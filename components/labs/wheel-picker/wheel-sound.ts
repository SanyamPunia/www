/**
 * The wheel's detent, synthesised rather than fetched, on the shape
 * `crack-sound.ts` sets: one context, one noise buffer, a filtered burst per
 * event. The page requests nothing for it.
 *
 * A detent is the drum passing a row. It is a very short, high click, a little
 * lower on each wheel to the right, so three wheels turning at once do not
 * sound like one. The row a drum lands on gets a thud instead: lower, longer
 * and with a little body under it, so a landing is heard as done.
 */

let ctx: AudioContext | null = null;
let noise: AudioBuffer | null = null;
let last = 0;

/** the ceiling on a click, since it plays for every row a flick crosses */
const GAIN = 0.11;

/** the closest two clicks may be, so a fast flick is a rattle and not a buzz */
const GAP = 0.024;

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

/**
 * Unlock the clock on a press or a key. A context made outside a gesture
 * starts suspended, and a wheel event is not a gesture, so a picker turned by
 * a trackpad alone stays silent until something is pressed.
 */
export function armWheel(): void {
  const audio = ensure();
  if (audio && audio.state === "suspended") void audio.resume();
}

/** one detent, on wheel `index` counted from the left */
export function detent(index: number): void {
  const audio = ensure();
  if (!audio || audio.state !== "running" || !noise) return;
  const at = audio.currentTime;
  if (at - last < GAP) return;
  last = at;
  const source = audio.createBufferSource();
  source.buffer = noise;
  const filter = audio.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = (3600 - index * 420) * (0.94 + Math.random() * 0.12);
  filter.Q.value = 3.2;
  const level = audio.createGain();
  level.gain.setValueAtTime(0, at);
  level.gain.linearRampToValueAtTime(GAIN, at + 0.001);
  level.gain.exponentialRampToValueAtTime(0.0001, at + 0.018);
  source.connect(filter).connect(level).connect(audio.destination);
  source.start(at);
  source.stop(at + 0.03);
}

/** the drum arriving on its row, on wheel `index` counted from the left */
export function thud(index: number): void {
  const audio = ensure();
  if (!audio || audio.state !== "running" || !noise) return;
  const at = audio.currentTime;
  last = at;
  const source = audio.createBufferSource();
  source.buffer = noise;
  const filter = audio.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = 1500 - index * 160;
  filter.Q.value = 1.6;
  const level = audio.createGain();
  level.gain.setValueAtTime(0, at);
  level.gain.linearRampToValueAtTime(GAIN * 1.5, at + 0.002);
  level.gain.exponentialRampToValueAtTime(0.0001, at + 0.045);
  source.connect(filter).connect(level).connect(audio.destination);
  source.start(at);
  source.stop(at + 0.06);
  const body = audio.createOscillator();
  body.type = "sine";
  body.frequency.setValueAtTime(190 - index * 14, at);
  body.frequency.exponentialRampToValueAtTime(110, at + 0.05);
  const weight = audio.createGain();
  weight.gain.setValueAtTime(0, at);
  weight.gain.linearRampToValueAtTime(GAIN * 1.1, at + 0.003);
  weight.gain.exponentialRampToValueAtTime(0.0001, at + 0.06);
  body.connect(weight).connect(audio.destination);
  body.start(at);
  body.stop(at + 0.08);
}
