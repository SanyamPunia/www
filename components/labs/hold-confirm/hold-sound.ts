/**
 * What a hold sounds like, synthesised rather than fetched, on the shape
 * `crack-sound.ts` sets: one context, one noise buffer, a filtered burst per
 * event. The page requests nothing for any of it.
 *
 * A hold is a ratchet being wound: a tick at every twelfth of the fill, each a
 * little higher and a little louder, so the last few say "nearly" without a
 * word. The commit is a latch and a lid slamming, the cancel a short fall, and
 * the undo the cancel turned upward.
 */

let ctx: AudioContext | null = null;
let noise: AudioBuffer | null = null;

/** the ceiling on any one sound, since a portfolio is not a game */
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
    const length = Math.floor(ctx.sampleRate * 0.25);
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
export function armHold(): void {
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
  hz: number,
  q: number,
  life: number,
  gain: number,
): void {
  if (!noise) return;
  const source = audio.createBufferSource();
  source.buffer = noise;
  const filter = audio.createBiquadFilter();
  filter.type = type;
  filter.frequency.setValueAtTime(hz, at);
  filter.Q.value = q;
  const level = audio.createGain();
  level.gain.setValueAtTime(0, at);
  level.gain.linearRampToValueAtTime(gain, at + 0.002);
  level.gain.exponentialRampToValueAtTime(0.0001, at + life);
  source.connect(filter).connect(level).connect(audio.destination);
  source.start(at);
  source.stop(at + life + 0.02);
}

function tone(
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
  osc.frequency.exponentialRampToValueAtTime(to, at + life);
  const level = audio.createGain();
  level.gain.setValueAtTime(0, at);
  level.gain.linearRampToValueAtTime(gain, at + 0.006);
  level.gain.exponentialRampToValueAtTime(0.0001, at + life);
  osc.connect(level).connect(audio.destination);
  osc.start(at);
  osc.stop(at + life + 0.02);
}

/** one notch of the ratchet. `p` takes it up the scale and up in level */
export function tick(p: number): void {
  const audio = running();
  if (!audio) return;
  burst(
    audio,
    audio.currentTime,
    "bandpass",
    1700 + p * 2600,
    9,
    0.026,
    GAIN * (0.22 + p * 0.38),
  );
}

/** the latch letting go, the moment the hold completes */
export function latch(): void {
  const audio = running();
  if (!audio) return;
  const now = audio.currentTime;
  burst(audio, now, "bandpass", 5200, 6, 0.03, GAIN * 0.7);
  burst(audio, now + 0.03, "bandpass", 3100, 5, 0.04, GAIN * 0.5);
}

/** the lid slamming over the file, low and short */
export function thump(): void {
  const audio = running();
  if (!audio) return;
  const now = audio.currentTime;
  tone(audio, now, 150, 52, 0.16, GAIN * 0.9);
  burst(audio, now, "lowpass", 900, 0.7, 0.08, GAIN * 0.6);
  burst(audio, now + 0.012, "bandpass", 2400, 4, 0.03, GAIN * 0.25);
}

/** a hold let go early: the ratchet unwinding, as one short fall */
export function unwind(p: number): void {
  const audio = running();
  if (!audio) return;
  tone(audio, audio.currentTime, 380 + p * 260, 210, 0.12, GAIN * 0.35);
}

/** a tap, which is two soft knocks saying "not like that" */
export function nudge(): void {
  const audio = running();
  if (!audio) return;
  const now = audio.currentTime;
  burst(audio, now, "lowpass", 700, 1, 0.05, GAIN * 0.5);
  burst(audio, now + 0.09, "lowpass", 620, 1, 0.05, GAIN * 0.4);
}

/** the file coming back out, the unwind turned upward */
export function restore(): void {
  const audio = running();
  if (!audio) return;
  const now = audio.currentTime;
  tone(audio, now, 330, 520, 0.12, GAIN * 0.3);
  tone(audio, now + 0.08, 520, 780, 0.14, GAIN * 0.24);
}

/** the file landing back in its row */
export function settle(): void {
  const audio = running();
  if (!audio) return;
  burst(audio, audio.currentTime, "lowpass", 1400, 0.8, 0.05, GAIN * 0.35);
}

/**
 * A phone with a motor feels the ratchet as well as hearing it. `vibrate` is a
 * no-op everywhere else, and it is guarded since Safari does not define it.
 */
export function buzz(pattern: number | number[]): void {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    navigator.vibrate(pattern);
  }
}
