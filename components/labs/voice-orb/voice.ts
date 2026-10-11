/*
 * What the orb says, as a list of syllables on a clock.
 *
 * The reply is not speech. It is the shape of speech: syllables grouped into
 * words, words into a sentence, and a pause between sentences. The orb's swell
 * reads it, which is what makes the answer look like talking rather than a
 * pulse on a timer.
 *
 * Pure and DOM-free. Times are seconds from the start of the reply.
 */

export interface Syllable {
  /** when it starts, in seconds from the start of the reply */
  at: number;
  dur: number;
  /** how loud it is, 0 to 1 */
  peak: number;
}

/** mulberry32: a seeded generator, so a reply is reproducible from its seed */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * A reply about `length` seconds long. It always ends on the end of a word,
 * so it can run a little over.
 */
export function utterance(length: number, seed: number): Syllable[] {
  const r = rng(seed);
  const out: Syllable[] = [];
  let at = 0.05;
  let words = 0;
  // a sentence is four to seven words
  let sentence = 4 + Math.floor(r() * 4);
  let inSentence = 0;

  while (at < length) {
    const count = 1 + Math.floor(r() ** 1.6 * 3);
    for (let i = 0; i < count; i++) {
      const dur = 0.1 + r() * 0.12;
      // the stressed syllable is the first of a word, and it is a touch louder
      out.push({
        at,
        dur,
        peak: (0.55 + r() * 0.45) * (i === 0 ? 1 : 0.85),
      });
      at += dur + 0.015 + r() * 0.035;
    }
    words++;
    inSentence++;
    if (inSentence >= sentence) {
      at += 0.32 + r() * 0.12;
      inSentence = 0;
      sentence = 4 + Math.floor(r() * 4);
    } else {
      at += 0.07 + r() * 0.12;
    }
    if (words > 40) break;
  }
  return out;
}

/** when the reply is over */
export function endOf(list: readonly Syllable[]): number {
  const last = list[list.length - 1];
  return last ? last.at + last.dur : 0;
}

/**
 * How loud the reply is at `t`. A syllable rises fast and falls slower, which
 * is the shape of a voiced syllable and the reason the orb reads as talking
 * rather than pulsing.
 */
export function envelope(list: readonly Syllable[], t: number): number {
  for (const s of list) {
    if (t < s.at) return 0;
    const x = (t - s.at) / s.dur;
    if (x <= 1) {
      const shape = x < 0.25 ? x / 0.25 : 1 - ((x - 0.25) / 0.75) ** 1.6;
      return s.peak * Math.max(0, shape);
    }
  }
  return 0;
}
