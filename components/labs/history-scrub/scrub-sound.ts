/**
 * The haptics a web page cannot fire, as sound, on `swipe-sound.ts`'s shape:
 * one context, one noise buffer, a filtered burst per event. A firmer click
 * when the arrow arms, a light tick per row, and a swish on a commit.
 */

let ctx: AudioContext | null = null;
let noise: AudioBuffer | null = null;

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
    const length = Math.floor(ctx.sampleRate * 0.4);
    noise = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = noise.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
  }
  return ctx;
}

/**
 * Unlock the clock. A wheel event is not a user activation, so a trackpad
 * alone stays silent until the first press or key on the stage.
 */
export function armSound(): void {
  const audio = ensure();
  if (audio && audio.state === "suspended") void audio.resume();
}

function burst(
  from: number,
  to: number,
  q: number,
  life: number,
  gain: number,
): void {
  // never builds the context here: a wheel event cannot unlock audio, and
  // building it on the first detent stalled the page past the quiet gap,
  // which read as a hold and opened the panel on a plain swipe
  const audio = ctx;
  if (audio?.state !== "running" || !noise) return;
  const at = audio.currentTime;
  const source = audio.createBufferSource();
  source.buffer = noise;
  const filter = audio.createBiquadFilter();
  filter.type = "bandpass";
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

/** the arrow arming, or a lower one as it lets go */
export function detent(on: boolean): void {
  const hz = on ? 2600 : 1700;
  burst(hz, hz, 8, 0.035, GAIN * 0.7);
}

/** the highlight passing onto the next row */
export function tick(): void {
  burst(3400, 3400, 10, 0.02, GAIN * 0.45);
}

/** a page committing: air moving, falling as it goes */
export function swish(): void {
  burst(2200, 520, 1.4, 0.22, GAIN);
}

/** a phone with a motor feels each one. `vibrate` is a no-op elsewhere */
export function buzz(ms: number): void {
  if (typeof navigator !== "undefined" && "vibrate" in navigator)
    navigator.vibrate(ms);
}
