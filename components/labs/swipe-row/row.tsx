"use client";

import { animate, motion, useMotionValue, useTransform } from "motion/react";
import {
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
} from "react";
import { EnvelopeIcon, FlagIcon, TrashIcon } from "@/components/icons";
import { cn } from "@/lib/utils";
import { HUE, type Message } from "./mail";
import {
  AXIS,
  armed,
  buttonWidth,
  follow,
  openAt,
  type Side,
  SLOP,
  settle,
  WHEEL_IDLE_MS,
} from "./swipe";
import { armSound, buzz, click, detent, swish } from "./swipe-sound";

/*
 * One row and its gesture. The row's face rides one motion value, `x`, and
 * every other moving part is derived from it: the width of the strip each side
 * uncovers, where each icon sits in it, and how far the far action has grown.
 * So the face and the actions under it can never disagree about where the
 * finger is.
 */

interface RowProps {
  msg: Message;
  /** the side this row is open on, owned by the list so only one is open */
  side: Side | null;
  last: boolean;
  reduce: boolean;
  /** back from an undo, so it slides in from the side it left by */
  returning: boolean;
  /** show the gesture once: slide open a sliver and settle back */
  peek: boolean;
  setSide: (id: string, side: Side | null) => void;
  /** a press landed here, and the list closes any other open row */
  onPress: (id: string) => boolean;
  onCarry: (on: boolean) => void;
  onRead: (id: string, unread: boolean) => void;
  onFlag: (id: string) => void;
  onDelete: (id: string, byKey: boolean) => void;
}

interface Drag {
  pointer: number;
  x0: number;
  y0: number;
  base: number;
  axis: "x" | "y" | null;
  /** the press closed another row, so it is not also a tap on this one */
  consumed: boolean;
}

/** the last 80ms of motion, for the release velocity */
type Sample = [t: number, x: number];

const ICON = 20;

function velocityOf(samples: Sample[]): number {
  const now = performance.now();
  const recent = samples.filter(([t]) => now - t < 80);
  if (recent.length < 2) return 0;
  const [t0, x0] = recent[0];
  const [t1, x1] = recent[recent.length - 1];
  return t1 > t0 ? ((x1 - x0) / (t1 - t0)) * 1000 : 0;
}

