import { clamp01, lerp } from "@/lib/lerp";

/**
 * Eight ways to reveal the same three lines, from one fade to a cloud of dots
 * that settles into the type.
 *
 * Every pattern is a pure function of one clock, `t` in seconds, so nothing
 * here keeps state between frames and a pattern looks the same at any instant
 * however it got there. A pattern writes styles straight to the nodes it
 * is handed, and `reset` takes every one of them off again, so switching
 * patterns cannot leave one pattern's styles on another's frame.
 */

export interface Segment {
  text: string;
  /** the phrase the line ends on, set darker as in the reference */
  hl: boolean;
}

export const LINES: readonly (readonly Segment[])[] = [
  [
    { text: "Nothing on this page", hl: false },
    { text: "is in a hurry.", hl: true },
  ],
  [
    { text: "Each line waits for", hl: false },
    { text: "the one above it,", hl: true },
  ],
  [
    { text: "then", hl: false },
    { text: "arrives on cue.", hl: true },
  ],
];

export const COPY = LINES.map((line) =>
  line.map((segment) => segment.text).join(" "),
).join(" ");

export interface Word {
  text: string;
  hl: boolean;
  line: number;
  /** across the whole copy, in reading order */
  index: number;
  /** the index of its first character across the whole copy */
  first: number;
  /** its characters, each with its index across the whole copy */
  letters: readonly { ch: string; index: number }[];
}

/** the copy as words per line, with every word and character numbered once */
export const LAYOUT: readonly (readonly Word[])[] = (() => {
  let word = 0;
  let char = 0;
  return LINES.map((segments, line) =>
    segments.flatMap((segment) =>
      segment.text.split(" ").map((text) => {
        const first = char;
        const letters = [...text].map((ch, i) => ({ ch, index: first + i }));
        const w = { text, hl: segment.hl, line, index: word, first, letters };
        word += 1;
        char += text.length;
        return w;
      }),
    ),
  );
})();

export const WORDS = LAYOUT.flat();
export const CHARS = WORDS.flatMap((word) =>
  [...word.text].map((ch) => ({ ch, hl: word.hl, word: word.index })),
);

/** the nodes a pattern writes to, indexed as `LAYOUT` numbers them */
export interface Nodes {
  /** every line together, which `assemble` fades as one */
  block: HTMLElement | null;
  /** a line's box, which clips it for the patterns that slide a line in */
  wraps: HTMLElement[];
  /** the reference's rectangle, one per line */
  rects: HTMLElement[];
  lines: HTMLElement[];
  words: HTMLElement[];
  /** a word's characters, apart from its bar */
  inks: HTMLElement[];
  /** the shutter bar over each word */
  bars: HTMLElement[];
  chars: HTMLElement[];
  /** each character's advance at rest, in ems, measured once */
  widths: number[];
}

export interface Pattern {
  id: string;
  duration: number;
  /** clip each line to its own box, for a pattern that slides a line in */
  clip?: boolean;
  /**
   * Hold every character at its resting width and centre it in that box, for
   * a pattern that changes a glyph or its weight. Without it a centred line
   * re-flows on every frame and the whole line shivers sideways.
   */
  fixed?: boolean;
  paint: (t: number, n: Nodes) => void;
}

/** progress through `[start, start + duration]`, held at 0 and 1 outside it */
function seg(t: number, start: number, duration: number): number {
  return clamp01((t - start) / duration);
}

const outCubic = (x: number) => 1 - (1 - x) ** 3;
const outExpo = (x: number) => (x >= 1 ? 1 : 1 - 2 ** (-10 * x));
const inOutCubic = (x: number) =>
  x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2;
const inOutExpo = (x: number) => {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  return x < 0.5 ? 2 ** (20 * x - 10) / 2 : (2 - 2 ** (-20 * x + 10)) / 2;
};

/** an integer hash to a float in [0, 1), so one frame always draws the same noise */
export function hash(n: number): number {
  let x = n | 0;
  x = Math.imul(x ^ (x >>> 16), 0x45d9f3b);
  x = Math.imul(x ^ (x >>> 16), 0x45d9f3b);
  x ^= x >>> 16;
  return (x >>> 0) / 4294967296;
}

const GLYPHS = "abcdefghijklmnopqrstuvwxyz0123456789#%&*+=?<>/";

