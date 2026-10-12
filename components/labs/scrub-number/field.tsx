"use client";

import {
  ArrowsOutLineHorizontalIcon,
  ArrowsOutLineVerticalIcon,
  LinkSimpleBreakIcon,
  LinkSimpleIcon,
  TextAaIcon,
  TextBIcon,
} from "@phosphor-icons/react";
import { animate, motion, useMotionValue } from "motion/react";
import { type ComponentType, useEffect, useId, useRef, useState } from "react";
import { Tooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { fitCanvas, type Ink, paintRuler, readInk } from "./ruler";
import {
  advance,
  type Bounds,
  band,
  begin,
  COAST,
  type Detent,
  evaluate,
  fit,
  format,
  formatDelta,
  GEAR,
  type Gear,
  gearOf,
  type Key,
  precisionOf,
  REST,
  type Scrub,
  type Spec,
  stepOf,
  THROW,
} from "./scrub";
import { armScrub, playDetent, playLimit, playStep } from "./scrub-sound";

export type AutoState = "on" | "off" | "mixed";

/** What x-ray reads out about the scrub in flight. */
export interface Xray {
  key: Key;
  mode: "scrub" | "coast";
  hand: number;
  down: number;
  rate: number;
  gain: number;
  raw: number;
  value: number;
  hold: number;
  over: number;
  speed: number;
  mixed: boolean;
}

/** What a field asks of the panel it sits in. */
export interface Panel {
  /** this field's value on every selected word, in order */
  read(key: Key): number[];
  /** set the selected words, one value each */
  write(key: Key, values: number[], how: "jump" | "glide"): void;
  /** where this field sticks for the first selected word */
  detents(key: Key): Detent[];
  /** the names a typed sum may use, one set per selected word */
  refs(): Record<string, number>[];
  snapshot(): unknown;
  /** one undo step, coalesced with the last one when the tag repeats */
  record(before: unknown, tag: string): void;
  restore(snap: unknown, how: "jump" | "glide"): void;
  /** put the number back in the box, unless it is being typed or scrubbed */
  show(key: Key): void;
  setAuto(on: boolean): void;
  /** the badge beside the hand, and the drawn cursor while it is locked */
  cursor(
    at: { x: number; y: number; locked: boolean; text: string } | null,
  ): void;
  xray(info: Xray | null): void;
  xrayOn(): boolean;
  soundOn(): boolean;
  reduce(): boolean;
}

const ICON: Record<
  Key,
  ComponentType<{ className?: string; "aria-hidden"?: "true" }>
> = {
  weight: TextBIcon,
  size: TextAaIcon,
  track: ArrowsOutLineHorizontalIcon,
  lead: ArrowsOutLineVerticalIcon,
};

/**
 * A mouse that moves this far before lifting is scrubbing, and anything less
 * is a click. A finger drifts further on a tap, so it gets more.
 */
const SLOP = { mouse: 3, pen: 4, touch: 8 } as const;

/** How long a still finger has to rest on a field before it scrubs, ms. */
const LONG_PRESS = 350;

/**
 * How close to the edge of the window the hand gets before the pointer is
 * locked. See the note on `lock` below.
 */
const EDGE = 32;

/**
 * Chrome on some platforms hands the first event after a lock a jump of
 * hundreds of px, which is the pointer being re-centred rather than a hand.
 */
const SPIKE = 250;

/** The window a release's speed is read over, ms. Older samples are stale. */
const WINDOW = 80;

const BACK = { type: "spring", visualDuration: 0.28, bounce: 0.35 } as const;

interface Gesture {
  el: HTMLElement;
  phase: "pending" | "scrub";
  id: number;
  type: keyof typeof SLOP;
  x0: number;
  y0: number;
  lastX: number;
  lastY: number;
  /** horizontal hand travel since the scrub began, px */
  hand: number;
  /** how far below where it started the hand is, px */
  down: number;
  gear: Gear;
  locked: boolean;
  tried: boolean;
  /** a finger that held still long enough to own the gesture */
  armed: boolean;
  timer: number;
  /** where the drawn cursor is while the real one is locked */
  vx: number;
  vy: number;
  /** recent `[time, px]`, for the speed at release */
  samples: [number, number][];
}

/** One scrub, from its first px to the end of its coast. */
interface Run {
  starts: number[];
  mixed: boolean;
  start: number;
  bounds: Bounds;
  before: unknown;
  s: Scrub;
  gear: Gear;
  rate: number;
  hand: number;
  down: number;
  speed: number;
  mode: "scrub" | "coast";
  frame: number;
  coast: number;
}

function same(values: number[]): boolean {
  return values.every((v) => Math.abs(v - values[0]) < 1e-9);
}

/** The speed as one multiplier, `×10` or `×0.42`, or nothing at base. */
function rateText(rate: number): string {
  if (Math.abs(rate - 1) < 1e-3) return "";
  const r = rate >= 1 ? Math.round(rate) : Number(rate.toFixed(2));
  return `×${r}`;
}

export function Field({
  spec,
  panel,
  auto,
}: {
  spec: Spec;
  panel: Panel;
  /** whether tracking follows size, on the tracking field only */
  auto?: AutoState;
}) {
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const label = useRef<HTMLLabelElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const badge = useRef<HTMLSpanElement>(null);
  const g = useRef<Gesture | null>(null);
  const run = useRef<Run | null>(null);
  const ink = useRef<Ink | null>(null);
  /** a scrub ends in a click on the element it started on, which is not one */
  const scrubbed = useRef(false);
  /** consecutive repeats of a held arrow key */
  const repeats = useRef(0);
  /** the rubber band against a limit, and the shake on a bad entry */
  const nudge = useMotionValue(0);
  const [tip, setTip] = useState(false);
  const Icon = ICON[spec.key];

  /** typing and the badge, which the field's React handlers reach through this */
  const actions = useRef<{ commit: () => void; say: (t: string) => void }>({
    commit: () => {},
    say: () => {},
  });

  // the gesture is bound once, imperatively, since a finger held to scrub
  // needs a `touchmove` listener that is not passive, which React cannot add
  useEffect(() => {
    const labelEl = label.current;
    const inputEl = input.current;
    if (!labelEl || !inputEl) return;

    const say = (text: string) => {
      const el = badge.current;
      const row = root.current;
      if (!el || !row) return;
      if (text) el.textContent = text;
      row.dataset.badge = text ? "true" : "false";
    };

    const display = (r: Run) => {
      if (r.mixed) inputEl.value = formatDelta(r.s.value, spec);
      else inputEl.value = format(r.s.value, spec);
      inputEl.setAttribute("aria-valuenow", String(r.s.value));
    };

    const paint = () => {
      const r = run.current;
      const el = canvas.current;
      if (!r || !el || !ink.current) return;
      r.frame = 0;
      const gain = spec.perPx * GEAR[r.gear] * r.rate;
      paintRuler(
        el,
        {
          value: r.s.value,
          raw: r.s.raw,
          start: r.start,
          gain,
          min: r.bounds.min,
          max: r.bounds.max,
          detents: !r.mixed && r.gear === "base" ? panel.detents(spec.key) : [],
          band: band(r.s.over),
          hold: r.s.stuck ? r.s.hold : 0,
          xray: panel.xrayOn(),
        },
        ink.current,
      );
      panel.xray({
        key: spec.key,
        mode: r.mode,
        hand: r.hand,
        down: r.down,
        rate: GEAR[r.gear] * r.rate,
        gain,
        raw: r.s.raw,
        value: r.s.value,
        hold: r.s.stuck ? r.s.hold : 0,
        over: r.s.over,
        speed: r.speed,
        mixed: r.mixed,
      });
    };

    const schedule = () => {
      const r = run.current;
      if (r && !r.frame) r.frame = requestAnimationFrame(paint);
    };

    /** Travel `dx` px at the given gear and rate, and say what happened. */
    const move = (dx: number, gear: Gear, rate: number) => {
      const r = run.current;
      if (!r) return;
      const gain = spec.perPx * GEAR[gear] * rate;
      const detents =
        !r.mixed && gear === "base" ? panel.detents(spec.key) : [];
      const prev = r.s;
      r.gear = gear;
      r.rate = rate;
      r.hand += dx;
      r.s = advance(prev, dx, gain, stepOf(spec, gear), r.bounds, detents);
      const v = r.s.value;
      panel.write(
        spec.key,
        r.mixed ? r.starts.map((s) => fit(s + v, spec)) : r.starts.map(() => v),
        "jump",
      );
      display(r);
      nudge.jump(band(r.s.over));

      const sound = panel.soundOn();
      if (r.s.stuck && r.s.stuck !== prev.stuck) {
        if (sound) playDetent();
        // a tick under a finger, on a phone with a motor. A no-op elsewhere
        navigator.vibrate?.(6);
      } else if (r.s.over !== 0 && prev.over === 0) {
        if (sound) playLimit();
      } else if (r.s.value !== prev.value && sound) {
        const at = r.mixed ? r.starts[0] + v : v;
        playStep((at - spec.min) / (spec.max - spec.min));
      }
      const text = r.s.stuck?.name ?? rateText(GEAR[gear] * rate);
      say(text);
      schedule();
      return text;
    };

    const finish = (commit: boolean) => {
      const ges = g.current;
      const r = run.current;
      g.current = null;
      run.current = null;
      if (ges) window.clearTimeout(ges.timer);
      if (!r) return;
      if (r.frame) cancelAnimationFrame(r.frame);
      if (r.coast) cancelAnimationFrame(r.coast);
      scrubbed.current = true;

      delete document.documentElement.dataset.scrub;
      const row = root.current;
      if (row) row.dataset.scrub = "false";
      say("");
      panel.cursor(null);
      panel.xray(null);
      if (ges && document.pointerLockElement === ges.el) {
        document.exitPointerLock();
      }
      if (panel.reduce()) nudge.jump(0);
      else animate(nudge, 0, BACK);

      if (!commit) {
        panel.restore(r.before, "glide");
      } else if (r.s.value !== r.start) {
        // landing on Inter's own value is the same as asking for it
        if (spec.key === "track" && r.s.stuck?.name === "auto") {
          panel.setAuto(true);
        }
        panel.record(r.before, `scrub:${spec.key}:${performance.now()}`);
      }
      panel.show(spec.key);
    };

    /**
     * **Let go while moving and the value coasts.** The speed at release is
     * read over the last 80ms, and a hand that stopped before it let go throws
     * nothing. The coast runs through the same `advance` the hand does, so a
     * detent it reaches slowly enough catches it, a limit stops it, and the
     * ruler and the sound carry on as though the hand were still there.
     */
    const release = (ges: Gesture) => {
      const r = run.current;
      if (!r) return;
      const now = performance.now();
      const recent = ges.samples.filter(([t]) => now - t < WINDOW);
      const fresh =
        recent.length > 1 && now - recent[recent.length - 1][0] < 50;
      const span = fresh ? now - recent[0][0] : 0;
      const v =
        span > 0 ? (recent.reduce((a, [, d]) => a + d, 0) / span) * 1000 : 0;
      if (Math.abs(v) < THROW || panel.reduce() || r.s.over !== 0) {
        finish(true);
        return;
      }
      g.current = null;
      if (document.pointerLockElement === ges.el) document.exitPointerLock();
      panel.cursor(null);
      r.mode = "coast";
      let speed = v;
      let t = now;
      const step = (time: number) => {
        const cur = run.current;
        if (!cur) return;
        const dt = Math.min(0.05, (time - t) / 1000);
        t = time;
        speed *= Math.exp(-dt / COAST);
        cur.speed = speed;
        move(speed * dt, cur.gear, cur.rate);
        if (Math.abs(speed) < REST || cur.s.over !== 0) {
          finish(true);
          return;
        }
        cur.coast = requestAnimationFrame(step);
      };
      r.coast = requestAnimationFrame(step);
    };

    const startScrub = (
      ges: Gesture,
      e: { shiftKey: boolean; altKey: boolean },
    ) => {
      const starts = panel.read(spec.key);
      const mixed = !same(starts);
      const start = mixed ? 0 : starts[0];
      ges.phase = "scrub";
      run.current = {
        starts,
        mixed,
        start,
        // a mixed scrub runs in deltas, and stops once every word has stopped
        bounds: mixed
          ? {
              min: spec.min - Math.max(...starts),
              max: spec.max - Math.min(...starts),
            }
          : { min: spec.min, max: spec.max },
        before: panel.snapshot(),
        s: begin(start),
        gear: gearOf(e),
        rate: 1,
        hand: 0,
        down: 0,
        speed: 0,
        mode: "scrub",
        frame: 0,
        coast: 0,
      };
      setTip(false);
      document.documentElement.dataset.scrub = "true";
      const row = root.current;
      if (row) row.dataset.scrub = "true";
      ink.current = readInk();
      if (canvas.current) fitCanvas(canvas.current);
      if (run.current.mixed) inputEl.value = formatDelta(0, spec);
      say(rateText(GEAR[run.current.gear]));
      schedule();
    };

    /**
     * **The pointer is locked only when the hand reaches the edge of the
     * window, never for the whole scrub.** Locking hides the cursor and frees
     * the hand from the edge of the screen, which is what a long scrub needs,
     * and Chrome announces every lock with a banner across the top of the
     * page. Locking at the start puts that banner over every short scrub that
     * never needed it.
     *
     * The pointerdown's user activation is still live for a few seconds,
     * which is what lets a lock asked for mid-drag succeed. A scrub held longer
     * than that, or a browser that refuses, stops at the edge of the screen,
     * which is where every slider stops anyway.
     */
    const lock = (ges: Gesture, x: number, y: number) => {
      if (ges.tried || ges.type !== "mouse") return;
      if (x > EDGE && x < window.innerWidth - EDGE) return;
      ges.tried = true;
      ges.vx = x;
      ges.vy = y;
      try {
        const out = ges.el.requestPointerLock() as unknown as
          | Promise<void>
          | undefined;
        // Chrome returns a promise and Safari returns nothing
        if (out && typeof out.catch === "function") out.catch(() => {});
      } catch {
        // refused, so the scrub carries on unlocked
      }
    };

    const down = (e: PointerEvent) => {
      const el = e.currentTarget as HTMLElement;
      // a focused box is being typed in, and a press there places the caret
      if (el === inputEl && document.activeElement === inputEl) return;
      if (e.button !== 0) return;
      // a press catches a coasting value where it is
      if (run.current?.mode === "coast") finish(true);
      if (g.current) return;
      // no focus move and no text selection: a press is either the start of a
      // scrub or a click, and both are handled here
      e.preventDefault();
      armScrub();
      scrubbed.current = false;
      if (inputEl.dataset.editing === "true") commit();
      el.setPointerCapture(e.pointerId);
      const type = (e.pointerType as Gesture["type"]) || "mouse";
      const ges: Gesture = {
        el,
        phase: "pending",
        id: e.pointerId,
        type,
        x0: e.clientX,
        y0: e.clientY,
        lastX: e.clientX,
        lastY: e.clientY,
        hand: 0,
        down: 0,
        gear: gearOf(e),
        locked: false,
        tried: false,
        armed: false,
        timer: 0,
        vx: e.clientX,
        vy: e.clientY,
        samples: [],
      };
      g.current = ges;
      if (type === "touch") {
        // a finger that rests owns the gesture, so it can drag down for
        // precision without the page scrolling under it
        ges.timer = window.setTimeout(() => {
          if (g.current !== ges || ges.phase !== "pending") return;
          ges.armed = true;
          navigator.vibrate?.(10);
          startScrub(ges, { shiftKey: false, altKey: false });
        }, LONG_PRESS);
      }
    };

    const moved = (e: PointerEvent) => {
      const ges = g.current;
      if (!ges || e.pointerId !== ges.id) return;

      if (ges.phase === "pending") {
        const dx = e.clientX - ges.x0;
        const dy = e.clientY - ges.y0;
        const slop = SLOP[ges.type];
        // a finger that sets off vertically is scrolling the page
        if (
          ges.type === "touch" &&
          Math.abs(dy) > slop &&
          Math.abs(dy) > Math.abs(dx)
        ) {
          window.clearTimeout(ges.timer);
          g.current = null;
          return;
        }
        if (Math.abs(dx) < slop) return;
        window.clearTimeout(ges.timer);
        // the slop is discarded rather than applied, so the value does not
        // jump by however far the hand had to travel to be read as a scrub
        ges.lastX = e.clientX;
        ges.lastY = e.clientY;
        ges.y0 = e.clientY;
        startScrub(ges, e);
        return;
      }

      const r = run.current;
      if (!r) return;
      const locked = document.pointerLockElement === ges.el;
      ges.locked = locked;
      let dx = locked ? e.movementX : e.clientX - ges.lastX;
      let dy = locked ? e.movementY : e.clientY - ges.lastY;
      ges.lastX = e.clientX;
      ges.lastY = e.clientY;
      if (locked && (Math.abs(dx) > SPIKE || Math.abs(dy) > SPIKE)) {
        dx = 0;
        dy = 0;
      }
      ges.down += dy;
      ges.samples.push([performance.now(), dx]);
      if (ges.samples.length > 12) ges.samples.shift();

      r.down = Math.max(0, ges.down);
      const text = move(dx, gearOf(e), precisionOf(r.down));

      if (locked) {
        // the drawn cursor wraps round the window, the way a 3D app's does,
        // so a scrub can go on in one direction as long as the hand likes
        const w = window.innerWidth;
        ges.vx = (((ges.vx + dx) % w) + w) % w;
        ges.vy = Math.min(window.innerHeight - 8, Math.max(8, ges.vy + dy));
        panel.cursor({ x: ges.vx, y: ges.vy, locked: true, text: text ?? "" });
      } else {
        panel.cursor({
          x: e.clientX,
          y: e.clientY,
          locked: false,
          text: text ?? "",
        });
        lock(ges, e.clientX, e.clientY);
      }
    };

    const up = (e: PointerEvent) => {
      const ges = g.current;
      if (!ges || e.pointerId !== ges.id) return;
      window.clearTimeout(ges.timer);
      if (ges.phase === "pending") {
        g.current = null;
        return;
      }
      // set here and not when the scrub finishes: a thrown value is still
      // coasting when the release's click arrives, and that click would
      // otherwise focus the box
      scrubbed.current = true;
      release(ges);
    };

    const cancel = () => {
      if (g.current?.phase === "pending") {
        window.clearTimeout(g.current.timer);
        g.current = null;
        return;
      }
      if (run.current) finish(false);
    };

    // a finger that has been held to scrub must not also scroll the page
    const touch = (e: TouchEvent) => {
      if (g.current?.armed) e.preventDefault();
    };

    const click = (e: MouseEvent) => {
      const el = e.currentTarget as HTMLElement;
      if (el === inputEl && document.activeElement === inputEl) return;
      // the label's own activation would focus the box, and after a scrub
      // nothing at all should happen, so the default is taken over either way
      e.preventDefault();
      if (scrubbed.current) {
        scrubbed.current = false;
        return;
      }
      if (el === labelEl && e.detail === 2) {
        // a double click on the label puts the default back
        const before = panel.snapshot();
        const values = panel.read(spec.key);
        if (spec.key === "track") {
          panel.setAuto(true);
          panel.record(before, `reset:${spec.key}:${performance.now()}`);
        } else if (values.some((v) => v !== spec.def)) {
          panel.record(before, `reset:${spec.key}:${performance.now()}`);
          panel.write(
            spec.key,
            values.map(() => spec.def),
            "glide",
          );
        }
      }
      inputEl.focus();
      inputEl.select();
    };

    // what can end a scrub without a pointerup: Escape, a lost lock, a lost window
    const key = (e: KeyboardEvent) => {
      const r = run.current;
      if (!r) return;
      if (e.key === "Escape") {
        e.preventDefault();
        finish(false);
        return;
      }
      if ((e.key === "Shift" || e.key === "Alt") && r.mode === "scrub") {
        // Alt on its own focuses the menu bar on some systems
        e.preventDefault();
        r.gear = gearOf(e);
        say(rateText(GEAR[r.gear] * r.rate));
        schedule();
      }
    };
    // Escape under a lock is eaten by the browser to release it, so a lock
    // that goes away while the button is still down is that Escape
    const lockChange = () => {
      const ges = g.current;
      if (ges?.phase !== "scrub") return;
      if (document.pointerLockElement === ges.el) ges.locked = true;
      else if (ges.locked) finish(false);
    };
    const blur = () => {
      if (g.current || run.current) finish(false);
    };

    for (const el of [labelEl, inputEl] as HTMLElement[]) {
      el.addEventListener("pointerdown", down);
      el.addEventListener("pointermove", moved);
      el.addEventListener("pointerup", up);
      el.addEventListener("pointercancel", cancel);
      el.addEventListener("click", click);
      el.addEventListener("touchmove", touch, { passive: false });
    }
    window.addEventListener("keydown", key);
    window.addEventListener("keyup", key);
    window.addEventListener("blur", blur);
    document.addEventListener("pointerlockchange", lockChange);

    // typing, which the field's own React handlers reach through this ref
    actions.current = { commit, say };

    return () => {
      for (const el of [labelEl, inputEl] as HTMLElement[]) {
        el.removeEventListener("pointerdown", down);
        el.removeEventListener("pointermove", moved);
        el.removeEventListener("pointerup", up);
        el.removeEventListener("pointercancel", cancel);
        el.removeEventListener("click", click);
        el.removeEventListener("touchmove", touch);
      }
      window.removeEventListener("keydown", key);
      window.removeEventListener("keyup", key);
      window.removeEventListener("blur", blur);
      document.removeEventListener("pointerlockchange", lockChange);
      if (run.current?.coast) cancelAnimationFrame(run.current.coast);
      // a lab unmounted mid-scrub must not leave the page's cursor behind
      delete document.documentElement.dataset.scrub;
    };

    /** Whatever is in the box becomes the value, or the box goes back. */
    function commit() {
      if (inputEl?.dataset.editing !== "true") return;
      inputEl.dataset.editing = "false";
      const text = inputEl.value.trim().toLowerCase();
      if (spec.key === "track" && text === "auto") {
        panel.record(panel.snapshot(), `type:${spec.key}:${performance.now()}`);
        panel.setAuto(true);
        panel.show(spec.key);
        return;
      }
      const current = panel.read(spec.key);
      const refs = panel.refs();
      const next = current.map((v, i) =>
        evaluate(inputEl.value, v, spec.unit, refs[i]),
      );
      if (text === "" || next.some((v) => v === null)) {
        shake();
        panel.show(spec.key);
        return;
      }
      const fitted = next.map((v) => fit(v as number, spec));
      if (fitted.some((v, i) => v !== current[i])) {
        panel.record(panel.snapshot(), `type:${spec.key}:${performance.now()}`);
        panel.write(spec.key, fitted, "glide");
      }
      // shown even when unchanged, so `56.0` or `56px` reads back as `56`
      panel.show(spec.key);
    }

    function shake() {
      const row = root.current;
      if (row) {
        row.dataset.invalid = "true";
        window.setTimeout(() => {
          row.dataset.invalid = "false";
        }, 700);
      }
      if (!panel.reduce()) {
        animate(nudge, [0, -4, 4, -3, 2, 0], {
          duration: 0.28,
          ease: "easeOut",
        });
      }
    }
  }, [nudge, panel, spec]);

  const step = (
    e: React.KeyboardEvent<HTMLInputElement>,
    dir: number,
    by?: number,
  ) => {
    actions.current.commit();
    // a held arrow speeds up the longer it is held, and lands on the grid of
    // the speed it has reached
    repeats.current = e.repeat ? repeats.current + 1 : 0;
    const n = repeats.current;
    const mult = n < 6 ? 1 : n < 16 ? 2 : n < 32 ? 5 : 10;
    const unit = by ?? stepOf(spec, gearOf(e)) * mult;
    const before = panel.snapshot();
    const current = panel.read(spec.key);
    const uniform = same(current);
    const next = current.map((v) => {
      const raw = v + dir * unit;
      return fit(
        uniform && mult > 1 ? Math.round(raw / unit) * unit : raw,
        spec,
      );
    });
    actions.current.say(mult > 1 ? `×${mult}` : "");
    if (next.every((v, i) => v === current[i])) {
      if (panel.soundOn()) playLimit();
      return;
    }
    // held arrows are one undo step, not one per repeat
    panel.record(before, `step:${spec.key}`);
    panel.write(spec.key, next, "glide");
    panel.show(spec.key);
    if (panel.soundOn()) {
      playStep((next[0] - spec.min) / (spec.max - spec.min));
    }
    input.current?.select();
  };

  const onKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const field = e.currentTarget;
    switch (e.key) {
      case "Enter":
        e.preventDefault();
        actions.current.commit();
        field.select();
        return;
      case "Escape":
        e.preventDefault();
        if (field.dataset.editing === "true") {
          field.dataset.editing = "false";
          panel.show(spec.key);
          field.select();
        } else {
          field.blur();
        }
        return;
      case "ArrowUp":
      case "ArrowDown":
        e.preventDefault();
        armScrub();
        step(e, e.key === "ArrowUp" ? 1 : -1);
        return;
      case "PageUp":
      case "PageDown":
        e.preventDefault();
        armScrub();
        step(e, e.key === "PageUp" ? 1 : -1, stepOf(spec, "fast"));
        return;
      case "Home":
      case "End": {
        if (field.dataset.editing === "true") return;
        e.preventDefault();
        const before = panel.snapshot();
        const current = panel.read(spec.key);
        const to = e.key === "Home" ? spec.min : spec.max;
        if (current.every((v) => v === to)) return;
        panel.record(before, `edge:${spec.key}:${performance.now()}`);
        panel.write(
          spec.key,
          current.map(() => to),
          "glide",
        );
        panel.show(spec.key);
        field.select();
        return;
      }
    }
  };

  return (
    <div
      ref={root}
      data-key={spec.key}
      data-scrub="false"
      data-badge="false"
      data-invalid="false"
      className={cn(
        "group/field relative flex h-9 items-center overflow-hidden rounded-md bg-fill transition-all duration-200",
        "focus-within:ring-2 focus-within:ring-text-primary/15 focus-within:ring-offset-2",
        "data-[scrub=true]:bg-fill-hover data-[invalid=true]:bg-danger/10",
      )}
    >
      <Tooltip
        label={`${spec.name}, drag to change`}
        open={tip}
        onOpenChange={(open) => setTip(open && !g.current && !run.current)}
      >
        <label
          ref={label}
          htmlFor={id}
          className={cn(
            // a press on the label is a drag first, so the cursor says so. One
            // more place the shared `cursor-pointer` rule is off
            "flex h-full w-8 shrink-0 cursor-ew-resize touch-pan-y items-center justify-center text-text-muted transition-colors duration-150",
            "hover:text-text-primary group-data-[scrub=true]/field:text-text-primary",
          )}
        >
          <Icon aria-hidden="true" className="size-3.5" />
        </label>
      </Tooltip>

      <motion.div style={{ x: nudge }} className="flex min-w-0 flex-1">
        <input
          ref={input}
          id={id}
          role="spinbutton"
          inputMode="decimal"
          autoComplete="off"
          spellCheck={false}
          aria-label={spec.name}
          aria-valuemin={spec.min}
          aria-valuemax={spec.max}
          data-editing="false"
          data-field={spec.key}
          onInput={(e) => {
            e.currentTarget.dataset.editing = "true";
          }}
          onKeyDown={onKey}
          onKeyUp={(e) => {
            if (e.key.startsWith("Arrow")) actions.current.say("");
          }}
          onFocus={(e) => e.currentTarget.select()}
          onBlur={() => actions.current.commit()}
          className={cn(
            // a box that is not focused is a scrub handle like the label. Once
            // focused it is a text box, and the cursor goes back to the caret
            "w-full min-w-0 cursor-ew-resize touch-pan-y bg-transparent font-mono text-body text-text-primary tabular-nums outline-none focus:cursor-text",
            "placeholder:font-sans placeholder:text-body placeholder:text-text-muted",
          )}
        />
      </motion.div>

      <span
        aria-hidden="true"
        className={cn(
          "text-meta text-text-muted transition-opacity duration-150 group-data-[badge=true]/field:opacity-0",
          auto ? "pr-1" : "pr-2.5",
        )}
      >
        {spec.unit}
      </span>
      {auto && (
        <Tooltip
          label={
            auto === "on"
              ? "Stop following size"
              : "Follow size, Inter's dynamic metrics"
          }
        >
          <button
            type="button"
            aria-label="Track with size"
            aria-pressed={
              auto === "on" ? true : auto === "mixed" ? "mixed" : false
            }
            onClick={() => {
              panel.record(panel.snapshot(), `auto:${performance.now()}`);
              panel.setAuto(auto !== "on");
              panel.show("track");
            }}
            className={cn(
              "mr-1 flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-sm text-text-muted transition-colors duration-150",
              "hover:bg-fill-active hover:text-text-primary aria-pressed:text-text-primary",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-primary/15",
            )}
          >
            {auto === "off" ? (
              <LinkSimpleBreakIcon aria-hidden="true" className="size-3.5" />
            ) : (
              <LinkSimpleIcon aria-hidden="true" className="size-3.5" />
            )}
          </button>
        </Tooltip>
      )}
      {/* the speed or the detent holding the value, in place of the unit */}
      <span
        ref={badge}
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute text-meta text-text-primary opacity-0 transition-opacity duration-150 group-data-[badge=true]/field:opacity-100",
          auto ? "right-8" : "right-2.5",
        )}
      />

      <canvas
        ref={canvas}
        className="pointer-events-none absolute inset-x-0 bottom-0 h-2.5 w-full opacity-0 transition-opacity duration-150 group-data-[scrub=true]/field:opacity-100"
      />
    </div>
  );
}
