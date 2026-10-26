/**
 * What a string sounds like, synthesised from the same mode amplitudes the
 * drawing reads, on `crack-sound.ts`'s shape: one context, nothing fetched.
 *
 * A pluck is one sine oscillator per mode, each at that mode's stretched
 * frequency and dying at that mode's own rate. Additive synthesis rather than
 * Karplus-Strong because the modes are already known: the string on screen is
 * a sum of them, so the sound can be the same sum and the two cannot drift.
 * The oscillators run inside the audio thread, so a strum of six strings costs
 * the page a few hundred node creations and no sample math.
 */

import { type Course, decay, partial } from "./strings";

let ctx: AudioContext | null = null;
let bus: AudioNode | null = null;
let noise: AudioBuffer | null = null;

/** the ceiling on one string, since a portfolio is not a game */
const LEVEL = 0.11;
/** nothing above this is worth an oscillator, and a laptop speaker stops here */
const CEILING = 9000;
/** a mode quieter than this share of the loudest is not worth a node */
const FLOOR = 0.004;
/** how far ahead of the event a sound is placed, so a strum keeps its spacing */
const LEAD = 0.02;

function ensure(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();

    /*
     * The body. A guitar's top and its air cavity resonate near 100 and
     * 200Hz, which is most of what turns a bare string into an instrument, and
     * a compressor at the end keeps six strings at once from clipping.
     */
    const air = ctx.createBiquadFilter();
    air.type = "peaking";
    air.frequency.value = 102;
    air.Q.value = 1.4;
    air.gain.value = 5;
    const top = ctx.createBiquadFilter();
    top.type = "peaking";
    top.frequency.value = 205;
    top.Q.value = 1.2;
    top.gain.value = 3;
    const shine = ctx.createBiquadFilter();
    shine.type = "lowpass";
    shine.frequency.value = 7200;
    const limit = ctx.createDynamicsCompressor();
    limit.threshold.value = -14;
    limit.ratio.value = 4;
    limit.attack.value = 0.003;
    limit.release.value = 0.25;
    air.connect(top).connect(shine).connect(limit).connect(ctx.destination);
    bus = air;

    const length = Math.floor(ctx.sampleRate * 0.02);
    noise = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = noise.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
  }
  return ctx;
}

/**
 * Unlock the clock on the press. A context made outside a gesture starts
 * suspended and queues what is started on it, which `poke-sound.ts` documents.
 */
export function armStrings(): void {
  const audio = ensure();
  if (audio && audio.state === "suspended") void audio.resume();
}

function running(): AudioContext | null {
  const audio = ensure();
  return audio && audio.state === "running" ? audio : null;
}

/**
 * The audio time for a moment on the page's own clock.
 *
 * A strum crosses six strings inside one or two pointer events, so placing
 * each pluck at "now" would play them as one chord. `getOutputTimestamp` pairs
 * a context time with the performance time it was heard at, which maps the
 * crossing's own timestamp onto the audio clock. A fixed lead keeps the past
 * ones in the future and their spacing intact.
 */
function at(audio: AudioContext, time: number): number {
  const stamp = audio.getOutputTimestamp?.();
  const base =
    stamp?.contextTime !== undefined && stamp.performanceTime
      ? stamp.contextTime + (time - stamp.performanceTime) / 1000
      : audio.currentTime + (time - performance.now()) / 1000;
  return Math.max(audio.currentTime + 0.002, base + LEAD + audio.baseLatency);
}

/** each string's own sounds, so a finger touching it can stop them */
const voices: Map<number, { gain: GainNode; stop: (at: number) => void }[]> =
  new Map();

/** how far across the stereo field each string sits, low on the left */
function pan(index: number, count: number): number {
  return -0.3 + (0.6 * index) / Math.max(1, count - 1);
}

/**
 * A finger on the string: everything ringing on it dies in about 25ms, which
 * is how fast a fingertip damps a string, and nothing it was playing is left
 * running.
 */
export function mute(index: number, time: number): void {
  const audio = running();
  const list = voices.get(index);
  if (!audio || !list) return;
  const when = at(audio, time);
  for (const voice of list) {
    voice.gain.gain.cancelScheduledValues(when);
    voice.gain.gain.setTargetAtTime(0, when, 0.008);
    voice.stop(when + 0.08);
  }
  voices.set(index, []);
}

/**
 * A pluck.
 *
 * `modes` is the pluck's mode amplitudes at unit pull, `strength` how hard it
 * was pulled as a share of the slip, and `width` the contact's width, which
 * also sets how much click the attack carries: a pick's edge snaps, a
 * fingertip does not.
 */
