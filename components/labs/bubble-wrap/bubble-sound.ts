/**
 * What bubble wrap sounds like, synthesised on `crack-sound.ts`'s shape: one
 * context, one noise buffer, a few filtered bursts per event, nothing fetched.
 *
 * A pop is four things on top of each other, all inside 90ms:
 *
 * - a snap a few ms long, very high, which is the film tearing,
 * - a crack, a band of noise round 2.5kHz falling as it dies, which is most of
 *   what the ear calls the pop,
 * - a thump, a short low tone falling an octave, which is the air leaving,
 * - a puff of low noise behind it.
 *
 * A bubble's seed moves every band a little and its burst pressure sets the
 * level, so no two pops sound the same and a tough bubble pops louder. A dud
 * hisses instead, and pressing film that has already burst crinkles.
 */

let ctx: AudioContext | null = null;
let bus: AudioNode | null = null;
let noise: AudioBuffer | null = null;

/** the ceiling on one pop, since a portfolio is not a game */
const LEVEL = 0.5;
const NOISE_SECONDS = 0.8;

function ensure(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
    /* a quick limiter, so a row of pops at once does not clip */
    const limit = ctx.createDynamicsCompressor();
    limit.threshold.value = -12;
    limit.ratio.value = 6;
    limit.attack.value = 0.001;
    limit.release.value = 0.12;
    limit.connect(ctx.destination);
    bus = limit;
    const length = Math.floor(ctx.sampleRate * NOISE_SECONDS);
    noise = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = noise.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
  }
  return ctx;
}

/**
 * Unlock the clock on the press. A context made outside a gesture starts
 * suspended and queues what is started on it, which `poke-sound.ts` documents.
 */
export function armBubbles(): void {
  const audio = ensure();
  if (audio && audio.state === "suspended") void audio.resume();
}

function running(): AudioContext | null {
  const audio = ensure();
  return audio && audio.state === "running" ? audio : null;
}

function out(audio: AudioContext, pan: number): AudioNode {
  const field = audio.createStereoPanner();
  field.pan.value = Math.max(-1, Math.min(1, pan));
  field.connect(bus as AudioNode);
  return field;
}

/** a burst of noise through a filter, with a fast attack and an exponential tail */
function grain(
  audio: AudioContext,
  dest: AudioNode,
  at: number,
  type: BiquadFilterType,
  hz: number,
  q: number,
  gain: number,
  life: number,
  fall = 1,
): void {
  if (!noise) return;
  const src = audio.createBufferSource();
  src.buffer = noise;
  const filter = audio.createBiquadFilter();
  filter.type = type;
  filter.frequency.setValueAtTime(hz, at);
  if (fall !== 1) {
    filter.frequency.exponentialRampToValueAtTime(hz * fall, at + life);
  }
  filter.Q.value = q;
  const env = audio.createGain();
  env.gain.setValueAtTime(0, at);
  env.gain.linearRampToValueAtTime(gain, at + 0.0008);
  env.gain.exponentialRampToValueAtTime(0.0001, at + life);
  src.connect(filter).connect(env).connect(dest);
  const offset = Math.random() * (NOISE_SECONDS - life - 0.01);
  src.start(at, Math.max(0, offset), life + 0.01);
}

/**
 * A pop. `strength` is 0 to 1 off the pressure it burst at, `pan` where it is
 * across the sheet, and `seed` the bubble's own, so its bands are its own.
 */
export function pop(strength: number, pan: number, seed: number): void {
  const audio = running();
  if (!audio || !bus) return;
  const at = audio.currentTime + 0.002;
  const dest = out(audio, pan);
  const g = LEVEL * (0.55 + 0.45 * strength);
  const tune = 0.84 + 0.32 * seed;

  grain(audio, dest, at, "highpass", 5200, 0.7, g * 0.55, 0.006);
  grain(audio, dest, at, "bandpass", 2500 * tune, 1.1, g * 0.9, 0.04, 0.55);
  grain(audio, dest, at + 0.001, "bandpass", 1150 * tune, 1.6, g * 0.35, 0.03);

  const body = audio.createOscillator();
  body.type = "triangle";
  body.frequency.setValueAtTime(230 * tune, at);
  body.frequency.exponentialRampToValueAtTime(95 * tune, at + 0.05);
  const env = audio.createGain();
  env.gain.setValueAtTime(0, at);
  env.gain.linearRampToValueAtTime(g * 0.4, at + 0.0015);
  env.gain.exponentialRampToValueAtTime(0.0001, at + 0.06);
  body.connect(env).connect(dest);
  body.start(at);
  body.stop(at + 0.07);

  grain(audio, dest, at + 0.004, "lowpass", 700, 0.5, g * 0.14, 0.09);
}

/** air going out of a pinhole: a narrow hiss, falling as the bubble empties */
export function hiss(pan: number): void {
  const audio = running();
  if (!audio || !bus || !noise) return;
  const at = audio.currentTime + 0.002;
  const src = audio.createBufferSource();
  src.buffer = noise;
  const band = audio.createBiquadFilter();
  band.type = "bandpass";
  band.frequency.setValueAtTime(4200, at);
  band.frequency.exponentialRampToValueAtTime(1900, at + 0.5);
  band.Q.value = 1.4;
  const env = audio.createGain();
  env.gain.setValueAtTime(0, at);
  env.gain.linearRampToValueAtTime(LEVEL * 0.12, at + 0.05);
  env.gain.exponentialRampToValueAtTime(0.0001, at + 0.55);
  src.connect(band).connect(env).connect(out(audio, pan));
  src.start(at, 0, 0.6);
}

/** a dud squeezed flat lets the last of its air out with a soft low puff */
export function sigh(pan: number): void {
  const audio = running();
  if (!audio || !bus) return;
  grain(
    audio,
    out(audio, pan),
    audio.currentTime + 0.002,
    "lowpass",
    500,
    0.6,
    LEVEL * 0.12,
    0.16,
    0.6,
  );
}

/** film that has already given way, crushed again: a few dry specks of crackle */
export function crinkle(level: number, pan: number): void {
  const audio = running();
  if (!audio || !bus) return;
  const dest = out(audio, pan);
  const count = 2 + Math.floor(Math.random() * 3);
  for (let i = 0; i < count; i++) {
    grain(
      audio,
      dest,
      audio.currentTime + 0.002 + Math.random() * 0.06,
      "bandpass",
      4200 + Math.random() * 3200,
      2.2,
      LEVEL * 0.05 * level * (0.5 + Math.random() * 0.5),
      0.006 + Math.random() * 0.006,
    );
  }
}

/** a sheet dragged across the box: a long brush of plastic on board */
export function rustle(): void {
  const audio = running();
  if (!audio || !bus || !noise) return;
  const at = audio.currentTime + 0.002;
  const src = audio.createBufferSource();
  src.buffer = noise;
  const band = audio.createBiquadFilter();
  band.type = "bandpass";
  band.frequency.setValueAtTime(1400, at);
  band.frequency.exponentialRampToValueAtTime(3600, at + 0.35);
  band.Q.value = 0.8;
  const env = audio.createGain();
  env.gain.setValueAtTime(0, at);
  env.gain.linearRampToValueAtTime(LEVEL * 0.07, at + 0.08);
  env.gain.exponentialRampToValueAtTime(0.0001, at + 0.42);
  src.connect(band).connect(env).connect(out(audio, 0));
  src.start(at, 0, 0.45);
}

/** a phone with a motor feels each pop, and `vibrate` is a no-op elsewhere */
export function buzz(ms: number): void {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    navigator.vibrate(ms);
  }
}
