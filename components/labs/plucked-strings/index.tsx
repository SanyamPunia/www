"use client";

import { useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import {
  couple,
  decay,
  fraction,
  loudness,
  MODES,
  pluckModes,
  STRINGS,
} from "./strings";
import {
  armStrings,
  mute,
  pluck as play,
  sympathy,
  tick,
} from "./strings-sound";

/* ─────────────────────────────────────────────────────────
 * PLUCKED STRINGS
 *
 *   press      a finger on a string damps it, sound and drawing
 *   drag       the string bends round the finger into a V
 *   slip       past `SLIP` it gets away and the V is released
 *   ring       24 modes, each on its own clock and its own decay
 *   sympathy   the other strings answer through the bridge
 * ───────────────────────────────────────────────────────── */

const COUNT = STRINGS.length;
/** harmonics shown under the strings */
const BARS = 12;
/** points along a string, enough that a kink reads as a kink */
const SAMPLES = 120;
/** each string's drawn width, the wound ones a little heavier */
const WIDTHS = [1.7, 1.5, 1.35, 1.2, 1.05, 0.95];
/** how many px of swing take a string from its resting grey to full ink */
const LIGHT_UP = 4;
/**
 * How far toward full ink a string goes, from its resting grey. Kept low so a
 * string that is ringing or held reads as a step darker and never as black.
 */
const RINGING = 0.3;
const HELD = 0.45;
const HOVER = 0.2;
/** a pick's edge and a fingertip, as a share of the string */
const PICK = 0.006;
const FINGER = 0.03;
/** how much of a string's push crosses the bridge into the others */
const BRIDGE = 0.045;
/** how long a string takes to start answering through the bridge, in seconds */
const RISE = 0.18;
/** a ring this small is dropped, in px */
const DEAD = 0.05;
/** a string moving less than this is drawn straight and asks for no frames */
const STILL = 0.15;
/** where the keyboard plucks, a fifth of the way along, as players do */
const KEY_SPOT = 0.2;

/*
 * The drawing runs slow. A real D2 swings 73 times a second, which on screen
 * is a blur and nothing else, so each string's shape is played back at a
 * couple of swings a second. The decay is not slowed: a string that rings for
 * three seconds is drawn ringing for three seconds. Higher strings swing a
 * little faster, so the six still read as six pitches.
 */
const SLOW = STRINGS.map((s) => 2 * (s.hz / STRINGS[0].hz) ** 0.35);

/** every mode's decay, looked up rather than worked out per point per frame */
const TAU = STRINGS.map((s) =>
  Array.from({ length: MODES }, (_, i) => decay(s, i + 1)),
);

/** sin(n pi u) for every mode at every point along a string */
const SHAPE = Array.from({ length: MODES }, (_, i) => {
  const row = new Float32Array(SAMPLES);
  for (let k = 0; k < SAMPLES; k++) {
    row[k] = Math.sin(((i + 1) * Math.PI * k) / (SAMPLES - 1));
  }
  return row;
});

interface Ring {
  /** when it started, on the page's clock */
  t0: number;
  /** mode amplitudes in px */
  modes: number[];
  /** seconds to build up, 0 for a pluck and `RISE` for sympathy */
  rise: number;
}

interface Hold {
  pointer: number;
  /** where the finger is along the string, in px */
  x: number;
  /** how far it has pulled the string, signed, in px */
  d: number;
  /** which way it is pulling, 0 until it has moved */
  dir: number;
}

interface Hand {
  x: number;
  y: number;
  t: number;
  width: number;
  touch: boolean;
}

interface Geometry {
  w: number;
  h: number;
  x0: number;
  x1: number;
  ys: number[];
  gap: number;
  /** where the harmonic bars start */
  readout: number;
  /** how far a string bends round a finger before it gets away */
  slip: number;
  /** how close a press has to land to take a string */
  reach: number;
}

/** from the foot of the posts to the bars, and the bars and their line */
const BELOW = 28;
const READOUT = 32;

/**
 * The strings and the readout are centred together as one group, so the stage
 * has one object in it rather than a set of strings and a caption left at the
 * bottom edge.
 */
function layout(w: number, h: number): Geometry {
  const gap = Math.min(h * 0.085, 30);
  const group = gap * (COUNT - 1 + 1.5) + BELOW + READOUT;
  const first = (h - group) / 2 + gap * 0.75;
  const ys = STRINGS.map((_, i) => first + i * gap);
  return {
    w,
    h,
    x0: w * 0.13,
    x1: w * 0.89,
    ys,
    gap,
    readout: ys[COUNT - 1] + gap * 0.75 + BELOW,
    slip: gap * 0.48,
    reach: Math.max(7, gap * 0.34),
  };
}

/** a hex token as three channels, since a canvas cannot mix a `var()` */
function rgb(hex: string): number[] {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? [...h].map((c) => c + c).join("") : h;
  return [0, 2, 4].map((i) => Number.parseInt(full.slice(i, i + 2), 16));
}

const clamp = (v: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, v));
const mix = (a: number, b: number, t: number) => a * (1 - t) + b * t;

