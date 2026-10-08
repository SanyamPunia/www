"use client";

import {
  ArrowCounterClockwiseIcon,
  ArrowRightIcon,
  SpeakerHighIcon,
  SpeakerSlashIcon,
} from "@phosphor-icons/react";
import { useInView, useReducedMotion } from "motion/react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Pill } from "@/components/lab/controls";
import { Tooltip, TooltipProvider } from "@/components/ui/tooltip";
import { dry, fresh, inkTo, type Progress } from "./ink";
import { grid, type Line, type Plan, plan } from "./layout";
import { NOTES, plain } from "./notes";
import { closePen, movePen, openPen, touchPen } from "./pen-sound";

/*
 * A note written out by hand, a stroke at a time, and a pen that goes back over
 * it: once the hand has finished a marked run, the pen circles, underlines,
 * strikes or highlights it, and the hand waits for most of that stroke before
 * it writes on.
 *
 * Nothing here is a font being revealed. The hand is a single-line font, so
 * every letter is the path a nib takes, and the page is two canvases the pen
 * draws onto as its clock runs: the marker underneath, the ink on top.
 */

/**
 * The sheet: a warm off-white, scoped here and not a token, since paper is the
 * object and a page of pure white reads as a screen.
 */
const PAPER = "#fcfbf7";

/*
 * The paper's texture, two noise tiles that can only darken. Each turns its
 * noise into a colour at an alpha that is zero below the noise's middle, so the
 * sheet keeps its tone and only gains patches and specks, where a plain noise
 * at low opacity greys the whole page.
 *
 * The mottle is large and soft and barely warm, the slow unevenness of a
 * real sheet, on a tile wide enough that the repeat never lands inside the
 * stage. The tooth is fine and laid over the ink as well, so the ink has it too.
 */
const MOTTLE = `url("data:image/svg+xml,%3Csvg viewBox='0 0 640 640' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='m'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.005 0.009' numOctaves='4' seed='7' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 0.5 0 0 0 0 0.47 0 0 0 0 0.42 1.8 0 0 0 -0.85'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23m)'/%3E%3C/svg%3E")`;
const GRAIN = `url("data:image/svg+xml,%3Csvg viewBox='0 0 160 160' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='g'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 0.2 0 0 0 0 0.18 0 0 0 0 0.15 2.4 0 0 0 -1.2'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23g)'/%3E%3C/svg%3E")`;

/** how long fresh ink stays wet, ms, plus up to this much again */
const WET = 650;
const WET_SPREAD = 350;

/** the room kept clear under the text for the controls, px */
const FOOT = 52;

/** how far under a baseline its ruled line sits, ems */
const RULE = 0.1;

/** the box the note is written in, and the em the hand is set at */
function measure(box: { w: number; h: number }) {
  const pad = box.w * 0.09;
  const width = box.w - 2 * pad;
  return {
    area: { left: pad, top: box.w * 0.03, width, height: box.h - FOOT },
    size: Math.min(32, Math.max(22, width * 0.07)),
  };
}

interface Run {
  plan: Plan;
  prog: Progress[];
  /** when the note started, on the page's clock */
  t0: number;
  key: string;
  last: number;
  /** the stroke the pen was on last frame, for the landing click */
  pen: Line | null;
}

