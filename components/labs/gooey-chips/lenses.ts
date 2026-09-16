/*
 * What the chips filter, and the one thing that makes this demo honest.
 *
 * The reference this comes from reports "19 results" from a hardcoded table of
 * weights: a number that can only be believed. This filters a real list and the
 * count is `matches().length`, with enough of the matched rows on screen that a
 * reader can count them.
 *
 * **Every tag is derivable from the row it sits on**, which is the stronger
 * half of the claim. The rules are stated once, here, and then a reader can
 * check any lens against them by reading its own name:
 *
 * - `prime` is one focal length, `zoom` is a range. The name says which.
 * - `wide` is 35mm or shorter, at the wide end for a zoom.
 * - `tele` is 85mm or longer, at the long end for a zoom.
 * - `fast` is f/2.8 or wider.
 * - `macro` says macro.
 *
 * So 40mm f/2.8 is a fast prime and neither wide nor tele, which is what a
 * normal lens is. Nothing here is a claim about the world that a reader has to
 * take on trust, which is the difference between real data and a plausible
 * number.
 */

export type Tag = "prime" | "zoom" | "wide" | "tele" | "macro" | "fast";

/**
 * The chips, in the order they sit in the row. Ordered widest idea to
 * narrowest, so the row reads as a set rather than as a shuffle.
 */
export const TAGS: readonly Tag[] = [
  "prime",
  "zoom",
  "wide",
  "tele",
  "macro",
  "fast",
];

export interface Lens {
  /** the whole of the row, and the whole of the evidence for its tags */
  name: string;
  tags: readonly Tag[];
}

export const LENSES: readonly Lens[] = [
  { name: "14mm f/2.8", tags: ["prime", "wide", "fast"] },
  { name: "24mm f/1.4", tags: ["prime", "wide", "fast"] },
  { name: "28mm f/2.8", tags: ["prime", "wide", "fast"] },
  { name: "35mm f/2", tags: ["prime", "wide", "fast"] },
  { name: "40mm f/2.8", tags: ["prime", "fast"] },
  { name: "50mm f/1.2", tags: ["prime", "fast"] },
  { name: "58mm f/5.6", tags: ["prime"] },
  { name: "85mm f/1.8", tags: ["prime", "tele", "fast"] },
  { name: "105mm f/4", tags: ["prime", "tele"] },
  { name: "135mm f/2", tags: ["prime", "tele", "fast"] },
  { name: "200mm f/2.8", tags: ["prime", "tele", "fast"] },
  { name: "300mm f/4", tags: ["prime", "tele"] },
  { name: "60mm f/2.8 macro", tags: ["prime", "macro", "fast"] },
  { name: "90mm f/2.8 macro", tags: ["prime", "tele", "macro", "fast"] },
  { name: "100mm f/4 macro", tags: ["prime", "tele", "macro"] },
  { name: "12-24mm f/4", tags: ["zoom", "wide"] },
  { name: "16-35mm f/2.8", tags: ["zoom", "wide", "fast"] },
  { name: "24-70mm f/2.8", tags: ["zoom", "wide", "fast"] },
  { name: "70-200mm f/4", tags: ["zoom", "tele"] },
  { name: "100-400mm f/5.6", tags: ["zoom", "tele"] },
];

/**
 * Every lens carrying all of the chosen tags.
 *
 * All of them and not any of them, so picking a second chip narrows rather than
 * widens. A filter that grows as you add to it teaches the opposite of what a
 * filter does, and the count going down is most of what makes the tray worth
 * watching.
 */
export function matches(chosen: readonly Tag[]): readonly Lens[] {
  if (chosen.length === 0) return LENSES;
  return LENSES.filter((lens) =>
    chosen.every((tag) => lens.tags.includes(tag)),
  );
}
