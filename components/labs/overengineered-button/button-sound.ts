/**
 * What the button sounds like, synthesised rather than fetched, on the shape
 * `crack-sound.ts` sets: one context, a few sine partials per event, nothing
 * requested. A press is a soft click, a success two notes up a fifth, and a
 * failure two notes down a minor third, so the result is heard as well as seen.
 */

let ctx: AudioContext | null = null;

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
  return ctx;
}

/** unlock the clock on the press, `poke-sound.ts`'s two-step */
export function armButton(): void {
  const audio = ensure();
  if (audio && audio.state === "suspended") void audio.resume();
}

function running(): AudioContext | null {
  const audio = ensure();
  return audio && audio.state === "running" ? audio : null;
}

function note(
  audio: AudioContext,
  at: number,
  hz: number,
  life: number,
  gain: number,
  type: OscillatorType = "sine",
): void {
  const osc = audio.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(hz, at);
  const level = audio.createGain();
  level.gain.setValueAtTime(0, at);
  level.gain.linearRampToValueAtTime(gain, at + 0.008);
  level.gain.exponentialRampToValueAtTime(0.0001, at + life);
  osc.connect(level).connect(audio.destination);
  osc.start(at);
  osc.stop(at + life + 0.02);
}

/** the press, a short low click */
export function click(): void {
  const audio = running();
  if (!audio) return;
  const now = audio.currentTime;
  note(audio, now, 520, 0.05, GAIN * 0.5, "triangle");
}

/** a success, two notes up a fifth with a quiet octave over the second */
export function chime(): void {
  const audio = running();
  if (!audio) return;
  const now = audio.currentTime;
  note(audio, now, 660, 0.22, GAIN * 0.7);
  note(audio, now + 0.09, 990, 0.42, GAIN * 0.75);
  note(audio, now + 0.09, 1980, 0.3, GAIN * 0.12);
}

/** a failure, two notes down a minor third, softer and lower */
export function drop(): void {
  const audio = running();
  if (!audio) return;
  const now = audio.currentTime;
  note(audio, now, 392, 0.2, GAIN * 0.7, "triangle");
  note(audio, now + 0.11, 330, 0.34, GAIN * 0.7, "triangle");
}

/** a phone with a motor feels the result, and `vibrate` is a no-op elsewhere */
export function buzz(pattern: number | number[]): void {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    navigator.vibrate(pattern);
  }
}
