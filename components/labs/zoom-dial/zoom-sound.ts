/**
 * The zoom dial's sound, synthesised rather than fetched, on the shape
 * `crack-sound.ts` sets: one context, one noise buffer, nothing requested.
 *
 * A mark passing under the needle is a very short, quiet click, and a lens stop
 * catching is a softer, lower one with a little body under it. Both are kept
 * quiet, since a camera is not a toy.
 */

let ctx: AudioContext | null = null;
let noise: AudioBuffer | null = null;
let last = 0;

const GAIN = 0.08;

/** the closest two clicks may be, so a fast scrub is a purr and not a buzz */
const GAP = 0.026;

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
    const length = Math.floor(ctx.sampleRate * 0.05);
    noise = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = noise.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
  }
  return ctx;
}

/** unlock the clock on a press or a key, `poke-sound.ts`'s two-step */
export function armZoom(): void {
  const audio = ensure();
  if (audio && audio.state === "suspended") void audio.resume();
}

function running(): AudioContext | null {
  const audio = ensure();
  return audio && audio.state === "running" ? audio : null;
}

function burst(
  audio: AudioContext,
  hz: number,
  q: number,
  gain: number,
  life: number,
) {
  if (!noise) return;
  const at = audio.currentTime;
  const source = audio.createBufferSource();
  source.buffer = noise;
  const filter = audio.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = hz;
  filter.Q.value = q;
  const level = audio.createGain();
  level.gain.setValueAtTime(0, at);
  level.gain.linearRampToValueAtTime(gain, at + 0.0015);
  level.gain.exponentialRampToValueAtTime(0.0001, at + life);
  source.connect(filter).connect(level).connect(audio.destination);
  source.start(at);
  source.stop(at + life + 0.02);
}

/** a mark passing under the needle */
export function mark(): void {
  const audio = running();
  if (!audio) return;
  if (audio.currentTime - last < GAP) return;
  last = audio.currentTime;
  burst(audio, 3400 * (0.95 + Math.random() * 0.1), 3, GAIN, 0.016);
}

/** a lens stop catching, lower and with a little body */
export function stop(): void {
  const audio = running();
  if (!audio) return;
  last = audio.currentTime;
  burst(audio, 1400, 1.4, GAIN * 1.6, 0.04);
  const at = audio.currentTime;
  const body = audio.createOscillator();
  body.frequency.setValueAtTime(220, at);
  body.frequency.exponentialRampToValueAtTime(140, at + 0.05);
  const level = audio.createGain();
  level.gain.setValueAtTime(0, at);
  level.gain.linearRampToValueAtTime(GAIN * 1.2, at + 0.003);
  level.gain.exponentialRampToValueAtTime(0.0001, at + 0.06);
  body.connect(level).connect(audio.destination);
  body.start(at);
  body.stop(at + 0.08);
}
