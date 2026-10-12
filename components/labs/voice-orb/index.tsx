"use client";

import { useReducedMotion } from "motion/react";
import type React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { TextMorph } from "torph/react";
import { SpeakerHighIcon, SpeakerSlashIcon } from "@/components/icons";
import { Tooltip, TooltipProvider } from "@/components/ui/tooltip";
import { approach, clamp01 } from "@/lib/lerp";
import { cn } from "@/lib/utils";
import { armOrb, bloop, doneChime, listenChime } from "./orb-sound";
import { createOrb, drawOrb, type Orb, RIPPLES } from "./shader";
import { endOf, envelope, type Syllable, utterance } from "./voice";

/*
 * A voice assistant's orb. Hold it to talk and it listens, let go and it
 * thinks, then it answers. A tap pokes it, a tap while it is answering cuts it
 * off, and a pointer near it drags the fluid inside toward itself.
 *
 * `shader.ts` is the drawing, one fragment shader over the stage. `voice.ts` is
 * the reply as a list of syllables, which the orb's swell reads.
 * `orb-sound.ts` is the earcons. This file is the state machine and the frame
 * loop.
 *
 * Nothing renders per frame. Every eased number lives in a ref and one loop
 * hands them to the shader. The only state is the phase, which changes a few
 * times a conversation and drives the label.
 */

type Phase = "idle" | "listening" | "thinking" | "speaking";
type Tone = readonly [number, number, number];

interface Palette {
  deep: Tone;
  mid: Tone;
  light: Tone;
  halo: Tone;
}

