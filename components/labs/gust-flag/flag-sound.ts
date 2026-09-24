/**
 * The snap a flag makes when a gust runs off its tails, synthesised rather
 * than fetched. `crack-sound.ts` sets the shape: one context, one noise buffer,
 * a filtered burst per event, and the page fetches nothing.
 *
 * Cloth snapping is a crack's softer cousin: a wide band of noise, lower and
 * less resonant than glass, with a fast decay. Two bursts a few hundredths
 * apart, since a swallowtail has two tails and they do not crack together.
 */

let ctx: AudioContext | null = null;
let noise: AudioBuffer | null = null;

/** the ceiling on any one snap, since a portfolio is not a game */
const GAIN = 0.2;

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
    const length = Math.floor(ctx.sampleRate * 0.2);
    noise = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = noise.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
  }
  return ctx;
}

/**
 * Unlock the clock on the press, play when the gust reaches the tails.
 *
 * A context made outside a user gesture starts suspended and queues what is
 * started on it, so a later resume fires the lot at once. `poke-sound.ts`
 * documents the same two-step.
 */
export function armFlag(): void {
  const audio = ensure();
  if (audio && audio.state === "suspended") void audio.resume();
}

function burst(
  audio: AudioContext,
  at: number,
  hz: number,
  gain: number,
): void {
  if (!noise) return;
  const source = audio.createBufferSource();
  source.buffer = noise;

  const band = audio.createBiquadFilter();
  band.type = "bandpass";
  band.frequency.setValueAtTime(hz, at);
  band.frequency.exponentialRampToValueAtTime(hz * 0.5, at + 0.09);
  band.Q.value = 1.4;

  const level = audio.createGain();
  level.gain.setValueAtTime(0, at);
  level.gain.linearRampToValueAtTime(gain, at + 0.003);
  level.gain.exponentialRampToValueAtTime(0.0001, at + 0.09);

  source.connect(band).connect(level).connect(audio.destination);
  source.start(at);
  source.stop(at + 0.12);
}

export function playSnap(): void {
  const audio = ensure();
  if (audio?.state !== "running") return;
  const now = audio.currentTime;
  burst(audio, now, 1100, GAIN);
  burst(audio, now + 0.035, 1500, GAIN * 0.6);
}
