/*
 * The model behind a scrubbable number, pure and DOM-free: how a pointer's
 * travel becomes a value, where it sticks, where it stops, how it coasts, and
 * what typing into the field means. `field.tsx` is the gesture and the
 * drawing.
 */

export type Key = "weight" | "size" | "track" | "lead";

export interface Spec {
  key: Key;
  /** the accessible name, and what the tooltip says */
  name: string;
  unit: string;
  /** spoken after the value, since a screen reader reads `%` and `×` badly */
  spoken: string;
  min: number;
  max: number;
  def: number;
  /** the grid a scrub lands on at base speed */
  step: number;
  /** value per px of hand at base speed */
  perPx: number;
  /** what a typed sum may call this field, beside its key */
  alias: string;
}

/**
 * Inter's own tracking for a size, from its dynamic metrics: `a + b * e^(c *
 * size)` em, with the constants Rasmus Andersson publishes at
 * rsms.me/inter/dynmetrics. Small type opens up and large type closes in.
 * Returned in percent of the em, which is what the field shows.
 */
export function autoTrack(size: number): number {
  const em = -0.0223 + 0.185 * Math.exp(-0.1745 * size);
  return Math.round(em * 1000) / 10;
}

export const SPECS: readonly Spec[] = [
  {
    key: "weight",
    name: "Weight",
    unit: "",
    spoken: "",
    min: 100,
    max: 900,
    def: 600,
    step: 1,
    perPx: 2,
    alias: "w",
  },
  {
    key: "size",
    name: "Size",
    unit: "px",
    spoken: "pixels",
    min: 12,
    max: 72,
    def: 56,
    step: 1,
    perPx: 0.25,
    alias: "s",
  },
  {
    key: "track",
    name: "Tracking",
    unit: "%",
    spoken: "percent",
    min: -10,
    max: 20,
    def: autoTrack(56),
    step: 0.1,
    perPx: 0.05,
    alias: "t",
  },
  {
    key: "lead",
    name: "Line height",
    unit: "×",
    spoken: "times",
    min: 0.8,
    max: 1.8,
    def: 1,
    step: 0.01,
    perPx: 0.005,
    alias: "l",
  },
];

export const SPEC = Object.fromEntries(SPECS.map((s) => [s.key, s])) as Record<
  Key,
  Spec
>;

export type Values = Record<Key, number>;

export const DEFAULTS = Object.fromEntries(
  SPECS.map((s) => [s.key, s.def]),
) as Values;

/**
 * Shift and Alt change the speed, and they change the grid with it. A fast
 * scrub lands on tens of steps and a fine one on tenths, so Shift is how you
 * reach a round number and Alt is how you leave one.
 */
export type Gear = "fine" | "base" | "fast";

export function gearOf(e: { shiftKey: boolean; altKey: boolean }): Gear {
  if (e.shiftKey) return "fast";
  if (e.altKey) return "fine";
  return "base";
}

export const GEAR = { fine: 0.1, base: 1, fast: 10 } as const;

export function stepOf(spec: Spec, gear: Gear): number {
  return spec.step * GEAR[gear];
}

/**
 * How far below the field the hand has drifted, as a slowdown. The first
 * 24px are free, so an unsteady hand does not change speed, and past that the
 * speed falls by a step for every 48px, down to a twelfth. Apple's video
 * scrubber does the same thing in bands, and a continuous curve is the same
 * idea without the jumps between them.
 */
export function precisionOf(down: number): number {
  if (down <= 24) return 1;
  return Math.max(1 / 12, 1 / (1 + (down - 24) / 48));
}

/** A value a scrub sticks to on the way past, and why, if it has a name. */
export interface Detent {
  at: number;
  name?: string;
}

const WEIGHTS = [
  "thin",
  "extralight",
  "light",
  "regular",
  "medium",
  "semibold",
  "bold",
  "extrabold",
  "black",
];

/**
 * Where each field sticks, given the rest of the item. Weight sticks at its
 * nine named weights, size at a few sizes a designer reaches for, tracking at
 * none and at Inter's own value for the current size, and line height at solid
 * and at the 1.6 this site sets its body copy in.
 */
export function detentsFor(key: Key, v: Values): Detent[] {
  switch (key) {
    case "weight":
      return WEIGHTS.map((name, i) => ({ at: (i + 1) * 100, name }));
    case "size":
      return [16, 24, 32, 48, 64].map((at) => ({ at }));
    case "track":
      return [
        { at: 0, name: "none" },
        { at: autoTrack(v.size), name: "auto" },
      ];
    case "lead":
      return [
        { at: 1, name: "solid" },
        { at: 1.6, name: "body" },
      ];
  }
}

