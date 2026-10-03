"use client";

import {
  ArrowsLeftRightIcon,
  CursorIcon,
  HandGrabbingIcon,
  HandIcon,
  HandPointingIcon,
} from "@phosphor-icons/react";
import {
  type MotionValue,
  motion,
  motionValue,
  useReducedMotion,
  useSpring,
} from "motion/react";
import { useEffect, useRef, useState } from "react";
import { TextMorph } from "torph/react";
import { cn } from "@/lib/utils";

/**
 * The post's three demos. `Broken` and `Fixed` are one board with one
 * difference, which is where the grabbing cursor comes from: two classes on the
 * chip, or a flag the gesture writes to `<html>`. `Inherit` is a stage frozen
 * mid-drag, for the one step between them.
 *
 * Every readout is `getComputedStyle(el).cursor` on the element under the
 * pointer, so it reports what CSS asks for rather than a guess. Headless
 * browsers paint no cursor, and this is the value the real one is drawn from.
 */

const CHIPS = ["Design", "Motion", "Type", "Colour", "Layout"];

/** Movement before a press counts as a drag, in px. A click never gets this far. */
const SLOP = 4;

/** How far a chip stays inside the stage's edge, in px. */
const INSET = 8;

/**
 * The chip trails the hand a little. Most draggables do, and it is one of the
 * ways the pointer ends up somewhere other than the chip it pressed.
 */
const FOLLOW = { stiffness: 520, damping: 42 };

/** The flag the fixed board writes. The rule that reads it is in `globals.css`. */
const FLAG = "dragging";

const STAGE =
  "relative flex h-48 w-full flex-wrap content-center items-center justify-center gap-2 rounded-md bg-fill p-6 ring-1 ring-stroke ring-inset";

const CHIP =
  "relative select-none rounded-full bg-bg px-3 py-1.5 text-action text-text-secondary ring-1 ring-stroke transition-colors duration-200";

/**
 * How a readout changes, through `torph`. 160ms rather than the site's usual
 * 200, since the cursor under a fast drag changes often and a morph still
 * running when the next one starts is a smear.
 */
const MORPH = {
  duration: 160,
  ease: "cubic-bezier(0.32, 0.72, 0, 1)",
} as const;

function cursorUnder(x: number, y: number): string {
  const el = document.elementFromPoint(x, y);
  return el ? getComputedStyle(el).cursor : "auto";
}

/**
 * A cursor value held in state, set only when it changes, so a drag renders
 * once per change of cursor and never once per frame.
 */
function useCursor() {
  const [cursor, setCursor] = useState("auto");
  const last = useRef("auto");
  const show = (next: string) => {
    if (next === last.current) return;
    last.current = next;
    setCursor(next);
  };
  return [cursor, show] as const;
}

/** The cursor CSS resolves to, an icon for it, and an optional tally. */
function Readout({
  cursor,
  tally,
  off = false,
}: {
  cursor: string;
  tally?: string;
  off?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4 text-meta text-text-muted">
      <div data-cursor={cursor} className="group flex items-center gap-1.5">
        <HandGrabbingIcon
          aria-hidden="true"
          className="hidden size-3.5 text-text-primary group-data-[cursor=grabbing]:block"
        />
        <HandIcon
          aria-hidden="true"
          className="hidden size-3.5 text-text-primary group-data-[cursor=grab]:block"
        />
        <HandPointingIcon
          aria-hidden="true"
          className="hidden size-3.5 text-text-primary group-data-[cursor=pointer]:block"
        />
        <CursorIcon
          aria-hidden="true"
          className="size-3.5 text-text-primary group-data-[cursor=grab]:hidden group-data-[cursor=grabbing]:hidden group-data-[cursor=pointer]:hidden"
        />
        <span>cursor:</span>
        <span className="whitespace-nowrap font-mono text-text-primary">
          <TextMorph duration={MORPH.duration} ease={MORPH.ease}>
            {cursor}
          </TextMorph>
        </span>
      </div>
      {tally && (
        <span
          className={cn(
            "whitespace-nowrap text-right transition-colors duration-200",
            off && "text-danger",
          )}
        >
          <TextMorph duration={MORPH.duration} ease={MORPH.ease}>
            {tally}
          </TextMorph>
        </span>
      )}
    </div>
  );
}

