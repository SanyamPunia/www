"use client";

import { CaretLeftIcon, CaretRightIcon, XIcon } from "@phosphor-icons/react";
import {
  AnimatePresence,
  animate,
  type MotionValue,
  motion,
  motionValue,
  type Transition,
  useReducedMotion,
} from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { TextMorph } from "torph/react";
import { Tooltip, TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { PHOTOS } from "./photos";
import {
  captionTop,
  carouselPose,
  type Pose,
  resist,
  type Size,
  sizes,
  stackPose,
} from "./stack";

/*
 * A pile of photos. Drag the front one off either side and it goes to the back
 * while the next comes forward. Press any photo, the front or a sliver of one
 * behind it, and it opens with the rest beside it as a carousel.
 *
 * Every card is always mounted and is only ever moved: the pile and the
 * carousel are two sets of poses for the same five elements, so opening a
 * photo is that card travelling from where it was, never a copy growing out of
 * it. Each card's x, y, rotation, box and opacity are motion values written
 * imperatively, so a drag and a spring write the same values and nothing
 * renders per frame.
 */

const COUNT = PHOTOS.length;

/** the pile answers the hand, so it is quick and barely overshoots */
const SETTLE: Transition = { type: "spring", stiffness: 480, damping: 40 };
/** opening and closing carry a card across the stage and grow it, so softer */
const TRAVEL: Transition = { type: "spring", stiffness: 340, damping: 34 };
/**
 * A card thrown off the pile leaves on an ease-out rather than a spring: it is
 * already moving, and what it has to do is get clear of the pile before it
 * gives up its place in front.
 */
const THROW_MS = 200;
const THROW: Transition = {
  duration: THROW_MS / 1000,
  ease: [0.23, 1, 0.32, 1],
};

/**
 * The swap comes before the throw ends. The ease-out has covered nearly all of
 * its distance by then, and waiting for the tail left the card sitting still
 * at the side for about 100ms before it went behind.
 */
const SWAP_MS = 120;

/**
 * How far from the pile's centre a card's own centre has to be, in card
 * widths, before it can go behind without the swap showing. At 0.85 only the
 * edge nearest the pile still overlaps it.
 */
const CLEAR = 0.85;

const SLOP = 6;

/** rotation per pixel of drag, so a card turns the way it is pulled */
const TWIST = 0.05;

const SHADOW =
  "0 1px 1px rgba(0,0,0,.06), 0 4px 10px -2px rgba(0,0,0,.10), 0 18px 32px -14px rgba(0,0,0,.22)";

/* the site's focus pattern is a ring, which is a box-shadow and would replace
   the card's own lift, so the photos take the same mark as an outline */
const OUTLINE =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-text-primary/40";

const FOCUS =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-primary/15 focus-visible:ring-offset-2";

const CONTROL = cn(
  "inline-flex size-9 cursor-pointer items-center justify-center rounded-full bg-bg text-text-secondary transition-all duration-200",
  "hover:bg-fill-hover hover:text-text-primary active:bg-fill-active active:duration-0",
  "disabled:cursor-not-allowed disabled:opacity-50",
  FOCUS,
);

interface Values {
  x: MotionValue<number>;
  y: MotionValue<number>;
  rotate: MotionValue<number>;
  width: MotionValue<number>;
  height: MotionValue<number>;
  opacity: MotionValue<number>;
}

interface Gesture {
  id: number;
  mode: "stack" | "carousel";
  startX: number;
  startY: number;
  dx: number;
  live: boolean;
  /** the last two samples, for the release velocity */
  lastX: number;
  lastT: number;
  velocity: number;
}

/** the pile with `id` taken out of it and put at the back */
const toBack = (order: readonly number[], id: number) => [
  ...order.filter((entry) => entry !== id),
  id,
];

/** the pile turned round, cyclically, so `id` is on top */
const toFront = (order: readonly number[], id: number) => {
  const at = order.indexOf(id);
  return [...order.slice(at), ...order.slice(0, at)];
};

/** hand focus to the card that has just come to the front */
const focusNext = (node: HTMLButtonElement | null | undefined) =>
  requestAnimationFrame(() => node?.focus({ preventScroll: true }));

/** a keyboard press is the only one that should move focus, `notice-stack` */
const byKeyboard = () =>
  document.activeElement?.matches(":focus-visible") ?? false;

export default function PhotoStack() {
  const reduce = useReducedMotion() ?? false;
  const stageRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const closeRef = useRef<HTMLButtonElement>(null);

  const [values] = useState<Values[]>(() =>
    PHOTOS.map(() => ({
      x: motionValue(0),
      y: motionValue(0),
      rotate: motionValue(0),
      width: motionValue(0),
      height: motionValue(0),
      opacity: motionValue(0),
    })),
  );

  const [order, setOrder] = useState<number[]>(() => PHOTOS.map((_, i) => i));
  const [open, setOpen] = useState<number | null>(null);
  /** the card being thrown off the pile, held in front until it is clear */
  const [leaving, setLeaving] = useState<number | null>(null);
  const [spread, setSpread] = useState(false);
  const [stage, setStage] = useState<{ w: number; h: number } | null>(null);

  const orderRef = useRef(order);
  const openRef = useRef(open);
  const leavingRef = useRef(leaving);
  const spreadRef = useRef(spread);
  const sizeRef = useRef<Size | null>(null);
  const gestureRef = useRef<Gesture | null>(null);
  const draggedRef = useRef(false);
  const placedRef = useRef<{ size: Size; open: number | null } | null>(null);
  const leaveFrame = useRef(0);

  const size = stage ? sizes(stage.w, stage.h) : null;

  useEffect(() => {
    orderRef.current = order;
    openRef.current = open;
    leavingRef.current = leaving;
    spreadRef.current = spread;
    sizeRef.current = size;
  });

  const poseOf = useCallback(
    (
      i: number,
      s: Size,
      o: readonly number[],
      opened: number | null,
      fan: boolean,
      drag = 0,
    ): Pose =>
      opened === null
        ? stackPose(o.indexOf(i), s, fan)
        : carouselPose(i - opened, s, drag),
    [],
  );

  /** write a pose to a card, animated or set */
  const send = useCallback(
    (i: number, pose: Pose, transition: Transition | null) => {
      const v = values[i];
      const targets: [MotionValue<number>, number][] = [
        [v.x, pose.cx - pose.width / 2],
        [v.y, pose.cy - pose.height / 2],
        [v.rotate, pose.rotate],
        [v.width, pose.width],
        [v.height, pose.height],
        [v.opacity, pose.opacity],
      ];
      for (const [value, target] of targets) {
        if (transition === null) {
          value.jump(target);
        } else {
          animate(value, target, transition);
        }
      }
    },
    [values],
  );

  /*
   * Every state change lands here. A new size is set rather than animated,
   * since a corrected measurement is not a gesture, which is `gooey-chips`'s
   * rule, and a change of open state takes the softer spring.
   */
  useEffect(() => {
    if (!size) return;
    const last = placedRef.current;
    const resized =
      !last || last.size.bigW !== size.bigW || last.size.bigH !== size.bigH;
    const transition = resized
      ? null
      : reduce
        ? { duration: 0 }
        : last.open !== open
          ? TRAVEL
          : SETTLE;
    placedRef.current = { size, open };
    for (let i = 0; i < COUNT; i++) {
      if (i === leaving) continue;
      send(i, poseOf(i, size, order, open, spread), transition);
    }
  }, [size, order, open, spread, leaving, reduce, poseOf, send]);

  useEffect(() => {
    const node = stageRef.current;
    if (!node) return;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setStage((prev) =>
        prev && prev.w === width && prev.h === height
          ? prev
          : { w: width, h: height },
      );
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  /*
   * Throwing the front card: it carries on out to the side it was pulled
   * toward while the pile moves up behind it, and only once it is clear does it
   * give up its place in front. `zIndex` is discrete, so the swap is hidden by
   * where it happens: out at the side, the only part of it still over the pile
   * is the part that goes behind the new front card, which is what tucking a
   * photo under a stack looks like. `stamp-collection` documents the pop this
   * avoids.
   */
  const throwBack = useCallback(
    (dir: 1 | -1) => {
      const s = sizeRef.current;
      if (!s) return;
      const id = orderRef.current[0];
      const next = orderRef.current[1];
      const keyboard = byKeyboard();
      setOrder(toBack(orderRef.current, id));

      /*
       * Where the card is now, as its centre's distance from the pile's. A
       * card already dragged clear goes straight to the back from where it was
       * let go. Sending it to a fixed point first pulled a card dropped past
       * that point back toward the pile before it went behind, which read as
       * two moves in a row.
       */
      const v = values[id];
      const at = v.x.get() + v.width.get() / 2;
      const clear = s.cardW * CLEAR;
      if (reduce || at * dir >= clear) {
        if (keyboard) focusNext(cardRefs.current[next]);
        return;
      }

      /* not clear yet, so it carries on outward to the clear point, never
         back, and only then gives up its place in front */
      setLeaving(id);
      const base = stackPose(0, s, false);
      send(
        id,
        {
          ...base,
          cx: dir * clear,
          cy: v.y.get() + v.height.get() / 2,
          rotate: dir * Math.max(12, Math.abs(v.rotate.get())),
        },
        THROW,
      );
      window.setTimeout(() => {
        if (leavingRef.current === id) setLeaving(null);
      }, SWAP_MS);
      if (keyboard) focusNext(cardRefs.current[next]);
    },
    [reduce, send, values],
  );

  const openPhoto = useCallback((i: number) => {
    setSpread(false);
    setOpen(i);
  }, []);

  const close = useCallback(() => {
    const opened = openRef.current;
    if (opened === null) return;
    const keyboard = byKeyboard();
    setOrder(toFront(orderRef.current, opened));
    setOpen(null);
    if (keyboard) {
      requestAnimationFrame(() =>
        cardRefs.current[opened]?.focus({ preventScroll: true }),
      );
    }
  }, []);

  const step = useCallback((dir: 1 | -1) => {
    const opened = openRef.current;
    if (opened === null) return;
    const next = Math.min(COUNT - 1, Math.max(0, opened + dir));
    setOpen(next);
  }, []);

  /* focus lands on the close control when a photo opens from the keyboard */
  const openedByKey = useRef(false);
  useEffect(() => {
    if (open !== null && openedByKey.current) {
      openedByKey.current = false;
      closeRef.current?.focus({ preventScroll: true });
    }
  }, [open]);

  /* a modal closes on Escape, and the arrows walk it */
  useEffect(() => {
    if (open === null) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
      else if (event.key === "ArrowLeft") step(-1);
      else if (event.key === "ArrowRight") step(1);
      else return;
      event.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close, step]);

  /*
   * The drag, on nib's rules: down on a card, move, up, cancel and blur on the
   * window, and `buttons === 0` ends one whose lift was never heard. It writes
   * the same motion values the springs do, so nothing renders while it runs.
   */
  useEffect(() => {
    const stageNode = stageRef.current;

    const end = (commit: boolean) => {
      const g = gestureRef.current;
      gestureRef.current = null;
      stageNode?.removeAttribute("data-carry");
      const s = sizeRef.current;
      if (!g?.live || !s) return;

      const dir: 1 | -1 = (g.dx || g.velocity) > 0 ? 1 : -1;
      const flung = Math.abs(g.velocity) > 500 && Math.sign(g.velocity) === dir;

      if (g.mode === "stack") {
        if (commit && (Math.abs(g.dx) > s.cardW * 0.3 || flung)) {
          throwBack(dir);
          return;
        }
        send(
          g.id,
          stackPose(0, s, spreadRef.current),
          reduce ? { duration: 0 } : SETTLE,
        );
        return;
      }

      const opened = openRef.current;
      if (opened === null) return;
      const next =
        commit && (Math.abs(g.dx) > s.bigW * 0.2 || flung)
          ? Math.min(COUNT - 1, Math.max(0, opened - dir))
          : opened;
      setOpen(next);
      /* an unchanged `open` renders nothing, so put the strip back here */
      for (let i = 0; i < COUNT; i++) {
        send(
          i,
          carouselPose(i - next, s, 0),
          reduce ? { duration: 0 } : SETTLE,
        );
      }
    };

    const onMove = (event: PointerEvent) => {
      const g = gestureRef.current;
      const s = sizeRef.current;
      if (!g || !s) return;
      if (event.buttons === 0) {
        end(false);
        return;
      }
      const dx = event.clientX - g.startX;
      const dy = event.clientY - g.startY;
      if (!g.live) {
        if (Math.abs(dx) < SLOP) {
          /* a vertical start is the page scrolling, not a swipe */
          if (Math.abs(dy) > SLOP) gestureRef.current = null;
          return;
        }
        g.live = true;
        draggedRef.current = true;
        stageNode?.setAttribute("data-carry", "");
      }

      const now = performance.now();
      const dt = now - g.lastT;
      if (dt > 0) {
        g.velocity =
          ((event.clientX - g.lastX) / dt) * 1000 * 0.6 + g.velocity * 0.4;
      }
      g.lastX = event.clientX;
      g.lastT = now;
      g.dx = dx;

      if (g.mode === "stack") {
        const base = stackPose(0, s, spreadRef.current);
        send(
          g.id,
          {
            ...base,
            cx: base.cx + dx,
            cy: base.cy + Math.abs(dx) * 0.04,
            rotate: base.rotate + dx * TWIST,
          },
          null,
        );
        return;
      }

      const opened = openRef.current;
      if (opened === null) return;
      const drag = resist(dx, opened, COUNT);
      for (let i = 0; i < COUNT; i++) {
        send(i, carouselPose(i - opened, s, drag), null);
      }
    };

    const onUp = () => end(true);
    const onCancel = () => end(false);

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onCancel);
    window.addEventListener("blur", onCancel);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onCancel);
      window.removeEventListener("blur", onCancel);
    };
  }, [reduce, send, throwBack]);

  const press = (i: number, event: React.PointerEvent) => {
    if (event.button !== 0) return;
    draggedRef.current = false;
    const opened = openRef.current;
    const front = orderRef.current[0];
    /* the pile only lets its front card go, and the carousel only its middle */
    if (
      opened === null
        ? i !== front || leavingRef.current !== null
        : i !== opened
    )
      return;
    gestureRef.current = {
      id: i,
      mode: opened === null ? "stack" : "carousel",
      startX: event.clientX,
      startY: event.clientY,
      dx: 0,
      live: false,
      lastX: event.clientX,
      lastT: performance.now(),
      velocity: 0,
    };
  };

  const click = (i: number, event: React.MouseEvent) => {
    /* a drag ends in a click on the card it started on */
    if (draggedRef.current) {
      draggedRef.current = false;
      return;
    }
    if (open === null) {
      openedByKey.current = event.detail === 0;
      openPhoto(i);
    } else if (i !== open) {
      setOpen(i);
    }
  };

  const keydown = (i: number, event: React.KeyboardEvent) => {
    if (open !== null || i !== order[0]) return;
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      event.preventDefault();
      throwBack(event.key === "ArrowLeft" ? -1 : 1);
    }
  };

  /* hover leans the pile out. Mouse and pen only, `folder-stack`'s gate, and
     the leave waits a frame so crossing from one card to the next is no dip */
  const enter = (event: React.PointerEvent) => {
    if (event.pointerType !== "mouse" && event.pointerType !== "pen") return;
    cancelAnimationFrame(leaveFrame.current);
    if (openRef.current === null) setSpread(true);
  };
  const leave = () => {
    cancelAnimationFrame(leaveFrame.current);
    leaveFrame.current = requestAnimationFrame(() => setSpread(false));
  };

  const zIndex = (i: number) => {
    if (open !== null) {
      const far = Math.abs(i - open);
      return far === 0 ? 50 : far === 1 ? 40 : 30;
    }
    if (i === leaving) return 55;
    return 45 - order.indexOf(i);
  };

  const current = open === null ? null : PHOTOS[open];

  return (
    <TooltipProvider delayDuration={200}>
      <div
        ref={stageRef}
        className={cn(
          "relative h-130 w-full select-none overflow-hidden rounded-lg bg-fill ring-1 ring-stroke ring-inset",
          "data-carry:cursor-grabbing data-carry:[&_*]:cursor-grabbing",
        )}
      >
        <p aria-live="polite" className="sr-only">
          {current
            ? `${current.title}, photo ${(open ?? 0) + 1} of ${COUNT}`
            : ""}
        </p>

        {/* the modal's ground. A real button so a press on it closes, and out
            of the tab order since the close control is the keyboard's way */}
        <motion.button
          type="button"
          tabIndex={-1}
          aria-hidden="true"
          onClick={close}
          initial={false}
          animate={{ opacity: open === null ? 0 : 1 }}
          transition={{ duration: reduce ? 0 : 0.2 }}
          className={cn(
            "absolute inset-0 z-20 cursor-default bg-bg",
            open === null && "pointer-events-none",
          )}
        />

        {stage
          ? PHOTOS.map((photo, i) => {
              const v = values[i];
              const front = open === null ? i === order[0] : i === open;
              return (
                <motion.button
                  key={photo.id}
                  ref={(node) => {
                    cardRefs.current[i] = node;
                  }}
                  type="button"
                  tabIndex={front ? 0 : -1}
                  aria-label={
                    open === null
                      ? `Open ${photo.title}, photo ${i + 1} of ${COUNT}`
                      : photo.title
                  }
                  aria-describedby={
                    open === null && front ? "photo-stack-how" : undefined
                  }
                  onPointerDown={(event) => press(i, event)}
                  onPointerEnter={enter}
                  onPointerLeave={leave}
                  onClick={(event) => click(i, event)}
                  onKeyDown={(event) => keydown(i, event)}
                  style={{
                    x: v.x,
                    y: v.y,
                    rotate: v.rotate,
                    width: v.width,
                    height: v.height,
                    opacity: v.opacity,
                    zIndex: zIndex(i),
                    boxShadow: SHADOW,
                  }}
                  className={cn(
                    "absolute top-1/2 left-1/2 overflow-hidden rounded-[12px] bg-fill-active touch-pan-y",
                    front ? "cursor-grab" : "cursor-pointer",
                    open !== null && !front && "cursor-pointer",
                    OUTLINE,
                  )}
                >
                  {/* biome-ignore lint/performance/noImgElement: an inline SVG data URI, which next/image has nothing to optimise */}
                  <img
                    src={photo.uri}
                    alt=""
                    draggable={false}
                    className="pointer-events-none size-full select-none object-cover"
                  />
                  {/* an inset hairline on an arbitrary fill, which is the one
                      place the translucent ring is right */}
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0 rounded-[12px] ring-1 ring-text-primary/10 ring-inset"
                  />
                </motion.button>
              );
            })
          : null}

        <span id="photo-stack-how" className="sr-only">
          Drag it sideways or press the left and right arrow keys to send it to
          the back.
        </span>

        <AnimatePresence>
          {open !== null && size && stage ? (
            <motion.div
              key="chrome"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1, transition: { delay: reduce ? 0 : 0.08 } }}
              exit={{ opacity: 0, transition: { duration: 0.12 } }}
              transition={{ duration: reduce ? 0 : 0.2 }}
              className="pointer-events-none absolute inset-0 z-60"
            >
              <div className="pointer-events-auto absolute top-4 right-4">
                <Tooltip label="Close (Esc)">
                  <button
                    ref={closeRef}
                    type="button"
                    aria-label="Close the photo"
                    onClick={close}
                    className={CONTROL}
                  >
                    <XIcon aria-hidden="true" className="size-4" />
                  </button>
                </Tooltip>
              </div>

              <div className="pointer-events-auto absolute top-1/2 left-3 -translate-y-1/2">
                <Tooltip label="Previous photo">
                  <button
                    type="button"
                    aria-label="Previous photo"
                    disabled={open === 0}
                    onClick={() => step(-1)}
                    className={CONTROL}
                  >
                    <CaretLeftIcon aria-hidden="true" className="size-4" />
                  </button>
                </Tooltip>
              </div>
              <div className="pointer-events-auto absolute top-1/2 right-3 -translate-y-1/2">
                <Tooltip label="Next photo">
                  <button
                    type="button"
                    aria-label="Next photo"
                    disabled={open === COUNT - 1}
                    onClick={() => step(1)}
                    className={CONTROL}
                  >
                    <CaretRightIcon aria-hidden="true" className="size-4" />
                  </button>
                </Tooltip>
              </div>

              <div
                style={{ top: captionTop(stage.h, size) }}
                className="absolute inset-x-0 flex flex-col items-center"
              >
                <span className="whitespace-nowrap text-body text-text-primary">
                  <TextMorph duration={200} ease="cubic-bezier(0.4, 0, 0.2, 1)">
                    {PHOTOS[open].title}
                  </TextMorph>
                </span>
                <span className="text-meta text-text-muted tabular-nums">
                  {open + 1} of {COUNT}
                </span>
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </TooltipProvider>
  );
}
