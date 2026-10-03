"use client";

import {
  animate,
  type MotionValue,
  motion,
  motionValue,
  type Transition,
  useReducedMotion,
  useTransform,
} from "motion/react";
import { useCallback, useId, useLayoutEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { FACETS, type Facet, GRAIN } from "./art";
import { assign, type Bento, bento, type Rect, travel } from "./layout";

/*
 * Five pictures on a bento grid with one large focus slot. Press a small tile
 * and it grows into the slot, the tile that had it shrinks back into the grid,
 * and the rest re-settle into the small slots, the farther they have to go
 * the later they set off. The focused tile's title and copy rise in as it
 * lands. Press again mid-flight and every tile turns toward its new slot from
 * where it is.
 *
 * Every tile is always mounted and only ever moved. Its box is four motion
 * values, `x`, `y`, `width` and `height`, animated rather than scaled, so the
 * corner radius is right on every frame, the gradients repaint at the new size
 * rather than stretching, and nothing renders while the grid moves.
 */

const COUNT = FACETS.length;

/**
 * One spring carries every tile. A press mid-flight starts the new animation
 * from the value and the velocity the old one had reached, so the grid changes
 * course instead of stopping and setting off again, which is what an ease
 * restarted from rest does.
 */
const MOVE: Transition = { type: "spring", visualDuration: 0.42, bounce: 0.1 };

/** the longest any tile waits, in seconds, given to the one that goes farthest */
const SPREAD = 0.07;

/** when the focused tile is close enough to its slot for its text to rise */
const LAND = 0.2;
/** when the tile that lost the slot has shrunk enough to take its label back */
const RETURN = 0.3;

/** text leaving goes up and out of its mask on an in-out curve */
const EXIT: Transition = { duration: 0.24, ease: [0.7, 0, 0.16, 1] };
/** text arriving rises into its mask on a strong ease-out */
const RISE: Transition = { duration: 0.55, ease: [0.3, 0.9, 0.1, 1] };

/** a label or a line of text, as a share of its own height, out of its mask */
const BELOW = 110;
const ABOVE = -110;

const FOCUS =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-primary/15 focus-visible:ring-offset-2 focus-visible:ring-offset-fill";

interface Values {
  x: MotionValue<number>;
  y: MotionValue<number>;
  w: MotionValue<number>;
  h: MotionValue<number>;
  z: MotionValue<number>;
  label: MotionValue<number>;
  title: MotionValue<number>;
  copy: MotionValue<number>;
}

const make = (): Values => ({
  x: motionValue(0),
  y: motionValue(0),
  w: motionValue(0),
  h: motionValue(0),
  z: motionValue(1),
  label: motionValue(0),
  title: motionValue(BELOW),
  copy: motionValue(BELOW),
});

const rectOf = (v: Values): Rect => ({
  x: v.x.get(),
  y: v.y.get(),
  w: v.w.get(),
  h: v.h.get(),
});

export default function BentoFocus() {
  const reduce = useReducedMotion() ?? false;
  const id = useId();
  const stageRef = useRef<HTMLDivElement>(null);
  const values = useRef<Values[]>(Array.from({ length: COUNT }, make)).current;

  const [focus, setFocus] = useState(0);
  const [grid, setGrid] = useState<Bento | null>(null);

  // the logical state the text is heading for, which a value mid-animation
  // cannot say on its own
  const focusRef = useRef(0);
  const gridRef = useRef<Bento | null>(null);
  const labelShown = useRef(FACETS.map((_, i) => i !== 0));
  const detailShown = useRef(FACETS.map((_, i) => i === 0));

  /** put every tile in its slot with no travel: first paint and a resize */
  const settle = useCallback(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const { width, height } = stage.getBoundingClientRect();
    if (width === 0 || height === 0) return;
    const next = bento(width, height);
    const seats = assign(COUNT, focusRef.current);
    values.forEach((v, i) => {
      const to = next.slots[seats[i]];
      v.x.jump(to.x);
      v.y.jump(to.y);
      v.w.jump(to.w);
      v.h.jump(to.h);
    });
    gridRef.current = next;
    setGrid(next);
  }, [values]);

  useLayoutEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    values.forEach((v, i) => {
      v.label.jump(i === 0 ? BELOW : 0);
      v.title.jump(i === 0 ? 0 : BELOW);
      v.copy.jump(i === 0 ? 0 : BELOW);
      v.z.jump(1);
    });
    settle();
    // a corrected measurement is set, not animated, `gooey-chips`'s rule
    const observer = new ResizeObserver(settle);
    observer.observe(stage);
    return () => observer.disconnect();
  }, [settle, values]);

  const select = useCallback(
    (next: number) => {
      const prev = focusRef.current;
      const layout = gridRef.current;
      if (next === prev || !layout) return;
      focusRef.current = next;
      setFocus(next);

      const seats = assign(COUNT, next);
      const targets = values.map((_, i) => layout.slots[seats[i]]);
      const moves = values.map((v, i) => travel(rectOf(v), targets[i]));
      const far = Math.max(1, ...moves.filter((_, i) => i !== next));

      const run = (
        mv: MotionValue<number>,
        to: number | number[],
        t: Transition,
      ) => {
        if (reduce) {
          mv.jump(Array.isArray(to) ? to[to.length - 1] : to);
          return;
        }
        animate(mv, to, t);
      };

      values.forEach((v, i) => {
        // the tile coming in paints over everything, the one going out over
        // the rest, so the two that cross the grid are never under a third
        v.z.set(i === next ? 3 : i === prev ? 2 : 1);

        // the pressed tile answers at once. A tile already in flight keeps
        // moving, since a delay would hold it still in mid-air first
        const moving = v.x.isAnimating() || v.w.isAnimating();
        const delay = i === next || moving ? 0 : (moves[i] / far) * SPREAD;
        const to = targets[i];
        const t: Transition = { ...MOVE, delay };
        run(v.x, to.x, t);
        run(v.y, to.y, t);
        run(v.w, to.w, t);
        run(v.h, to.h, t);

        const wantLabel = i !== next;
        if (labelShown.current[i] !== wantLabel) {
          labelShown.current[i] = wantLabel;
          if (wantLabel) {
            run(v.label, [BELOW, 0], {
              ...RISE,
              delay: i === prev ? RETURN : 0,
            });
          } else {
            run(v.label, ABOVE, EXIT);
          }
        }

        const wantDetail = i === next;
        if (detailShown.current[i] !== wantDetail) {
          detailShown.current[i] = wantDetail;
          if (wantDetail) {
            run(v.title, [BELOW, 0], { ...RISE, duration: 0.6, delay: LAND });
            run(v.copy, [BELOW, 0], { ...RISE, delay: LAND + 0.06 });
          } else {
            run(v.title, ABOVE, EXIT);
            run(v.copy, ABOVE, { ...EXIT, delay: 0.025 });
          }
        }
      });
    },
    [reduce, values],
  );

  return (
    <div
      ref={stageRef}
      className="@container relative aspect-8/5 min-h-78 w-full select-none overflow-hidden rounded-lg bg-fill ring-1 ring-stroke ring-inset"
    >
      {grid ? (
        <fieldset className="contents" aria-label="Five sports, one in focus">
          {FACETS.map((facet, i) => (
            <Tile
              key={facet.id}
              facet={facet}
              values={values[i]}
              focused={focus === i}
              grid={grid}
              copyId={`${id}-copy-${i}`}
              onSelect={() => select(i)}
            />
          ))}
        </fieldset>
      ) : null}
      <p className="sr-only" aria-live="polite">
        {FACETS[focus].title} in focus
      </p>
    </div>
  );
}

