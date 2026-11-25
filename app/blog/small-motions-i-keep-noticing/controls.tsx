"use client";

import { motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { Frame, KNOB, RAISED, WELL } from "@/components/blogs/frame";
import { PauseIcon, PlayIcon } from "@/components/icons";
import { CopyMark } from "@/components/ui/copy-mark";
import { Tooltip, TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

/*
 * The demos for the controls in the post: the switch that stretches, the
 * progress bar that grows, the label that scrubs and the copy icon.
 */

/* ----------------------------------------------------------------- switch */

/**
 * The track, the thumb, and how far the thumb stretches while pressed, in px.
 * They are set inline rather than as `w-*` and `h-*`, since `--spacing` is
 * 0.2rem here and the classes would not match the arithmetic.
 */
const TRACK = 56;
const HEIGHT = 32;
const PAD = 2;
const THUMB = HEIGHT - PAD * 2;
const STRETCH = 7;

const THUMB_SPRING = {
  type: "spring",
  visualDuration: 0.25,
  bounce: 0.15,
} as const;

/**
 * The thumb widens toward the side it is going to while the press is held,
 * and the value changes on the release. A native `click` only fires when the
 * press ends over the button, so dragging off and letting go cancels for free.
 */
export function SwitchDemo() {
  const [on, setOn] = useState(false);
  const [pressed, setPressed] = useState(false);

  const width = THUMB + (pressed ? STRETCH : 0);
  const x = on ? TRACK - PAD - width : PAD;

  return (
    <Frame hint="Press and hold the switch." className="items-center">
      <div className={cn("flex items-center gap-4 rounded-lg p-5", RAISED)}>
        <span className="text-body text-text-primary">Airplane mode</span>
        <button
          type="button"
          role="switch"
          aria-checked={on}
          aria-label="Airplane mode"
          onPointerDown={(e) => {
            if (e.button === 0) setPressed(true);
          }}
          onPointerUp={() => setPressed(false)}
          onPointerLeave={() => setPressed(false)}
          onPointerCancel={() => setPressed(false)}
          onKeyDown={(e) => {
            if (e.key === " ") setPressed(true);
          }}
          onKeyUp={() => setPressed(false)}
          onBlur={() => setPressed(false)}
          onClick={() => setOn((v) => !v)}
          className={cn(
            "relative shrink-0 cursor-pointer touch-none rounded-full shadow-[inset_0_1px_2px_rgb(0_0_0/0.12)] transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-primary/15 focus-visible:ring-offset-2",
            on ? "bg-text-primary" : "bg-fill-active",
          )}
          style={{ width: TRACK, height: HEIGHT }}
        >
          <motion.span
            aria-hidden="true"
            initial={false}
            animate={{ x, width }}
            transition={THUMB_SPRING}
            className="absolute left-0 block rounded-full bg-bg shadow-[0_1px_2px_rgb(0_0_0/0.18),0_3px_8px_-2px_rgb(0_0_0/0.2)]"
            style={{ top: PAD, height: THUMB }}
          />
        </button>
      </div>
    </Frame>
  );
}

/* ----------------------------------------------------------- progress bar */

const LENGTH = 250;

function clock(seconds: number): string {
  const s = Math.round(seconds);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/**
 * Thin while it only reports, thick with a knob while it is being aimed at.
 * The hit area is taller than the bar at both sizes, so growing it never moves
 * the region that decides whether it is hovered.
 */
export function ProgressDemo() {
  const [value, setValue] = useState(0.34);
  const [near, setNear] = useState(false);
  const [held, setHeld] = useState(false);
  const [playing, setPlaying] = useState(false);
  const area = useRef<HTMLDivElement>(null);
  const live = near || held;

  /* a quarter second of playback every quarter second, paused while a hand
     holds the bar, and stopped at the end */
  useEffect(() => {
    if (!playing || held) return;
    const id = setInterval(() => {
      setValue((v) => {
        const next = Math.min(1, v + 0.25 / LENGTH);
        if (next >= 1) setPlaying(false);
        return next;
      });
    }, 250);
    return () => clearInterval(id);
  }, [playing, held]);

  const seek = (clientX: number) => {
    const r = area.current?.getBoundingClientRect();
    if (!r) return;
    setValue(Math.max(0, Math.min(1, (clientX - r.left) / r.width)));
  };

  return (
    <Frame hint="Hover the bar, then drag it." className="items-center">
      <TooltipProvider delayDuration={200}>
        <div
          className={cn(
            "flex w-full max-w-110 flex-col gap-4 rounded-lg p-5",
            RAISED,
          )}
        >
          <div className="flex items-center gap-3">
            {/* the episode's cover, a scoped hue: the picture is the subject's */}
            {/* the cover stands on the card: a contact line, a cast and a
              sheen across the top, the way a printed square catches light */}
            <span
              aria-hidden="true"
              className="relative size-14 shrink-0 overflow-hidden rounded-md shadow-[0_0_0_1px_rgb(0_0_0/0.08),0_1px_2px_rgb(0_0_0/0.16),0_6px_14px_-4px_rgb(0_0_0/0.28)]"
              style={{
                background:
                  "radial-gradient(circle at 70% 30%, #ffd59e, transparent 45%), linear-gradient(160deg, #3f6fb5, #1d2f5c)",
              }}
            >
              <span className="absolute inset-0 bg-[linear-gradient(180deg,rgb(255_255_255/0.28),transparent_45%)]" />
            </span>
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-body text-text-primary">
                Episode 12, the harbour
              </span>
              <span className="truncate text-meta text-text-muted">
                Slow radio
              </span>
            </div>
            <Tooltip label={playing ? "Pause" : "Play"}>
              <button
                type="button"
                aria-label={playing ? "Pause" : "Play"}
                onClick={() => {
                  if (value >= 1) setValue(0);
                  setPlaying((p) => !p);
                }}
                className={cn(
                  "grid size-10 shrink-0 cursor-pointer place-items-center rounded-full transition-[filter] duration-150 hover:brightness-125 active:brightness-90 active:duration-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-primary/15 focus-visible:ring-offset-2",
                  KNOB,
                )}
                style={{ color: "#fff" }}
              >
                {playing ? (
                  <PauseIcon aria-hidden="true" className="size-5" />
                ) : (
                  <PlayIcon aria-hidden="true" className="size-5" />
                )}
              </button>
            </Tooltip>
          </div>
          <div className="flex flex-col gap-1">
            <div
              ref={area}
              role="slider"
              tabIndex={0}
              aria-label="Playback position"
              aria-valuemin={0}
              aria-valuemax={LENGTH}
              aria-valuenow={Math.round(value * LENGTH)}
              aria-valuetext={clock(value * LENGTH)}
              onPointerEnter={(e) => {
                if (e.pointerType !== "touch") setNear(true);
              }}
              onPointerLeave={() => setNear(false)}
              onPointerDown={(e) => {
                e.currentTarget.setPointerCapture(e.pointerId);
                setHeld(true);
                seek(e.clientX);
              }}
              onPointerMove={(e) => {
                if (held) seek(e.clientX);
              }}
              onPointerUp={() => setHeld(false)}
              onPointerCancel={() => setHeld(false)}
              onFocus={() => setNear(true)}
              onBlur={() => setNear(false)}
              onKeyDown={(e) => {
                const step =
                  e.key === "ArrowRight" ? 5 : e.key === "ArrowLeft" ? -5 : 0;
                if (!step) return;
                e.preventDefault();
                setValue((v) => Math.max(0, Math.min(1, v + step / LENGTH)));
              }}
              className="group/bar relative flex h-6 cursor-pointer touch-none items-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-primary/15"
            >
              <div
                className={cn(
                  "relative w-full overflow-hidden rounded-full transition-[height] duration-150 ease-out",
                  WELL,
                  live ? "h-2" : "h-1",
                )}
              >
                {/* the filled part is lit from the top, so it reads as a bar
                  lying in the slot */}
                <div
                  className="h-full rounded-full bg-[linear-gradient(180deg,var(--color-text-secondary),var(--color-text-primary))] shadow-[inset_0_1px_0_rgb(255_255_255/0.18)]"
                  style={{ width: `${value * 100}%` }}
                />
              </div>
              <span
                aria-hidden="true"
                className={cn(
                  "-translate-x-1/2 absolute top-1/2 size-3.5 -mt-1.75 rounded-full transition-[scale] duration-150 ease-out",
                  KNOB,
                  live ? "scale-100" : "scale-0",
                )}
                style={{ left: `${value * 100}%` }}
              />
            </div>
            {/* elapsed under the start of the bar and the length under its end,
            the way a player sets them, so a long title never shares a row */}
            <div className="flex justify-between font-mono text-meta text-text-muted tabular-nums">
              <span>{clock(value * LENGTH)}</span>
              <span>{clock(LENGTH)}</span>
            </div>
          </div>
        </div>
      </TooltipProvider>
    </Frame>
  );
}

/* ------------------------------------------------------------ label scrub */

type Field = "x" | "w" | "r";

const FIELDS: Record<
  Field,
  { label: string; name: string; min: number; max: number }
> = {
  x: { label: "X", name: "Position", min: 0, max: 160 },
  w: { label: "W", name: "Width", min: 40, max: 200 },
  r: { label: "R", name: "Corner radius", min: 0, max: 40 },
};

function clamp(f: Field, v: number): number {
  return Math.round(Math.max(FIELDS[f].min, Math.min(FIELDS[f].max, v)));
}

/**
 * A number field whose label is a handle. The field stays a text box for an
 * exact value, and the label drags for a rough one: a pixel of hand is one
 * unit, ten with Shift. The cursor belongs to the page while a drag runs,
 * through `data-scrub` on `<html>`, since the hand leaves the label at once.
 */
export function ScrubDemo() {
  const [values, setValues] = useState<Record<Field, number>>({
    x: 40,
    w: 120,
    r: 12,
  });
  const [text, setText] = useState<Record<Field, string> | null>(null);
  const drag = useRef<{ field: Field; raw: number } | null>(null);

  useEffect(
    () => () => {
      delete document.documentElement.dataset.scrub;
    },
    [],
  );

  const set = (f: Field, v: number) =>
    setValues((cur) => ({ ...cur, [f]: clamp(f, v) }));
  const w = values.w * 0.9;

  return (
    <Frame
      hint="Drag a label. Shift goes faster."
      className="items-center gap-8"
    >
      <div
        className={cn(
          "relative h-28 w-full max-w-90 overflow-hidden rounded-lg",
          WELL,
        )}
      >
        <div
          className="absolute top-1/2 h-14 -translate-y-1/2 bg-text-primary"
          style={{
            left: 12 + values.x * 0.4,
            width: w,
            borderRadius: values.r,
          }}
        />
      </div>
      <div className="flex flex-wrap justify-center gap-3">
        {(Object.keys(FIELDS) as Field[]).map((f) => (
          <div
            key={f}
            className={cn(
              "flex w-28 items-center gap-1 rounded-[0.5rem] p-1",
              RAISED,
            )}
          >
            <span
              aria-hidden="true"
              onPointerDown={(e) => {
                if (e.button !== 0) return;
                e.preventDefault();
                e.currentTarget.setPointerCapture(e.pointerId);
                drag.current = { field: f, raw: values[f] };
                document.documentElement.dataset.scrub = "true";
              }}
              onPointerMove={(e) => {
                const d = drag.current;
                if (!d || d.field !== f) return;
                d.raw += e.movementX * (e.shiftKey ? 10 : 1);
                d.raw = Math.max(FIELDS[f].min, Math.min(FIELDS[f].max, d.raw));
                set(f, d.raw);
              }}
              onPointerUp={() => {
                drag.current = null;
                delete document.documentElement.dataset.scrub;
              }}
              onPointerCancel={() => {
                drag.current = null;
                delete document.documentElement.dataset.scrub;
              }}
              className="grid h-8 w-7 shrink-0 cursor-ew-resize touch-none place-items-center rounded-md font-mono text-meta text-text-muted normal-case transition-colors duration-150 hover:bg-fill hover:text-text-primary"
            >
              {FIELDS[f].label}
            </span>
            <input
              aria-label={FIELDS[f].name}
              inputMode="numeric"
              value={text?.[f] ?? String(values[f])}
              onFocus={() =>
                setText({
                  x: String(values.x),
                  w: String(values.w),
                  r: String(values.r),
                })
              }
              onChange={(e) => {
                const raw = e.target.value;
                setText((t) => (t ? { ...t, [f]: raw } : t));
                const n = Number(raw);
                if (raw !== "" && Number.isFinite(n)) set(f, n);
              }}
              onBlur={() => setText(null)}
              onKeyDown={(e) => {
                const step =
                  e.key === "ArrowUp" ? 1 : e.key === "ArrowDown" ? -1 : 0;
                if (!step) return;
                e.preventDefault();
                const next = clamp(f, values[f] + step * (e.shiftKey ? 10 : 1));
                set(f, next);
                setText((t) => (t ? { ...t, [f]: String(next) } : t));
              }}
              className="h-8 w-full min-w-0 rounded-md bg-transparent px-2 font-mono text-body text-text-primary tabular-nums transition-all duration-200 focus-visible:bg-fill focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-primary/15"
            />
          </div>
        ))}
      </div>
    </Frame>
  );
}

/* ------------------------------------------------------------------- copy */

const COMMAND = "pnpm add motion";

/**
 * The copy icon swaps to a tick for two seconds in the place the reader was
 * already looking, through the site's own `CopyMark`, and the button keeps
 * its size, so nothing else moves.
 */
export function CopyDemo() {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(COMMAND);
    } catch {
      /* the command is on screen, so a refused clipboard still confirms */
    }
    setCopied(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Frame hint="Copy the command." className="items-center">
      <TooltipProvider delayDuration={200}>
        <div
          className={cn("flex items-center gap-1 rounded-[0.5rem] p-1", RAISED)}
        >
          <code className="px-3 font-mono text-body text-text-primary">
            {COMMAND}
          </code>
          <Tooltip label={copied ? "Copied" : "Copy command"}>
            <button
              type="button"
              onClick={copy}
              aria-label={copied ? "Copied" : "Copy command"}
              className="grid size-8 cursor-pointer place-items-center rounded-md text-text-secondary transition-colors duration-150 hover:bg-fill hover:text-text-primary active:bg-fill-hover active:duration-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-primary/15"
            >
              <CopyMark mark="copy" copied={copied} />
            </button>
          </Tooltip>
          <span aria-live="polite" className="sr-only">
            {copied ? "Copied to the clipboard" : ""}
          </span>
        </div>
      </TooltipProvider>
    </Frame>
  );
}
