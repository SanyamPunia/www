/**
 * What the menu sounds like, synthesised rather than fetched, on the shape
 * `crack-sound.ts` sets: one context, one noise buffer, a short burst per
 * event. The page requests nothing for any of it.
 *
 * Three sounds: a low thunk when a photo lifts, which stands in for the
 * Taptic Engine, a tick when the finger slides onto another action, and a
 * click when an action is chosen.
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
    const length = Math.floor(ctx.sampleRate * 0.3);
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
  type: BiquadFilterType,
  hz: number,
  q: number,
  life: number,
  gain: number,
): void {
  if (!noise) return;
  const at = audio.currentTime;
  const source = audio.createBufferSource();
  source.buffer = noise;
  const filter = audio.createBiquadFilter();
  filter.type = type;
  filter.frequency.value = hz;
  filter.Q.value = q;
  const level = audio.createGain();
  level.gain.setValueAtTime(0, at);
  level.gain.linearRampToValueAtTime(gain, at + 0.003);
  level.gain.exponentialRampToValueAtTime(0.0001, at + life);
  source.connect(filter).connect(level).connect(audio.destination);
  source.start(at);
  source.stop(at + life + 0.02);
}

/** the lift: a short low sine falling under a soft body of noise */
export function thunk(): void {
  const audio = running();
  if (!audio) return;
  const at = audio.currentTime;
  const osc = audio.createOscillator();
  osc.type = "sine";
  osc.frequency.setValueAtTime(140, at);
  osc.frequency.exponentialRampToValueAtTime(60, at + 0.07);
  const level = audio.createGain();
  level.gain.setValueAtTime(0, at);
  level.gain.linearRampToValueAtTime(GAIN, at + 0.004);
  level.gain.exponentialRampToValueAtTime(0.0001, at + 0.09);
  osc.connect(level).connect(audio.destination);
  osc.start(at);
  osc.stop(at + 0.1);
  burst(audio, "lowpass", 700, 0.7, 0.05, GAIN * 0.5);
}

/** the finger crossing onto another action */
export function tick(): void {
  const audio = running();
  if (!audio) return;
  burst(audio, "bandpass", 3200, 9, 0.02, GAIN * 0.45);
}

/** an action chosen */
export function click(): void {
  const audio = running();
  if (!audio) return;
  burst(audio, "lowpass", 1800, 0.8, 0.05, GAIN * 0.55);
}

/** a phone with a motor feels each of the above. A no-op elsewhere */
export function buzz(ms: number): void {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    navigator.vibrate(ms);
  }
}
