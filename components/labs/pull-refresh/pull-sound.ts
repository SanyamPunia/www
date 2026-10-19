/**
 * What a pull sounds like, synthesised rather than fetched, on the shape
 * `crack-sound.ts` sets. Two sounds, each on its causal frame: a detent when
 * the pull passes the threshold, and a soft note when new messages land.
 */

let ctx: AudioContext | null = null;
let noise: AudioBuffer | null = null;

/** the ceiling on any one sound, since a portfolio is not a game */
const GAIN = 0.16;

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
    const length = Math.floor(ctx.sampleRate * 0.1);
    noise = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = noise.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
  }
  return ctx;
}

/**
 * Unlock the clock on the press. A context made outside a gesture starts
 * suspended and queues what is started on it, so a later resume fires every
 * queued sound at once. `poke-sound.ts` documents the same two-step.
 */
export function armSound(): void {
  const audio = ensure();
  if (audio && audio.state === "suspended") void audio.resume();
}

function running(): AudioContext | null {
  const audio = ensure();
  return audio && audio.state === "running" ? audio : null;
}

/** the pull passing the threshold: a short, crisp detent */
export function detent(): void {
  const audio = running();
  if (!audio || !noise) return;
  const at = audio.currentTime;
  const source = audio.createBufferSource();
  source.buffer = noise;
  const band = audio.createBiquadFilter();
  band.type = "bandpass";
  band.frequency.value = 2600;
  band.Q.value = 8;
  const level = audio.createGain();
  level.gain.setValueAtTime(0, at);
  level.gain.linearRampToValueAtTime(GAIN * 0.7, at + 0.002);
  level.gain.exponentialRampToValueAtTime(0.0001, at + 0.03);
  source.connect(band).connect(level).connect(audio.destination);
  source.start(at);
  source.stop(at + 0.05);
}

/**
 * A scrub crossing a data point: the faintest high click, so a finger running
 * along a sparkline feels each price go by without the sound becoming a buzz.
 */
export function notch(): void {
  const audio = running();
  if (!audio || !noise) return;
  const at = audio.currentTime;
  const source = audio.createBufferSource();
  source.buffer = noise;
  const band = audio.createBiquadFilter();
  band.type = "bandpass";
  band.frequency.value = 4200;
  band.Q.value = 10;
  const level = audio.createGain();
  level.gain.setValueAtTime(0, at);
  level.gain.linearRampToValueAtTime(GAIN * 0.25, at + 0.001);
  level.gain.exponentialRampToValueAtTime(0.0001, at + 0.015);
  source.connect(band).connect(level).connect(audio.destination);
  source.start(at);
  source.stop(at + 0.03);
}

/** new prices landing: two soft sine notes a fifth apart */
export function arrive(): void {
  const audio = running();
  if (!audio) return;
  const now = audio.currentTime;
  for (const [hz, delay] of [
    [660, 0],
    [990, 0.07],
  ] as const) {
    const at = now + delay;
    const osc = audio.createOscillator();
    osc.type = "sine";
    osc.frequency.value = hz;
    const level = audio.createGain();
    level.gain.setValueAtTime(0, at);
    level.gain.linearRampToValueAtTime(GAIN * 0.35, at + 0.01);
    level.gain.exponentialRampToValueAtTime(0.0001, at + 0.22);
    osc.connect(level).connect(audio.destination);
    osc.start(at);
    osc.stop(at + 0.25);
  }
}

/** a phone with a motor feels the detent. `vibrate` is a no-op elsewhere */
export function buzz(pattern: number | number[]): void {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    navigator.vibrate(pattern);
  }
}
