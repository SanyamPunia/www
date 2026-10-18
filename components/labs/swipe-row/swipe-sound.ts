/**
 * What a swipe sounds like, synthesised rather than fetched, on the shape
 * `crack-sound.ts` sets: one context, one noise buffer, a filtered burst per
 * event. The page requests nothing for any of it.
 *
 * Three sounds, each on its causal frame: a detent when the far action arms, a
 * swish when a row leaves, and a soft click when a toggle lands.
 */

let ctx: AudioContext | null = null;
let noise: AudioBuffer | null = null;

/** the ceiling on any one sound, since a portfolio is not a game */
const GAIN = 0.18;

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
    const length = Math.floor(ctx.sampleRate * 0.4);
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

function burst(
  audio: AudioContext,
  at: number,
  type: BiquadFilterType,
  from: number,
  to: number,
  q: number,
  life: number,
  gain: number,
): void {
  if (!noise) return;
  const source = audio.createBufferSource();
  source.buffer = noise;
  const filter = audio.createBiquadFilter();
  filter.type = type;
  filter.frequency.setValueAtTime(from, at);
  filter.frequency.exponentialRampToValueAtTime(to, at + life);
  filter.Q.value = q;
  const level = audio.createGain();
  level.gain.setValueAtTime(0, at);
  level.gain.linearRampToValueAtTime(gain, at + 0.004);
  level.gain.exponentialRampToValueAtTime(0.0001, at + life);
  source.connect(filter).connect(level).connect(audio.destination);
  source.start(at);
  source.stop(at + life + 0.02);
}

/** the far action arming or letting go: a short detent, lower going back */
export function detent(on: boolean): void {
  const audio = running();
  if (!audio) return;
  const hz = on ? 2600 : 1700;
  burst(audio, audio.currentTime, "bandpass", hz, hz, 8, 0.03, GAIN * 0.6);
}

/** a row leaving the list: air moving, falling as it goes */
export function swish(): void {
  const audio = running();
  if (!audio) return;
  burst(audio, audio.currentTime, "bandpass", 2400, 500, 1.4, 0.24, GAIN);
}

/** a toggle landing, read or flagged */
export function click(): void {
  const audio = running();
  if (!audio) return;
  burst(audio, audio.currentTime, "lowpass", 1800, 900, 0.8, 0.05, GAIN * 0.5);
}

/** a phone with a motor feels the detent. `vibrate` is a no-op elsewhere */
export function buzz(pattern: number | number[]): void {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    navigator.vibrate(pattern);
  }
}
