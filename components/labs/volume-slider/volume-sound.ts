/**
 * What the volume slider sounds like, synthesised rather than fetched, on the
 * shape `crack-sound.ts` sets: one context, one noise buffer, nothing
 * requested.
 *
 * Everything here is played at the level the slider is set to, since that is
 * the one thing a volume control should let you hear. A step is a short blip
 * that gets louder and a little higher as the level rises and is silent at
 * zero. Letting go plays the macOS pop at the new level. Hitting either end is
 * a soft knock at a fixed level, since it says "no further" and not "this
 * loud".
 */

let ctx: AudioContext | null = null;
let noise: AudioBuffer | null = null;
let last = 0;

/** the loudest anything here gets, at a full level */
const GAIN = 0.16;

/** the closest two blips may be, so a fast drag is a run and not a buzz */
const GAP = 0.03;

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
    const length = Math.floor(ctx.sampleRate * 0.08);
    noise = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = noise.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
  }
  return ctx;
}

/** unlock the clock on a press or a key, `poke-sound.ts`'s two-step */
export function armVolume(): void {
  const audio = ensure();
  if (audio && audio.state === "suspended") void audio.resume();
}

function running(): AudioContext | null {
  const audio = ensure();
  return audio && audio.state === "running" ? audio : null;
}

/** how loud a level is heard, on a curve, since loudness is not linear */
function loudness(level: number): number {
  return GAIN * level ** 1.6;
}

function blip(audio: AudioContext, hz: number, gain: number, life: number) {
  const at = audio.currentTime;
  const osc = audio.createOscillator();
  osc.type = "sine";
  osc.frequency.setValueAtTime(hz, at);
  osc.frequency.exponentialRampToValueAtTime(hz * 0.82, at + life);
  const level = audio.createGain();
  level.gain.setValueAtTime(0, at);
  // a soft attack, so a blip swells rather than clicks
  level.gain.linearRampToValueAtTime(gain, at + 0.012);
  level.gain.exponentialRampToValueAtTime(0.0001, at + life);
  osc.connect(level).connect(audio.destination);
  osc.start(at);
  osc.stop(at + life + 0.02);
}

/** one sixteenth crossed, heard at the level it landed on */
export function step(level: number): void {
  const audio = running();
  if (!audio || level <= 0) return;
  const at = audio.currentTime;
  if (at - last < GAP) return;
  last = at;
  blip(audio, 420 + level * 260, loudness(level) * 0.5, 0.07);
}

/** letting go, the macOS pop at the new level */
export function pop(level: number): void {
  const audio = running();
  if (!audio || level <= 0) return;
  last = audio.currentTime;
  blip(audio, 760, loudness(level), 0.12);
}

/** an end of the range reached, a soft knock at a fixed level */
export function knock(): void {
  const audio = running();
  if (!audio || !noise) return;
  const at = audio.currentTime;
  last = at;
  const source = audio.createBufferSource();
  source.buffer = noise;
  const filter = audio.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 600;
  const level = audio.createGain();
  level.gain.setValueAtTime(0, at);
  level.gain.linearRampToValueAtTime(GAIN * 0.4, at + 0.006);
  level.gain.exponentialRampToValueAtTime(0.0001, at + 0.06);
  source.connect(filter).connect(level).connect(audio.destination);
  source.start(at);
  source.stop(at + 0.08);
}