export function Row({
  msg,
  side,
  last,
  reduce,
  returning,
  peek,
  setSide,
  onPress,
  onCarry,
  onRead,
  onFlag,
  onDelete,
}: RowProps) {
  const root = useRef<HTMLDivElement>(null);
  const face = useRef<HTMLButtonElement>(null);
  const flagButton = useRef<HTMLButtonElement>(null);
  const readButton = useRef<HTMLButtonElement>(null);
  const w = useRef(0);
  const drag = useRef<Drag | null>(null);
  const samples = useRef<Sample[]>([]);
  /*
   * A row back from an undo starts armed, so the trash fills the strip and
   * shrinks as the row comes home: the delete run backwards. It has to start
   * armed rather than be set so in an effect, since the motion element only
   * subscribes to its derived styles after the effects have run and misses a
   * change made before then.
   */
  const isArmed = useRef(returning);
  /** where `x` is headed, so a prop echo of our own decision does not restart it */
  const target = useRef(0);
  const dragged = useRef(false);
  /** this press closed another row, so its click is spent */
  const spent = useRef(false);
  const leaving = useRef(false);
  const wheel = useRef({ active: false, raw: 0, timer: 0 });

  const x = useMotionValue(0);
  const arm = useMotionValue(returning ? 1 : 0);

  /* ------------------------------------------------- derived from `x` */

  /*
   * Under a pixel draws nothing. A spring settles within half a pixel of its
   * target, and that half pixel showed as a red hairline down the edge of a
   * row that had closed.
   */
  const trailW = useTransform(x, (v) => (v < -1 ? -v : 0));
  const leadW = useTransform(x, (v) => (v > 1 ? v : 0));
  // the flag gives its share to the trash as the far action arms
  const flagGrow = useTransform(arm, (a) => Math.max(0.0001, 1 - a));
  const trailIcons = useTransform(trailW, (s) =>
    Math.min(1, Math.max(0, (s - 16) / (buttonWidth(w.current) * 1.4))),
  );
  const leadIcon = useTransform(leadW, (s) =>
    Math.min(1, Math.max(0, (s - 16) / (buttonWidth(w.current) * 0.7))),
  );
  /*
   * Where the trash icon sits in its button. Centred while the two buttons
   * share the strip, then pinned half a button from the face's edge once the
   * trash has the whole strip, so it rides out with the finger the way Mail's
   * does.
   */
  const trashLeft = useTransform([trailW, arm], ([s, a]: number[]) => {
    const own = s / (2 - a);
    const centred = own / 2;
    const pinned = buttonWidth(w.current) / 2;
    return centred + (pinned - centred) * a - ICON / 2;
  });
  // the leading icon stays half a button in from the face's edge once there
  // is room, and centred in the strip before that
  const readRight = useTransform(
    leadW,
    (s) => Math.min(s / 2, buttonWidth(w.current) / 2) - ICON / 2,
  );
  const armScale = useTransform(arm, (a) => 1 + a * 0.14);

  /* ---------------------------------------------------------- springs */

  const spring = useCallback(
    (to: number, velocity = 0, bounce = 0) => {
      target.current = to;
      if (reduce) {
        x.set(to);
        return Promise.resolve();
      }
      return animate(x, to, {
        type: "spring",
        velocity,
        bounce,
        visualDuration: 0.34,
      }).finished;
    },
    [reduce, x],
  );

  const setArmed = useCallback(
    (on: boolean, quiet = false) => {
      if (isArmed.current === on) return;
      isArmed.current = on;
      if (reduce) arm.set(on ? 1 : 0);
      else
        animate(arm, on ? 1 : 0, {
          type: "spring",
          bounce: on ? 0.3 : 0,
          visualDuration: 0.26,
        });
      if (quiet) return;
      detent(on);
      buzz(on ? 10 : 5);
    },
    [arm, reduce],
  );

  /* ----------------------------------------------------------- measure */

  // `returning` only matters on the first layout, so this runs once
  // biome-ignore lint/correctness/useExhaustiveDependencies: mount only
  useLayoutEffect(() => {
    const el = root.current;
    if (!el) return;
    w.current = el.offsetWidth;
    // back from an undo: it left to the left, so it comes back from there
    if (returning) {
      x.set(-w.current);
      void spring(0, 0, 0).then(() => setArmed(false, true));
    }
    const ro = new ResizeObserver(() => {
      w.current = el.offsetWidth;
      // a resize re-seats an open row at the new width, set rather than
      // animated, since a corrected measurement is not a gesture
      if (drag.current || leaving.current || target.current === 0) return;
      const to = openAt(target.current < 0 ? "trailing" : "leading", w.current);
      target.current = to;
      x.set(to);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  /* ----------------------------------------------------- the outcomes */

  const remove = useCallback(
    async (velocity: number, byKey: boolean) => {
      if (leaving.current) return;
      leaving.current = true;
      setArmed(true, true);
      swish();
      buzz(16);
      /*
       * Off the far edge, with the trash filling the strip it uncovers. The
       * list is told the moment the face has crossed the edge rather than
       * when the spring settles: a spring spends its last few hundred
       * milliseconds on fractions of a pixel nobody can see, and the gap left
       * waiting for it read as a red sliver that would not go.
       */
      const edge = -w.current * 0.98;
      let told = false;
      const tell = () => {
        if (told) return;
        told = true;
        off();
        onDelete(msg.id, byKey);
      };
      const off = x.on("change", (v) => {
        if (v <= edge) tell();
      });
      // a delete from a key or a button has no throw behind it, so it is
      // given the speed of a flick, which is how Mail's trash leaves
      await spring(-w.current * 1.04, velocity || -1600, 0);
      tell();
    },
    [msg.id, onDelete, setArmed, spring, x],
  );

  const toggleRead = useCallback(
    (velocity = 0) => {
      onRead(msg.id, !msg.unread);
      click();
      buzz(10);
      setSide(msg.id, null);
      void spring(0, velocity, velocity === 0 ? 0 : 0.18);
      setArmed(false, true);
    },
    [msg.id, msg.unread, onRead, setArmed, setSide, spring],
  );

  const release = useCallback(
    (velocity: number) => {
      const out = settle(x.get(), velocity, w.current, isArmed.current);
      if (out.kind === "commit") {
        if (out.side === "trailing") void remove(velocity, false);
        else toggleRead(velocity);
        return;
      }
      setArmed(false, true);
      // a row that was thrown open gets a little bounce, since the throw
      // applied the force. One that was put down does not
      const bounce = Math.abs(velocity) > 400 ? 0.16 : 0;
      if (out.kind === "open") {
        void spring(openAt(out.side, w.current), velocity, bounce);
        setSide(msg.id, out.side);
      } else {
        void spring(0, velocity, 0);
        setSide(msg.id, null);
      }
    },
    [msg.id, remove, setArmed, setSide, spring, toggleRead, x],
  );

  /*
   * The peek. A list of rows at rest says nothing about being swipeable, so
   * the first row shows the gesture once: it slides open far enough to show a
   * sliver of both trailing colours, holds a beat and springs home with a
   * little bounce. A press during it catches the row where it is, since the
   * press stops `x`.
   */
  useEffect(() => {
    if (!peek || reduce || drag.current || target.current !== 0) return;
    let live = true;
    const run = async () => {
      await animate(x, -52, {
        type: "spring",
        bounce: 0,
        visualDuration: 0.34,
      }).finished;
      await new Promise((r) => setTimeout(r, 180));
      if (!live || drag.current || target.current !== 0) return;
      animate(x, 0, { type: "spring", bounce: 0.3, visualDuration: 0.4 });
    };
    void run();
    return () => {
      live = false;
    };
  }, [peek, reduce, x]);

  // the list closed this row, or opened it from the keyboard
  useEffect(() => {
    if (drag.current || wheel.current.active || leaving.current) return;
    const to = side ? openAt(side, w.current) : 0;
    if (to === target.current) return;
    setArmed(false, true);
    void spring(to);
  }, [side, setArmed, spring]);

  /* ----------------------------------------------------------- pointer */

  const track = (raw: number) => {
    const v = follow(raw, w.current);
    x.set(v);
    samples.current.push([performance.now(), v]);
    if (samples.current.length > 12) samples.current.shift();
    setArmed(armed(v, w.current, isArmed.current));
  };

  const onPointerDown = (e: PointerEvent<HTMLButtonElement>) => {
    if (e.button !== 0 || leaving.current || drag.current) return;
    armSound();
    const consumed = onPress(msg.id);
    drag.current = {
      pointer: e.pointerId,
      x0: e.clientX,
      y0: e.clientY,
      base: x.get(),
      axis: null,
      consumed,
    };
    dragged.current = false;
    spent.current = consumed;
    x.stop();
    if (!consumed) e.currentTarget.dataset.pressed = "true";
  };

  const onPointerMove = (e: PointerEvent<HTMLButtonElement>) => {
    const d = drag.current;
    if (!d || e.pointerId !== d.pointer) return;
    const dx = e.clientX - d.x0;
    const dy = e.clientY - d.y0;
    if (d.axis === null) {
      if (Math.hypot(dx, dy) < SLOP) return;
      delete e.currentTarget.dataset.pressed;
      if (Math.abs(dx) < Math.abs(dy) * AXIS) {
        // a scroll, which the page keeps, since the face is `pan-y`
        drag.current = null;
        return;
      }
      d.axis = "x";
      // the drag starts from here, so the slop is not a jump
      d.x0 = e.clientX;
      d.base = x.get();
      dragged.current = true;
      samples.current = [];
      e.currentTarget.setPointerCapture(e.pointerId);
      onCarry(true);
    }
    track(d.base + (e.clientX - d.x0));
  };

  const onPointerEnd = (e: PointerEvent<HTMLButtonElement>) => {
    const d = drag.current;
    if (!d || e.pointerId !== d.pointer) return;
    drag.current = null;
    delete e.currentTarget.dataset.pressed;
    if (d.axis !== "x") return;
    onCarry(false);
    release(e.type === "pointercancel" ? 0 : velocityOf(samples.current));
  };

  /**
   * A tap opens the message, which in Mail marks it read. A tap on a row that
   * is open closes it instead, and a press that closed another row is spent.
   */
  const onClick = () => {
    if (dragged.current || spent.current) {
      dragged.current = false;
      spent.current = false;
      return;
    }
    if (leaving.current) return;
    if (side) {
      setSide(msg.id, null);
      return;
    }
    if (msg.unread) {
      onRead(msg.id, false);
      click();
    }
  };

  /* ---------------------------------------------------------- trackpad */

  /*
   * A two-finger swipe on a trackpad drives the same `x`, the way Mail's does
   * on a Mac. It arrives as wheel events with no start or end, so the end is
   * the moment they stop coming. Bound by hand, since a listener that calls
   * `preventDefault` cannot be passive and React's are.
   */
  useEffect(() => {
    const el = face.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaX) <= Math.abs(e.deltaY) || leaving.current) return;
      e.preventDefault();
      const wh = wheel.current;
      const scale = e.deltaMode === 1 ? 16 : 1;
      if (!wh.active) {
        armSound();
        onPress(msg.id);
        x.stop();
        wh.active = true;
        wh.raw = x.get();
        samples.current = [];
      }
      wh.raw -= e.deltaX * scale;
      track(wh.raw);
      clearTimeout(wh.timer);
      wh.timer = window.setTimeout(() => {
        wh.active = false;
        release(velocityOf(samples.current));
      }, WHEEL_IDLE_MS);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  });

  useEffect(() => {
    const wh = wheel.current;
    return () => clearTimeout(wh.timer);
  }, []);

  /* ---------------------------------------------------------- keyboard */

  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (leaving.current) return;
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      setSide(msg.id, side === "leading" ? null : "trailing");
      if (side !== "leading")
        requestAnimationFrame(() => flagButton.current?.focus());
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      setSide(msg.id, side === "trailing" ? null : "leading");
      if (side !== "trailing")
        requestAnimationFrame(() => readButton.current?.focus());
    } else if (e.key === "Escape" && side) {
      e.preventDefault();
      setSide(msg.id, null);
    } else if (e.key === "Delete" || e.key === "Backspace") {
      e.preventDefault();
      void remove(0, true);
    }
  };

  // Escape from an action button closes the row and goes back to its face
  const onActionKey = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (
      e.key === "Escape" ||
      (e.key === "ArrowRight" && side === "trailing") ||
      (e.key === "ArrowLeft" && side === "leading")
    ) {
      e.preventDefault();
      setSide(msg.id, null);
      face.current?.focus();
    }
  };

  /* ------------------------------------------------------------ render */

  const readLabel = msg.unread ? "Mark as read" : "Mark as unread";

  return (
    <div
      ref={root}
      className="relative overflow-hidden"
      style={{ "--focus": HUE.unread } as CSSProperties}
    >
      {/* leading: one action, uncovered by a swipe to the right */}
      <motion.div
        inert={side !== "leading"}
        className="absolute inset-y-0 left-0 flex overflow-hidden"
        style={{ width: leadW, backgroundColor: HUE.unread }}
      >
        <button
          ref={readButton}
          type="button"
          aria-label={readLabel}
          onClick={(e) => {
            toggleRead();
            if (e.detail === 0) face.current?.focus();
          }}
          onKeyDown={onActionKey}
          className="relative h-full flex-1 cursor-pointer text-bg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bg/70 focus-visible:ring-inset"
        >
          <motion.span
            className="absolute top-1/2 -mt-2.5 flex"
            style={{ right: readRight, opacity: leadIcon, scale: armScale }}
          >
            <EnvelopeIcon className="size-5" />
          </motion.span>
        </button>
      </motion.div>

      {/* trailing: flag and trash, uncovered by a swipe to the left */}
      <motion.div
        inert={side !== "trailing"}
        className="absolute inset-y-0 right-0 flex overflow-hidden"
        style={{ width: trailW }}
      >
        <motion.button
          ref={flagButton}
          type="button"
          aria-label={msg.flagged ? "Remove flag" : "Flag"}
          onClick={(e) => {
            onFlag(msg.id);
            click();
            buzz(10);
            setSide(msg.id, null);
            // the button goes inert as the row closes, so a keyboard press
            // hands focus back to the face rather than dropping it on the page
            if (e.detail === 0) face.current?.focus();
          }}
          onKeyDown={onActionKey}
          className="relative h-full min-w-0 cursor-pointer overflow-hidden text-bg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bg/70 focus-visible:ring-inset"
          style={{
            flexGrow: flagGrow,
            flexBasis: 0,
            backgroundColor: HUE.flag,
          }}
        >
          <motion.span
            className="absolute top-1/2 left-1/2 -mt-2.5 -ml-2.5 flex"
            style={{ opacity: trailIcons }}
          >
            <FlagIcon className="size-5" />
          </motion.span>
        </motion.button>
        <button
          type="button"
          aria-label="Delete"
          onClick={() => void remove(0, false)}
          onKeyDown={onActionKey}
          className="relative h-full min-w-0 flex-1 basis-0 cursor-pointer overflow-hidden text-bg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bg/70 focus-visible:ring-inset"
          style={{ backgroundColor: HUE.trash }}
        >
          <motion.span
            className="absolute top-1/2 -mt-2.5 flex"
            style={{ left: trashLeft, opacity: trailIcons, scale: armScale }}
          >
            <TrashIcon className="size-5" />
          </motion.span>
        </button>
      </motion.div>

      {/* the face, which is the message */}
      <motion.button
        ref={face}
        type="button"
        data-row={msg.id}
        aria-label={`${msg.unread ? "Unread. " : ""}${msg.flagged ? "Flagged. " : ""}${msg.from}, ${msg.subject}, ${msg.time}`}
        aria-describedby="swipe-row-help"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
        onClick={onClick}
        onKeyDown={onKeyDown}
        onContextMenu={(e) => {
          if (dragged.current) e.preventDefault();
        }}
        style={{ x }}
        className={cn(
          "relative z-10 flex h-18 w-full cursor-pointer touch-pan-y items-center gap-2.5 bg-bg pr-4 pl-3 text-left",
          "transition-colors duration-200 hover:bg-surface data-[pressed=true]:bg-fill data-[pressed=true]:duration-0",
          /*
           * Focus is a rounded ring set in from the row, in the system blue,
           * the way macOS draws it. The site's own inset ring is a square,
           * which the card's corners clipped into what read as a stray
           * selection box, and at `text-primary/15` it was 1.2:1. This is
           * 4.02:1, so it is the stronger of the two. It is set 6px in because
           * a ring draws outward from its box: its outer edge then sits 4px
           * inside the row, clear of the card's 20px corners.
           */
          "focus-visible:outline-none focus-visible:after:pointer-events-none focus-visible:after:absolute focus-visible:after:inset-[6px] focus-visible:after:rounded-[10px] focus-visible:after:ring-2 focus-visible:after:ring-(--focus)",
        )}
      >
        {/* the dot sits on the sender's line, so "unread" and the name read as
            one unit, the way Mail places it */}
        <span className="flex min-w-0 flex-1 items-start gap-2.5">
          <span className="flex h-[1lh] w-2.5 shrink-0 items-center justify-center text-body">
            <motion.span
              aria-hidden="true"
              className="size-2.5 rounded-full"
              style={{ backgroundColor: HUE.unread }}
              initial={false}
              animate={
                msg.unread
                  ? { opacity: 1, scale: 1 }
                  : { opacity: 0, scale: 0.5 }
              }
              transition={{ type: "spring", bounce: 0.35, visualDuration: 0.3 }}
            />
          </span>
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="flex items-center gap-2">
              {/* one step of weight while unread, so the state reads before
                the eye reaches the dot. Inter is variable, so it eases */}
              <span
                className={cn(
                  "min-w-0 flex-1 truncate text-body text-text-primary transition-[font-weight] duration-200",
                  msg.unread && "font-medium",
                )}
              >
                {msg.from}
              </span>
              <motion.span
                aria-hidden="true"
                className="flex"
                style={{ color: HUE.flag }}
                initial={false}
                animate={
                  msg.flagged
                    ? { opacity: 1, scale: 1 }
                    : { opacity: 0, scale: 0.5 }
                }
                transition={{
                  type: "spring",
                  bounce: 0.35,
                  visualDuration: 0.3,
                }}
              >
                <FlagIcon className="size-3.5" />
              </motion.span>
              <span className="shrink-0 text-meta text-text-muted">
                {msg.time}
              </span>
            </span>
            <span className="truncate text-meta text-text-secondary">
              {msg.subject}
            </span>
          </span>
        </span>
        {/* the hairline between rows, inset to the text like Mail's */}
        {!last && (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute right-0 bottom-0 left-8 h-px bg-stroke"
          />
        )}
      </motion.button>
    </div>
  );
}