/** How much hand travel a detent holds on to before it lets go, px. */
export const STICK = 10;

/** Where a scrub may go, which for a mixed selection is a range of deltas. */
export interface Bounds {
  min: number;
  max: number;
}

/**
 * Everything a scrub carries from one pointer event to the next.
 *
 * `raw` is a float that keeps the sub-step remainder, so a slow hand still
 * moves the value. `hold` is the travel a detent has left to absorb. `over` is
 * how far the hand has pushed past a limit, which draws the rubber band and
 * nothing else.
 */
export interface Scrub {
  raw: number;
  value: number;
  hold: number;
  stuck: Detent | null;
  /** the detent last let go of, so leaving it does not catch it again */
  left: number | null;
  over: number;
}

export function begin(value: number): Scrub {
  return { raw: value, value, hold: 0, stuck: null, left: null, over: 0 };
}

/**
 * One pointer event's worth of travel, `dx` px at `gain` value per px.
 *
 * **It integrates rather than mapping total distance to a value**, and that is
 * the whole reason the speed can change mid-scrub. `start + distance * gain`
 * rescales every pixel already travelled the moment Shift goes down, or the
 * hand drifts below the field, so the value leaps. Adding each event at the
 * gain in force for it means a change of speed only changes what comes next.
 *
 * **Detents are caught at base speed only**, which the caller says by passing
 * an empty list. At Shift's speed the weight detents sit closer together than
 * their own hold, so a fast scrub becomes a row of stops, and Alt is how a
 * reader asks for 599.5 beside a detent at 600. A detent being held is let go
 * of the moment the list comes back empty.
 */
export function advance(
  s: Scrub,
  dx: number,
  gain: number,
  step: number,
  bounds: Bounds,
  detents: readonly Detent[],
): Scrub {
  let { raw, hold, stuck, left, over } = s;
  let px = dx;
  if (px === 0) return s;
  const dir = Math.sign(px);

  // reversing away from a limit moves the value at once. Owing the hand the
  // travel it spent pushing into the wall is what makes a slider feel stuck
  if (over !== 0 && Math.sign(over) !== dir) over = 0;

  if (stuck && detents.length === 0) {
    left = stuck.at;
    raw = stuck.at;
    stuck = null;
    hold = 0;
  }

  // a detent holds the value until the hand has pushed through its window,
  // in either direction
  if (stuck) {
    const take = Math.min(Math.abs(px), hold);
    hold -= take;
    px -= dir * take;
    if (hold > 0) return { ...s, hold, over };
    left = stuck.at;
    raw = stuck.at;
    stuck = null;
  }

  // walk the remaining travel across every detent it crosses, in order
  for (let guard = 0; guard < 16 && px !== 0; guard++) {
    const next = raw + px * gain;
    let hit: Detent | null = null;
    for (const d of detents) {
      if (d.at === left) continue;
      const crosses =
        dir > 0 ? d.at > raw && d.at <= next : d.at < raw && d.at >= next;
      if (!crosses) continue;
      if (!hit || Math.abs(d.at - raw) < Math.abs(hit.at - raw)) hit = d;
    }
    if (!hit) {
      raw = next;
      px = 0;
      break;
    }
    const spent = (hit.at - raw) / gain;
    const rest = Math.abs(px - spent);
    raw = hit.at;
    left = null;
    if (rest < STICK) {
      stuck = hit;
      hold = STICK - rest;
      px = 0;
      break;
    }
    // a hand fast enough to clear the whole window in one event passes through
    left = hit.at;
    px = dir * (rest - STICK);
  }

  if (raw > bounds.max) {
    over += (raw - bounds.max) / gain;
    raw = bounds.max;
  } else if (raw < bounds.min) {
    over -= (bounds.min - raw) / gain;
    raw = bounds.min;
  }
  if (stuck && (stuck.at > bounds.max || stuck.at < bounds.min)) stuck = null;

  const value = stuck ? stuck.at : snap(raw, step, bounds);
  return { raw, value, hold, stuck, left, over };
}

/**
 * Onto the gear's grid, then inside the range. A detent can sit off the grid,
 * a tracking of -2.2 while the scrub runs in whole percents, which is why a
 * stuck value skips this entirely.
 */
export function snap(raw: number, step: number, bounds: Bounds): number {
  const v = Math.round(raw / step) * step;
  return clean(Math.min(bounds.max, Math.max(bounds.min, v)));
}

/** Float noise off a value that is meant to be on a decimal grid. */
export function clean(v: number): number {
  return Math.round(v * 1e6) / 1e6;
}