function Chip({
  label,
  x,
  y,
  fixed,
  pressed,
  onPress,
  onDown,
}: {
  label: string;
  x: MotionValue<number>;
  y: MotionValue<number>;
  fixed: boolean;
  pressed: boolean;
  onPress: () => void;
  onDown: (e: React.PointerEvent<HTMLButtonElement>) => void;
}) {
  const reduce = useReducedMotion();
  const sx = useSpring(x, FOLLOW);
  const sy = useSpring(y, FOLLOW);

  return (
    <motion.button
      type="button"
      aria-pressed={pressed}
      onPointerDown={onDown}
      onClick={onPress}
      style={{ x: reduce ? x : sx, y: reduce ? y : sy }}
      className={cn(
        CHIP,
        "touch-none hover:text-text-primary hover:ring-stroke-strong aria-pressed:bg-text-primary aria-pressed:text-bg aria-pressed:ring-text-primary data-[carry=true]:z-10",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-primary/15 focus-visible:ring-offset-2 focus-visible:ring-offset-fill",
        // The whole difference between the two boards.
        fixed ? "cursor-pointer" : "cursor-pointer active:cursor-grabbing",
      )}
    >
      {label}
    </motion.button>
  );
}

function Board({ fixed }: { fixed: boolean }) {
  const stage = useRef<HTMLDivElement>(null);
  const carrying = useRef(false);
  const dragged = useRef(false);
  const stop = useRef<() => void>(() => {});
  const [values] = useState(() =>
    CHIPS.map(() => ({ x: motionValue(0), y: motionValue(0) })),
  );
  const [picked, setPicked] = useState<readonly number[]>([1]);
  const [cursor, show] = useCursor();
  // The tally changes on every frame of a drag, so it only morphs at the two
  // ends of one: a morph per frame is a smear.
  const [tally, setTally] = useState({ text: "drag a chip", off: false });

  useEffect(() => () => stop.current(), []);

  const hover = (e: React.PointerEvent) => {
    if (!carrying.current) show(cursorUnder(e.clientX, e.clientY));
  };

  const down = (i: number) => (e: React.PointerEvent<HTMLButtonElement>) => {
    if (e.button !== 0 || !stage.current) return;
    stop.current();
    dragged.current = false;

    const node = e.currentTarget;
    const room = stage.current;
    const { x, y } = values[i];
    // Offsets are from the chip's place in the flow, which no transform moves.
    const bounds = {
      minX: INSET - node.offsetLeft,
      maxX: room.clientWidth - INSET - node.offsetLeft - node.offsetWidth,
      minY: INSET - node.offsetTop,
      maxY: room.clientHeight - INSET - node.offsetTop - node.offsetHeight,
    };
    const start = { x: e.clientX, y: e.clientY, ox: x.get(), oy: y.get() };
    const point = { x: e.clientX, y: e.clientY };
    let frames = 0;
    let off = 0;
    let raf = 0;

    const tick = () => {
      const under = cursorUnder(point.x, point.y);
      frames += 1;
      if (under !== "grabbing") off += 1;
      show(under);
      raf = requestAnimationFrame(tick);
    };

    const move = (ev: PointerEvent) => {
      if (ev.buttons === 0) return end();
      point.x = ev.clientX;
      point.y = ev.clientY;
      const dx = ev.clientX - start.x;
      const dy = ev.clientY - start.y;
      if (!carrying.current) {
        if (Math.hypot(dx, dy) < SLOP) return;
        carrying.current = true;
        dragged.current = true;
        node.dataset.carry = "true";
        if (fixed) document.documentElement.dataset[FLAG] = "true";
        setTally({ text: "counting frames", off: false });
        raf = requestAnimationFrame(tick);
      }
      x.set(Math.min(bounds.maxX, Math.max(bounds.minX, start.ox + dx)));
      y.set(Math.min(bounds.maxY, Math.max(bounds.minY, start.oy + dy)));
    };

    const end = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
      window.removeEventListener("blur", end);
      cancelAnimationFrame(raf);
      if (carrying.current) {
        setTally({
          text: `${off} of ${frames} frames off the hand`,
          off: off > 0,
        });
      }
      carrying.current = false;
      node.dataset.carry = "false";
      if (fixed) delete document.documentElement.dataset[FLAG];
      show(cursorUnder(point.x, point.y));
      stop.current = () => {};
    };

    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
    window.addEventListener("blur", end);
    stop.current = end;
  };

  // A drag ends in a click on the chip it started on, which is not a click.
  const press = (i: number) => () => {
    if (dragged.current) return;
    setPicked((p) => (p.includes(i) ? p.filter((n) => n !== i) : [...p, i]));
  };

  return (
    // `select-none` on the whole block: every gesture here is a drag across
    // type, and a drag that leaves a chip anchors a selection on the nearest
    // text, which is the readout.
    <div
      className="my-6 flex w-full select-none flex-col gap-3"
      onPointerMove={hover}
    >
      <div ref={stage} className={STAGE}>
        {CHIPS.map((name, i) => (
          <Chip
            key={name}
            label={name}
            x={values[i].x}
            y={values[i].y}
            fixed={fixed}
            pressed={picked.includes(i)}
            onPress={press(i)}
            onDown={down(i)}
          />
        ))}
      </div>
      <Readout cursor={cursor} tally={tally.text} off={tally.off} />
    </div>
  );
}

