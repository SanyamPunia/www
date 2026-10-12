/**
 * What the island sounds like, synthesised rather than fetched.
 *
 * `crack-sound.ts` sets the shape: one context, one noise buffer, a few
 * milliseconds of narrow noise per event, and the page fetches nothing.
 *
 * - **A dot landing on its cell is a tick**, pitched by where it lands, low on
 *   the left and high on the right. A morph sweeps left to right, so a move
 *   rattles up the scale as it goes.
 * - **Ticks are limited to one per 12ms**, which turns a few hundred landings
 *   into a rattle rather than a wall of overlapping clicks.
 * - **A press is a lower click and a shutter is two bursts**, the blade
 *   closing and opening.
 */

let ctx: AudioContext | null = null;
let noise: AudioBuffer | null = null;
let last = 0;

/** the ceiling on any one sound, since a portfolio is not a game */
const GAIN = 0.06;

/** ms between two ticks, below which a tick is dropped */
const GAP = 12;

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
export function armDots(): void {
  const audio = ensure();
  if (audio && audio.state === "suspended") void audio.resume();
}

function burst(hz: number, q: number, gain: number, life: number, wait = 0) {
  const audio = ensure();
  if (audio?.state !== "running" || !noise) return;
  const at = audio.currentTime + wait;
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

/** A dot landing. `t` runs 0 to 1 across the panel, left to right. */
export function playLand(t: number): void {
  const now = performance.now();
  if (now - last < GAP) return;
  last = now;
  burst(2000 + Math.min(1, Math.max(0, t)) * 2600, 12, GAIN * 0.6, 0.01);
}

/** A press on the island. */
export function playPress(): void {
  last = performance.now();
  burst(760, 4, GAIN * 1.4, 0.03);
}

/** The shutter, closing and opening. */
export function playShutter(): void {
  last = performance.now();
  burst(1900, 3, GAIN * 1.6, 0.025);
  burst(1100, 3, GAIN * 1.3, 0.035, 0.05);
}
