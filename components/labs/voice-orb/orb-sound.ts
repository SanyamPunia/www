/*
 * What the orb sounds like, synthesised rather than fetched.
 *
 * `crack-sound.ts` sets the shape: one context, nothing requested over the
 * network. All three sounds are a sine or two, which is what a voice
 * assistant's earcons are. The reply itself is silent: a synthesised murmur was
 * built for it and taken out, since gibberish speech read as a browser trick.
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

/**
 * Unlock the clock on the press. A context made outside a user gesture starts
 * suspended and queues what is started on it, so a later resume fires every
 * queued sound at once. `poke-sound.ts` documents the same two-step.
 */
export function armOrb(): void {
  const audio = ensure();
  if (audio && audio.state === "suspended") void audio.resume();
}

function running(): AudioContext | null {
  const audio = ensure();
  return audio && audio.state === "running" ? audio : null;
}

/** one soft sine note, with a short attack so it never clicks */
function note(
  audio: AudioContext,
  at: number,
  from: number,
  to: number,
  life: number,
  gain: number,
): void {
  const osc = audio.createOscillator();
  osc.type = "sine";
  osc.frequency.setValueAtTime(from, at);
  osc.frequency.exponentialRampToValueAtTime(to, at + life * 0.6);
  const level = audio.createGain();
  level.gain.setValueAtTime(0, at);
  level.gain.linearRampToValueAtTime(gain * GAIN, at + 0.012);
  level.gain.exponentialRampToValueAtTime(0.0001, at + life);
  osc.connect(level).connect(audio.destination);
  osc.start(at);
  osc.stop(at + life + 0.02);
}

/** the orb starts listening: two notes going up */
export function listenChime(): void {
  const audio = running();
  if (!audio) return;
  const t = audio.currentTime;
  note(audio, t, 659, 659, 0.22, 0.5);
  note(audio, t + 0.07, 988, 988, 0.3, 0.45);
}

/** the orb stops listening: the same two notes going down */
export function doneChime(): void {
  const audio = running();
  if (!audio) return;
  const t = audio.currentTime;
  note(audio, t, 988, 988, 0.2, 0.4);
  note(audio, t + 0.07, 659, 659, 0.28, 0.4);
}

/** a poke: one note that drops, the sound of something soft being pressed */
export function bloop(strength: number): void {
  const audio = running();
  if (!audio) return;
  note(audio, audio.currentTime, 560, 330, 0.18, 0.35 + strength * 0.3);
}
