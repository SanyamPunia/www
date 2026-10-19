/**
 * The watchlist, as numbers. Pure and DOM-free.
 *
 * Every company is made up, so nothing here can be read as a real quote. Each
 * stock is a window of its last 24 prices, and a refresh pushes one new price
 * on and drops the oldest, so the sparkline keeps the same number of points
 * and can morph from one shape to the next. Nothing rolls at runtime: every
 * step comes off a seeded generator, so the same pull gives the same prices.
 */

export const POINTS = 24;

/**
 * Up and down, the two hues a quote is painted in, each with white text on
 * it clearing 4.5:1: green 5.02, red 4.73. Scoped to this experiment, not
 * tokens. Colour is what says which way a stock moved before the number is
 * read, the exception the lab's other scoped sets take.
 */
export const HUE = { up: "#15803d", down: "#d6372b" } as const;

export interface Stock {
  ticker: string;
  name: string;
  /** shares outstanding, in billions, for the market cap */
  shares: number;
  history: number[];
}

/**
 * What the pills show, cycled by a tap on any of them, the way Stocks does:
 * the day's move as a percentage, as a price change, or the market cap.
 */
export type Mode = "percent" | "change" | "cap";

export const MODES: readonly Mode[] = ["percent", "change", "cap"];

export const MODE_LABEL: Record<Mode, string> = {
  percent: "percent change",
  change: "price change",
  cap: "market cap",
};

/** a small, fast, seedable generator, so a run is the same every time */
function mulberry(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** one step of a random walk, a fraction of a percent either way */
function walk(price: number, rand: () => number, bias: number): number {
  const move = (rand() - 0.5 + bias) * 0.018;
  return Math.max(1, price * (1 + move));
}

const COMPANIES: readonly [string, string, number, number, number][] = [
  ["ORBT", "Orbital Systems", 214.3, 0.06, 2.4],
  ["KITE", "Kite Labs", 48.12, -0.05, 0.92],
  ["NOVA", "Nova Energy", 132.8, 0.04, 3.1],
  ["LUMA", "Luma Health", 76.45, -0.03, 1.2],
  ["PIXL", "Pixel Works", 301.2, 0.05, 4.6],
  ["TIDE", "Tide Freight", 22.9, -0.06, 0.41],
  ["FERN", "Fern Foods", 61.33, 0.02, 1.8],
  ["VOLT", "Volt Motors", 188.6, -0.04, 3.3],
  ["AXIS", "Axis Robotics", 97.1, 0.03, 0.75],
  ["MOSS", "Moss Bank", 39.75, -0.02, 2.2],
];

export function initialStocks(): Stock[] {
  return COMPANIES.map(([ticker, name, start, bias, shares], i) => {
    const rand = mulberry(i * 7919 + 13);
    const history = [start];
    for (let k = 1; k < POINTS; k++)
      history.push(walk(history[k - 1], rand, bias));
    return { ticker, name, shares, history };
  });
}

/** a refresh: one new price on the end of every window, the oldest dropped */
export function step(stocks: readonly Stock[], round: number): Stock[] {
  return stocks.map((s, i) => {
    const rand = mulberry(round * 104729 + i * 7919 + 1);
    const last = s.history[s.history.length - 1];
    // a nudge toward the day's open, so a long run of pulls does not run away
    const open = s.history[0];
    const pull = ((open - last) / open) * 0.8;
    const next = walk(last, rand, pull);
    return { ...s, history: [...s.history.slice(1), next] };
  });
}

/** the price at point `k` of the window, or the latest when `k` is null */
export function at(s: Stock, k: number | null): number {
  return s.history[k ?? s.history.length - 1];
}

/** the day's move to point `k`, against the first price in the window */
export function change(s: Stock, k: number | null = null): number {
  const open = s.history[0];
  return (at(s, k) - open) / open;
}

export function price(s: Stock, k: number | null = null): string {
  return at(s, k).toFixed(2);
}

/** what the pill says in the given mode, at point `k` */
export function pill(s: Stock, mode: Mode, k: number | null = null): string {
  const p = at(s, k);
  if (mode === "percent") return percent(change(s, k));
  if (mode === "change") {
    const d = p - s.history[0];
    return `${d >= 0 ? "+" : "-"}${Math.abs(d).toFixed(2)}`;
  }
  const cap = p * s.shares;
  return cap >= 1000 ? `${(cap / 1000).toFixed(2)}T` : `${cap.toFixed(1)}B`;
}

export function percent(c: number): string {
  const v = (c * 100).toFixed(2);
  return c >= 0 ? `+${v}%` : `${v}%`;
}

/**
 * The sparkline and the open's dotted line, in a `w` by `h` box. Always the
 * same number of points, so one path morphs into the next.
 */
export function spark(
  s: Stock,
  w: number,
  h: number,
): { d: string; open: number; points: [number, number][] } {
  const lo = Math.min(...s.history);
  const hi = Math.max(...s.history);
  const span = hi - lo || 1;
  const pad = 2;
  const y = (v: number) => pad + (1 - (v - lo) / span) * (h - pad * 2);
  const points = s.history.map(
    (v, k) => [(k / (POINTS - 1)) * w, y(v)] as [number, number],
  );
  const d = points
    .map(
      ([x, py], k) => `${k === 0 ? "M" : "L"}${x.toFixed(2)} ${py.toFixed(2)}`,
    )
    .join(" ");
  return { d, open: y(s.history[0]), points };
}