/** Take every style any pattern writes back off, so the copy is plain type. */
export function reset(n: Nodes): void {
  if (n.block) n.block.style.opacity = "";
  for (const el of n.wraps) el.style.overflow = "";
  for (const el of n.rects) {
    el.style.display = "";
    el.style.transform = "";
  }
  for (const el of n.lines) {
    el.style.opacity = "";
    el.style.transform = "";
    el.style.transformOrigin = "";
  }
  for (const el of n.inks) {
    el.style.opacity = "";
    el.style.transform = "";
    el.style.filter = "";
  }
  for (const el of n.bars) {
    el.style.display = "";
    el.style.transform = "";
    el.style.transformOrigin = "";
  }
  n.chars.forEach((el, i) => {
    el.style.opacity = "";
    el.style.transform = "";
    el.style.fontWeight = "";
    el.style.width = "";
    el.style.display = "";
    el.style.justifyContent = "";
    el.style.color = "";
    const ch = CHARS[i]?.ch ?? "";
    if (el.textContent !== ch) el.textContent = ch;
  });
}

/** Set up what a pattern holds for its whole run, before its first frame. */
export function prepare(pattern: Pattern, n: Nodes): void {
  if (pattern.clip) for (const el of n.wraps) el.style.overflow = "hidden";
  if (pattern.fixed) {
    n.chars.forEach((el, i) => {
      el.style.width = `${n.widths[i] ?? 0}em`;
      el.style.display = "inline-flex";
      el.style.justifyContent = "center";
    });
  }
}

const each = (n: number, step: number, duration: number) =>
  (n - 1) * step + duration;

/** 01. Each line fades up, one beat after the line above. */
const fade: Pattern = {
  id: "fade",
  duration: each(LINES.length, 0.09, 0.7),
  paint(t, n) {
    n.lines.forEach((el, i) => {
      const p = outCubic(seg(t, i * 0.09, 0.7));
      el.style.opacity = String(p);
      el.style.transform = `translateY(${(1 - p) * 0.4}em)`;
    });
  },
};

/**
 * 02. Each line rises out of its own box, tipped back on its foot so it lands
 * rather than slides.
 */
const rise: Pattern = {
  id: "rise",
  duration: each(LINES.length, 0.11, 1),
  clip: true,
  paint(t, n) {
    n.lines.forEach((el, i) => {
      const p = outExpo(seg(t, i * 0.11, 1));
      el.style.transformOrigin = "0 100%";
      el.style.transform = `translateY(${(1 - p) * 112}%) rotate(${(1 - p) * 3}deg)`;
    });
  },
};

/**
 * 03. The reference. A rounded rectangle sits on every line, squeezes away to
 * its left on an in-out curve, and the line slides in behind it from the right,
 * starting 60% into the rectangle's own move.
 */
const WIPE = { rect: 0.8, text: 0.8, at: 0.6, stagger: 0.05 };
const wipe: Pattern = {
  id: "wipe",
  duration: WIPE.rect * WIPE.at + each(LINES.length, WIPE.stagger, WIPE.text),
  clip: true,
  paint(t, n) {
    n.rects.forEach((el, i) => {
      const r = inOutExpo(seg(t, i * WIPE.stagger, WIPE.rect));
      el.style.display = "block";
      el.style.transform = `scaleX(${1 - r})`;
    });
    n.lines.forEach((el, i) => {
      const q = outExpo(
        seg(t, WIPE.rect * WIPE.at + i * WIPE.stagger, WIPE.text),
      );
      el.style.opacity = String(q);
      el.style.transform = `translateX(${(1 - q) * 2.4}em)`;
    });
  },
};

/**
 * 04. The wipe per word, both ways. A bar draws across each word from its left,
 * the word appears under it, and the bar leaves to the right. The phrase each
 * line ends on gets a dark bar, so the emphasis arrives before the words do.
 */
const SHUTTER = { stagger: 0.055, cover: 0.38, gap: 0.02, uncover: 0.5 };
const shutter: Pattern = {
  id: "shutter",
  duration:
    (WORDS.length - 1) * SHUTTER.stagger +
    SHUTTER.cover +
    SHUTTER.gap +
    SHUTTER.uncover,
  paint(t, n) {
    WORDS.forEach((word, w) => {
      const bar = n.bars[w];
      const ink = n.inks[w];
      if (!bar || !ink) return;
      const s = word.index * SHUTTER.stagger;
      const off = s + SHUTTER.cover + SHUTTER.gap;
      const g = inOutExpo(seg(t, s, SHUTTER.cover));
      const r = inOutExpo(seg(t, off, SHUTTER.uncover));
      bar.style.display = "block";
      // the origin swaps while the bar is whole, so the swap cannot be seen
      bar.style.transformOrigin = r > 0 ? "100% 50%" : "0 50%";
      bar.style.transform = `scaleX(${r > 0 ? 1 - r : g})`;
      ink.style.opacity = t >= s + SHUTTER.cover ? "1" : "0";
      const q = outExpo(seg(t, off, 0.7));
      ink.style.transform = `translateX(${(q - 1) * 0.12}em)`;
    });
  },
};

