/**
 * What a scrubbed number sounds like, synthesised rather than fetched.
 *
 * `crack-sound.ts` sets the shape and `cube-orbit`'s `dial-sound.ts` the size:
 * one context, one noise buffer, a few milliseconds of narrow noise per event,
 * and the page fetches nothing.
 *
 * - **A step is a tick, pitched by where the value sits in its range**, so a
 *   scrub up a field climbs and a scrub down it falls. The band runs 1.4kHz to
 *   4.2kHz.
 * - **Ticks are limited to one per 14ms**, which is what turns a fast scrub
 *   into a rattle rather than a wall of overlapping clicks. A Shift scrub
 *   changes the value by ten steps an event, so it rattles at the rate of the
 *   hand rather than the rate of the steps.
 * - **A detent is a lower, heavier click**, and a limit a soft knock, since
 *   those are the two events the hand should feel rather than count.
 */

let ctx: AudioContext | null = null;
let noise: AudioBuffer | null = null;
let last = 0;

/** the ceiling on any one sound, since a portfolio is not a game */
const GAIN = 0.07;

/** ms between two ticks, below which a tick is dropped */
const GAP = 14;

function ensure(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
  }
  if (!noise) {
    const length = Math.floor(ctx.sampleRate * 0.1);
    noise = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = noise.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
  }
  return ctx;
}

/**
 * Unlock the clock on the press and play on whatever follows. A context made
 * outside a gesture starts suspended and queues what is started on it, which
 * `poke-sound.ts` documents.
 */
export function armScrub(): void {
  const audio = ensure();
  if (audio && audio.state === "suspended") void audio.resume();
}

function burst(hz: number, q: number, gain: number, life: number): void {
  const audio = ensure();
  if (audio?.state !== "running" || !noise) return;
  const at = audio.currentTime;
  const source = audio.createBufferSource();
  source.buffer = noise;
  const band = audio.createBiquadFilter();
  band.type = "bandpass";
  band.frequency.setValueAtTime(hz, at);
  band.Q.value = q;
  const level = audio.createGain();
  level.gain.setValueAtTime(0, at);
  level.gain.linearRampToValueAtTime(gain, at + 0.001);
  level.gain.exponentialRampToValueAtTime(0.0001, at + life);
  source.connect(band).connect(level).connect(audio.destination);
  source.start(at);
  source.stop(at + life + 0.02);
}

/** One step. `t` runs 0 to 1 across the field's range. */
export function playStep(t: number): void {
  const now = performance.now();
  if (now - last < GAP) return;
  last = now;
  burst(1400 + Math.min(1, Math.max(0, t)) * 2800, 10, GAIN * 0.7, 0.012);
}

/** A detent catching the value. */
export function playDetent(): void {
  last = performance.now();
  burst(900, 5, GAIN * 1.3, 0.03);
}

/** The value meeting a limit. */
export function playLimit(): void {
  last = performance.now();
  burst(320, 2.5, GAIN * 1.4, 0.05);
}
