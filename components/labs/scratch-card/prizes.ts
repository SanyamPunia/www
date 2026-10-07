/**
 * What is under the coating: nine symbols, and the prize three of a kind wins.
 *
 * A card is built so its answer is fixed before anyone scratches it, the way a
 * printed ticket is. A winning card carries one symbol three times and no other
 * more than twice. A losing card carries none three times. Every symbol is a
 * prize of its own, so what you match is what you win.
 */

export type Mark =
  | "cherries"
  | "clover"
  | "crown"
  | "diamond"
  | "heart"
  | "star";

export const SYMBOLS: readonly Mark[] = [
  "cherries",
  "clover",
  "crown",
  "diamond",
  "heart",
  "star",
];

export const PRIZES: Record<Mark, string> = {
  cherries: "Two prints for the price of one",
  clover: "Free shipping for a month",
  crown: "Early access to the next drop",
  diamond: "A year of the members' club",
  heart: "A free coffee, any size",
  star: "20% off your next order",
};

/** one card in four loses, which is generous for a scratch card */
const WIN_RATE = 0.75;

export interface Card {
  id: number;
  cells: Mark[];
  /** the symbol that comes up three times, or null on a losing card */
  win: Mark | null;
  code: string;
}

/** no 0 and O, no 1 and I, so a code read off a card is typed right */
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

function pick(n: number): string {
  let out = "";
  for (let i = 0; i < n; i++) {
    out += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return out;
}

function shuffle<T>(list: T[]): T[] {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function makeCard(id: number, previous?: Card): Card {
  const wins = Math.random() < WIN_RATE;
  // never the same prize twice running, or a new card looks like the old one
  const pool = shuffle(SYMBOLS.filter((s) => s !== previous?.win));
  if (wins) {
    const [win, a, b, c] = pool;
    return {
      id,
      cells: shuffle([win, win, win, a, a, b, b, c, c]),
      win,
      code: `${pick(4)}-${pick(4)}`,
    };
  }
  // four pairs and a single, so a losing card still teases two of a kind
  const [a, b, c, d, e] = shuffle([...SYMBOLS]);
  return {
    id,
    cells: shuffle([a, a, b, b, c, c, d, d, e]),
    win: null,
    code: "",
  };
}
