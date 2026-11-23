/**
 * The sound a drop of paint makes landing in the well, synthesised rather than
 * fetched, on `crack-sound.ts`'s shape: one context, nothing fetched.
 *
 * A plop is a sine whose pitch falls fast, which is the cavity a drop opens
 * closing, plus a short burst of low noise for the splash. The pitch is set
 * per pigment so a run of drops is not one note repeated.
 */

let ctx: AudioContext | null = null;

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
  return ctx;
}

/** unlock the clock on the press, `poke-sound.ts`'s two-step */
export function armPaint(): void {
  const audio = ensure();
  if (audio && audio.state === "suspended") void audio.resume();
}

/** a drop landing, `tone` from 0 to 1 sets the pitch */
export function plop(tone: number): void {
  if (ctx?.state !== "running") return;
  const audio = ctx;
  const at = audio.currentTime + 0.005;
  const top = 520 + tone * 380;

  const osc = audio.createOscillator();
  osc.type = "sine";
  osc.frequency.setValueAtTime(top, at);
  osc.frequency.exponentialRampToValueAtTime(top * 0.32, at + 0.09);
  const env = audio.createGain();
  env.gain.setValueAtTime(0, at);
  env.gain.linearRampToValueAtTime(GAIN, at + 0.006);
  env.gain.exponentialRampToValueAtTime(0.0001, at + 0.13);
  osc.connect(env).connect(audio.destination);
  osc.start(at);
  osc.stop(at + 0.15);

  const length = Math.floor(audio.sampleRate * 0.06);
  const buffer = audio.createBuffer(1, length, audio.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / length) ** 3;
  }
  const noise = audio.createBufferSource();
  noise.buffer = buffer;
  const lp = audio.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = 900;
  const ng = audio.createGain();
  ng.gain.value = GAIN * 0.5;
  noise.connect(lp).connect(ng).connect(audio.destination);
  noise.start(at);
}
