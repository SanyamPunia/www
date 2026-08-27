/**
 * The click the portrait makes when it is poked.
 *
 * Web Audio rather than an `<audio>` element, and the flurry is why: a poke can
 * land every 90ms, and one element replayed that fast has to be rewound and
 * restarted, which either swallows the play or cuts the previous one off. One
 * decoded buffer with a fresh source node per poke overlaps them properly and
 * starts on the same tick as the press, where an element's `play()` returns a
 * promise and lands whenever it lands.
 *
 * Not React, and beside its one caller rather than in `lib/`, which is for pure
 * functions: this owns a context and a buffer for the life of the page.
 */

const SRC = "/assets/poke.mp3";

/**
 * How loud, and how the pitch moves across a flurry.
 *
 * A click at full scale on a portfolio is a jump-scare, so 0.32. The rate climbs
 * with the streak the way the wobble's amplitude does, which is the only other
 * thing saying the pokes are being counted, and the poke that knocks the stack
 * loose drops below 1 instead: the pitch has been rising, and the thing coming
 * off is a release rather than another press.
 */
const GAIN = 0.32;
const RATE_STEP = 0.02;
const RATE_MAX = 1.14;
const RATE_LOOSE = 0.82;

export const rateAt = (poke: number) =>
  Math.min(1 + (poke - 1) * RATE_STEP, RATE_MAX);
export const RATE_ON_DROP = RATE_LOOSE;

/*
 * One context and one buffer for the page. Module scope rather than a ref,
 * because a second `Portrait` would want the same decoded bytes and because the
 * warm-up has to survive a remount of the photo, which every drop causes.
 */
let context: AudioContext | null = null;
let buffer: AudioBuffer | null = null;
let loading: Promise<void> | null = null;

/**
 * Fetch and decode, once.
 *
 * **Called when the pointer arrives on the photo, not on mount.** A visitor who
 * never goes near it pays nothing, and a pointer landing on the photo is a frame
 * or more ahead of the press, so by the time the first poke lands the buffer is
 * there. A lazy load on the press itself would make the first poke silent, which
 * on a joke like this reads as broken rather than as loading.
 *
 * The context is created here too, and starts suspended, since a mousemove is not
 * a user activation and a page may not have audio running without one.
 * {@link armPokeSound} is what unlocks it.
 */
export function warmPokeSound(): void {
  if (loading || typeof window === "undefined") return;
  if (!("AudioContext" in window)) return;

  loading = (async () => {
    try {
      context = new AudioContext();
      const response = await fetch(SRC);
      buffer = await context.decodeAudioData(await response.arrayBuffer());
    } catch {
      // no audio then. Every caller checks the buffer, so the poke stays silent
      // and nothing else about the interaction changes.
    }
  })();
}

/**
 * Unlock the clock, from inside a real gesture.
 *
 * **On the press, not on the sound, and this is the whole reason there are two
 * functions.** A context created outside a user activation starts suspended and
 * only a gesture may resume it, `resume` is a promise, and a suspended context's
 * clock does not advance: a source started on it is not dropped, it is queued,
 * so resuming later fires every queued click at once. Arming on `pointerdown`
 * gives the resume the length of the press to land, and {@link poke} refuses to
 * start anything until it has, so the worst case is one quiet click rather than a
 * burst.
 *
 * Warming from here as well, for touch, which has no `pointerenter` to warm on.
 */
export function armPokeSound(): void {
  warmPokeSound();
  if (context && context.state !== "running") void context.resume();
}

/**
 * Play it, at this rate.
 *
 * Silent until the buffer is there and the clock is running, and deliberately not
 * gated on reduced motion: that setting is about movement nobody asked for, and
 * this is the sound of a press. Same line the signature player draws for its play
 * button.
 */
export function poke(rate: number): void {
  if (!context || !buffer || context.state !== "running") return;

  const source = context.createBufferSource();
  source.buffer = buffer;
  source.playbackRate.value = rate;

  const gain = context.createGain();
  gain.gain.value = GAIN;

  source.connect(gain).connect(context.destination);
  source.start();
}
