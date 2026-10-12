"use client";

import { useReducedMotion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { SpeakerHighIcon, SpeakerSlashIcon } from "@/components/icons";
import { FOCUS } from "@/components/lab/controls";
import { Tooltip, TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { armDots, playLand, playPress, playShutter } from "./dot-sound";
import {
  cut,
  type Dot,
  type Geometry,
  inFlight,
  morph,
  type Panel,
  paint,
  progress,
  prune,
  type RGBA,
  retone,
} from "./dots";
import {
  type Action,
  type Clock,
  type Item,
  type Phase,
  rowCycle,
  type Scene,
  SHUTTER,
  scene,
  TALLEST,
  type Tone,
} from "./scenes";

/**
 * A recorder in a Dynamic Island, drawn on a dot-matrix panel. Every word,
 * icon and digit on it is lit cells on one grid, and a change of state is the
 * lit dots travelling to their places in the next one, ticking as they land.
 *
 * The grid belongs to the stage, not to the pill. The pill is a window onto
 * it that grows and shrinks on a spring, so a cell never moves: a dot in
 * flight can be anywhere, and a dot at rest is always on a cell.
 *
 * One canvas paints the slab, its unlit cells and its lit dots, and a second
 * paints the lit dots again for the page to blur into a bloom. Nothing renders
 * per frame: the phase and the stage's size are the only state, and the frame
 * loop asks the scene for what should be lit and moves the panel toward it.
 */

/**
 * The record dot's red, the one hue the island owns. It means recording and
 * nothing else, the way `halftone-ripple`'s pink means liked: the same dot in
 * the menu is white until it is pressed. 5.6:1 on `inverse-bg`. Scoped to this
 * experiment, not a token, and nothing else may reach for it.
 */
const REC = "#ff453a";

/** how long an ending holds before the island folds back to rest */
const HOLD = 1500;

/** the left-to-right sweep of a change of state, in ms */
const SPREAD = 180;

/**
 * The pill's spring, in cells. A damping ratio of 0.75, so a pill growing past
 * its size and settling back reads as something soft giving way, which is the
 * island's whole character, and a pill shrinking does the same in reverse.
 */
const SPRING = { k: 520, c: 34 };

/**
 * How long a shrinking pill holds its old size, as a share of the time the
 * slowest dot takes to land. A fixed wait was too short for the stopped menu:
 * the pill closed over its bottom row while that row's dots were still on
 * their way up, and the clip cut them off mid-flight.
 */
const SHRINK_HOLD = 0.6;

/** each phase's own name for the live region */
const SAYS: Record<Phase, string> = {
  idle: "",
  menu: "Menu open",
  rec: "Recording",
  stopped: "Recording paused",
  shot: "Taking a screenshot",
  saved: "Saved",
  deleted: "Recording deleted",
};

/** what a press on the compact pill does, as its accessible name */
const COMPACT: Record<Phase, string> = {
  idle: "Open the recorder",
  menu: "",
  rec: "Stop recording",
  stopped: "",
  shot: "Taking a screenshot",
  saved: "Saved. Close",
  deleted: "Deleted. Close",
};

const ROW_NAME: Record<Action, string> = {
  record: "Record",
  screenshot: "Screenshot",
  save: "Save recording",
  restart: "Restart recording",
  delete: "Delete recording",
};

function rgba(hex: string, a: number): RGBA {
  const h = hex.replace("#", "").trim();
  const n = Number.parseInt(
    h.length === 3
      ? h
          .split("")
          .map((c) => c + c)
          .join("")
      : h,
    16,
  );
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255, a];
}

/** css px per cell for a stage this wide, whole device pixels apart */
function geometry(w: number, h: number, dpr: number): Geometry {
  const raw = Math.min(5, Math.max(3, w / 112));
  const pitch = Math.round(raw * dpr) / dpr;
  return {
    pitch,
    cx: Math.round(w / 2),
    top: Math.max(20, Math.round((h - TALLEST * pitch) / 2)),
    dpr,
  };
}

const cellSig = (item: Item) => item.cells.map((c) => c.join(",")).join(";");
const toneSig = (item: Item) => item.tones.join(",");

const COMPACT_PHASES: Phase[] = ["idle", "rec", "shot", "saved", "deleted"];

export default function DotIsland() {
  const reduce = useReducedMotion();
  const [phase, setPhase] = useState<Phase>("idle");
  /** the stage's geometry, which the buttons are laid out from */
  const [layout, setLayout] = useState<Geometry | null>(null);
  const [sound, setSound] = useState(true);

  const stage = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const glowCanvas = useRef<HTMLCanvasElement>(null);
  const compact = useRef<HTMLButtonElement>(null);
  const rowEls = useRef<(HTMLButtonElement | null)[]>([]);

  const ctx = useRef<CanvasRenderingContext2D | null>(null);
  const glow = useRef<CanvasRenderingContext2D | null>(null);
  const geo = useRef<Geometry>({ pitch: 4, cx: 0, top: 20, dpr: 1 });
  const dims = useRef({ w: 0, h: 0 });

  const phaseRef = useRef<Phase>("idle");
  const phaseAt = useRef(0);
  const soundRef = useRef(true);
  const still = useRef(false);
  const visible = useRef(true);
  const palette = useRef<Record<Tone, RGBA> | null>(null);
  const ground = useRef("#0a0a0a");

  const dots = useRef<Dot[]>([]);
  const applied = useRef<{
    phase: Phase | null;
    sigs: Map<string, { cells: string; tones: string }>;
  }>({ phase: null, sigs: new Map() });
  /** the pill, in cells, and its velocity */
  const pill = useRef({ w: 0, h: 0, vw: 0, vh: 0 });
  /** the size the pill had before the last change, held while it shrinks */
  const hold = useRef({ w: 0, h: 0, until: 0 });

  /** the row under the pointer or the keyboard, and when it got there */
  const hover = useRef<number | null>(null);
  /**
   * Each row whose icon is playing: when the play began, and when it ends once
   * the hover has gone. A leaving hover finishes the loop it is in rather than
   * cutting to rest, so `until` is the end of that loop, and null while the
   * row is still hovered.
   */
  const plays = useRef(
    new Map<number, { start: number; until: number | null }>(),
  );
  const leaving = useRef(0);
  /** -1 for the compact pill, a row's index, or null */
  const pressed = useRef<number | null>(null);
  /** each row region's extra glow, eased, and the compact pill's */
  const levels = useRef<number[]>([]);
  const compactLevel = useRef(0);

  /** the recording: what it has run for, and when it last resumed */
  const recRun = useRef(0);
  const recFrom = useRef<number | null>(null);
  /** whether the last action came from the keyboard, which moves focus */
  const viaKey = useRef(false);

  const frame = useRef(0);
  const last = useRef(0);

  useEffect(() => {
    soundRef.current = sound;
  }, [sound]);

  /** the plays still running at `now`, as ms into each, dropping the ended ones */
  const playing = useCallback((now: number) => {
    const out = new Map<number, number>();
    for (const [row, play] of plays.current) {
      if (play.until !== null && now >= play.until) plays.current.delete(row);
      else out.set(row, Math.max(0, now - play.start));
    }
    return out;
  }, []);

  const sceneAt = useCallback(
    (now: number): Scene =>
      scene(phaseRef.current, {
        /*
         * A frame's timestamp is when the frame began, which can be a little
         * before a handler that ran inside it read the clock, so every age is
         * floored at zero rather than going briefly negative.
         */
        since: Math.max(0, now - phaseAt.current),
        now,
        hover: hover.current,
        plays: playing(now),
        elapsed:
          recRun.current +
          (recFrom.current === null ? 0 : Math.max(0, now - recFrom.current)),
        still: still.current,
      } satisfies Clock),
    [playing],
  );

  /* ── the frame loop ────────────────────────────────────── */

  const tick = useCallback(
    function loop(now: number) {
      frame.current = 0;
      const c = ctx.current;
      const gl = glow.current;
      const colors = palette.current;
      if (!c || !gl || !colors) return;
      const dt = Math.min(
        1 / 30,
        last.current ? (now - last.current) / 1000 : 0,
      );
      last.current = now;

      const s = sceneAt(now);
      const p = phaseRef.current;
      const instant = still.current;

      /* move the panel toward the scene */
      if (applied.current.phase !== p) {
        const first = applied.current.phase === null;
        dots.current = morph(dots.current, s.items, {
          now,
          palette: colors,
          spread: instant || first ? 0 : SPREAD,
          quiet: first,
        });
        if (instant || first) {
          for (const d of dots.current) {
            d.start = now;
            d.dur = 0;
            d.cStart = now - 1000;
            d.c0 = d.c1;
            d.ticks = false;
            d.landed = true;
          }
        }
        applied.current = {
          phase: p,
          sigs: new Map(
            s.items.map((i) => [
              i.key,
              { cells: cellSig(i), tones: toneSig(i) },
            ]),
          ),
        };
        hold.current = {
          w: pill.current.w,
          h: pill.current.h,
          until:
            now +
            SHRINK_HOLD *
              dots.current.reduce(
                (m, d) => Math.max(m, d.start + d.dur - now),
                0,
              ),
        };
        levels.current = s.rows.map(() => 0);
        if (first) {
          pill.current = { w: s.w, h: s.h, vw: 0, vh: 0 };
        }
      } else {
        for (const item of s.items) {
          const was = applied.current.sigs.get(item.key);
          const cells = cellSig(item);
          const tones = toneSig(item);
          if (!was || was.cells !== cells) {
            /* a flipbook frame waits for its dots to finish arriving */
            if (
              dots.current.some((d) => d.key === item.key && inFlight(d, now))
            )
              continue;
            dots.current =
              item.motion === "slide" && !instant
                ? morph(
                    dots.current,
                    [item],
                    { now, palette: colors, spread: 40, quiet: true },
                    new Set([item.key]),
                  )
                : cut(dots.current, item, now, colors);
            applied.current.sigs.set(item.key, { cells, tones });
          } else if (was.tones !== tones) {
            retone(dots.current, item, now, colors);
            was.tones = tones;
          }
        }
      }
      dots.current = prune(dots.current, now);

      /* the pill's spring, holding its old size a beat when it shrinks */
      const pl = pill.current;
      const holding = now < hold.current.until;
      const tw = holding ? Math.max(s.w, hold.current.w) : s.w;
      const th = holding ? Math.max(s.h, hold.current.h) : s.h;
      let springing = false;
      if (instant) {
        pl.w = s.w;
        pl.h = s.h;
        pl.vw = 0;
        pl.vh = 0;
      } else {
        const steps = Math.max(1, Math.ceil(dt / (1 / 120)));
        const h = dt / steps;
        for (let i = 0; i < steps; i++) {
          pl.vw += (SPRING.k * (tw - pl.w) - SPRING.c * pl.vw) * h;
          pl.vh += (SPRING.k * (th - pl.h) - SPRING.c * pl.vh) * h;
          pl.w += pl.vw * h;
          pl.h += pl.vh * h;
        }
        springing =
          holding ||
          Math.abs(pl.vw) + Math.abs(pl.vh) > 0.02 ||
          Math.abs(tw - pl.w) + Math.abs(th - pl.h) > 0.01;
        if (!springing) {
          pl.w = tw;
          pl.h = th;
          pl.vw = 0;
          pl.vh = 0;
        }
      }

      /* each row's glow, and the compact pill's, eased toward the hand */
      const k = 1 - Math.exp(-dt / 0.07);
      let easing = false;
      const halfW = (s.w - 1) / 2;
      const regions = s.rows.map((row, i) => {
        const goal =
          hover.current === i ? (pressed.current === i ? 0.16 : 0.08) : 0;
        const level = levels.current[i] ?? 0;
        const nextLevel = instant ? goal : level + (goal - level) * k;
        levels.current[i] =
          Math.abs(goal - nextLevel) < 0.001 ? goal : nextLevel;
        if (levels.current[i] !== goal) easing = true;
        return {
          x: row.x - halfW,
          y: row.y,
          w: row.w,
          h: row.h,
          level: levels.current[i],
        };
      });
      const compactGoal =
        pressed.current === -1 ? 0.07 : hover.current === -1 ? 0.03 : 0;
      compactLevel.current = instant
        ? compactGoal
        : compactLevel.current + (compactGoal - compactLevel.current) * k;
      if (Math.abs(compactGoal - compactLevel.current) < 0.001)
        compactLevel.current = compactGoal;
      else easing = true;

      /* ticks, as dots land */
      let flying = false;
      for (const d of dots.current) {
        if (d.landed) continue;
        if (progress(d, now) >= 1) {
          d.landed = true;
          if (d.ticks && soundRef.current)
            playLand((d.tx + pl.w / 2) / Math.max(1, pl.w));
        } else flying = true;
      }

      const panel: Panel = {
        base: 0.06 + compactLevel.current,
        regions,
        flash: s.flash,
      };
      const { w, h } = dims.current;
      paint(
        c,
        gl,
        w,
        h,
        dots.current,
        pl,
        geo.current,
        panel,
        ground.current,
        now,
      );

      /*
       * What keeps the loop running. The loader and the blink are flipbooks
       * that never stop on their own, so the idle and recording pills run at
       * the frame rate while they are on screen. Everything else runs only
       * while something is moving.
       */
      const animated =
        !instant &&
        (p === "idle" ||
          p === "rec" ||
          p === "shot" ||
          ((p === "menu" || p === "stopped") && plays.current.size > 0));
      const needs = flying || springing || easing || animated || s.flash > 0.01;
      if (needs && visible.current) frame.current = requestAnimationFrame(loop);
      else last.current = 0;
    },
    [sceneAt],
  );

  const kick = useCallback(() => {
    if (frame.current || !visible.current) return;
    frame.current = requestAnimationFrame(tick);
  }, [tick]);

  /* ── setup: the canvases, the tokens, visibility ───────── */

  useEffect(() => {
    const el = stage.current;
    const c = canvas.current;
    const g = glowCanvas.current;
    if (!el || !c || !g) return;
    ctx.current = c.getContext("2d");
    glow.current = g.getContext("2d");

    const root = getComputedStyle(document.documentElement);
    const token = (name: string) => root.getPropertyValue(name).trim();
    const text = token("--color-inverse-text") || "#fafafa";
    ground.current = token("--color-inverse-bg") || "#0a0a0a";
    palette.current = {
      on: rgba(text, 1),
      dim: rgba(text, 0.34),
      tail: rgba(text, 0.5),
      faint: rgba(text, 0.2),
      rec: rgba(REC, 1),
      recDim: rgba(REC, 0.28),
    };

    const resize = () => {
      const { width, height } = el.getBoundingClientRect();
      if (width < 1 || height < 1) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      for (const [canvasEl, context] of [
        [c, ctx.current],
        [g, glow.current],
      ] as const) {
        canvasEl.width = Math.round(width * dpr);
        canvasEl.height = Math.round(height * dpr);
        context?.setTransform(dpr, 0, 0, dpr, 0, 0);
      }
      dims.current = { w: width, h: height };
      geo.current = geometry(width, height, dpr);
      setLayout(geo.current);
      kick();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(el);

    /* the loader runs forever, so the loop stops while the stage is off screen */
    const io = new IntersectionObserver(([entry]) => {
      visible.current = entry.isIntersecting;
      if (visible.current) kick();
    });
    io.observe(el);

    return () => {
      ro.disconnect();
      io.disconnect();
      cancelAnimationFrame(frame.current);
      frame.current = 0;
    };
  }, [kick]);

  useEffect(() => {
    still.current = reduce ?? false;
    kick();
  }, [reduce, kick]);

  /* ── phases ────────────────────────────────────────────── */

  const go = useCallback(
    (next: Phase) => {
      const now = performance.now();
      phaseRef.current = next;
      phaseAt.current = now;
      hover.current = null;
      pressed.current = null;
      plays.current.clear();
      setPhase(next);
      kick();
    },
    [kick],
  );

  /* the endings hold, then fold back to rest, and the shutter hands over */
  useEffect(() => {
    if (phase === "shot") {
      const id = setTimeout(() => go("saved"), SHUTTER + 420);
      const flash = setTimeout(() => {
        if (soundRef.current) playShutter();
      }, SHUTTER);
      return () => {
        clearTimeout(id);
        clearTimeout(flash);
      };
    }
    if (phase === "saved" || phase === "deleted") {
      const id = setTimeout(() => go("idle"), HOLD);
      return () => clearTimeout(id);
    }
    if (phase === "rec") {
      /* under reduced motion nothing else wakes the loop for the timer */
      const id = setInterval(kick, 250);
      return () => clearInterval(id);
    }
  }, [phase, go, kick]);

  /* a keyboard action hands focus to whatever the new phase is pressed by */
  useEffect(() => {
    if (!viaKey.current) return;
    viaKey.current = false;
    if (phase === "menu" || phase === "stopped") rowEls.current[0]?.focus();
    else compact.current?.focus();
  }, [phase]);

  const startRec = () => {
    recRun.current = 0;
    recFrom.current = performance.now();
    go("rec");
  };

  const pauseRec = () => {
    const now = performance.now();
    if (recFrom.current !== null) recRun.current += now - recFrom.current;
    recFrom.current = null;
  };

  const resumeRec = useCallback(() => {
    recFrom.current = performance.now();
    go("rec");
  }, [go]);

  const pressCompact = (key: boolean) => {
    viaKey.current = key;
    if (soundRef.current) playPress();
    const p = phaseRef.current;
    if (p === "idle") go("menu");
    else if (p === "rec") {
      pauseRec();
      go("stopped");
    } else if (p === "saved" || p === "deleted") go("idle");
  };

  const pressRow = (action: Action, key: boolean) => {
    viaKey.current = key;
    if (soundRef.current) playPress();
    switch (action) {
      case "record":
      case "restart":
        startRec();
        break;
      case "screenshot":
        go("shot");
        break;
      case "save":
        recFrom.current = null;
        go("saved");
        break;
      case "delete":
        recFrom.current = null;
        recRun.current = 0;
        go("deleted");
        break;
    }
  };

  /** close an open menu: the first one to rest, the second back to recording */
  const close = useCallback(() => {
    const p = phaseRef.current;
    if (p === "menu") go("idle");
    else if (p === "stopped") resumeRec();
  }, [go, resumeRec]);

  /*
   * Escape closes a menu from anywhere on the page, `island-menu`'s call. A
   * mouse press on the compact pill unmounts the button it focused, so focus is
   * on the page by then and a test for focus inside the demo would miss it.
   */
  useEffect(() => {
    if (phase !== "menu" && phase !== "stopped") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      viaKey.current = stage.current?.contains(document.activeElement) ?? false;
      close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, close]);

  /*
   * A press on the bare stage closes a menu. Bound to the node rather than
   * written as a prop, the call `stamp-collection` makes for its table: the
   * stage is a region the pointer passes through and has no role to carry.
   * Anything inside a button is the island's, everything else is the stage.
   */
  useEffect(() => {
    const el = stage.current;
    if (!el) return;
    const onDown = () => armDots();
    const onClick = (e: MouseEvent) => {
      if ((e.target as Element).closest("button")) return;
      viaKey.current = false;
      close();
    };
    el.addEventListener("pointerdown", onDown);
    el.addEventListener("click", onClick);
    return () => {
      el.removeEventListener("pointerdown", onDown);
      el.removeEventListener("click", onClick);
    };
  }, [close]);

  /* ── hover and press ───────────────────────────────────── */

  /** a hover has left row `i`: its play runs to the end of the loop it is in */
  const finish = (i: number) => {
    const play = plays.current.get(i);
    if (!play || play.until !== null) return;
    const now = performance.now();
    const cycle = rowCycle(phaseRef.current, i);
    play.until = cycle
      ? play.start + Math.ceil((now - play.start) / cycle) * cycle
      : now;
  };

  const enter = (i: number) => {
    cancelAnimationFrame(leaving.current);
    leaving.current = 0;
    const was = hover.current;
    /* crossing straight to another row cancels that row's pending leave, so
       it is finished here instead */
    if (was !== null && was >= 0 && was !== i) finish(was);
    const now = performance.now();
    const play = plays.current.get(i);
    /* back on a row still finishing its loop: carry on from where it is */
    if (play && (play.until === null || now < play.until)) play.until = null;
    else plays.current.set(i, { start: now, until: null });
    hover.current = i;
    kick();
  };

  /* a leave waits a frame, so crossing from one row to the next is no dip */
  const leave = (i: number) => {
    cancelAnimationFrame(leaving.current);
    leaving.current = requestAnimationFrame(() => {
      leaving.current = 0;
      if (hover.current === i) {
        hover.current = null;
        finish(i);
      }
      if (pressed.current === i) pressed.current = null;
      kick();
    });
  };

  const hovers = (e: React.PointerEvent) =>
    e.pointerType === "mouse" || e.pointerType === "pen";

  /* ── layout for the buttons, from the scene the phase is heading to ── */

  const target = layout
    ? scene(phase, {
        since: 0,
        now: 0,
        hover: null,
        plays: new Map(),
        elapsed: 0,
        still: true,
      })
    : null;
  const g = layout;
  const box =
    target && g
      ? {
          left: g.cx - (target.w * g.pitch) / 2,
          top: g.top,
          width: target.w * g.pitch,
          height: target.h * g.pitch,
        }
      : null;
  const isCompact = COMPACT_PHASES.includes(phase);

  const rowKeys = (e: React.KeyboardEvent, i: number, count: number) => {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    e.preventDefault();
    const next = (i + (e.key === "ArrowDown" ? 1 : count - 1)) % count;
    rowEls.current[next]?.focus();
  };

  return (
    <div
      ref={stage}
      className="relative aspect-8/5 min-h-78 w-full select-none overflow-hidden rounded-lg bg-fill ring-1 ring-stroke ring-inset"
    >
      <canvas
        ref={canvas}
        className="pointer-events-none absolute inset-0 size-full"
      />
      {/* the bloom: the lit dots again, blurred and screened over the slab */}
      <canvas
        ref={glowCanvas}
        className="pointer-events-none absolute inset-0 size-full opacity-80 mix-blend-screen blur-[5px]"
      />

      {box && isCompact && (
        <button
          ref={compact}
          key="compact"
          type="button"
          aria-label={COMPACT[phase]}
          aria-disabled={phase === "shot"}
          onClick={(e) => pressCompact(e.detail === 0)}
          onPointerEnter={(e) => {
            if (hovers(e)) {
              hover.current = -1;
              kick();
            }
          }}
          onPointerLeave={() => {
            if (hover.current === -1) hover.current = null;
            if (pressed.current === -1) pressed.current = null;
            kick();
          }}
          onPointerDown={() => {
            pressed.current = -1;
            kick();
          }}
          onPointerUp={() => {
            pressed.current = null;
            kick();
          }}
          className={cn(
            "absolute cursor-pointer rounded-full outline-none",
            "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-text-primary/30",
            phase === "shot" && "cursor-default",
          )}
          style={box}
        />
      )}

      {box && target && !isCompact && (
        <fieldset
          aria-label={phase === "menu" ? "Recorder" : "Recording paused"}
          className="absolute m-0 min-w-0 border-0 p-0"
          style={box}
        >
          {target.rows.map((row, i) => (
            <button
              key={row.action}
              ref={(el) => {
                rowEls.current[i] = el;
              }}
              type="button"
              aria-label={ROW_NAME[row.action]}
              onClick={(e) => pressRow(row.action, e.detail === 0)}
              onKeyDown={(e) => rowKeys(e, i, target.rows.length)}
              onFocus={() => enter(i)}
              onBlur={() => leave(i)}
              onPointerEnter={(e) => {
                if (hovers(e)) enter(i);
              }}
              onPointerLeave={(e) => {
                if (hovers(e)) leave(i);
              }}
              onPointerDown={() => {
                pressed.current = i;
                kick();
              }}
              onPointerUp={() => {
                pressed.current = null;
                kick();
              }}
              className={cn(
                "absolute cursor-pointer rounded-lg outline-none",
                "focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-inverse-text/40",
              )}
              style={
                g
                  ? {
                      left: row.x * g.pitch,
                      top: row.y * g.pitch,
                      width: row.w * g.pitch,
                      height: row.h * g.pitch,
                    }
                  : undefined
              }
            />
          ))}
        </fieldset>
      )}

      <TooltipProvider delayDuration={200}>
        <div className="absolute right-3 bottom-3">
          <Tooltip label={sound ? "Mute" : "Unmute"}>
            <button
              type="button"
              aria-label={sound ? "Mute" : "Unmute"}
              onClick={() => setSound((s) => !s)}
              className={cn(
                "flex size-7 cursor-pointer items-center justify-center rounded-full bg-fill-hover text-text-secondary transition-colors duration-200 hover:bg-fill-active hover:text-text-primary active:bg-stroke-strong",
                FOCUS,
                "focus-visible:ring-offset-fill",
              )}
            >
              {sound ? (
                <SpeakerHighIcon aria-hidden="true" className="size-3.5" />
              ) : (
                <SpeakerSlashIcon aria-hidden="true" className="size-3.5" />
              )}
            </button>
          </Tooltip>
        </div>
      </TooltipProvider>

      <span role="status" className="sr-only">
        {SAYS[phase]}
      </span>
    </div>
  );
}
