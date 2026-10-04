"use client";

import { useReducedMotion } from "motion/react";
import {
  type CSSProperties,
  type KeyboardEvent,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { approach, lerp } from "@/lib/lerp";
import { cn } from "@/lib/utils";
import {
  ASPECT,
  blendFaces,
  drawFace,
  FACES,
  type Face,
  faceCss,
  START_ANGLE,
} from "./art";
import {
  type Lab,
  MARGIN,
  outline,
  type Point,
  paint,
  palette,
  SHADOW,
  segments,
  shadowAlpha,
  shadowBlur,
} from "./glow";

/*
 * A picture on a grey stage, casting a shadow in its own colours. Each side of
 * the shadow is the colour most of that side of the picture is. Turn the
 * picture by dragging it and the shadow's colours turn with it. Pick another
 * picture and the new colours travel round the edge from the dot that was
 * pressed.
 *
 * The picture is drawn to a canvas at whatever angle it has been turned to,
 * and sampled live: drawn again small and read back whenever it turns or
 * changes. Nothing renders while any of it moves. One frame loop draws the
 * picture, samples it, eases the shadow and paints it, and stops when the
 * stage is off screen.
 */

const SEGS = segments(ASPECT);

/** sampling size: plenty for a majority vote, and 29k pixels a read */
const SAMPLE_W = 214;
const SAMPLE_H = Math.round(SAMPLE_W / ASPECT);

/**
 * How fast things follow a change, as time constants in seconds. Colour is
 * quick, so a turning picture's shadow keeps up with the hand. The first
 * fade-in is slower since it is the shadow arriving rather than changing, and
 * the picture's own crossfade sits between.
 */
const TAU = { color: 0.12, strength: 0.5, lift: 0.16, picture: 0.14 };

/**
 * How long new colours take to travel round to the far side of the picture,
 * in seconds. Each segment starts easing to its new colour after a share of
 * this, by how far round the edge it is from the dot that was pressed.
 */
const SWEEP = 0.6;

/**
 * A turned picture coasts after the hand lets go, slowing on this time
 * constant, so a flick keeps turning and comes to rest. A key press turns it
 * by `KEY_STEP` degrees through the same coast.
 */
const COAST = 0.35;
const KEY_STEP = 15;

/** fractal noise, one 140px tile, `document-pocket`'s grain at a finer grit */
const GRAIN = `url("data:image/svg+xml,%3Csvg viewBox='0 0 140 140' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='g'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23g)'/%3E%3C/svg%3E")`;

/** how far a hovered picture rises, as a share of its height */
const RISE = 0.025;

/**
 * The tilt, after `foil-card`: the picture tips toward the pointer, so the
 * edge under it goes back and the far edge comes forward. `deg` is the most
 * either axis turns, and the spring is that lab's own at a 0.69 damping ratio,
 * whose 5% of overshoot is what says the thing being tipped has weight.
 */
const TILT = { deg: 8, perspective: 900, stiffness: 210, damping: 20 };

const faceOf = (slug: string): Face =>
  FACES.find((f) => f.slug === slug) ?? FACES[0];

/** a face change waiting for the loop, with where its sweep starts */
interface Change {
  face: Face;
  origin: number;
}

export default function AmbientCard() {
  const reduce = useReducedMotion();
  const [face, setFace] = useState(FACES[0].slug);

  const stage = useRef<HTMLDivElement>(null);
  const holder = useRef<HTMLDivElement>(null);
  const card = useRef<HTMLDivElement>(null);
  const picture = useRef<HTMLCanvasElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);

  /*
   * Everything the loop reads lives in refs, so a face change, a turn, a hover
   * or a resize is a ref write and a kick, and none of them waits on a render.
   */
  const pending = useRef<Change | null>(null);
  const resample = useRef(true);
  const lifted = useRef(false);
  /* where the pointer is over the picture, -1 to 1 on each axis */
  const aim = useRef({ x: 0, y: 0 });
  /* the picture's angle in degrees, and how fast it is turning */
  const turn = useRef({ deg: START_ANGLE, vel: 0, held: false });
  const visible = useRef(true);
  const reduceRef = useRef(false);
  const kick = useRef<() => void>(() => {});

  reduceRef.current = reduce === true;

  useEffect(() => {
    const ctx = canvas.current?.getContext("2d");
    const pic = picture.current?.getContext("2d");
    const sampler = document.createElement("canvas");
    sampler.width = SAMPLE_W;
    sampler.height = SAMPLE_H;
    const sample = sampler.getContext("2d", { willReadFrequently: true });
    if (!ctx || !pic || !sample) return;

    let raf = 0;
    let last = 0;
    let t = 0;
    let shape: Point[] = [];
    let size = { width: 0, height: 0 };
    let picDirty = true;
    let drawnDeg = Number.NaN;

    /* the picture on screen, and the one it is fading from */
    let shown: Face = FACES[0];
    let leaving: Face | null = null;
    let mix = 1;

    /* the shadow: what the picture says now, what each segment aims at, what it shows */
    let want: Lab[] | null = null;
    let aimAt: Lab[] | null = null;
    let have: Lab[] | null = null;
    let strength = 0;
    let lift = 0;
    let sweep: { start: number; delays: number[]; prev: Lab[] } | null = null;
    const tilt = { x: 0, y: 0, vx: 0, vy: 0 };

    const tick = (now: number) => {
      const dt = last ? Math.min((now - last) / 1000, 0.05) : 0;
      last = now;
      t += dt;

      const still = reduceRef.current;
      const step = (tau: number) => (still ? 1 : approach(tau, dt));
      let moving = false;
      const spin = turn.current;

      /* a face change: the picture crossfades and the colours sweep */
      const change = pending.current;
      if (change) {
        pending.current = null;
        if (change.face !== shown) {
          leaving = shown;
          shown = change.face;
          mix = 0;
          resample.current = true;
          if (aimAt) {
            const n = SEGS.length;
            sweep = {
              start: t,
              prev: aimAt.slice(),
              delays: SEGS.map((_, i) => {
                const d = Math.abs(i - change.origin);
                return (Math.min(d, n - d) / (n / 2)) * SWEEP;
              }),
            };
          }
        }
      }

      /* the coast after a flick, and the turn a key asked for */
      if (!spin.held && Math.abs(spin.vel) > 0.5) {
        if (still) {
          spin.deg += spin.vel * COAST;
          spin.vel = 0;
        } else {
          spin.deg += spin.vel * dt;
          spin.vel *= Math.exp(-dt / COAST);
        }
        moving = true;
      } else if (!spin.held) {
        spin.vel = 0;
      }

      if (spin.deg !== drawnDeg) {
        picDirty = true;
        resample.current = true;
      }

      mix = lerp(mix, 1, step(TAU.picture));
      if (mix > 0.999) {
        mix = 1;
        if (leaving) picDirty = true;
        leaving = null;
      } else {
        moving = true;
        picDirty = true;
      }

      const { width, height } = size;
      if (picDirty && width > 0) {
        pic.clearRect(0, 0, width, height);
        drawFace(
          pic,
          leaving ? blendFaces(leaving, shown, mix) : shown,
          width,
          height,
          spin.deg,
        );
        drawnDeg = spin.deg;
        picDirty = false;
        holder.current?.setAttribute(
          "aria-valuenow",
          `${Math.round((((spin.deg - START_ANGLE) % 360) + 360) % 360)}`,
        );
      }

      /* sample the picture as it is now, the face it is changing to */
      if (resample.current) {
        resample.current = false;
        sample.clearRect(0, 0, SAMPLE_W, SAMPLE_H);
        drawFace(sample, shown, SAMPLE_W, SAMPLE_H, spin.deg);
        const { data } = sample.getImageData(0, 0, SAMPLE_W, SAMPLE_H);
        want = palette(data, SAMPLE_W, SAMPLE_H, SEGS);
        if (!have) have = want.slice();
        if (!aimAt) aimAt = want.slice();
      }

      if (want && aimAt && have) {
        /* during a sweep a segment keeps its old aim until its delay has passed */
        for (let i = 0; i < aimAt.length; i++) {
          aimAt[i] =
            sweep && t < sweep.start + sweep.delays[i] && !still
              ? sweep.prev[i]
              : want[i];
        }
        if (sweep && (still || t > sweep.start + SWEEP)) sweep = null;
        if (sweep) moving = true;

        const k = step(TAU.color);
        for (let i = 0; i < have.length; i++) {
          const a = have[i];
          const b = aimAt[i];
          const next: Lab = [
            lerp(a[0], b[0], k),
            lerp(a[1], b[1], k),
            lerp(a[2], b[2], k),
          ];
          if (Math.abs(next[0] - b[0]) + Math.abs(next[1] - b[1]) > 1e-4) {
            moving = true;
          }
          have[i] = next;
        }
      }

      const ready = want ? 1 : 0;
      strength = lerp(strength, ready, step(TAU.strength));
      if (Math.abs(strength - ready) > 1e-3) moving = true;
      else strength = ready;

      const up = lifted.current && !still ? 1 : 0;
      lift = lerp(lift, up, step(TAU.lift));
      if (Math.abs(lift - up) > 1e-3) moving = true;
      else lift = up;

      /* semi-implicit Euler on each axis, which is stable at any frame rate here */
      if (still) {
        tilt.x = aim.current.x;
        tilt.y = aim.current.y;
        tilt.vx = 0;
        tilt.vy = 0;
      } else {
        tilt.vx +=
          (TILT.stiffness * (aim.current.x - tilt.x) - TILT.damping * tilt.vx) *
          dt;
        tilt.vy +=
          (TILT.stiffness * (aim.current.y - tilt.y) - TILT.damping * tilt.vy) *
          dt;
        tilt.x += tilt.vx * dt;
        tilt.y += tilt.vy * dt;
        if (
          Math.abs(tilt.vx) + Math.abs(tilt.vy) > 1e-3 ||
          Math.abs(aim.current.x - tilt.x) + Math.abs(aim.current.y - tilt.y) >
            1e-3
        ) {
          moving = true;
        }
      }

      const pad = height * MARGIN;
      if (card.current) {
        card.current.style.transform = `perspective(${TILT.perspective}px) rotateX(${-tilt.y * TILT.deg}deg) rotateY(${tilt.x * TILT.deg}deg) translateY(${-lift * RISE * height}px)`;
      }

      ctx.clearRect(0, 0, width + pad * 2, height + pad * 2);
      if (canvas.current) {
        canvas.current.style.opacity = `${shadowAlpha(lift) * strength}`;
        canvas.current.style.filter = `blur(${shadowBlur(height, lift)}px)`;
      }
      if (have && width > 0) {
        paint(
          ctx,
          shape,
          have,
          { x: pad, y: pad, width, height },
          {
            t,
            wave: still ? 0 : 1,
            lift,
            shiftX: -tilt.x * SHADOW.shift * height,
            shiftY: -tilt.y * SHADOW.shift * height,
          },
        );
      }

      /*
       * The wave never settles, so with motion allowed the loop runs for as
       * long as the stage is on screen. Under reduced motion there is no wave,
       * so it paints the frames it was kicked for and stops.
       */
      raf =
        visible.current && (moving || !still || spin.held)
          ? requestAnimationFrame(tick)
          : 0;
    };

    kick.current = () => {
      if (raf) return;
      last = 0;
      raf = requestAnimationFrame(tick);
    };

    /*
     * Both canvases are measured off the holder. The picture is the holder's
     * own size and the shadow is that plus a margin on every side.
     */
    const resize = () => {
      const el = holder.current;
      const c = canvas.current;
      const p = picture.current;
      if (!el || !c || !p) return;
      const width = el.offsetWidth;
      const height = width / ASPECT;
      size = { width, height };
      const dpr = Math.min(window.devicePixelRatio || 1, 2);

      p.width = Math.round(width * dpr);
      p.height = Math.round(height * dpr);
      pic.setTransform(dpr, 0, 0, dpr, 0, 0);
      picDirty = true;

      const pad = height * MARGIN;
      const cw = width + pad * 2;
      const ch = height + pad * 2;
      c.width = Math.round(cw * dpr);
      c.height = Math.round(ch * dpr);
      c.style.width = `${cw}px`;
      c.style.height = `${ch}px`;
      c.style.left = `${-pad}px`;
      c.style.top = `${-pad}px`;
      /* the picture's corner, `var(--card) * 0.05`, so the shadow follows it */
      shape = outline(width, height, width * 0.05, SEGS);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      kick.current();
    };

    /*
     * The pointer is heard on the holder, which never moves, and measured
     * against its box. The picture inside it is `pointer-events-none`, since a
     * tilted picture pulls the edge under the pointer inward, and a hit test
     * against the moving box drops the hover and levels the picture under a
     * pointer that never left, which is the loop `foil-card` documents.
     *
     * Hover tilts and lifts, for a mouse or a pen only, `folder-stack`'s gate.
     * A press of any kind turns the picture: the angle follows the pointer's
     * bearing round the picture's middle, so dragging round it is turning a
     * dial, and letting go coasts.
     */
    const node = holder.current;
    let bearing = 0;
    let lastMove = 0;
    const angleAt = (event: PointerEvent) => {
      const box = (node as HTMLDivElement).getBoundingClientRect();
      return (
        (Math.atan2(
          event.clientY - (box.top + box.height / 2),
          event.clientX - (box.left + box.width / 2),
        ) *
          180) /
        Math.PI
      );
    };
    const move = (event: PointerEvent) => {
      if (!node) return;
      const spin = turn.current;
      if (spin.held) {
        const a = angleAt(event);
        let d = a - bearing;
        if (d > 180) d -= 360;
        if (d < -180) d += 360;
        bearing = a;
        const now = event.timeStamp;
        const gap = Math.max((now - lastMove) / 1000, 1 / 240);
        lastMove = now;
        spin.deg += d;
        /* smoothed, so the last jittery sample before a release does not decide the throw */
        spin.vel = spin.vel * 0.6 + (d / gap) * 0.4;
      }
      if (event.pointerType === "mouse" || event.pointerType === "pen") {
        const box = node.getBoundingClientRect();
        const x = ((event.clientX - box.left) / box.width) * 2 - 1;
        const y = ((event.clientY - box.top) / box.height) * 2 - 1;
        aim.current = {
          x: Math.max(-1, Math.min(1, x)),
          y: Math.max(-1, Math.min(1, y)),
        };
        lifted.current = true;
      }
      kick.current();
    };
    const down = (event: PointerEvent) => {
      if (!node || event.button !== 0) return;
      node.setPointerCapture(event.pointerId);
      const spin = turn.current;
      spin.held = true;
      spin.vel = 0;
      bearing = angleAt(event);
      lastMove = event.timeStamp;
      stage.current?.setAttribute("data-carry", "true");
      kick.current();
    };
    const up = (event: PointerEvent) => {
      const spin = turn.current;
      if (!spin.held) return;
      spin.held = false;
      /* a hand that stopped before letting go throws nothing */
      if (event.timeStamp - lastMove > 60) spin.vel = 0;
      stage.current?.setAttribute("data-carry", "false");
      kick.current();
    };
    const leave = (event: PointerEvent) => {
      if (turn.current.held) return;
      if (event.pointerType !== "mouse" && event.pointerType !== "pen") return;
      aim.current = { x: 0, y: 0 };
      lifted.current = false;
      kick.current();
    };
    node?.addEventListener("pointerdown", down);
    node?.addEventListener("pointermove", move);
    node?.addEventListener("pointerup", up);
    node?.addEventListener("pointercancel", up);
    node?.addEventListener("pointerleave", leave);

    const observer = new ResizeObserver(resize);
    if (node) observer.observe(node);

    const seen = new IntersectionObserver(([entry]) => {
      visible.current = entry.isIntersecting;
      if (entry.isIntersecting) kick.current();
    });
    if (stage.current) seen.observe(stage.current);

    return () => {
      cancelAnimationFrame(raf);
      raf = 0;
      observer.disconnect();
      seen.disconnect();
      node?.removeEventListener("pointerdown", down);
      node?.removeEventListener("pointermove", move);
      node?.removeEventListener("pointerup", up);
      node?.removeEventListener("pointercancel", up);
      node?.removeEventListener("pointerleave", leave);
    };
  }, []);

  /* reduced motion changes what the loop does, so it needs one more frame */
  useEffect(() => {
    if (reduce !== null) kick.current();
  }, [reduce]);

  /*
   * A pick starts its sweep at the bottom edge segment nearest the dot that was
   * pressed, since the dots sit under the picture.
   */
  const pick = (slug: string, from: HTMLElement) => {
    const box = holder.current?.getBoundingClientRect();
    const dot = from.getBoundingClientRect();
    const fx = box ? (dot.left + dot.width / 2 - box.left) / box.width : 0.5;
    let origin = 0;
    let best = Number.POSITIVE_INFINITY;
    SEGS.forEach((seg, i) => {
      const d = Math.hypot(seg.x - fx, (seg.y - 1) * 2);
      if (d < best) {
        best = d;
        origin = i;
      }
    });
    pending.current = { face: faceOf(slug), origin };
    setFace(slug);
    kick.current();
  };

  const nudge = (event: KeyboardEvent<HTMLDivElement>) => {
    const dir =
      event.key === "ArrowRight" || event.key === "ArrowUp"
        ? 1
        : event.key === "ArrowLeft" || event.key === "ArrowDown"
          ? -1
          : 0;
    if (!dir) return;
    event.preventDefault();
    /* a coast covers its velocity times its time constant, so this lands one step on */
    turn.current.vel += (dir * KEY_STEP) / COAST;
    kick.current();
  };

  const name = faceOf(face).name;

  return (
    <div
      ref={stage}
      className="@container relative flex w-full select-none flex-col items-center gap-20 overflow-hidden rounded-lg bg-fill px-8 py-24 ring-1 ring-stroke ring-inset data-[carry=true]:cursor-grabbing data-[carry=true]:[&_*]:cursor-grabbing"
      style={{ "--card": "min(72cqw, 20rem)" } as CSSProperties}
    >
      {/*
       * The holder is the slider: it never moves, it hears the pointer, and it
       * takes focus, so the arrow keys turn the picture too. `touch-none` traps
       * a thumb that lands on the picture, which is the price of turning it
       * with a finger, and only on the picture.
       */}
      <div
        ref={holder}
        role="slider"
        tabIndex={0}
        aria-label="Turn the picture"
        aria-valuemin={0}
        aria-valuemax={359}
        aria-valuenow={0}
        onKeyDown={nudge}
        className="relative flex cursor-grab touch-none flex-col focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-primary/15 focus-visible:ring-offset-2 focus-visible:ring-offset-fill"
        style={{
          width: "var(--card)",
          borderRadius: "calc(var(--card) * 0.05)",
        }}
      >
        <canvas ref={canvas} className="pointer-events-none absolute" />

        <div
          ref={card}
          role="img"
          aria-label={`The ${name.toLowerCase()} picture`}
          className="pointer-events-none relative w-full overflow-hidden"
          style={{
            aspectRatio: `${ASPECT}`,
            borderRadius: "calc(var(--card) * 0.05)",
            /*
             * A neutral contact shadow seats the picture on the page. The
             * coloured shadow is the ambient light round it and sits much
             * further out, so the two do not compete.
             */
            boxShadow:
              "0 1px 1px rgba(0,0,0,0.08), 0 4px 10px -4px rgba(0,0,0,0.18)",
          }}
        >
          <canvas ref={picture} className="absolute inset-0 size-full" />

          {/*
           * The grain is what makes the picture matte. A flat gradient on a
           * screen reads as glossy plastic, and noise over it reads as a
           * printed, uncoated surface. `overlay` does most to the mid tones
           * and leaves the darkest and lightest ends alone, so the grain sits
           * in the colour rather than greying it.
           */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 opacity-45 mix-blend-overlay"
            style={{ backgroundImage: GRAIN, backgroundSize: "140px" }}
          />
          {/* an inset hairline, which a picture with a pale edge needs on grey */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 rounded-[inherit] ring-1 ring-text-primary/10 ring-inset"
          />
        </div>
      </div>

      <FaceStrip value={face} onChange={pick} />
    </div>
  );
}

/**
 * The pictures, as dots of the pictures: real radios visually hidden inside
 * their labels, which is `pixel-reveal`'s strip. The arrow keys walk the
 * group and the checked state is the browser's.
 */
function FaceStrip({
  value,
  onChange,
}: {
  value: string;
  onChange: (slug: string, from: HTMLElement) => void;
}) {
  const group = useId();

  return (
    <fieldset className="flex items-center gap-3">
      <legend className="sr-only">Picture</legend>
      {FACES.map((f) => {
        const picked = f.slug === value;
        return (
          <label
            key={f.slug}
            className={cn(
              "relative size-6 shrink-0 cursor-pointer overflow-hidden rounded-full ring-offset-2 ring-offset-fill transition-all duration-200",
              picked
                ? "ring-2 ring-stroke-strong"
                : "ring-1 ring-stroke hover:ring-stroke-strong",
              "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-text-primary/15 has-[:focus-visible]:outline-offset-4",
            )}
            style={{ backgroundImage: faceCss(f) }}
          >
            <input
              type="radio"
              name={group}
              value={f.slug}
              checked={picked}
              onChange={(event) =>
                onChange(
                  f.slug,
                  event.currentTarget.closest("label") ?? event.currentTarget,
                )
              }
              className="sr-only"
            />
            <span className="sr-only">{f.name}</span>
          </label>
        );
      })}
    </fieldset>
  );
}
