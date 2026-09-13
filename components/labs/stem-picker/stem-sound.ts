/**
 * What a stem sounds like, synthesised rather than fetched.
 *
 * `crack-sound.ts` sets the shape: one context, one noise buffer, a filtered
 * burst per event, and nothing requested over the network. A stem is a quieter
 * problem than a pane of glass. Adding one is a rustle, which is broadband
 * noise with a fast decay and no pitch in it at all, plus a soft low knock
 * where the cut end meets the others at the knot. Taking one out is the same
 * rustle run shorter and drier, which is what pulling a stem clear of a bunch
 * actually sounds like.
 *
 * Foliage has no note, so nothing here is an oscillator except the knock.
 */

let ctx: AudioContext | null = null;
let noise: AudioBuffer | null = null;

/** the ceiling on any one press. a bunch of flowers is not a game */
const GAIN = 0.13;

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
    /* a fifth of a second of white noise, reused by every rustle */
    const length = Math.floor(ctx.sampleRate * 0.2);
    noise = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = noise.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
  }
  return ctx;
}

/**
 * Unlock the clock on the press, play on the release.
 *
 * A context made outside a user gesture starts suspended, its clock does not
 * advance, and a source started on one is queued rather than dropped, so a
 * later resume fires every queued sound at once. `crack-sound.ts` and
 * `poke-sound.ts` both document the same two-step and the same reason.
 */
export function armStems(): void {
  const audio = ensure();
  if (audio && audio.state === "suspended") void audio.resume();
}

/**
 * A rustle. Leaves are broadband, so this is a wide band that falls rather than
 * the narrow one a brittle snap wants, and the decay does the rest.
 */
function rustle(
  audio: AudioContext,
  at: number,
  hz: number,
  life: number,
  gain: number,
): void {
  if (!noise) return;
  const source = audio.createBufferSource();
  source.buffer = noise;
  source.playbackRate.value = 0.8 + Math.random() * 0.4;

  const band = audio.createBiquadFilter();
  band.type = "bandpass";
  band.frequency.setValueAtTime(hz, at);
  band.frequency.exponentialRampToValueAtTime(
    Math.max(hz * 0.4, 300),
    at + life,
  );
  band.Q.value = 0.7;

  /* the top off, or a rustle reads as static */
  const roof = audio.createBiquadFilter();
  roof.type = "lowpass";
  roof.frequency.value = 5200;

  const level = audio.createGain();
  level.gain.setValueAtTime(0, at);
  level.gain.linearRampToValueAtTime(gain, at + 0.012);
  level.gain.exponentialRampToValueAtTime(0.0001, at + life);

  source.connect(band).connect(roof).connect(level).connect(audio.destination);
  source.start(at);
  source.stop(at + life + 0.02);
}

/** the cut end meeting the others at the knot. felt more than heard */
function knock(
  audio: AudioContext,
  at: number,
  hz: number,
  gain: number,
): void {
  const tone = audio.createOscillator();
  tone.type = "sine";
  tone.frequency.setValueAtTime(hz, at);
  tone.frequency.exponentialRampToValueAtTime(hz * 0.55, at + 0.09);

  const level = audio.createGain();
  level.gain.setValueAtTime(0, at);
  level.gain.linearRampToValueAtTime(gain, at + 0.006);
  level.gain.exponentialRampToValueAtTime(0.0001, at + 0.11);

  tone.connect(level).connect(audio.destination);
  tone.start(at);
  tone.stop(at + 0.13);
}

/**
 * One stem going in. `fill` runs 0 to 1 across the bunch and takes the rustle
 * up a little, since a fuller bunch has more foliage for a new stem to pass.
 */
export function playAdd(fill: number): void {
  const audio = ensure();
  if (audio?.state !== "running") return;
  const now = audio.currentTime;
  rustle(audio, now, 1500 + fill * 900, 0.17 + fill * 0.05, GAIN);
  /* the knock lands when the stem does, not when the button goes down */
  knock(audio, now + 0.18, 150, GAIN * 0.55);
}

/** one stem coming out. shorter and drier, and no knock, since nothing lands */
export function playRemove(): void {
  const audio = ensure();
  if (audio?.state !== "running") return;
  rustle(audio, audio.currentTime, 2300, 0.1, GAIN * 0.8);
}
