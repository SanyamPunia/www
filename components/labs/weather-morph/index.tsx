"use client";

import { animate, useReducedMotion } from "motion/react";
import { useLayoutEffect, useRef, useState } from "react";
import {
  BEAT,
  duration,
  type Live,
  plan,
  sample,
  type Track,
  toPath,
} from "./morph";
import { SCENES, type Scene } from "./scenes";

/*
 * Enough paths for the largest icon. A morph never has more tracks than the
 * larger of the two icons it runs between, and a press mid-morph starts from
 * what is on screen, which is the same count again.
 */
const POOL = 12;

// how far the icon breathes in through the middle of a morph. It used to blur
// as well, and a filter re-rasterises the whole drawing on every frame, which
// was most of why the morph felt laggy
const DIP = 0.04;

const whole = (scene: Scene): Live[] => [
  { ...scene.body, op: 1, body: true },
  ...scene.satellites.map((p) => ({ ...p, op: 1, body: false })),
];

export default function WeatherMorph() {
  const [index, setIndex] = useState(0);
  const reduce = useReducedMotion();

  const group = useRef<SVGGElement>(null);
  const paths = useRef<(SVGPathElement | null)[]>([]);
  const live = useRef<Live[]>(whole(SCENES[0]));
  const scale = useRef(1);
  const run = useRef<{ stop: () => void } | null>(null);
  // the morph in flight, so a press can read where its points are heading
  const flight = useRef<{ tracks: Track[]; clock: number } | null>(null);

  const paint = (parts: readonly Live[], s: number) => {
    scale.current = s;
    group.current?.setAttribute(
      "transform",
      `translate(60 60) scale(${s.toFixed(4)}) translate(-60 -60)`,
    );
    for (let i = 0; i < POOL; i++) {
      const el = paths.current[i];
      if (!el) continue;
      const part = parts[i];
      if (!part || part.op < 0.002) {
        el.setAttribute("d", "");
        continue;
      }
      el.setAttribute("d", toPath(part.pts));
      el.style.fill = part.color;
      el.style.opacity = part.op.toFixed(3);
    }
  };

  // paints the first icon once, before the first frame is shown
  // biome-ignore lint/correctness/useExhaustiveDependencies: mount only
  useLayoutEffect(() => {
    paint(live.current, 1);
    return () => run.current?.stop();
  }, []);

  const next = () => {
    const to = (index + 1) % SCENES.length;
    setIndex(to);
    const target = SCENES[to];
    run.current?.stop();

    if (reduce) {
      flight.current = null;
      live.current = whole(target);
      paint(live.current, 1);
      return;
    }

    // a press mid-morph starts from the shapes as they are this frame, so
    // nothing jumps back to the icon it was leaving, and with how fast each
    // point is moving, so it curves into the new target rather than turning
    // on the spot
    const caught = flight.current;
    if (caught) {
      const h = 1 / 240;
      const now = sample(caught.tracks, caught.clock);
      const before = sample(caught.tracks, Math.max(0, caught.clock - h));
      live.current = now.map((p, i) => ({
        ...p,
        vel: p.pts.map((v, j) => (v - before[i].pts[j]) / h),
      }));
    }
    const from = live.current.filter((p) => p.op > 0.01);
    const startScale = scale.current;
    const tracks: Track[] = plan(from, SCENES[index].spin, target);
    const total = duration(tracks);
    flight.current = { tracks, clock: 0 };

    run.current = animate(0, total, {
      duration: total,
      ease: "linear",
      onUpdate: (clock) => {
        const beat = Math.min(1, clock / BEAT);
        const wave = Math.sin(Math.PI * beat);
        flight.current = { tracks, clock };
        const parts = sample(tracks, clock);
        live.current = parts;
        paint(parts, startScale + (1 - startScale) * beat - DIP * wave);
      },
      onComplete: () => {
        flight.current = null;
        live.current = whole(target);
        paint(live.current, 1);
      },
    });
  };

  const scene = SCENES[index];
  const upcoming = SCENES[(index + 1) % SCENES.length];

  return (
    <div className="@container flex aspect-8/5 min-h-72 w-full select-none flex-col items-center justify-center">
      <button
        type="button"
        onClick={next}
        aria-label={`${scene.name}. Press to change to ${upcoming.name.toLowerCase()}`}
        /*
          The one press in the codebase besides `foil-card` that scales. The
          project's rule is written for targets small enough that 3% is a
          fraction of a pixel, and this is a 190px square, so 3% is 6px of
          edge and reads as the tile giving under the finger. The step in is
          quick and the step back is eased, so a fast click still dips.
        */
        className="cursor-pointer rounded-2xl p-4 transition-[background-color,scale] duration-200 ease-out hover:bg-fill active:scale-[0.97] active:bg-fill-hover active:duration-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-primary/15 focus-visible:ring-offset-2"
      >
        {/* sized off the stage, since the icon is the subject and no token
            scales with the column */}
        <svg
          viewBox="0 0 120 120"
          aria-hidden="true"
          focusable="false"
          className="block size-[clamp(7.5rem,30cqw,10rem)]"
        >
          <g ref={group}>
            {Array.from({ length: POOL }, (_, i) => (
              <path
                // a fixed pool, written to by index and never reordered
                // biome-ignore lint/suspicious/noArrayIndexKey: see above
                key={i}
                ref={(el) => {
                  paths.current[i] = el;
                }}
              />
            ))}
          </g>
        </svg>
      </button>

      <p className="sr-only" aria-live="polite">
        {scene.name}
      </p>
    </div>
  );
}
