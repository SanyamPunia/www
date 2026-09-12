/**
 * What a pane sounds like, synthesised rather than fetched.
 *
 * `poke-sound.ts` decodes one mp3 and plays a fresh source node per press, and
 * that is the right shape for a click, which is one sound. This is eleven sounds
 * that have to get sharper and busier as the glass gives, and a shatter that is
 * a scatter of them, so there is nothing to record: a crack is a filtered noise
 * burst with a fast decay, and the only thing that changes between the first
 * press and the eleventh is where the filter sits and how many bursts go off.
 *
 * The page fetches nothing for any of it.
 */

let ctx: AudioContext | null = null;
let noise: AudioBuffer | null = null;

/** the ceiling on any one press, since a portfolio is not a game */
const GAIN = 0.22;

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
    /* a quarter second of white noise, reused by every burst */
    const length = Math.floor(ctx.sampleRate * 0.25);
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
 * advance, and a source started on one is queued rather than dropped, so a later
 * resume fires every queued sound at once. `poke-sound.ts` documents the same
 * two-step and the same reason.
 */
export function armGlass(): void {
  const audio = ensure();
  if (audio && audio.state === "suspended") void audio.resume();
}

function burst(
  audio: AudioContext,
  at: number,
  hz: number,
  q: number,
  life: number,
  gain: number,
): void {
  if (!noise) return;
  const source = audio.createBufferSource();
  source.buffer = noise;

  /* a crack is a narrow band of noise, which is what a brittle snap is */
  const band = audio.createBiquadFilter();
  band.type = "bandpass";
  band.frequency.setValueAtTime(hz, at);
  band.frequency.exponentialRampToValueAtTime(
    Math.max(hz * 0.45, 200),
    at + life,
  );
  band.Q.value = q;

  const level = audio.createGain();
  level.gain.setValueAtTime(0, at);
  level.gain.linearRampToValueAtTime(gain, at + 0.002);
  level.gain.exponentialRampToValueAtTime(0.0001, at + life);

  source.connect(band).connect(level).connect(audio.destination);
  source.start(at);
  source.stop(at + life + 0.02);
}

/**
 * One press. `damage` runs 0 to 1 and takes the pitch up and the decay down, so
 * the glass sounds tighter and drier the closer it is to going.
 */
export function playCrack(damage: number): void {
  const audio = ensure();
  if (!audio || audio.state !== "running") return;
  const now = audio.currentTime;
  burst(
    audio,
    now,
    1500 + damage * 2600,
    6 + damage * 6,
    0.05 + (1 - damage) * 0.05,
    GAIN,
  );
}

/**
 * The break: a body under a scatter of cracks.
 *
 * A shatter is not one louder crack, it is a great many of them inside about a
 * quarter of a second, which is why this is the same burst called twelve times
 * on a falling curve rather than a different sound.
 */
export function playShatter(): void {
  const audio = ensure();
  if (!audio || audio.state !== "running") return;
  const now = audio.currentTime;

  /* the pane letting go, low and short, under everything else */
  burst(audio, now, 420, 2, 0.2, GAIN * 0.9);

  for (let i = 0; i < 12; i++) {
    const at = now + Math.random() ** 1.7 * 0.26;
    burst(
      audio,
      at,
      2200 + Math.random() * 4200,
      8 + Math.random() * 8,
      0.03 + Math.random() * 0.05,
      GAIN * (0.28 + Math.random() * 0.4),
    );
  }
}

/** the glass going back together, which is the shatter read backwards and softer */
export function playRepair(): void {
  const audio = ensure();
  if (!audio || audio.state !== "running") return;
  const now = audio.currentTime;
  for (let i = 0; i < 5; i++) {
    burst(
      audio,
      now + (i / 5) ** 0.7 * 0.3,
      900 + i * 520,
      5,
      0.05,
      GAIN * 0.22,
    );
  }
}