interface Readout {
  note: string;
  at: string;
}

export default function PluckedStrings() {
  const reduce = useReducedMotion() ?? false;
  const stage = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const bars = useRef<(HTMLSpanElement | null)[]>([]);
  const [geo, setGeo] = useState<Geometry | null>(null);
  const [readout, setReadout] = useState<Readout | null>(null);

  const geoRef = useRef<Geometry | null>(null);
  const rings = useRef<Ring[][]>(STRINGS.map(() => []));
  const holds = useRef<(Hold | null)[]>(STRINGS.map(() => null));
  const hands = useRef(new Map<number, Hand>());
  const last = useRef<{ index: number; t0: number; loud: number[] } | null>(
    null,
  );
  const ink = useRef({
    rest: [155, 155, 155],
    live: [26, 26, 26],
    paper: "#ffffff",
    edge: "#ebebeb",
  });
  /** the string a hovering pointer would take, or -1 */
  const hover = useRef(-1);
  const keySpot = useRef(KEY_SPOT);
  const keyboard = useRef(false);
  const frame = useRef(0);
  const keyTarget = useRef<HTMLButtonElement>(null);
  const reduceRef = useRef(reduce);
  reduceRef.current = reduce;

  useEffect(() => {
    const node = stage.current;
    const surface = canvas.current;
    if (!node || !surface) return;
    const ctx = surface.getContext("2d");
    if (!ctx) return;

    const root = getComputedStyle(document.documentElement);
    const token = (name: string, fallback: string) =>
      root.getPropertyValue(name).trim() || fallback;
    ink.current = {
      rest: rgb(token("--color-text-muted", "#9b9b9b")),
      live: rgb(token("--color-text-primary", "#1a1a1a")),
      paper: token("--color-bg", "#ffffff"),
      edge: token("--color-stroke", "#ebebeb"),
    };
    /** a string's ink, from resting grey at 0 to full ink at 1 */
    const tone = (k: number, alpha = 1) => {
      const [a, b] = [ink.current.rest, ink.current.live];
      const c = a.map((v, j) => Math.round(mix(v, b[j], clamp(k, 0, 1))));
      return `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${alpha})`;
    };

    /* ── drawing ─────────────────────────────────────────── */

    const paint = (now: number): boolean => {
      const g = geoRef.current;
      if (!g) return false;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, g.w, g.h);
      const still = reduceRef.current;
      let busy = false;

      /* the nut and the bridge, two white pills the strings are pinned to */
      const top = g.ys[0] - g.gap * 0.7;
      const foot = g.ys[COUNT - 1] + g.gap * 0.7;
      ctx.lineCap = "round";
      ctx.fillStyle = ink.current.paper;
      ctx.strokeStyle = ink.current.edge;
      ctx.lineWidth = 1;
      for (const x of [g.x0, g.x1]) {
        ctx.beginPath();
        ctx.roundRect(x - 5, top, 10, foot - top, 5);
        ctx.fill();
        ctx.stroke();
      }

      /* where the keyboard will pluck, only while the keyboard is the hand */
      if (keyboard.current) {
        const x = mix(g.x0, g.x1, keySpot.current);
        ctx.save();
        ctx.strokeStyle = tone(0);
        ctx.lineWidth = 1;
        ctx.setLineDash([2, 3]);
        ctx.beginPath();
        ctx.moveTo(x, top + 4);
        ctx.lineTo(x, foot - 4);
        ctx.stroke();
        ctx.restore();
      }

      ctx.lineJoin = "round";
      const span = g.x1 - g.x0;
      const coef = new Float64Array(MODES);
      const reach = new Float64Array(MODES);
      /** a pin where the string meets a post, in the string's own ink */
      const pins = (y: number, color: string) => {
        ctx.fillStyle = color;
        for (const x of [g.x0, g.x1]) {
          ctx.beginPath();
          ctx.arc(x, y, 2, 0, Math.PI * 2);
          ctx.fill();
        }
      };

      for (let i = 0; i < COUNT; i++) {
        const y = g.ys[i];
        ctx.lineWidth = WIDTHS[i];
        ctx.beginPath();
        const hold = holds.current[i];
        const near = hover.current === i ? HOVER : 0;

        if (hold) {
          /* bent round the fingertip, which is a small radius and not a point */
          busy = true;
          ctx.strokeStyle = tone(HELD);
          const r = Math.min(5, Math.abs(hold.d) * 0.6);
          ctx.moveTo(g.x0, y);
          if (Math.abs(hold.d) < 0.3) ctx.lineTo(g.x1, y);
          else {
            ctx.arcTo(hold.x, y + hold.d, g.x1, y, r);
            ctx.lineTo(g.x1, y);
          }
          ctx.stroke();
          pins(y, tone(HELD));
          continue;
        }

        /* sum every ring on this string into one set of mode amplitudes */
        coef.fill(0);
        reach.fill(0);
        let size = 0;
        const list = rings.current[i];
        for (let r = list.length - 1; r >= 0; r--) {
          const ring = list[r];
          const t = (now - ring.t0) / 1000;
          if (t < 0) continue;
          const grow = ring.rise > 0 ? 1 - Math.exp(-t / ring.rise) : 1;
          let alive = 0;
          for (let n = 0; n < MODES; n++) {
            const a = ring.modes[n] * Math.exp(-t / TAU[i][n]) * grow;
            alive = Math.max(alive, Math.abs(a));
            reach[n] += Math.abs(a);
            coef[n] += a * Math.cos(2 * Math.PI * (n + 1) * SLOW[i] * t);
          }
          if (alive < DEAD && t > ring.rise * 4) list.splice(r, 1);
          else size += alive;
        }

        /* a string at rest is a quiet grey and takes on ink as it swings, so
           the strings that are ringing are the dark ones */
        const glow = Math.max(
          near,
          still ? 0 : Math.min(RINGING, size / LIGHT_UP),
        );
        if (still || size < STILL) {
          ctx.strokeStyle = tone(glow);
          ctx.moveTo(g.x0, y);
          ctx.lineTo(g.x1, y);
          ctx.stroke();
          pins(y, tone(glow));
          continue;
        }
        busy = true;

        /* the band it sweeps, the soft lens a ringing string shows the eye */
        ctx.fillStyle = tone(0, 0.12 * clamp(glow / RINGING, 0, 1));
        ctx.beginPath();
        for (let k = 0; k < SAMPLES; k++) {
          let off = 0;
          for (let n = 0; n < MODES; n++)
            off += reach[n] * Math.abs(SHAPE[n][k]);
          const x = g.x0 + (span * k) / (SAMPLES - 1);
          if (k === 0) ctx.moveTo(x, y - off);
          else ctx.lineTo(x, y - off);
        }
        for (let k = SAMPLES - 1; k >= 0; k--) {
          let off = 0;
          for (let n = 0; n < MODES; n++)
            off += reach[n] * Math.abs(SHAPE[n][k]);
          ctx.lineTo(g.x0 + (span * k) / (SAMPLES - 1), y + off);
        }
        ctx.fill();

        ctx.strokeStyle = tone(glow);
        ctx.beginPath();
        for (let k = 0; k < SAMPLES; k++) {
          let off = 0;
          for (let n = 0; n < MODES; n++) off += coef[n] * SHAPE[n][k];
          const x = g.x0 + (span * k) / (SAMPLES - 1);
          if (k === 0) ctx.moveTo(x, y + off);
          else ctx.lineTo(x, y + off);
        }
        ctx.stroke();
        pins(y, tone(glow));
      }

      /* the harmonics of the last pluck, dying at their own rates */
      const shown = last.current;
      if (shown) {
        const t = still ? 0 : (now - shown.t0) / 1000;
        let lit = 0;
        for (let n = 0; n < BARS; n++) {
          const v = shown.loud[n] * Math.exp(-t / TAU[shown.index][n]);
          lit = Math.max(lit, v);
          const bar = bars.current[n];
          if (bar) bar.style.transform = `scaleY(${v ** 0.6})`;
        }
        if (lit > 0.03 && !still) busy = true;
      }

      return busy;
    };

    const loop = (now: number) => {
      frame.current = 0;
      if (paint(now)) frame.current = requestAnimationFrame(loop);
    };
    /* cancel and reschedule rather than skip, `book-opening`'s rule */
    const run = () => {
      cancelAnimationFrame(frame.current);
      frame.current = requestAnimationFrame(loop);
    };

    /* ── sizing ──────────────────────────────────────────── */

    const size = () => {
      const box = node.getBoundingClientRect();
      const g = layout(box.width, box.height);
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      surface.width = Math.round(g.w * dpr);
      surface.height = Math.round(g.h * dpr);
      geoRef.current = g;
      setGeo(g);
      run();
    };
    const watch = new ResizeObserver(size);
    watch.observe(node);
    size();

    /* ── playing ─────────────────────────────────────────── */

    /** a finger on a ringing string stops it, which is how a string is damped */
    const damp = (i: number, t: number) => {
      rings.current[i] = [];
      mute(i, t);
      /* the readout describes a string that is ringing, and this one no
         longer is */
      if (last.current?.index === i) {
        last.current = null;
        for (const bar of bars.current) {
          if (bar) bar.style.transform = "scaleY(0)";
        }
        setReadout(null);
      }
    };

    const fire = (
      i: number,
      p: number,
      pull: number,
      t: number,
      width: number,
      touch: boolean,
    ) => {
      const g = geoRef.current;
      if (!g) return;
      const course = STRINGS[i];
      const modes = pluckModes(p, pull, width);
      const unit = pluckModes(p, 1, width);
      const strength = clamp(Math.abs(pull) / g.slip, 0, 1.2);
      rings.current[i] = [{ t0: t, modes, rise: 0 }];
      play(i, COUNT, course, unit, strength, width, t);

      for (let j = 0; j < COUNT; j++) {
        if (j === i || holds.current[j]) continue;
        const drawn = couple(course, modes, STRINGS[j], BRIDGE);
        if (Math.max(...drawn.map(Math.abs)) > 0.004) {
          const list = rings.current[j];
          list.push({ t0: t, modes: drawn, rise: RISE });
          if (list.length > 6) list.shift();
        }
        const heard = couple(course, unit, STRINGS[j], BRIDGE).map(
          (v) => v * strength,
        );
        sympathy(j, COUNT, STRINGS[j], heard, t, RISE);
      }

      const loud = loudness(modes).slice(0, BARS);
      const peak = Math.max(...loud) || 1;
      last.current = { index: i, t0: t, loud: loud.map((v) => v / peak) };
      setReadout({ note: course.note, at: fraction(p) });
      if (touch) tick();
      run();
    };

    const spot = (g: Geometry, x: number) =>
      clamp((x - g.x0) / (g.x1 - g.x0), 0.03, 0.97);

    const local = (e: PointerEvent) => {
      const box = node.getBoundingClientRect();
      return { x: e.clientX - box.left, y: e.clientY - box.top };
    };

    /** the width of what is touching the string, from the pointer itself */
    const contact = (e: PointerEvent, g: Geometry): number => {
      if (e.pointerType !== "touch") return PICK;
      const span = g.x1 - g.x0;
      return e.width > 1 ? clamp(e.width / span, 0.012, 0.08) : FINGER;
    };

    /** let go of a held string: a pluck if it was pulled, silence if not */
    const letGo = (
      i: number,
      hand: Hand,
      x: number,
      pull: number,
      t: number,
    ) => {
      const g = geoRef.current;
      holds.current[i] = null;
      if (!g) return;
      fire(i, spot(g, x), pull, t, hand.width, hand.touch);
    };

    /**
     * One step of a hand from where it was to where it is.
     *
     * Every pointer sample is a segment, and a string is crossed where the
     * segment meets its line. A strum crosses all six inside an event or two,
     * so each crossing and each slip is placed by interpolating along the
     * segment, in space for where it was plucked and in time for when. That
     * time goes to the audio clock, which is what keeps a strum a strum rather
     * than six strings struck at once.
     */
    const step = (id: number, hand: Hand, x: number, y: number, t: number) => {
      const g = geoRef.current;
      if (!g) return;
      /* strings this hand let go of in this same step, which it is now on the
         far side of without having crossed anything */
      const freed = new Set<number>();

      for (let i = 0; i < COUNT; i++) {
        const hold = holds.current[i];
        if (!hold || hold.pointer !== id) continue;
        const was = hand.y - g.ys[i];
        const d = y - g.ys[i];
        hold.x = clamp(x, g.x0 + 2, g.x1 - 2);
        if (hold.dir === 0 && Math.abs(d) > 0.5) hold.dir = Math.sign(d);
        if (hold.dir !== 0 && Math.sign(d) === -hold.dir && Math.abs(d) > 0.5) {
          /* the finger rolled back off the side it came from, so the string
             goes back to rest under it with nothing to set it ringing. The
             hand has passed back over it, which is not a crossing to catch */
          holds.current[i] = null;
          freed.add(i);
          continue;
        }
        if (hold.dir !== 0 && Math.abs(d) >= g.slip) {
          const s = clamp((hold.dir * g.slip - was) / (d - was || 1), 0, 1);
          letGo(
            i,
            hand,
            mix(hand.x, x, s),
            hold.dir * g.slip,
            mix(hand.t, t, s),
          );
        } else hold.d = d;
      }

      for (let i = 0; i < COUNT; i++) {
        if (holds.current[i] || freed.has(i)) continue;
        const a = hand.y - g.ys[i];
        const b = y - g.ys[i];
        if (a === 0 || a * b > 0) continue;
        const s = a / (a - b);
        const cx = mix(hand.x, x, s);
        if (cx < g.x0 || cx > g.x1) continue;
        const dir = Math.sign(b - a);
        const tc = mix(hand.t, t, s);
        damp(i, tc);
        if (Math.abs(b) >= g.slip) {
          /* fast enough to cross and get past the slip in one sample: it is
             plucked where and when the hand was a slip past the string */
          const s2 = clamp((dir * g.slip - a) / (b - a), 0, 1);
          fire(
            i,
            spot(g, mix(hand.x, x, s2)),
            dir * g.slip,
            mix(hand.t, t, s2),
            hand.width,
            hand.touch,
          );
        } else {
          holds.current[i] = {
            pointer: id,
            x: clamp(cx, g.x0 + 2, g.x1 - 2),
            d: b,
            dir,
          };
        }
      }

      hand.x = x;
      hand.y = y;
      hand.t = t;
    };

    const down = (e: PointerEvent) => {
      const g = geoRef.current;
      if (!g || (e.pointerType === "mouse" && e.button !== 0)) return;
      armStrings();
      node.setPointerCapture(e.pointerId);
      const { x, y } = local(e);
      const hand: Hand = {
        x,
        y,
        t: e.timeStamp,
        width: contact(e, g),
        touch: e.pointerType === "touch",
      };
      hands.current.set(e.pointerId, hand);
      keyboard.current = false;

      /* a press that lands on a string takes it, and damps it */
      if (x >= g.x0 && x <= g.x1) {
        let best = -1;
        let near = g.reach;
        for (let i = 0; i < COUNT; i++) {
          const gap = Math.abs(y - g.ys[i]);
          if (!holds.current[i] && gap <= near) {
            near = gap;
            best = i;
          }
        }
        if (best >= 0) {
          damp(best, e.timeStamp);
          holds.current[best] = {
            pointer: e.pointerId,
            x,
            d: y - g.ys[best],
            dir: 0,
          };
        }
      }
      run();
    };

    /** a hovering mouse or pen lifts the string it would take, a little */
    const aim = (e: PointerEvent) => {
      const g = geoRef.current;
      if (!g || e.pointerType === "touch") return;
      const { x, y } = local(e);
      let best = -1;
      if (x >= g.x0 && x <= g.x1) {
        let near = g.reach;
        for (let i = 0; i < COUNT; i++) {
          const gap = Math.abs(y - g.ys[i]);
          if (gap <= near) {
            near = gap;
            best = i;
          }
        }
      }
      if (best !== hover.current) {
        hover.current = best;
        run();
      }
    };

    const leave = () => {
      if (hover.current === -1) return;
      hover.current = -1;
      run();
    };

    const move = (e: PointerEvent) => {
      const hand = hands.current.get(e.pointerId);
      if (!hand) {
        aim(e);
        return;
      }
      const samples = e.getCoalescedEvents?.() ?? [];
      for (const sample of samples.length ? samples : [e]) {
        const { x, y } = local(sample);
        step(e.pointerId, hand, x, y, sample.timeStamp);
      }
      run();
    };

    const up = (e: PointerEvent) => {
      const hand = hands.current.get(e.pointerId);
      const g = geoRef.current;
      hands.current.delete(e.pointerId);
      if (!hand || !g) return;
      for (let i = 0; i < COUNT; i++) {
        const hold = holds.current[i];
        if (!hold || hold.pointer !== e.pointerId) continue;
        if (hold.dir === 0) {
          /* a press with no drag is a tap: the string is flicked off the pad */
          letGo(i, hand, hold.x, g.slip * 0.7, e.timeStamp);
        } else if (Math.abs(hold.d) >= 1.5) {
          letGo(i, hand, hold.x, hold.d, e.timeStamp);
        } else holds.current[i] = null;
      }
      run();
    };

    /* a cancelled pointer lets go of everything it held without a sound */
    const cancel = (e: PointerEvent) => {
      hands.current.delete(e.pointerId);
      holds.current = holds.current.map((h) =>
        h && h.pointer === e.pointerId ? null : h,
      );
      run();
    };

    node.addEventListener("pointerdown", down);
    node.addEventListener("pointermove", move);
    node.addEventListener("pointerup", up);
    node.addEventListener("pointercancel", cancel);
    node.addEventListener("pointerleave", leave);

    /* ── keyboard ────────────────────────────────────────── */

    const keys = keyTarget.current;
    const strum = (reverse: boolean) => {
      const g = geoRef.current;
      if (!g) return;
      armStrings();
      const now = performance.now();
      for (let k = 0; k < COUNT; k++) {
        const i = reverse ? COUNT - 1 - k : k;
        const t = now + k * 24;
        damp(i, t);
        fire(i, keySpot.current, (reverse ? -1 : 1) * g.slip, t, PICK, false);
      }
    };
    const key = (e: KeyboardEvent) => {
      const g = geoRef.current;
      if (!g) return;
      const digit = Number(e.key);
      if (Number.isInteger(digit) && digit >= 1 && digit <= COUNT) {
        e.preventDefault();
        armStrings();
        const t = performance.now();
        damp(digit - 1, t);
        fire(digit - 1, keySpot.current, g.slip * 0.8, t, PICK, false);
      } else if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        if (!e.repeat) strum(e.shiftKey);
      } else if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        e.preventDefault();
        const step =
          (e.shiftKey ? 0.01 : 0.05) * (e.key === "ArrowLeft" ? -1 : 1);
        keySpot.current = clamp(keySpot.current + step, 0.05, 0.95);
        run();
      }
    };
    const focus = () => {
      keyboard.current = keys?.matches(":focus-visible") ?? false;
      run();
    };
    const blur = () => {
      keyboard.current = false;
      run();
    };
    keys?.addEventListener("keydown", key);
    keys?.addEventListener("focus", focus);
    keys?.addEventListener("blur", blur);

    return () => {
      watch.disconnect();
      cancelAnimationFrame(frame.current);
      node.removeEventListener("pointerdown", down);
      node.removeEventListener("pointermove", move);
      node.removeEventListener("pointerup", up);
      node.removeEventListener("pointercancel", cancel);
      node.removeEventListener("pointerleave", leave);
      keys?.removeEventListener("keydown", key);
      keys?.removeEventListener("focus", focus);
      keys?.removeEventListener("blur", blur);
    };
  }, []);

  return (
    <div
      ref={stage}
      className="relative aspect-8/5 min-h-78 w-full cursor-pointer touch-none select-none overflow-hidden rounded-lg bg-fill"
    >
      <canvas ref={canvas} className="absolute inset-0 size-full" />

      {geo
        ? STRINGS.map((s, i) => (
            <span
              key={s.note}
              data-string={i}
              aria-hidden="true"
              className="pointer-events-none absolute -translate-y-1/2 font-mono text-meta text-text-muted [text-transform:none]"
              style={{ top: geo.ys[i], right: geo.w - geo.x0 + 14 }}
            >
              {s.note}
            </span>
          ))
        : null}

      <div
        className="pointer-events-none absolute inset-x-0 flex justify-center"
        style={{ top: geo?.readout ?? "100%" }}
      >
        <div className="flex h-8 items-center gap-3 rounded-full bg-bg pr-3.5 pl-3 ring-1 ring-stroke">
          <div className="flex h-3.5 items-end gap-[3px]">
            {Array.from({ length: BARS }, (_, n) => (
              <span
                // biome-ignore lint/suspicious/noArrayIndexKey: a harmonic is its index
                key={n}
                className="relative h-full w-[3px]"
              >
                <span className="absolute bottom-0 left-0 size-[3px] rounded-full bg-stroke-strong" />
                <span
                  ref={(el) => {
                    bars.current[n] = el;
                  }}
                  className="absolute inset-0 origin-bottom rounded-full bg-text-muted"
                  style={{ transform: "scaleY(0)" }}
                />
              </span>
            ))}
          </div>
          <p
            aria-live="polite"
            className="flex items-center gap-1.5 font-mono text-meta text-text-muted"
          >
            {readout ? (
              <>
                <span className="text-text-secondary [text-transform:none]">
                  {readout.note}
                </span>
                <span>at {readout.at}</span>
              </>
            ) : (
              <span>harmonics</span>
            )}
          </p>
        </div>
      </div>

      <button
        ref={keyTarget}
        type="button"
        aria-label="Six strings in open G. Press 1 to 6 to pluck one, Enter to strum, and the arrow keys to move where you pluck."
        className="pointer-events-none absolute inset-0 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-primary/15 focus-visible:ring-inset"
      />

      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 rounded-lg ring-1 ring-stroke ring-inset"
      />
    </div>
  );
}