/**
 * How long a thrown scrub keeps coasting, s. Its speed falls by `e` every
 * this long, so it covers `v * COAST` px of hand in all.
 */
export const COAST = 0.32;

/** Below this a coasting scrub has stopped, px/s. */
export const REST = 24;

/** Below this a release is a placement rather than a throw, px/s. */
export const THROW = 160;

/** How far the drawn number gives against a limit, px. */
export function band(over: number): number {
  if (over === 0) return 0;
  return Math.sign(over) * Math.min(5, Math.sqrt(Math.abs(over)) * 0.7);
}

/** Decimals a field shows: its own step's, plus one for Alt. */
export function decimals(spec: Spec): number {
  return Math.max(0, Math.round(-Math.log10(spec.step))) + 1;
}

/** Trailing zeros off, and never `-0`. */
export function format(v: number, spec: Spec): string {
  const r = Number(v.toFixed(decimals(spec)));
  if (r === 0) return "0";
  return String(r);
}

/** A delta during a mixed scrub, always signed. */
export function formatDelta(v: number, spec: Spec): string {
  const s = format(Math.abs(v), spec);
  if (s === "0") return "±0";
  return `${v < 0 ? "−" : "+"}${s}`;
}

/**
 * What the reader typed, as a number, or null when it is not one.
 *
 * Arithmetic works, `120/3`, `2*(40+8)`, `3x4`, because a field you can type
 * into is a place people do sums. Another field's name works too, `size/2` or
 * `w+100`, from `refs`, so one value can be set from another. A leading `+`,
 * `*` or `/` applies to the current value, so `*2` doubles it and `+10` adds
 * ten. A leading `-` is a negative number rather than a subtraction, since
 * `-2` in a tracking field means minus two far more often than "take two off".
 * The field's own unit is allowed at the end and ignored, so `48px` pastes.
 *
 * A recursive descent over a handful of tokens rather than `eval` or
 * `new Function`, which would run whatever was pasted.
 */
export function evaluate(
  text: string,
  current: number,
  unit: string,
  refs: Record<string, number>,
): number | null {
  let src = text.trim().toLowerCase().replace(/\s+/g, "");
  const units = unit === "×" ? ["×", "x"] : unit ? [unit] : [];
  for (const u of units) {
    if (
      src.endsWith(u) &&
      src.length > u.length &&
      /[\d)]/.test(src.at(-1 - u.length) ?? "")
    ) {
      src = src.slice(0, -u.length);
      break;
    }
  }
  if (src === "") return null;
  if (/^[+*/×]/.test(src)) src = `${current}${src}`;

  let i = 0;
  const peek = () => src[i];
  const expr = (): number => {
    let v = term();
    while (peek() === "+" || peek() === "-") {
      const op = src[i++];
      const t = term();
      v = op === "+" ? v + t : v - t;
    }
    return v;
  };
  const term = (): number => {
    let v = factor();
    // `x` multiplies only between two operands, never at the start of a name
    while (
      peek() === "*" ||
      peek() === "/" ||
      peek() === "×" ||
      (peek() === "x" && !/[a-z]/.test(src[i + 1] ?? ""))
    ) {
      const op = src[i++];
      const f = factor();
      v = op === "/" ? v / f : v * f;
    }
    return v;
  };
  const factor = (): number => {
    const c = peek();
    if (c === "-") {
      i++;
      return -factor();
    }
    if (c === "+") {
      i++;
      return factor();
    }
    if (c === "(") {
      i++;
      const v = expr();
      if (src[i++] !== ")") throw new Error("paren");
      return v;
    }
    const name = /^[a-z]+/.exec(src.slice(i));
    if (name) {
      if (!(name[0] in refs)) throw new Error("name");
      i += name[0].length;
      return refs[name[0]];
    }
    const m = /^(\d+\.?\d*|\.\d+)/.exec(src.slice(i));
    if (!m) throw new Error("number");
    i += m[0].length;
    return Number(m[0]);
  };

  try {
    const v = expr();
    if (i !== src.length || !Number.isFinite(v)) return null;
    return v;
  } catch {
    return null;
  }
}

/** A typed or stepped value, inside the field's range and on its fine grid. */
export function fit(v: number, spec: Spec): number {
  const grid = spec.step / 10;
  return clean(
    Math.min(spec.max, Math.max(spec.min, Math.round(v / grid) * grid)),
  );
}

/** Every name a sum may use for every field. */
export function refsOf(v: Values): Record<string, number> {
  const out: Record<string, number> = {};
  for (const s of SPECS) {
    out[s.key] = v[s.key];
    out[s.alias] = v[s.key];
  }
  out.tracking = v.track;
  out.leading = v.lead;
  return out;
}
