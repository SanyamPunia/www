/**
 * What a tile landing in the focus slot sounds like, synthesised rather than
 * fetched.
 *
 * `crack-sound.ts` sets the shape: one context, one noise buffer, a filtered
 * burst per event, and the page fetches nothing. A tile settling is a soft
 * card set down on a table, so this is a short low thump with no pitch in it
 * worth naming: noise through a falling lowpass, and a sine under it that dies
 * in a few tens of milliseconds.
 */

let ctx: AudioContext | null = null;
let noise: AudioBuffer | null = null;

/** the ceiling on one landing, since a portfolio is not a game */
const GAIN = 0.11;

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
    /* a tenth of a second of white noise, reused by every landing */
    const length = Math.floor(ctx.sampleRate * 0.1);
    noise = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = noise.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
  }
  return ctx;
}

/**
 * Unlock the clock on the press, play on the landing.
 *
 * A context made outside a user gesture starts suspended, its clock does not
 * advance, and a source started on one is queued rather than dropped, so a
 * later resume fires every queued sound at once. `poke-sound.ts` documents the
 * same two-step and the same reason.
 */
export function armBento(): void {
  const audio = ensure();
  if (audio && audio.state === "suspended") void audio.resume();
}

/** a tile settling into the focus slot */
export function playLand(): void {
  const audio = ensure();
  if (audio?.state !== "running" || !noise) return;
  const at = audio.currentTime;

  const source = audio.createBufferSource();
  source.buffer = noise;
  const low = audio.createBiquadFilter();
  low.type = "lowpass";
  low.frequency.setValueAtTime(1400, at);
  low.frequency.exponentialRampToValueAtTime(260, at + 0.06);
  const level = audio.createGain();
  level.gain.setValueAtTime(0, at);
  level.gain.linearRampToValueAtTime(GAIN, at + 0.002);
  level.gain.exponentialRampToValueAtTime(0.0001, at + 0.07);
  source.connect(low).connect(level).connect(audio.destination);
  source.start(at);
  source.stop(at + 0.09);

  const body = audio.createOscillator();
  body.type = "sine";
  body.frequency.setValueAtTime(150, at);
  body.frequency.exponentialRampToValueAtTime(70, at + 0.08);
  const thump = audio.createGain();
  thump.gain.setValueAtTime(0, at);
  thump.gain.linearRampToValueAtTime(GAIN * 0.9, at + 0.003);
  thump.gain.exponentialRampToValueAtTime(0.0001, at + 0.09);
  body.connect(thump).connect(audio.destination);
  body.start(at);
  body.stop(at + 0.1);
}