function hex(value: string): Tone {
  const n = Number.parseInt(value.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

/**
 * One palette per phase, scoped here and not tokens. The orb is the subject
 * and its colour is what says which phase it is in: blue at rest, indigo while
 * it listens, violet while it thinks, and a brighter cyan while it answers.
 */
const PALETTE: Record<Phase, Palette> = {
  idle: {
    deep: hex("#1e4fd8"),
    mid: hex("#59a8ff"),
    light: hex("#d7efff"),
    halo: hex("#8cc8ff"),
  },
  listening: {
    deep: hex("#3a2fd0"),
    mid: hex("#7c86ff"),
    light: hex("#e4e6ff"),
    halo: hex("#a7acff"),
  },
  thinking: {
    deep: hex("#5b2fc7"),
    mid: hex("#a57bff"),
    light: hex("#f1e8ff"),
    halo: hex("#c3a8ff"),
  },
  speaking: {
    deep: hex("#0b63e6"),
    mid: hex("#36b7ff"),
    light: hex("#dcf7ff"),
    halo: hex("#7fd6ff"),
  },
};

type Active = Exclude<Phase, "idle">;
const PHASES: readonly Active[] = ["listening", "thinking", "speaking"];

const STATUS: Record<Phase, { now: string; next: string; label: string }> = {
  idle: {
    now: "Hold to talk",
    next: "Tap to poke it",
    label: "Hold to talk to the orb",
  },
  listening: {
    now: "Listening",
    next: "Move to speak up, let go to send",
    label: "Listening. Let go to send",
  },
  thinking: { now: "Thinking", next: "Tap to cancel", label: "Thinking" },
  speaking: {
    now: "Speaking",
    next: "Tap to cut it off",
    label: "Speaking. Press to cut it off",
  },
};

/** how long a press has to last before it is a hold rather than a tap */
const HOLD = 220;
/** how long it thinks before it answers */
const THINK = 900;
/** a reply's length in seconds, before it is cut to a whole word */
const REPLY = { min: 1.4, max: 5.5 } as const;

/** the orb's radius as a share of the stage's short side, and where it stands */
const SIZE = 0.26;
const RISE = 0.42;

/** the pop a tap gives the orb: a spring on its scale, a little under damped */
const POP = { k: 260, c: 13, kick: 2.4 } as const;

interface Layout {
  w: number;
  h: number;
  dpr: number;
  cx: number;
  cy: number;
  r: number;
}

function mix(a: Tone, b: Tone, t: number): Tone {
  return [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t,
  ];
}

/** a tone as CSS, for the drawing that stands in when there is no WebGL */
function css(t: Tone): string {
  return `rgb(${t.map((v) => Math.round(v * 255)).join(" ")})`;
}

export default function VoiceOrb() {
  const reduce = useReducedMotion();
  const stage = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [rect, setRect] = useState<{ x: number; y: number; d: number } | null>(
    null,
  );
  const [failed, setFailed] = useState(false);
  const [loud, setLoud] = useState(true);

  // everything the loop and the gestures read, kept out of React
  const live = useRef({
    orb: null as Orb | null,
    raf: 0,
    last: 0,
    seen: false,
    reduce: false,
    sound: true,
    layout: null as Layout | null,
    phase: "idle" as Phase,
    // eased toward their targets every frame
    energy: 0,
    listen: 0,
    speak: 0,
    think: 0,
    hover: 0,
    weight: { listening: 0, thinking: 0, speaking: 0 } as Record<
      Active,
      number
    >,
    px: 0,
    py: 0,
    pop: 0,
    popV: 0,
    // the clocks: real seconds, the fluid's, the rim's, and the inside's turn
    clock: 0,
    time: 0,
    wobbleClock: 0,
    rot: 0,
    // x, y, age, strength per ripple, in orb units
    ripples: new Float32Array(RIPPLES * 4),
    // the pointer in orb units, or null when it is not on the stage
    pointer: null as { x: number; y: number } | null,
    // the hand's speed in px a second, which is how loud it is talking
    speed: 0,
    lastMove: null as { x: number; y: number; t: number } | null,
    lastPet: 0,
    // the press, and the hold it may become
    press: null as { at: number } | null,
    holdTimer: 0 as ReturnType<typeof setTimeout> | 0,
    listenAt: 0,
    talk: 0,
    // the reply
    reply: [] as Syllable[],
    replyAt: 0,
    nextSyllable: 0,
    seed: 7,
    timers: [] as ReturnType<typeof setTimeout>[],
  });

  const ripple = useCallback((x: number, y: number, strength: number) => {
    const s = live.current;
    if (s.reduce) return;
    const r = s.ripples;
    // a free slot, or else the oldest one
    let slot = 0;
    let oldest = -1;
    for (let i = 0; i < RIPPLES; i++) {
      if (r[i * 4 + 3] <= 0) {
        slot = i;
        oldest = Number.POSITIVE_INFINITY;
        break;
      }
      if (r[i * 4 + 2] > oldest) {
        oldest = r[i * 4 + 2];
        slot = i;
      }
    }
    r[slot * 4] = x;
    r[slot * 4 + 1] = y;
    r[slot * 4 + 2] = 0;
    r[slot * 4 + 3] = strength;
  }, []);

  const draw = useCallback(() => {
    const s = live.current;
    const l = s.layout;
    if (!s.orb || !l) return;

    const breathe = s.reduce ? 0 : 0.012 * Math.sin(s.clock * 1.4);
    const scale =
      1 +
      s.pop +
      breathe * (1 - s.energy) +
      0.035 * s.hover * (1 - s.energy) +
      0.11 * s.speak +
      0.07 * s.listen -
      0.045 * s.energy -
      0.06 * s.think;

    let { deep, mid, light, halo }: Palette = PALETTE.idle;
    for (const key of PHASES) {
      const w = s.weight[key];
      if (w <= 0) continue;
      const p = PALETTE[key];
      deep = mix(deep, p.deep, w);
      mid = mix(mid, p.mid, w);
      light = mix(light, p.light, w);
      halo = mix(halo, p.halo, w);
    }

    drawOrb(s.orb, {
      width: Math.round(l.w * l.dpr),
      height: Math.round(l.h * l.dpr),
      cx: l.cx * l.dpr,
      cy: l.cy * l.dpr,
      radius: l.r * scale * l.dpr,
      time: s.time,
      wobbleClock: s.wobbleClock,
      wobble: s.reduce
        ? 0
        : 0.01 + 0.06 * s.speak + 0.045 * s.listen + 0.02 * s.think,
      rot: s.rot,
      twist: 2.6 * s.think,
      energy: s.energy,
      speak: s.speak,
      hover: s.hover,
      clock: s.clock,
      pointer: [s.px, s.py],
      deep,
      mid,
      light,
      halo,
      glow:
        0.32 +
        0.2 * s.hover +
        0.4 * s.speak +
        0.18 * s.energy +
        0.15 * s.listen,
      ripples: s.ripples,
    });
  }, []);

  /** every eased value straight to its target, for reduced motion */
  const snap = useCallback(() => {
    const s = live.current;
    const listening = s.phase === "listening";
    s.energy = listening ? 1 : 0;
    s.listen = listening ? 0.2 : 0;
    s.think = s.phase === "thinking" ? 1 : 0;
    s.speak = s.phase === "speaking" ? 0.4 : 0;
    for (const key of PHASES) s.weight[key] = s.phase === key ? 1 : 0;
    s.hover = 0;
    s.px = 0;
    s.py = 0;
    s.pop = 0;
    s.popV = 0;
    s.ripples.fill(0);
  }, []);

  const step = useCallback(
    (dt: number, now: number) => {
      const s = live.current;
      s.clock += dt;

      const listening = s.phase === "listening";
      // The hand's speed is how loud it is talking. It decays on its own, so
      // a hand that stops is a voice that goes quiet, and a still hold
      // breathes at a low level rather than sitting dead.
      s.speed *= Math.exp(-dt / 0.12);
      const heard = listening
        ? Math.min(
            1,
            0.12 + 0.08 * Math.sin(s.clock * 2.6) ** 2 + s.speed / 1400,
          )
        : 0;
      s.listen +=
        (heard - s.listen) * approach(heard > s.listen ? 0.05 : 0.22, dt);
      if (listening) s.talk += s.listen * dt;

      s.energy +=
        ((listening ? 1 : 0) - s.energy) * approach(listening ? 0.35 : 0.5, dt);
      s.think +=
        ((s.phase === "thinking" ? 1 : 0) - s.think) * approach(0.3, dt);

      let amp = 0;
      if (s.phase === "speaking") {
        const t = (now - s.replyAt) / 1000;
        amp = envelope(s.reply, t);
        // a loud syllable sends a ring out of the middle
        while (
          s.nextSyllable < s.reply.length &&
          (s.reply[s.nextSyllable]?.at ?? Number.POSITIVE_INFINITY) <= t
        ) {
          const syllable = s.reply[s.nextSyllable++];
          if (syllable && syllable.peak > 0.8) {
            ripple(0, 0, syllable.peak * 0.3);
          }
        }
      }
      s.speak += (amp - s.speak) * approach(amp > s.speak ? 0.025 : 0.07, dt);

      for (const key of PHASES) {
        s.weight[key] +=
          ((s.phase === key ? 1 : 0) - s.weight[key]) * approach(0.32, dt);
      }

      // full within one and a half radii of the middle, gone by three
      const p = s.pointer;
      const reach = p ? clamp01((3 - Math.hypot(p.x, p.y)) / 1.5) : 0;
      const hovered = s.press ? 1 : reach;
      s.hover += (hovered - s.hover) * approach(0.2, dt);
      let tx = 0;
      let ty = 0;
      if (p) {
        const len = Math.hypot(p.x, p.y);
        const k = len > 1.3 ? 1.3 / len : 1;
        tx = p.x * k;
        ty = p.y * k;
      }
      s.px += (tx - s.px) * approach(0.15, dt);
      s.py += (ty - s.py) * approach(0.15, dt);

      const a = -POP.k * s.pop - POP.c * s.popV;
      s.popV += a * dt;
      s.pop += s.popV * dt;

      s.time +=
        dt *
        (1 +
          1.8 * s.energy +
          2.4 * s.speak +
          1.4 * s.think +
          1.2 * s.listen +
          0.4 * s.hover);
      s.wobbleClock += dt * (1 + 3 * s.speak + 2.5 * s.listen);
      s.rot += dt * (0.12 + 2.4 * s.think);

      const r = s.ripples;
      for (let i = 0; i < RIPPLES; i++) {
        if (r[i * 4 + 3] <= 0) continue;
        r[i * 4 + 2] += dt;
        if (r[i * 4 + 2] > 1.6) r[i * 4 + 3] = 0;
      }
    },
    [ripple],
  );

  const tick = useCallback(
    function frame(now: number) {
      const s = live.current;
      s.raf = 0;
      // a stalled tab comes back to a 50ms step at most, not a leap
      const dt = Math.min(0.05, (now - s.last) / 1000);
      s.last = now;
      step(dt, now);
      draw();
      if (s.seen && !s.reduce && s.orb) s.raf = requestAnimationFrame(frame);
    },
    [draw, step],
  );

  const start = useCallback(() => {
    const s = live.current;
    if (s.raf || !s.seen || s.reduce || !s.orb) return;
    s.last = performance.now();
    s.raf = requestAnimationFrame(tick);
  }, [tick]);

  const go = useCallback(
    (next: Phase) => {
      const s = live.current;
      s.phase = next;
      setPhase(next);
      if (s.reduce) {
        snap();
        draw();
      }
    },
    [draw, snap],
  );

  /** stops whatever the orb is doing after the listening, and goes quiet */
  const interrupt = useCallback(() => {
    const s = live.current;
    for (const t of s.timers) clearTimeout(t);
    s.timers = [];
    if (s.phase === "thinking" || s.phase === "speaking") go("idle");
  }, [go]);

  const answer = useCallback(() => {
    const s = live.current;
    const held = (performance.now() - s.listenAt) / 1000;
    const length = Math.min(
      REPLY.max,
      Math.max(REPLY.min, 1.2 + held * 0.6 + s.talk * 1.6),
    );
    s.reply = utterance(length, s.seed++);
    s.replyAt = performance.now();
    s.nextSyllable = 0;
    go("speaking");
    s.timers.push(setTimeout(() => go("idle"), (endOf(s.reply) + 0.2) * 1000));
  }, [go]);

  /** a press begins: it pokes at once and becomes a hold if it lasts */
  const begin = useCallback(
    (x: number, y: number) => {
      const s = live.current;
      interrupt();
      s.press = { at: performance.now() };
      ripple(x, y, 0.55);
      if (s.holdTimer) clearTimeout(s.holdTimer);
      s.holdTimer = setTimeout(() => {
        s.holdTimer = 0;
        if (!s.press) return;
        s.listenAt = performance.now();
        s.talk = 0;
        s.speed = 0;
        go("listening");
        if (s.sound) listenChime();
      }, HOLD);
      start();
    },
    [go, interrupt, ripple, start],
  );

  /** a press ends: a hold sends what it heard, anything shorter was a poke */
  const end = useCallback(
    (cancelled: boolean) => {
      const s = live.current;
      if (s.holdTimer) clearTimeout(s.holdTimer);
      s.holdTimer = 0;
      if (!s.press) return;
      s.press = null;
      s.lastMove = null;
      if (s.phase === "listening") {
        if (cancelled) {
          go("idle");
          return;
        }
        if (s.sound) doneChime();
        go("thinking");
        s.timers.push(setTimeout(answer, s.reduce ? THINK / 2 : THINK));
        return;
      }
      if (cancelled) return;
      if (!s.reduce) s.popV += POP.kick;
      if (s.sound) bloop(0.5);
    },
    [answer, go],
  );

  // reduced motion: no loop, a frame per change
  useEffect(() => {
    const s = live.current;
    s.reduce = reduce === true;
    if (s.reduce) {
      cancelAnimationFrame(s.raf);
      s.raf = 0;
      snap();
      draw();
    } else {
      start();
    }
  }, [reduce, draw, snap, start]);

  // the context, the stage's size, and whether anyone is looking
  useEffect(() => {
    const node = stage.current;
    const c = canvas.current;
    if (!node || !c) return;
    const s = live.current;

    const init = () => {
      const gl = c.getContext("webgl", {
        alpha: true,
        premultipliedAlpha: true,
        antialias: false,
        powerPreference: "low-power",
      });
      s.orb = gl ? createOrb(gl) : null;
      setFailed(!s.orb);
    };
    init();

    const read = () => {
      const w = node.clientWidth;
      const h = node.clientHeight;
      if (w === 0 || h === 0) return;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      c.width = Math.round(w * dpr);
      c.height = Math.round(h * dpr);
      const r = Math.min(w, h) * SIZE;
      const l = { w, h, dpr, cx: w / 2, cy: h * RISE, r };
      s.layout = l;
      setRect({ x: l.cx - r, y: l.cy - r, d: r * 2 });
      draw();
      start();
    };
    read();
    const resize = new ResizeObserver(read);
    resize.observe(node);

    // no frames for a stage nobody is looking at
    const seen = new IntersectionObserver(([entry]) => {
      s.seen = entry?.isIntersecting ?? false;
      if (s.seen) start();
    });
    seen.observe(node);

    const lost = (e: Event) => {
      e.preventDefault();
      cancelAnimationFrame(s.raf);
      s.raf = 0;
      s.orb = null;
    };
    const restored = () => {
      init();
      draw();
      start();
    };
    c.addEventListener("webglcontextlost", lost);
    c.addEventListener("webglcontextrestored", restored);

    return () => {
      resize.disconnect();
      seen.disconnect();
      c.removeEventListener("webglcontextlost", lost);
      c.removeEventListener("webglcontextrestored", restored);
      cancelAnimationFrame(s.raf);
      s.raf = 0;
      for (const t of s.timers) clearTimeout(t);
      if (s.holdTimer) clearTimeout(s.holdTimer);
    };
  }, [draw, start]);

  /** a client point in orb units, y up */
  const toOrb = useCallback((clientX: number, clientY: number) => {
    const node = stage.current;
    const l = live.current.layout;
    if (!node || !l) return { x: 0, y: 0, px: 0, py: 0 };
    const box = node.getBoundingClientRect();
    const px = clientX - box.left;
    const py = clientY - box.top;
    return { x: (px - l.cx) / l.r, y: (l.cy - py) / l.r, px, py };
  }, []);

  /** the hand moving: where it is, and for a press, how fast */
  const track = useCallback(
    (e: PointerEvent | React.PointerEvent) => {
      const s = live.current;
      const at = toOrb(e.clientX, e.clientY);
      s.pointer = { x: at.x, y: at.y };
      const now = performance.now();
      const prev = s.lastMove;
      if (prev) {
        const dt = (now - prev.t) / 1000;
        if (dt > 0.004) {
          const v = Math.hypot(at.px - prev.x, at.py - prev.y) / dt;
          s.speed += (v - s.speed) * 0.35;
          // a quick pass over the orb at rest stirs its surface
          if (
            !s.press &&
            s.phase === "idle" &&
            v > 900 &&
            Math.hypot(at.x, at.y) < 1 &&
            now - s.lastPet > 140
          ) {
            s.lastPet = now;
            ripple(at.x, at.y, Math.min(0.45, v / 4500));
          }
        }
      }
      s.lastMove = { x: at.px, y: at.py, t: now };
      start();
    },
    [ripple, start, toOrb],
  );

  // Hover is the stage's, so the orb notices a pointer before it arrives. Mouse
  // and pen only: a finger has no hover to take back.
  useEffect(() => {
    const node = stage.current;
    if (!node) return;
    const s = live.current;
    const move = (e: PointerEvent) => {
      if (s.press || s.reduce) return;
      if (e.pointerType !== "mouse" && e.pointerType !== "pen") return;
      track(e);
    };
    const leave = (e: PointerEvent) => {
      if (s.press || e.pointerType === "touch") return;
      s.pointer = null;
      s.lastMove = null;
    };
    const blur = () => end(true);
    node.addEventListener("pointermove", move);
    node.addEventListener("pointerleave", leave);
    window.addEventListener("blur", blur);
    return () => {
      node.removeEventListener("pointermove", move);
      node.removeEventListener("pointerleave", leave);
      window.removeEventListener("blur", blur);
    };
  }, [end, track]);

  const onPointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (e.button !== 0) return;
    armOrb();
    e.currentTarget.setPointerCapture(e.pointerId);
    const s = live.current;
    s.lastMove = null;
    track(e);
    const at = toOrb(e.clientX, e.clientY);
    begin(at.x, at.y);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    const s = live.current;
    if (!s.press) return;
    // a lift that was never heard
    if (e.buttons === 0) {
      end(false);
      return;
    }
    track(e);
  };

  const onPointerUp = () => end(false);
  const onPointerCancel = () => end(true);

  const onKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === "Escape") {
      end(true);
      interrupt();
      return;
    }
    if (e.key !== " " && e.key !== "Enter") return;
    // the default is the click a button synthesises, which would land on top
    // of the hold this key is starting
    e.preventDefault();
    if (e.repeat || live.current.press) return;
    armOrb();
    begin(0, 0);
  };

  const onKeyUp = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (e.key !== " " && e.key !== "Enter") return;
    e.preventDefault();
    end(false);
  };

  // a click with no pointer and no key behind it is an assistive technology's,
  // and it gets a poke, since it has no way to hold
  const onClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (e.detail !== 0 || live.current.press) return;
    armOrb();
    begin(0, 0);
    end(false);
  };

  const toggleSound = () => {
    const s = live.current;
    s.sound = !s.sound;
    setLoud(s.sound);
  };

  const soundLabel = loud ? "Turn the sound off" : "Turn the sound on";
  const status = STATUS[phase];
  const fallback = PALETTE[phase];

  return (
    <TooltipProvider delayDuration={200}>
      <div
        ref={stage}
        className="relative isolate aspect-8/5 min-h-78 w-full select-none overflow-hidden rounded-lg bg-fill"
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
        >
          <canvas ref={canvas} className="block size-full" />
        </div>

        {failed && rect && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute rounded-full"
            style={{
              left: rect.x,
              top: rect.y,
              width: rect.d,
              height: rect.d,
              backgroundImage: `radial-gradient(circle at 35% 30%, ${css(fallback.light)}, ${css(fallback.mid)} 55%, ${css(fallback.deep)})`,
            }}
          />
        )}

        {rect && (
          <button
            type="button"
            aria-label={status.label}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerCancel}
            onLostPointerCapture={onPointerUp}
            onKeyDown={onKeyDown}
            onKeyUp={onKeyUp}
            onBlur={() => end(true)}
            onClick={onClick}
            onContextMenu={(e) => e.preventDefault()}
            className="absolute cursor-pointer touch-none rounded-full [-webkit-touch-callout:none] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-primary/15 focus-visible:ring-offset-2 focus-visible:ring-offset-fill"
            style={{ left: rect.x, top: rect.y, width: rect.d, height: rect.d }}
          />
        )}

        <span aria-live="polite" className="sr-only">
          {status.now}
        </span>

        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-4 bottom-5 flex flex-col items-center gap-0.5 text-center"
        >
          <span className="whitespace-nowrap text-body text-text-primary">
            <TextMorph duration={200} ease="cubic-bezier(0.4, 0, 0.2, 1)">
              {status.now}
            </TextMorph>
          </span>
          <span className="whitespace-nowrap text-meta text-text-muted">
            <TextMorph duration={200} ease="cubic-bezier(0.4, 0, 0.2, 1)">
              {status.next}
            </TextMorph>
          </span>
        </div>

        <div className="absolute top-3 right-3">
          <Tooltip label={soundLabel}>
            <button
              type="button"
              aria-label={soundLabel}
              aria-pressed={loud}
              onClick={toggleSound}
              className={cn(
                "inline-flex size-7 cursor-pointer items-center justify-center rounded-full bg-fill-hover text-text-secondary transition-colors duration-200",
                // one step up from the site's order, since it sits on a `fill`
                // ground where the lab's own `Pill` would be invisible
                "hover:bg-fill-active hover:text-text-primary active:bg-stroke-strong active:duration-0",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-primary/15 focus-visible:ring-offset-2 focus-visible:ring-offset-fill",
              )}
            >
              {loud ? (
                <SpeakerHighIcon
                  aria-hidden="true"
                  className="size-3.5 shrink-0"
                />
              ) : (
                <SpeakerSlashIcon
                  aria-hidden="true"
                  className="size-3.5 shrink-0"
                />
              )}
            </button>
          </Tooltip>
        </div>

        {/* the stage's own hairline, over the canvas */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 rounded-lg ring-1 ring-stroke ring-inset"
        />
      </div>
    </TooltipProvider>
  );
}
