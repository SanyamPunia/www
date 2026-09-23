/**
 * What a marble clearing the neck of the bag sounds like, synthesised rather
 * than fetched.
 *
 * `crack-sound.ts` sets the shape and `cube-orbit`'s `dial-sound.ts` the size:
 * one context, one noise buffer, a filtered burst per event, and the page
 * fetches nothing. This is the same few milliseconds of narrow noise with one
 * thing moving between clicks, and here that thing is the ball. A big marble
 * knocks lower than a small one, which is the one fact about the strand a
 * reader can hear rather than see.
 *
 * It needs no speed gate, unlike a dial's detents. There are five balls and
 * each crosses the mouth once a move, so the fastest thing this can produce is
 * five clicks over the length of an open.
 */

let ctx: AudioContext | null = null;
let noise: AudioBuffer | null = null;

/** the ceiling on any one click, since a portfolio is not a game */
const GAIN = 0.085;

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
export function armMarbles(): void {
  const audio = ensure();
  if (audio && audio.state === "suspended") void audio.resume();
}

/**
 * One ball through the neck. `size` is its share of the track's radius, which
 * on this strand runs 0.16 to 0.40, and it takes the band down with it.
 */
export function playClear(size: number): void {
  const audio = ensure();
  if (audio?.state !== "running" || !noise) return;
  const at = audio.currentTime;
  const hz = 2500 - size * 2800;
  const life = 0.022;

  const source = audio.createBufferSource();
  source.buffer = noise;

  const band = audio.createBiquadFilter();
  band.type = "bandpass";
  band.frequency.setValueAtTime(hz, at);
  band.Q.value = 7;

  const level = audio.createGain();
  level.gain.setValueAtTime(0, at);
  level.gain.linearRampToValueAtTime(GAIN, at + 0.001);
  level.gain.exponentialRampToValueAtTime(0.0001, at + life);

  source.connect(band).connect(level).connect(audio.destination);
  source.start(at);
  source.stop(at + life + 0.02);
}
