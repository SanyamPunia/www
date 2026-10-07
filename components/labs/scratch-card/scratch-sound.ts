/**
 * What a coin on a scratch card sounds like, synthesised rather than fetched.
 *
 * A scratch is not a sequence of events, it is one sound that lasts as long as
 * the hand is moving, so it is a looping noise source held open for the length
 * of the press, with its level and its band driven by the coin's speed and by
 * whether there is coating under it. Grit is the level jittering on every move
 * plus a tick now and then, which is what a grain of latex letting go sounds
 * like. Bare card under the coin is quiet and low, since there is nothing left
 * to tear.
 *
 * `crack-sound.ts` sets the shape: one context, one noise buffer, nothing
 * fetched, unlocked on the press.
 */

let ctx: AudioContext | null = null;
let noise: AudioBuffer | null = null;

/** the scratch at full speed on full coating, which is the loudest this gets */
const GAIN = 0.2;

interface Voice {
  source: AudioBufferSourceNode;
  band: BiquadFilterNode;
  level: GainNode;
  pan: StereoPannerNode;
}

let voice: Voice | null = null;

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
    /* two seconds, so the loop point is never heard as a pulse */
    const length = Math.floor(ctx.sampleRate * 2);
    noise = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = noise.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
  }
  return ctx;
}

/** unlock the clock on the press, the two-step `poke-sound.ts` documents */
export function armScratch(): void {
  const audio = ensure();
  if (audio && audio.state === "suspended") void audio.resume();
}

/** open the voice for one press, silent until the coin moves */
export function startScratch(): void {
  const audio = ensure();
  if (!audio || !noise || voice) return;
  const source = audio.createBufferSource();
  source.buffer = noise;
  source.loop = true;

  /* below this is the table and the hand, not the coating */
  const low = audio.createBiquadFilter();
  low.type = "highpass";
  low.frequency.value = 650;

  const band = audio.createBiquadFilter();
  band.type = "bandpass";
  band.frequency.value = 2400;
  band.Q.value = 0.8;

  const level = audio.createGain();
  level.gain.value = 0;

  /* the scratch sits where the coin is, left to right across the card */
  const pan = audio.createStereoPanner();

  source
    .connect(low)
    .connect(band)
    .connect(level)
    .connect(pan)
    .connect(audio.destination);
  source.start();
  voice = { source, band, level, pan };
}

/**
 * One move. `speed` is the coin's speed in panel widths a second, `foil` how
 * much coating was under it, 0 to 1, and `x` where the coin is across the card,
 * 0 to 1.
 */
export function moveScratch(speed: number, foil: number, x: number): void {
  const audio = ctx;
  if (!audio || !voice || audio.state !== "running") return;
  const now = audio.currentTime;
  const pace = Math.min(1, speed / 2.2);
  /* the jitter is the grit: a steady level reads as a hiss, not a scratch */
  const grit = 0.55 + Math.random() * 0.6;
  const body = 0.12 + 0.88 * foil;
  voice.level.gain.setTargetAtTime(GAIN * pace * body * grit, now, 0.012);
  /* thick coating tears high, and the pitch falls as it wears thin */
  voice.band.frequency.setTargetAtTime(
    foil > 0.1 ? 1500 + foil * 900 + pace * 3000 : 900 + pace * 700,
    now,
    0.03,
  );
  voice.pan.pan.setTargetAtTime((x - 0.5) * 1.4, now, 0.03);

  /* now and then a grain lets go, and only where there is coating to lose */
  if (foil > 0.2 && Math.random() < 0.18 * pace * foil) tick(audio, now);
}

/** the coin stopping, which lets the voice fall away rather than cutting it */
export function holdScratch(): void {
  if (!ctx || !voice) return;
  voice.level.gain.setTargetAtTime(0, ctx.currentTime, 0.025);
}

/** the coin lifting, which closes the voice */
export function stopScratch(): void {
  if (!ctx || !voice) return;
  const { source, level } = voice;
  level.gain.setTargetAtTime(0, ctx.currentTime, 0.03);
  source.stop(ctx.currentTime + 0.25);
  voice = null;
}

