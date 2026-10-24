/**
 * What the zipper sounds like, synthesised rather than fetched, on the shape
 * `crack-sound.ts` sets: one context, one noise buffer, nothing requested.
 *
 * The zip is not a recording. Every tooth the slider crosses is one very short
 * click, so a slow pull ticks and a fast one buzzes, and the sound follows the
 * hand because it is made of the same teeth the drawing is. Opening is a
 * little brighter than closing. The slider hitting a sewn end is a low knock.
 */

let ctx: AudioContext | null = null;
let noise: AudioBuffer | null = null;
let last = 0;

const GAIN = 0.14;

/** the closest two clicks may be, so a fast pull is a buzz and not a smear */
const GAP = 0.006;

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
    const length = Math.floor(ctx.sampleRate * 0.3);
    noise = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = noise.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
  }
  return ctx;
}

/** unlock the clock on a press or a key, `poke-sound.ts`'s two-step */
export function armZip(): void {
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
  type: BiquadFilterType = "bandpass",
) {
  if (!noise) return;
  const at = audio.currentTime;
  const source = audio.createBufferSource();
  source.buffer = noise;
  // a random place in the buffer, so no two clicks are the same grain
  const offset = Math.max(0, Math.random() * (noise.duration - life - 0.02));
  const filter = audio.createBiquadFilter();
  filter.type = type;
  filter.frequency.value = hz;
  filter.Q.value = q;
  const level = audio.createGain();
  level.gain.setValueAtTime(0, at);
  level.gain.linearRampToValueAtTime(gain, at + 0.001);
  level.gain.exponentialRampToValueAtTime(0.0001, at + life);
  source.connect(filter).connect(level).connect(audio.destination);
  source.start(at, offset);
  source.stop(at + life + 0.01);
}

/** one tooth crossed, louder the faster the slider is going */
export function tick(speed: number, opening: boolean): void {
  const audio = running();
  if (!audio) return;
  const at = audio.currentTime;
  if (at - last < GAP) return;
  last = at;
  const pace = Math.min(1, speed / 500);
  const hz = (opening ? 3600 : 3000) + Math.random() * 700;
  burst(audio, hz, 4, GAIN * (0.35 + pace * 0.65), 0.012);
}

/** the slider meeting a sewn end */
export function knock(): void {
  const audio = running();
  if (!audio) return;
  last = audio.currentTime;
  burst(audio, 700, 1, GAIN * 0.9, 0.07, "lowpass");
  burst(audio, 2400, 6, GAIN * 0.35, 0.03);
}

/** a hand taking hold of what is inside, a soft brush of paper */
export function rustle(): void {
  const audio = running();
  if (!audio) return;
  burst(audio, 1800, 0.8, GAIN * 0.45, 0.09);
}
