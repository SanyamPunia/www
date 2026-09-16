/*
 * What a match sounds like, synthesised rather than fetched.
 *
 * `crack-sound.ts` sets the shape this follows: one context, one noise buffer,
 * a filtered burst per event, nothing requested over the network. Both events
 * here are noise with no pitch in them at all, which is the whole reason there
 * is nothing to record: a strike is a scrape and a catch, and a snuff is a
 * breath, and neither has a note.
 */

let ctx: AudioContext | null = null;
let noise: AudioBuffer | null = null;

/** the ceiling on any one press, since a portfolio is not a game */
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
    /* half a second of white noise, reused by every burst */
    const length = Math.floor(ctx.sampleRate * 0.5);
    noise = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = noise.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
  }
  return ctx;
}

/**
 * Unlock the clock on the press, play on the release.
 *
 * A context made outside a user gesture starts suspended, its clock does not
 * advance, and a source started on one is queued rather than dropped, so a
 * later resume fires every queued sound at once. `poke-sound.ts` documents the
 * same two-step and the same reason.
 */
export function armEmber(): void {
  const audio = ensure();
  if (audio && audio.state === "suspended") void audio.resume();
}

interface Burst {
  at: number;
  /** where the band starts and where it sweeps to */
  from: number;
  to: number;
  q: number;
  life: number;
  gain: number;
  /** a bandpass is a scrape and a lowpass is a breath */
  type: BiquadFilterType;
}

function burst(audio: AudioContext, b: Burst): void {
  if (!noise) return;
  const source = audio.createBufferSource();
  source.buffer = noise;
  /* a random start into half a second of noise, so no two bursts are the same */
  const offset = Math.random() * (noise.duration - b.life - 0.02);

  const band = audio.createBiquadFilter();
  band.type = b.type;
  band.frequency.setValueAtTime(b.from, b.at);
  band.frequency.exponentialRampToValueAtTime(b.to, b.at + b.life);
  band.Q.value = b.q;

  const level = audio.createGain();
  level.gain.setValueAtTime(0, b.at);
  level.gain.linearRampToValueAtTime(b.gain, b.at + 0.004);
  level.gain.exponentialRampToValueAtTime(0.0001, b.at + b.life);

  source.connect(band).connect(level).connect(audio.destination);
  source.start(b.at, Math.max(0, offset), b.life + 0.02);
}

/**
 * The strike: a scrape and then a catch.
 *
 * Two bursts and not one, because striking a match is two events a few
 * hundredths apart and running them together is a hiss. The scrape sweeps up,
 * which is the head dragging across the grit, and the catch is a low body under
 * it that is the flame taking.
 */
export function playStrike(): void {
  const audio = ensure();
  if (!audio || audio.state !== "running") return;
  const now = audio.currentTime;

  burst(audio, {
    at: now,
    from: 1400,
    to: 5200,
    q: 1.4,
    life: 0.085,
    gain: GAIN,
    type: "bandpass",
  });

  burst(audio, {
    at: now + 0.045,
    from: 900,
    to: 260,
    q: 0.7,
    life: 0.3,
    gain: GAIN * 0.75,
    type: "lowpass",
  });
}

/**
 * One spark coming apart, which is most of what a fire sounds like: a fire
 * crackles because things in it are breaking, and the burst already knows when
 * one does. Short, high and quiet, since it is an event the size of a spark and
 * a flurry can set several off inside a second.
 */
export function playCrackle(): void {
  const audio = ensure();
  if (!audio || audio.state !== "running") return;
  burst(audio, {
    at: audio.currentTime,
    from: 3200 + Math.random() * 3600,
    to: 1400,
    q: 7 + Math.random() * 6,
    life: 0.018 + Math.random() * 0.026,
    gain: GAIN * (0.16 + Math.random() * 0.2),
    type: "bandpass",
  });
}

/**
 * The snuff: one breath, lower and drier than either half of the strike, and
 * with no sweep upward in it anywhere. Putting a flame out is a slower and
 * duller event than lighting one, which is the same claim the smoke makes.
 */
export function playSnuff(): void {
  const audio = ensure();
  if (!audio || audio.state !== "running") return;
  const now = audio.currentTime;

  burst(audio, {
    at: now,
    from: 1100,
    to: 320,
    q: 0.6,
    life: 0.22,
    gain: GAIN * 0.8,
    type: "lowpass",
  });
}