/** 05. Each word racks into focus from a blur, a little larger than it lands. */
const focus: Pattern = {
  id: "focus",
  duration: each(WORDS.length, 0.05, 0.8),
  paint(t, n) {
    n.inks.forEach((el, w) => {
      const p = seg(t, w * 0.05, 0.8);
      const e = outCubic(p);
      const blur = (1 - e) * 0.42;
      el.style.opacity = String(outCubic(clamp01(p * 1.8)));
      el.style.filter = blur > 0.002 ? `blur(${blur}em)` : "";
      el.style.transform = `translateY(${(1 - outExpo(p)) * 0.3}em) scale(${1.06 - 0.06 * e})`;
    });
  },
};

/**
 * 06. Each character turns up as noise and settles on its letter, left to
 * right. The noise is a hash of the character and the frame, never a random
 * call, so a replay shows the same noise.
 */
const DECODE = { stagger: 0.02, settle: 0.34, rate: 28 };
const decode: Pattern = {
  id: "decode",
  duration: each(CHARS.length, DECODE.stagger, DECODE.settle),
  fixed: true,
  paint(t, n) {
    n.chars.forEach((el, c) => {
      const ch = CHARS[c]?.ch ?? "";
      const s = c * DECODE.stagger;
      let text = ch;
      if (t < s) {
        el.style.opacity = "0";
      } else if (t < s + DECODE.settle) {
        el.style.opacity = "1";
        el.style.color = "var(--color-text-muted)";
        const frame = Math.floor(t * DECODE.rate);
        text = GLYPHS[Math.floor(hash(c * 97 + frame * 7919) * GLYPHS.length)];
      } else {
        el.style.opacity = "1";
        el.style.color = "";
      }
      if (el.textContent !== text) el.textContent = text;
    });
  },
};

/**
 * 07. A wave of weight runs through the copy on Inter's variable axis. Each
 * character arrives hairline, swells past black and settles on its own
 * weight. Its box stays at its resting width, so the heavy glyph spills over
 * its neighbours rather than shoving the line.
 */
const WEIGHT = { stagger: 0.022, run: 0.7, peak: 0.3, from: 100, top: 860 };
export const REST_WEIGHT = 500;
const weight: Pattern = {
  id: "weight",
  duration: each(CHARS.length, WEIGHT.stagger, WEIGHT.run),
  fixed: true,
  paint(t, n) {
    n.chars.forEach((el, c) => {
      const p = seg(t, c * WEIGHT.stagger, WEIGHT.run);
      const w =
        p < WEIGHT.peak
          ? lerp(WEIGHT.from, WEIGHT.top, outCubic(p / WEIGHT.peak))
          : lerp(
              WEIGHT.top,
              REST_WEIGHT,
              inOutCubic((p - WEIGHT.peak) / (1 - WEIGHT.peak)),
            );
      el.style.opacity = String(clamp01(p / 0.12));
      el.style.fontWeight = String(Math.round(w));
      el.style.transform = `translateY(${(1 - outCubic(clamp01(p / 0.4))) * 0.3}em)`;
    });
  },
};

/**
 * 08. A cloud of dots settles into the letters, then the type fades in over
 * them and the dots go. The dots are drawn by `assemble.ts`, so all this
 * pattern does to the DOM is hold the type back until they have landed.
 */
export const ASSEMBLE = { sweep: 0.6, jitter: 0.25, flight: 0.95, fade: 0.4 };
export const ARRIVE = ASSEMBLE.sweep + ASSEMBLE.jitter + ASSEMBLE.flight;
const assemble: Pattern = {
  id: "assemble",
  duration: ARRIVE + ASSEMBLE.fade,
  paint(t, n) {
    if (n.block)
      n.block.style.opacity = String(outCubic(seg(t, ARRIVE, ASSEMBLE.fade)));
  },
};

/** in order of how much machinery each one needs, from none to most */
export const PATTERNS: readonly Pattern[] = [
  fade,
  rise,
  wipe,
  shutter,
  focus,
  decode,
  weight,
  assemble,
];
