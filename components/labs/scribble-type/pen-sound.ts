import type { Kind } from "./layout";

/**
 * What a pen on paper sounds like, synthesised rather than fetched.
 *
 * Writing is one sound that lasts as long as the nib is moving, so it is a
 * looping noise source held open, with its level following the pen's speed and
 * falling to nothing on every lift. The jitter on the level is the paper's
 * tooth: a steady level reads as a hiss rather than as a nib dragging. Each kind
 * of pen has its own band: the fountain pen high and thin, the felt pen a little
 * lower and louder, and the marker low and broad, since a felt tip wiping across
 * paper is a soft squeak rather than a scratch.
 *
 * `scratch-sound.ts` sets the shape: one context, one noise buffer, nothing
 * fetched, unlocked on a press.
 */

let ctx: AudioContext | null = null;
let noise: AudioBuffer | null = null;

interface Voice {
  source: AudioBufferSourceNode;
  band: BiquadFilterNode;
  level: GainNode;
}

let voice: Voice | null = null;

const VOICES: Record<Kind, { freq: number; q: number; gain: number }> = {
  ink: { freq: 3600, q: 0.7, gain: 0.07 },
  pen: { freq: 2600, q: 0.9, gain: 0.09 },
  marker: { freq: 1300, q: 1.6, gain: 0.08 },
};

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

/** opens the voice, silent until the pen moves. Call it from a press. */
export function openPen(): void {
  const audio = ensure();
  if (!audio || !noise) return;
  if (audio.state === "suspended") void audio.resume();
  if (voice) return;
  const source = audio.createBufferSource();
  source.buffer = noise;
  source.loop = true;

  /* below this is the desk and the hand, not the nib */
  const low = audio.createBiquadFilter();
  low.type = "highpass";
  low.frequency.value = 500;

  const band = audio.createBiquadFilter();
  band.type = "bandpass";
  band.frequency.value = VOICES.ink.freq;
  band.Q.value = VOICES.ink.q;

  const level = audio.createGain();
  level.gain.value = 0;

  source.connect(low).connect(band).connect(level).connect(audio.destination);
  source.start();
  voice = { source, band, level };
}

/**
 * One frame. `kind` is the pen that is moving, or null on a lift, and `speed`
 * how fast it is moving against its own top speed, 0 to 1.
 */
export function movePen(kind: Kind | null, speed: number): void {
  const audio = ctx;
  if (!audio || !voice || audio.state !== "running") return;
  const now = audio.currentTime;
  if (!kind) {
    voice.level.gain.setTargetAtTime(0, now, 0.012);
    return;
  }
  const v = VOICES[kind];
  const pace = Math.min(1, speed);
  const tooth = 0.6 + Math.random() * 0.6;
  voice.level.gain.setTargetAtTime(v.gain * pace * tooth, now, 0.01);
  voice.band.frequency.setTargetAtTime(v.freq * (0.85 + 0.3 * pace), now, 0.02);
  voice.band.Q.setTargetAtTime(v.q, now, 0.02);
}

/** the nib landing on the paper, a click too short to have a pitch */
export function touchPen(kind: Kind): void {
  const audio = ctx;
  if (!audio || !noise || !voice || audio.state !== "running") return;
  const at = audio.currentTime;
  const source = audio.createBufferSource();
  source.buffer = noise;
  const band = audio.createBiquadFilter();
  band.type = "bandpass";
  band.frequency.value = kind === "marker" ? 900 : 1800 + Math.random() * 900;
  band.Q.value = 3;
  const level = audio.createGain();
  const life = 0.012;
  level.gain.setValueAtTime(0, at);
  level.gain.linearRampToValueAtTime(VOICES[kind].gain * 0.9, at + 0.001);
  level.gain.exponentialRampToValueAtTime(0.0001, at + life);
  source.connect(band).connect(level).connect(audio.destination);
  source.start(at, Math.random());
  source.stop(at + life + 0.02);
}

/** closes the voice, letting it fall away rather than cutting it */
export function closePen(): void {
  if (!ctx || !voice) return;
  const { source, level } = voice;
  level.gain.setTargetAtTime(0, ctx.currentTime, 0.03);
  source.stop(ctx.currentTime + 0.25);
  voice = null;
}