function tick(audio: AudioContext, at: number): void {
  if (!noise) return;
  const source = audio.createBufferSource();
  source.buffer = noise;
  const band = audio.createBiquadFilter();
  band.type = "bandpass";
  band.frequency.value = 3800 + Math.random() * 3000;
  band.Q.value = 9;
  const level = audio.createGain();
  const life = 0.012 + Math.random() * 0.02;
  level.gain.setValueAtTime(0, at);
  level.gain.linearRampToValueAtTime(GAIN * 0.9, at + 0.001);
  level.gain.exponentialRampToValueAtTime(0.0001, at + life);
  source.connect(band).connect(level).connect(audio.destination);
  source.start(at, Math.random());
  source.stop(at + life + 0.02);
}

/**
 * The last of the coating coming away: a short breath of noise falling in pitch,
 * which is the dust being blown off the card.
 */
export function playClear(): void {
  const audio = ensure();
  if (!audio || !noise || audio.state !== "running") return;
  const at = audio.currentTime;
  const source = audio.createBufferSource();
  source.buffer = noise;
  const lowpass = audio.createBiquadFilter();
  lowpass.type = "lowpass";
  lowpass.Q.value = 0.6;
  lowpass.frequency.setValueAtTime(3200, at);
  lowpass.frequency.exponentialRampToValueAtTime(380, at + 0.42);
  const level = audio.createGain();
  level.gain.setValueAtTime(0, at);
  level.gain.linearRampToValueAtTime(GAIN * 0.55, at + 0.05);
  level.gain.exponentialRampToValueAtTime(0.0001, at + 0.46);
  source.connect(lowpass).connect(level).connect(audio.destination);
  source.start(at, Math.random());
  source.stop(at + 0.5);
}

function tone(
  audio: AudioContext,
  hz: number,
  at: number,
  gain: number,
  life: number,
): void {
  const osc = audio.createOscillator();
  osc.type = "sine";
  osc.frequency.value = hz;
  const level = audio.createGain();
  level.gain.setValueAtTime(0, at);
  level.gain.linearRampToValueAtTime(gain, at + 0.008);
  level.gain.exponentialRampToValueAtTime(0.0001, at + life);
  osc.connect(level).connect(audio.destination);
  osc.start(at);
  osc.stop(at + life + 0.05);
}

/** a pentatonic run, so any number of finds in any order is in key */
const SCALE = [523, 587, 659, 784, 880, 1047, 1175, 1319, 1568];

/**
 * A symbol coming clear: one soft note, a step higher for every symbol found
 * on the card so far, so the card climbs as it is played. A symbol that makes
 * a pair adds the fifth above it, which is the tension before the third.
 */
export function playFound(count: number, pair: boolean): void {
  const audio = ensure();
  if (audio?.state !== "running") return;
  const at = audio.currentTime + 0.01;
  const hz = SCALE[Math.min(SCALE.length - 1, count)];
  tone(audio, hz, at, 0.05, 0.35);
  if (pair) tone(audio, hz * 1.5, at + 0.06, 0.035, 0.45);
}

/** a card with no three of a kind: two notes falling, quietly */
export function playLose(): void {
  const audio = ensure();
  if (audio?.state !== "running") return;
  const at = audio.currentTime + 0.02;
  tone(audio, 494, at, 0.045, 0.4);
  tone(audio, 392, at + 0.14, 0.045, 0.6);
}

/**
 * The prize, which is the one event worth a tone: three soft partials rising, a
 * major triad played as a short arpeggio with a long tail.
 */
export function playWin(): void {
  const audio = ensure();
  if (audio?.state !== "running") return;
  const start = audio.currentTime + 0.02;
  for (const [hz, delay, gain] of [
    [784, 0, 0.06],
    [988, 0.07, 0.05],
    [1175, 0.14, 0.045],
  ] as const) {
    const at = start + delay;
    const tone = audio.createOscillator();
    tone.type = "sine";
    tone.frequency.value = hz;
    const level = audio.createGain();
    level.gain.setValueAtTime(0, at);
    level.gain.linearRampToValueAtTime(gain, at + 0.012);
    level.gain.exponentialRampToValueAtTime(0.0001, at + 0.9);
    tone.connect(level).connect(audio.destination);
    tone.start(at);
    tone.stop(at + 0.95);
  }
}