export default function ScribbleType() {
  const reduce = useReducedMotion();
  const stage = useRef<HTMLDivElement>(null);
  const page = useRef<HTMLDivElement>(null);
  const marker = useRef<HTMLCanvasElement>(null);
  const ink = useRef<HTMLCanvasElement>(null);
  const run = useRef<Run | null>(null);
  const sound = useRef(false);

  const seen = useInView(stage, { once: true, amount: 0.5 });
  const [note, setNote] = useState(0);
  const [take, setTake] = useState(0);
  const [box, setBox] = useState<{ w: number; h: number } | null>(null);
  const [loud, setLoud] = useState(false);

  useEffect(() => {
    const node = stage.current;
    if (!node) return;
    const observer = new ResizeObserver(([entry]) =>
      setBox({ w: entry.contentRect.width, h: entry.contentRect.height }),
    );
    observer.observe(node);
    return () => {
      observer.disconnect();
      closePen();
    };
  }, []);

  // the ruled lines, from the stage alone, so they never move with the note
  useLayoutEffect(() => {
    const node = stage.current;
    if (!node) return;
    const rect = node.getBoundingClientRect();
    const { area, size } = measure(box ?? { w: rect.width, h: rect.height });
    const { leading, origin } = grid(area, size);
    const y = (origin + RULE * size) % leading;
    node.style.backgroundSize = `100% ${leading}px`;
    node.style.backgroundPositionY = `${y}px`;
  }, [box]);

  /*
   * The writing. A new note or a replay starts the clock again, and a resize
   * keeps it: the note is laid out at the new width and everything the pen had
   * written by now is put straight back down, so the hand carries on where it
   * was.
   */
  useEffect(() => {
    const node = stage.current;
    const wrap = page.current;
    const under = marker.current;
    const over = ink.current;
    if (!seen || !box || !node || !wrap || !under || !over) return;

    const { area, size } = measure(box);
    const key = `${note}:${take}`;
    const laid = plan(NOTES[note], area, size, `note-${note}`);

    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const [mctx, ictx] = [under, over].map((c) => {
      c.width = Math.round(box.w * dpr);
      c.height = Math.round(box.h * dpr);
      const ctx = c.getContext("2d");
      ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
      return ctx;
    });
    if (!mctx || !ictx) return;

    const prev = run.current;
    const now = performance.now();
    const state: Run = {
      plan: laid,
      prog: laid.lines.map(fresh),
      t0: prev && prev.key === key ? prev.t0 : now,
      key,
      last: now,
      pen: null,
    };
    run.current = state;
    for (const a of wrap.getAnimations()) a.cancel();

    const paint = (t: number, dt: number) => {
      let lead: Line | null = null;
      let moved = 0;
      laid.lines.forEach((line, k) => {
        const p = state.prog[k];
        if (p.done) {
          if (!p.dried && line.dry && t >= p.dryAt) {
            dry(ictx, line);
            p.dried = true;
          }
          return;
        }
        if (t < line.start) return;
        const f = line.ease(Math.min(1, (t - line.start) / line.dur));
        const travelled = inkTo(
          line.kind === "marker" ? mctx : ictx,
          line,
          p,
          f,
        );
        if (f >= 1) {
          p.done = true;
          p.dryAt = line.start + line.dur + WET + Math.random() * WET_SPREAD;
        } else if (!lead || line.start > lead.start) {
          lead = line;
          moved = travelled;
        }
      });

      if (!sound.current) return;
      const pen = lead as Line | null;
      if (pen && pen !== state.pen) touchPen(pen.kind);
      state.pen = pen;
      movePen(pen?.kind ?? null, dt > 0 ? moved / dt / laid.speed : 0);
    };

    if (reduce) {
      // twice, since ink only dries on the pass after it is finished
      paint(Number.POSITIVE_INFINITY, 0);
      paint(Number.POSITIVE_INFINITY, 0);
      return;
    }

    let raf = 0;
    const frame = (stamp: number) => {
      const t = stamp - state.t0;
      paint(t, stamp - state.last);
      state.last = stamp;
      if (t < laid.end + WET + WET_SPREAD + 100) {
        raf = requestAnimationFrame(frame);
      } else movePen(null, 0);
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      movePen(null, 0);
    };
  }, [seen, box, note, take, reduce]);

  /**
   * Clear the page, then write a note from its first stroke. Going to the next
   * note slides the old one 2px left as it fades, which is forward in reading
   * order: the button points right, so the page moves left, as a carousel does.
   * A rewrite of the same note only fades, since it is the same page.
   *
   * Both are quick and front-loaded, since the press is asking for the next
   * note and the old one is only in the way.
   */
  const restart = (next: number) => {
    if (sound.current) openPen();
    const wrap = page.current;
    const go = () => {
      setNote(next);
      setTake((n) => n + 1);
    };
    if (!wrap || reduce) return go();
    const onward = next !== note;
    wrap
      .animate(
        onward
          ? [
              { opacity: 1, transform: "translateX(0)" },
              { opacity: 0, transform: "translateX(-2px)" },
            ]
          : [{ opacity: 1 }, { opacity: 0 }],
        {
          duration: onward ? 140 : 120,
          easing: "cubic-bezier(0.23, 1, 0.32, 1)",
          fill: "forwards",
        },
      )
      .finished.then(go, () => {});
  };

  const toggleSound = () => {
    const on = !sound.current;
    sound.current = on;
    setLoud(on);
    if (on) openPen();
    else closePen();
  };

  const soundLabel = loud ? "Turn the sound off" : "Turn the sound on";

  return (
    <TooltipProvider delayDuration={200}>
      <div
        ref={stage}
        className="relative aspect-8/5 min-h-80 w-full select-none overflow-hidden rounded-lg ring-1 ring-stroke ring-inset"
        style={{
          backgroundColor: PAPER,
          // ruled paper, spaced and phased by the stage before the first paint
          backgroundImage:
            "linear-gradient(to bottom, var(--color-stroke) 1px, transparent 1px)",
        }}
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-6"
          style={{ backgroundImage: MOTTLE, backgroundSize: "640px" }}
        />
        <div ref={page} aria-hidden="true" className="absolute inset-0">
          <canvas
            ref={marker}
            className="absolute inset-0 size-full mix-blend-multiply"
          />
          <canvas ref={ink} className="absolute inset-0 size-full" />
        </div>
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-12"
          style={{ backgroundImage: GRAIN, backgroundSize: "160px" }}
        />

        <p className="sr-only">{plain(NOTES[note])}</p>

        <div className="absolute right-3 bottom-3 flex gap-2">
          <Tooltip label={soundLabel}>
            <Pill
              icon
              label={soundLabel}
              aria-pressed={loud}
              onClick={toggleSound}
            >
              {loud ? (
                <SpeakerHighIcon
                  aria-hidden="true"
                  className="size-3.5 shrink-0"
                />
              ) : (
                <SpeakerSlashIcon
                  aria-hidden="true"
                  className="size-3.5 shrink-0"
                />
              )}
            </Pill>
          </Tooltip>
          <Tooltip label="Write it again">
            <Pill icon label="Write it again" onClick={() => restart(note)}>
              <ArrowCounterClockwiseIcon
                aria-hidden="true"
                className="size-3.5 shrink-0"
              />
            </Pill>
          </Tooltip>
          <Tooltip label="Next note">
            <Pill
              icon
              label="Next note"
              onClick={() => restart((note + 1) % NOTES.length)}
            >
              <ArrowRightIcon
                aria-hidden="true"
                className="size-3.5 shrink-0"
              />
            </Pill>
          </Tooltip>
        </div>
      </div>
    </TooltipProvider>
  );
}