export function Broken() {
  return <Board fixed={false} />;
}

export function Fixed() {
  return <Board fixed />;
}

/**
 * A stage that is mid-drag for as long as the page is open: it carries
 * `cursor-grabbing` the whole time, and the one toggle adds the descendant
 * rule. The two chips are the two ways a child declares a cursor of its own: a
 * class, and the browser's stylesheet for `<button>`.
 */
export function Inherit() {
  const [deep, setDeep] = useState(false);
  const [cursor, show] = useCursor();

  return (
    <div className="my-6 flex w-full select-none flex-col gap-3">
      <div
        aria-hidden="true"
        onPointerMove={(e) => show(cursorUnder(e.clientX, e.clientY))}
        className={cn(
          STAGE,
          "cursor-grabbing",
          deep && "[&_*]:cursor-grabbing",
        )}
      >
        <span className={cn(CHIP, "cursor-pointer font-mono")}>
          cursor-pointer
        </span>
        <button type="button" tabIndex={-1} className={cn(CHIP, "font-mono")}>
          {"<button>"}
        </button>
      </div>
      <div className="flex items-center justify-between gap-4">
        <Readout cursor={cursor} />
        <button
          type="button"
          aria-pressed={deep}
          onClick={() => setDeep((d) => !d)}
          aria-label={
            deep ? "Remove the descendant rule" : "Add the descendant rule"
          }
          className="flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full bg-fill px-3 py-1.5 text-action text-text-secondary transition-colors duration-200 hover:bg-fill-hover hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-primary/15 focus-visible:ring-offset-2 active:bg-fill-active"
        >
          <span className="whitespace-nowrap font-mono">
            <TextMorph duration={MORPH.duration} ease={MORPH.ease}>
              {deep ? "with [&_*]" : "without [&_*]"}
            </TextMorph>
          </span>
          <ArrowsLeftRightIcon aria-hidden="true" className="size-3.5" />
        </button>
      </div>
    </div>
  );
}