export function pluck(
  index: number,
  count: number,
  course: Course,
  modes: readonly number[],
  strength: number,
  width: number,
  time: number,
): void {
  const audio = running();
  if (!audio || !bus) return;
  const start = at(audio, time);

  /* velocity, so n times displacement, normalised by its own energy so the
     pluck point changes the colour of the note and not how loud it is */
  const velocity = modes.map((b, i) => b * (i + 1));
  const energy = Math.sqrt(velocity.reduce((s, v) => s + v * v, 0)) || 1;
  const peak = Math.max(...velocity.map(Math.abs)) / energy;

  const out = audio.createGain();
  out.gain.value = 1;
  const field = audio.createStereoPanner();
  field.pan.value = pan(index, count);
  out.connect(field).connect(bus);

  const sources: (OscillatorNode | AudioBufferSourceNode)[] = [];
  let last: OscillatorNode | null = null;
  let end = start;
  /* a fingertip spreads the attack over a few ms, a pick's edge does not */
  const attack = 0.001 + width * 0.06;

  velocity.forEach((v, i) => {
    const n = i + 1;
    const hz = partial(course, n);
    const level = v / energy;
    if (hz > CEILING || Math.abs(level) < FLOOR * peak) return;
    const tau = decay(course, n);
    const osc = audio.createOscillator();
    osc.frequency.value = hz;
    const env = audio.createGain();
    env.gain.setValueAtTime(0, start);
    env.gain.linearRampToValueAtTime(LEVEL * strength * level, start + attack);
    env.gain.setTargetAtTime(0, start + attack, tau);
    osc.connect(env).connect(out);
    osc.start(start);
    const stop = start + attack + Math.min(6, tau * 7);
    osc.stop(stop);
    if (stop > end) {
      end = stop;
      last = osc;
    }
    sources.push(osc);
  });

  /* the pick leaving the string, a few ms of bright noise */
  if (noise) {
    const snap = audio.createBufferSource();
    snap.buffer = noise;
    const high = audio.createBiquadFilter();
    high.type = "highpass";
    high.frequency.value = 2400;
    const env = audio.createGain();
    const click = LEVEL * 0.5 * strength * Math.max(0, 1 - width / 0.05);
    env.gain.setValueAtTime(click, start);
    env.gain.exponentialRampToValueAtTime(0.0001, start + 0.012);
    snap.connect(high).connect(env).connect(out);
    snap.start(start);
    snap.stop(start + 0.02);
    sources.push(snap);
  }

  register(index, out, sources, last);
}

/**
 * A string answering another through the bridge. It does not start at full
 * level, it builds over a few hundred ms as the bridge pumps energy into it,
 * so each mode is a rise in series with its own decay.
 */
export function sympathy(
  index: number,
  count: number,
  course: Course,
  modes: readonly number[],
  time: number,
  rise: number,
): void {
  const audio = running();
  if (!audio || !bus) return;
  const start = at(audio, time);
  const out = audio.createGain();
  const field = audio.createStereoPanner();
  field.pan.value = pan(index, count);
  out.connect(field).connect(bus);

  const sources: OscillatorNode[] = [];
  let last: OscillatorNode | null = null;
  let end = start;
  modes.forEach((b, i) => {
    const n = i + 1;
    const level = LEVEL * Math.abs(b) * n;
    const hz = partial(course, n);
    if (level < 0.0004 || hz > CEILING) return;
    const tau = decay(course, n);
    const osc = audio.createOscillator();
    osc.frequency.value = hz;
    const grow = audio.createGain();
    grow.gain.setValueAtTime(0, start);
    grow.gain.setTargetAtTime(1, start, rise);
    const fade = audio.createGain();
    fade.gain.setValueAtTime(Math.min(level, LEVEL * 0.3), start);
    fade.gain.setTargetAtTime(0, start, tau);
    osc.connect(grow).connect(fade).connect(out);
    osc.start(start);
    const stop = start + Math.min(6, tau * 7);
    osc.stop(stop);
    if (stop > end) {
      end = stop;
      last = osc;
    }
    sources.push(osc);
  });
  if (sources.length === 0) {
    out.disconnect();
    return;
  }
  register(index, out, sources, last);
}

function register(
  index: number,
  out: GainNode,
  sources: (OscillatorNode | AudioBufferSourceNode)[],
  last: OscillatorNode | null,
): void {
  const list = voices.get(index) ?? [];
  const voice = {
    gain: out,
    stop: (when: number) => {
      for (const s of sources) {
        try {
          s.stop(when);
        } catch {
          // already stopped, which is the state this asked for
        }
      }
    },
  };
  list.push(voice);
  voices.set(index, list);
  /* forget it once its longest mode has run out, so the list stays the size
     of what rings */
  last?.addEventListener("ended", () => {
    const now = voices.get(index);
    if (now)
      voices.set(
        index,
        now.filter((v) => v !== voice),
      );
    window.setTimeout(() => out.disconnect(), 100);
  });
}

/** a phone with a motor feels each string, and `vibrate` is a no-op elsewhere */
export function tick(): void {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    navigator.vibrate(4);
  }
}
