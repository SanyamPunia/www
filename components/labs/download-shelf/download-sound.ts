/**
 * What a download sounds like, synthesised on `crack-sound.ts`'s shape: one
 * context, one noise buffer, nothing fetched. A file landing in the button is
 * a soft tuck, a finished download two notes up, a failed one two notes down.
 */

let ctx: AudioContext | null = null;
let noise: AudioBuffer | null = null;

const GAIN = 0.14;

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

/** unlock the clock on a press, `poke-sound.ts`'s two-step */
export function armSound(): void {
  const audio = ensure();
  if (audio && audio.state === "suspended") void audio.resume();
}

function running(): AudioContext | null {
  const audio = ensure();
  return audio?.state === "running" ? audio : null;
}

/** the file dropping into the button: a short low burst */
export function tuck(): void {
  const audio = running();
  if (!audio || !noise) return;
  const at = audio.currentTime;
  const source = audio.createBufferSource();
  source.buffer = noise;
  const filter = audio.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(1400, at);
  filter.frequency.exponentialRampToValueAtTime(260, at + 0.09);
  const level = audio.createGain();
  level.gain.setValueAtTime(0, at);
  level.gain.linearRampToValueAtTime(GAIN, at + 0.004);
  level.gain.exponentialRampToValueAtTime(0.0001, at + 0.1);
  source.connect(filter).connect(level).connect(audio.destination);
  source.start(at);
  source.stop(at + 0.12);
}

function note(hz: number, delay: number, gain: number): void {
  const audio = running();
  if (!audio) return;
  const at = audio.currentTime + delay;
  const osc = audio.createOscillator();
  osc.type = "sine";
  osc.frequency.value = hz;
  const level = audio.createGain();
  level.gain.setValueAtTime(0, at);
  level.gain.linearRampToValueAtTime(gain, at + 0.01);
  level.gain.exponentialRampToValueAtTime(0.0001, at + 0.32);
  osc.connect(level).connect(audio.destination);
  osc.start(at);
  osc.stop(at + 0.34);
}

export function done(): void {
  note(784, 0, GAIN * 0.5);
  note(1175, 0.07, GAIN * 0.4);
}

export function failed(): void {
  note(440, 0, GAIN * 0.5);
  note(370, 0.09, GAIN * 0.4);
}
