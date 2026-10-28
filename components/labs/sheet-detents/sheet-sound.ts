/**
 * What the sheet sounds like, synthesised rather than fetched, on the shape
 * `crack-sound.ts` sets: one context, one noise buffer, a filtered burst per
 * event. The page requests nothing for any of it.
 *
 * Three sounds, each on its causal frame: a tick when a drag crosses a detent,
 * a soft thud when a released sheet lands on one, and a pop when a place is
 * picked.
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
  from: number,
  to: number,
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
  filter.frequency.setValueAtTime(from, at);
  filter.frequency.exponentialRampToValueAtTime(to, at + life);
  filter.Q.value = q;
  const level = audio.createGain();
  level.gain.setValueAtTime(0, at);
  level.gain.linearRampToValueAtTime(gain, at + 0.003);
  level.gain.exponentialRampToValueAtTime(0.0001, at + life);
  source.connect(filter).connect(level).connect(audio.destination);
  source.start(at);
  source.stop(at + life + 0.02);
}

/** a drag crossing a detent: the faint tick iOS gives as a haptic */
export function tick(up: boolean): void {
  const audio = running();
  if (!audio) return;
  const hz = up ? 2900 : 2300;
  burst(audio, "bandpass", hz, hz, 9, 0.025, GAIN * 0.45);
}

/**
 * A released sheet arriving on a detent: a low, soft thud, louder the faster
 * it came in, with a sine under it for body.
 */
export function land(speed: number): void {
  const audio = running();
  if (!audio) return;
  const k = Math.min(1, 0.35 + speed / 2600);
  burst(audio, "lowpass", 900, 220, 0.7, 0.09, GAIN * 0.7 * k);
  const at = audio.currentTime;
  const osc = audio.createOscillator();
  osc.type = "sine";
  osc.frequency.setValueAtTime(150, at);
  osc.frequency.exponentialRampToValueAtTime(70, at + 0.1);
  const level = audio.createGain();
  level.gain.setValueAtTime(0, at);
  level.gain.linearRampToValueAtTime(GAIN * 0.5 * k, at + 0.004);
  level.gain.exponentialRampToValueAtTime(0.0001, at + 0.12);
  osc.connect(level).connect(audio.destination);
  osc.start(at);
  osc.stop(at + 0.14);
}

/** a place picked: a short, rounded pop */
export function pop(): void {
  const audio = running();
  if (!audio) return;
  const at = audio.currentTime;
  const osc = audio.createOscillator();
  osc.type = "sine";
  osc.frequency.setValueAtTime(520, at);
  osc.frequency.exponentialRampToValueAtTime(880, at + 0.05);
  const level = audio.createGain();
  level.gain.setValueAtTime(0, at);
  level.gain.linearRampToValueAtTime(GAIN * 0.35, at + 0.006);
  level.gain.exponentialRampToValueAtTime(0.0001, at + 0.11);
  osc.connect(level).connect(audio.destination);
  osc.start(at);
  osc.stop(at + 0.13);
}

/** a phone with a motor feels each detent. `vibrate` is a no-op elsewhere */
export function buzz(pattern: number | number[]): void {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    navigator.vibrate(pattern);
  }
}