function Tile({
  facet,
  values,
  focused,
  grid,
  copyId,
  onSelect,
}: {
  facet: Facet;
  values: Values;
  focused: boolean;
  grid: Bento;
  copyId: string;
  onSelect: () => void;
}) {
  const labelY = useTransform(values.label, (v) => `${v}%`);
  const titleY = useTransform(values.title, (v) => `${v}%`);
  const copyY = useTransform(values.copy, (v) => `${v}%`);
  const { inset, radius, slots } = grid;

  return (
    <motion.button
      type="button"
      aria-pressed={focused}
      aria-label={facet.title}
      aria-describedby={focused ? copyId : undefined}
      onClick={onSelect}
      className={cn(
        "group absolute top-0 left-0 overflow-hidden bg-fill-active text-left",
        focused ? "cursor-default" : "cursor-pointer",
        FOCUS,
      )}
      style={{
        x: values.x,
        y: values.y,
        width: values.w,
        height: values.h,
        zIndex: values.z,
        borderRadius: radius,
      }}
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{ background: facet.ground }}
      >
        {/* larger than the tile so its edge never shows while it drifts */}
        <span
          className="absolute -inset-1/4 motion-safe:animate-[bento-drift_18s_ease-in-out_infinite_alternate]"
          style={{
            background: facet.mesh,
            animationDuration: `${facet.drift}s`,
            animationDelay: `-${facet.drift / 2}s`,
          }}
        />
        <span
          className="absolute inset-0"
          style={{ background: facet.motif }}
        />
        <span
          className="absolute inset-0 opacity-40 mix-blend-overlay"
          style={{ backgroundImage: GRAIN, backgroundSize: "160px 160px" }}
        />
      </span>
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 h-3/5 bg-linear-to-t from-black/55 to-transparent"
      />
      <span
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute inset-0 bg-black opacity-0 transition-opacity duration-200",
          !focused &&
            "group-hover:opacity-10 group-active:opacity-20 group-active:duration-0",
        )}
      />

      {/* type here is printing on a picture, so it is sized as a share of the
          stage rather than from the type scale, `foil-card`'s standing */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute block overflow-hidden"
        style={{ left: inset, bottom: inset }}
      >
        <motion.span
          className="block whitespace-nowrap text-[clamp(0.625rem,2.1cqw,0.75rem)] text-inverse-text leading-[1.35]"
          style={{ y: labelY }}
        >
          {facet.title}
        </motion.span>
      </span>

      {/* laid out at the focus slot's width whatever size the tile is, so it
          never reflows while the box grows round it, and the tile's own clip
          hides it while the tile is small */}
      <span
        aria-hidden={!focused}
        className="pointer-events-none absolute flex flex-col gap-[0.6em]"
        style={{ left: inset, bottom: inset, width: slots[0].w - inset * 2 }}
      >
        <span className="block overflow-hidden">
          <motion.span
            className="block text-[clamp(1.25rem,5.6cqw,2.25rem)] text-inverse-text leading-[1.1] tracking-tight"
            style={{ y: titleY }}
          >
            {facet.title}
          </motion.span>
        </span>
        <span className="block overflow-hidden">
          <motion.span
            id={copyId}
            className="block text-[clamp(0.625rem,2.25cqw,0.8125rem)] text-inverse-text/85 leading-[1.45]"
            style={{ y: copyY }}
          >
            {facet.copy}
          </motion.span>
        </span>
      </span>
    </motion.button>
  );
}
