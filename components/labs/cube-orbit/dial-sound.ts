/**
 * What a dial with detents sounds like, synthesised rather than fetched.
 *
 * `crack-sound.ts` sets the shape and the reasons: one context, one noise
 * buffer, a filtered burst per event, and the page fetches nothing. A detent is
 * the smallest sound in that family, a few milliseconds of narrow noise, and
 * the only thing that moves between the first click and the last is where the
 * band sits.
 *
 * **Nothing plays above a walking pace.** A run of 1260 repetitions crosses two
 * hundred notches a second, and a click each is a machine gun rather than a
 * dial. So the ticks are gated on speed, which gives the right result for free:
 * a hand turning the dial clicks, a run spins silently through its middle, and
 * the clicks come back one at a time as it decelerates onto the last few
 * notches. The tone at the end is the only thing that says it arrived.
 */

let ctx: AudioContext | null = null;
let noise: AudioBuffer | null = null;

/** the ceiling on any one click, since a portfolio is not a game */
const GAIN = 0.1;

/** repetitions a second past which a click is a burst of clicks */
export const AUDIBLE = 11;

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
    /* an eighth of a second of white noise, reused by every click */
    const length = Math.floor(ctx.sampleRate * 0.125);
    noise = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = noise.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
  }
  return ctx;
}

/**
 * Unlock the clock on the press, play on whatever follows.
 *
 * A context made outside a user gesture starts suspended, its clock does not
 * advance, and a source started on one is queued rather than dropped, so a
 * later resume fires every queued sound at once. `poke-sound.ts` documents the
 * same two-step and the same reason.
 */
export function armDial(): void {
  const audio = ensure();
  if (audio && audio.state === "suspended") void audio.resume();
}

/**
 * One notch. `closing` runs 0 to 1 over the lap and takes the band up with it,
 * so a dial coming home sounds like it is tightening rather than repeating.
 */
export function playDetent(closing: number): void {
  const audio = ensure();
  if (!audio || audio.state !== "running" || !noise) return;
  const at = audio.currentTime;
  const hz = 1700 + closing * 900;
  const life = 0.018;

  const source = audio.createBufferSource();
  source.buffer = noise;

  const band = audio.createBiquadFilter();
  band.type = "bandpass";
  band.frequency.setValueAtTime(hz, at);
  band.Q.value = 9;

  const level = audio.createGain();
  level.gain.setValueAtTime(0, at);
  level.gain.linearRampToValueAtTime(GAIN, at + 0.001);
  level.gain.exponentialRampToValueAtTime(0.0001, at + life);

  source.connect(band).connect(level).connect(audio.destination);
  source.start(at);
  source.stop(at + life + 0.02);
}

/**
 * Landing on solved, which is the one event in the demo worth a tone rather
 * than a click: two partials a fifth apart, soft attack, long tail.
 */
export function playHome(): void {
  const audio = ensure();
  if (!audio || audio.state !== "running") return;
  const at = audio.currentTime;
  for (const [hz, gain, life] of [
    [392, 0.075, 0.5],
    [588, 0.045, 0.42],
  ] as const) {
    const tone = audio.createOscillator();
    tone.type = "sine";
    tone.frequency.value = hz;
    const level = audio.createGain();
    level.gain.setValueAtTime(0, at);
    level.gain.linearRampToValueAtTime(gain, at + 0.012);
    level.gain.exponentialRampToValueAtTime(0.0001, at + life);
    tone.connect(level).connect(audio.destination);
    tone.start(at);
    tone.stop(at + life + 0.05);
  }
}
