"use client";

import {
  ArrowCounterClockwiseIcon,
  ArrowUpIcon,
  CheckIcon,
  FileIcon,
  ImageIcon,
  LinkIcon,
  NoteIcon,
  PlusIcon,
} from "@phosphor-icons/react";
import {
  AnimatePresence,
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
} from "motion/react";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { TextMorph } from "torph/react";
import { Tooltip, TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { ITEMS, type Item, TONE } from "./items";

/*
 * A notch hanging from the top edge of a page, and a page of cards to carry
 * to it. Lift one and the notch opens, gooey, and asks for it. Hold it over
 * the notch and the notch asks louder while the card in your hand shrinks to
 * fit and goes in behind the black. Let go and it is swallowed, a drop merging
 * into the notch, which says so, then closes back to its resting word.
 */

type Phase = "rest" | "open" | "over" | "captured";

/** the notch's box in each phase, in stage px */
const NOTCH: Record<Phase, { w: number; h: number; r: number }> = {
  rest: { w: 104, h: 26, r: 14 },
  open: { w: 224, h: 72, r: 28 },
  over: { w: 248, h: 84, r: 32 },
  captured: { w: 200, h: 64, r: 26 },
};

/** what the notch says in each phase */
const LABEL: Record<Phase, string> = {
  rest: "capture",
  open: "drop to capture",
  over: "release to capture",
  captured: "captured",
};

/**
 * The one hue this experiment owns: the green a state icon takes once the
 * drop is going to happen. The arrow over the notch, the plus on the card and
 * the check on capture all wear it, so one colour means "this will be taken"
 * from the moment it can be to the moment it was. Scoped to this lab, not a
 * token: the site ships no success tone, and this is the exception nine other
 * experiments already take for a hue that carries meaning. 9.9:1 against
 * `inverse-bg` for the glyph drawn in it, and the glyph on the disc is the
 * notch's own black.
 */
const GO = "#3ecf8e";

/** how much the card in your hand shrinks over the notch */
const SHRINK = 0.55;
/** how far past the notch's own edge a drop still counts, in px */
const REACH = 16;
/** how long the notch says captured before it closes */
const SAID = 900;
/** how long a put-back card takes to spring home and hand over */
const SETTLE = 380;

/**
 * The notch's spring is underdamped on purpose: the overshoot is what makes
 * the opening read as something soft giving way rather than a box resizing.
 * The ghost's is tighter, since a thing in your hand should feel held.
 */
const GOO = { type: "spring", stiffness: 340, damping: 22, mass: 0.9 } as const;
const HAND = { stiffness: 700, damping: 42 };

const ICON = {
  note: NoteIcon,
  image: ImageIcon,
  link: LinkIcon,
  file: FileIcon,
} as const;

interface Grab {
  id: string;
  pointer: number;
  /** the card's box at the grab, relative to the stage */
  box: { x: number; y: number; w: number; h: number };
  /** where the pointer took hold, relative to the card */
  dx: number;
  dy: number;
  over: boolean;
}

/**
 * The preview each kind of card carries: the note's first lines, the
 * screenshot itself, the link's mark and host, the report's figures. Real
 * content in every case, since a grey bar standing in for a thing is not
 * worth carrying and says nothing about what the notch is for.
 */
function Preview({ item }: { item: Item }) {
  const frame =
    "flex h-24 w-full items-center justify-center overflow-hidden rounded-md bg-bg";
  if (item.kind === "note") {
    return (
      <div
        className={cn(frame, "flex-col items-start justify-start px-3 py-1.5")}
      >
        {item.lines?.map((line, i) => (
          <span
            key={line}
            className={cn(
              "w-full truncate text-meta leading-snug",
              i === 0 ? "text-text-primary" : "text-text-secondary",
            )}
          >
            {line}
          </span>
        ))}
      </div>
    );
  }
  if (item.kind === "image") {
    return (
      <div className={frame}>
        {/* biome-ignore lint/performance/noImgElement: a 640 by 400 still already on disk, painted into a 64px box, is not worth an image pipeline */}
        <img
          src={item.src}
          alt=""
          draggable={false}
          className="size-full select-none object-cover object-top"
        />
      </div>
    );
  }
  if (item.kind === "link") {
    return (
      <div
        className={cn(
          frame,
          "flex-col items-start justify-center gap-1.5 px-3",
        )}
      >
        <span className="flex items-center gap-1.5 font-mono text-meta text-text-muted [text-transform:none]">
          {/* biome-ignore lint/performance/noImgElement: a 16px mark from the site's own favicon registry */}
          <img
            src={item.favicon}
            alt=""
            width={16}
            height={16}
            draggable={false}
            className="size-4 shrink-0 select-none rounded-xs"
          />
          <span className="truncate">{item.host}</span>
        </span>
        <span className="w-full truncate text-meta leading-snug text-text-secondary">
          {item.title}
        </span>
      </div>
    );
  }
  return (
    <div className={cn(frame, "items-stretch justify-start px-3 py-2")}>
      {/* the first page: a heading and the three figures the report is for */}
      <div className="flex w-full flex-col gap-1">
        <span className="truncate text-meta leading-snug text-text-primary">
          {item.title}
        </span>
        <span className="flex gap-3 whitespace-nowrap font-mono text-meta leading-snug text-text-muted tabular-nums">
          {item.rows?.map(([k, v]) => (
            <span key={k} className="flex items-baseline gap-1">
              <span>{k}</span>
              <span className="text-text-secondary">{v}</span>
            </span>
          ))}
        </span>
      </div>
    </div>
  );
}

/** one card, drawn the same in the grid and in the hand */
function Card({ item, className }: { item: Item; className?: string }) {
  const Icon = ICON[item.kind];
  const tone = TONE[item.kind];
  return (
    <div
      className={cn(
        "flex size-full flex-col gap-4 rounded-lg p-4 text-left",
        className,
      )}
      /* the face is the kind's hue, and the preview stays white paper on it */
      style={{ backgroundColor: tone.face }}
    >
      <Preview item={item} />
      <span className="flex min-w-0 flex-col gap-1 px-1 pb-1">
        <span className="truncate text-body font-medium text-text-primary">
          {item.title}
        </span>
        <span
          className="flex items-center gap-1.5 truncate font-mono text-meta [text-transform:none]"
          style={{ color: tone.mark }}
        >
          <Icon aria-hidden="true" className="size-3.5 shrink-0" />
          <span className="truncate">{item.meta}</span>
        </span>
      </span>
    </div>
  );
}

export default function NotchDrop() {
  const reduce = useReducedMotion();
  const stage = useRef<HTMLDivElement>(null);
  const notch = useRef<HTMLDivElement>(null);
  const grab = useRef<Grab | null>(null);
  const gooId = useId();

  const [items, setItems] = useState<Item[]>(ITEMS);
  const [phase, setPhase] = useState<Phase>("rest");
  const [lifted, setLifted] = useState<Grab | null>(null);
  /** the ghost is on its way home, and the card under it is coming back */
  const [settling, setSettling] = useState(false);
  const [count, setCount] = useState(0);
  /** the black drop that merges into the notch on a capture */
  const [drop, setDrop] = useState<{
    x: number;
    y: number;
    size: number;
  } | null>(null);

  /* the ghost follows the hand through a tight spring */
  const gx = useMotionValue(0);
  const gy = useMotionValue(0);
  const sx = useSpring(gx, HAND);
  const sy = useSpring(gy, HAND);
  const scale = useSpring(1, { stiffness: 400, damping: 28 });

  const box = NOTCH[phase];
  const spring = reduce ? { duration: 0 } : GOO;
  const quick = reduce ? { duration: 0 } : { duration: 0.18 };
  const pop = reduce
    ? { duration: 0 }
    : ({ type: "spring", stiffness: 500, damping: 24 } as const);

  /** is a stage point inside the notch, with some reach */
  const overNotch = useCallback((x: number, y: number) => {
    const s = stage.current;
    const n = notch.current;
    if (!s || !n) return false;
    const sr = s.getBoundingClientRect();
    const nr = n.getBoundingClientRect();
    return (
      x >= nr.left - sr.left - REACH &&
      x <= nr.right - sr.left + REACH &&
      y <= nr.bottom - sr.top + REACH
    );
  }, []);

  /**
   * Put the card back. The ghost springs home while the card under it comes
   * back to full, and the ghost fades out over it once it is nearly there, so
   * the two cross rather than swap. Unmounting the ghost in one frame over a
   * placeholder still at 30% was a flicker: one frame of dim card with nothing
   * on top of it, then a 200ms fade up.
   */
  const rest = (g: Grab) => {
    gx.set(0);
    gy.set(0);
    scale.set(1);
    setPhase("rest");
    setSettling(true);
    setTimeout(
      () => {
        setLifted((l) => (l?.id === g.id ? null : l));
        setSettling(false);
      },
      reduce ? 0 : SETTLE,
    );
  };

  const lift = (e: React.PointerEvent<HTMLElement>, id: string) => {
    if (phase === "captured") return;
    const s = stage.current;
    if (!s) return;
    const sr = s.getBoundingClientRect();
    const r = e.currentTarget.getBoundingClientRect();
    const g: Grab = {
      id,
      pointer: e.pointerId,
      box: { x: r.left - sr.left, y: r.top - sr.top, w: r.width, h: r.height },
      dx: e.clientX - r.left,
      dy: e.clientY - r.top,
      over: false,
    };
    grab.current = g;
    /* the board keeps the pointer, so a hand that leaves the card still carries it */
    s.setPointerCapture(e.pointerId);
    gx.jump(0);
    gy.jump(0);
    sx.jump(0);
    sy.jump(0);
    scale.jump(1);
    setLifted(g);
    setPhase("open");
  };

  const move = (e: React.PointerEvent<HTMLDivElement>) => {
    const g = grab.current;
    const s = stage.current;
    if (!g || !s || e.pointerId !== g.pointer) return;
    const sr = s.getBoundingClientRect();
    const px = e.clientX - sr.left;
    const py = e.clientY - sr.top;
    gx.set(px - g.dx - g.box.x);
    gy.set(py - g.dy - g.box.y);
    const over = overNotch(px, py);
    if (over !== g.over) {
      g.over = over;
      scale.set(over ? SHRINK : 1);
      setPhase(over ? "over" : "open");
    }
  };

  const release = (e: React.PointerEvent<HTMLDivElement>) => {
    const g = grab.current;
    if (!g || e.pointerId !== g.pointer) return;
    grab.current = null;
    if (g.over) capture(g);
    else rest(g);
  };

  const cancel = () => {
    const g = grab.current;
    if (!g) return;
    grab.current = null;
    rest(g);
  };

  /** swallow the lifted card: a drop forms where it was and merges into the notch */
  const capture = (g: Grab) => {
    const n = notch.current;
    const s = stage.current;
    if (n && s) {
      const nr = n.getBoundingClientRect();
      const sr = s.getBoundingClientRect();
      const cx = g.box.x + sx.get() + g.dx;
      const cy = g.box.y + sy.get() + g.dy;
      setDrop({ x: cx, y: cy, size: Math.min(g.box.h, 64) * SHRINK });
      /* the ghost itself goes into the notch's centre and vanishes */
      gx.set(nr.left - sr.left + nr.width / 2 - g.box.x - g.dx);
      gy.set(nr.top - sr.top + nr.height / 2 - g.box.y - g.dy);
      scale.set(0.05);
    }
    setPhase("captured");
    setTimeout(
      () => {
        setItems((list) => list.filter((it) => it.id !== g.id));
        setCount((c) => c + 1);
        setLifted(null);
        setDrop(null);
      },
      reduce ? 0 : 260,
    );
    setTimeout(() => setPhase("rest"), reduce ? 0 : SAID);
  };

  /* a lost window or Escape is a cancel, nib's rule for a drag that must never stick */
  // biome-ignore lint/correctness/useExhaustiveDependencies: cancel reads refs and motion values, none of which change identity
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") cancel();
    };
    window.addEventListener("blur", cancel);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("blur", cancel);
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  /** the keyboard's path: the focused card goes straight into the notch */
  const captureFromKey = (e: React.KeyboardEvent<HTMLElement>, id: string) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    e.preventDefault();
    if (phase === "captured" || grab.current) return;
    const s = stage.current;
    if (!s) return;
    const sr = s.getBoundingClientRect();
    const r = e.currentTarget.getBoundingClientRect();
    const g: Grab = {
      id,
      pointer: -1,
      box: { x: r.left - sr.left, y: r.top - sr.top, w: r.width, h: r.height },
      dx: r.width / 2,
      dy: r.height / 2,
      over: true,
    };
    gx.jump(0);
    gy.jump(0);
    sx.jump(0);
    sy.jump(0);
    scale.jump(1);
    setLifted(g);
    /* the notch opens first, then the card leaves, so the eye sees where it went */
    setPhase("open");
    setTimeout(() => capture(g), reduce ? 0 : 180);
  };

  const liftedItem = lifted ? items.find((it) => it.id === lifted.id) : null;
  const notchLabel =
    phase === "rest" && count > 0 ? `${LABEL.rest} ${count}` : LABEL[phase];

  return (
    <div
      ref={stage}
      onPointerMove={move}
      onPointerUp={release}
      onPointerCancel={cancel}
      /* its own ring, since the stage's white covers the frame's inset ring,
         the trap the album cover documents */
      className="relative h-148 w-full select-none overflow-hidden rounded-lg bg-bg ring-1 ring-stroke ring-inset"
    >
      {/*
       * The goo. Two black shapes under one blur-and-threshold filter read as
       * one liquid: the notch's body and, on a capture, the drop that leaves
       * the card and merges into it. Nothing with an edge worth keeping sits
       * under the filter, so the label is a separate layer over it.
       */}
      <svg aria-hidden="true" className="absolute size-0">
        <defs>
          <filter id={gooId}>
            <feGaussianBlur in="SourceGraphic" stdDeviation="6" result="blur" />
            <feColorMatrix
              in="blur"
              mode="matrix"
              values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 22 -10"
            />
          </filter>
        </defs>
      </svg>

      {/* the goo sits under the face and under the card in your hand */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-20"
        style={{ filter: `url(#${gooId})` }}
      >
        <motion.div
          className="absolute top-0 left-1/2 -translate-x-1/2 bg-inverse-bg"
          initial={false}
          animate={{
            width: box.w,
            height: box.h,
            borderBottomLeftRadius: box.r,
            borderBottomRightRadius: box.r,
          }}
          transition={spring}
        />
        <AnimatePresence>
          {drop ? (
            <motion.div
              key="drop"
              className="absolute rounded-full bg-inverse-bg"
              initial={{
                x: drop.x - drop.size / 2,
                y: drop.y - drop.size / 2,
                width: drop.size,
                height: drop.size,
                opacity: 1,
              }}
              animate={{
                x: (stage.current?.clientWidth ?? 0) / 2 - 6,
                y: box.h - 10,
                width: 12,
                height: 12,
              }}
              exit={{ opacity: 0 }}
              transition={
                reduce
                  ? { duration: 0 }
                  : { type: "spring", stiffness: 260, damping: 26 }
              }
            />
          ) : null}
        </AnimatePresence>
      </div>

      {/* the notch's face: the state icon and the label, unfiltered, and the
          box the drop is tested against. Above everything. */}
      <motion.div
        ref={notch}
        aria-live="polite"
        className="absolute top-0 left-1/2 z-30 flex -translate-x-1/2 flex-col items-center justify-center gap-1.5 text-inverse-text"
        initial={false}
        animate={{ width: box.w, height: box.h }}
        transition={spring}
      >
        <AnimatePresence mode="popLayout" initial={false}>
          {phase === "open" ? (
            <motion.span
              key="arrow"
              initial={{ opacity: 0, y: 6, scale: 0.8 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={quick}
              className="flex size-6 items-center justify-center rounded-full bg-inverse-fill ring-1 ring-inverse-stroke"
            >
              <ArrowUpIcon
                aria-hidden="true"
                className="size-3.5"
                weight="bold"
              />
            </motion.span>
          ) : phase === "over" ? (
            <motion.span
              key="go"
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={pop}
              className="flex size-6 items-center justify-center rounded-full text-inverse-bg"
              style={{ backgroundColor: GO }}
            >
              <ArrowUpIcon
                aria-hidden="true"
                className="size-3.5"
                weight="bold"
              />
            </motion.span>
          ) : phase === "captured" ? (
            <motion.span
              key="check"
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={pop}
              className="flex size-6 items-center justify-center rounded-full text-inverse-bg"
              style={{ backgroundColor: GO }}
            >
              <CheckIcon
                aria-hidden="true"
                className="size-3.5"
                weight="bold"
              />
            </motion.span>
          ) : null}
        </AnimatePresence>
        <span className="whitespace-nowrap font-medium text-meta">
          <TextMorph duration={200} ease="cubic-bezier(0.32, 0.72, 0, 1)">
            {notchLabel}
          </TextMorph>
        </span>
      </motion.div>

      {/* the page: four cards to pick up. The grid starts below the notch's
          widest open height, so an open notch hangs over air and never over a
          card. */}
      <ul className="absolute inset-x-0 top-28 bottom-0 grid content-start gap-4 overflow-y-auto px-6 pt-1 pb-6 sm:grid-cols-2 sm:px-8">
        <AnimatePresence initial={false}>
          {items.map((item, i) => (
            <motion.li
              key={item.id}
              layout
              initial={{ opacity: 0, y: 10, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={
                reduce
                  ? { duration: 0 }
                  : {
                      type: "spring",
                      stiffness: 420,
                      damping: 34,
                      /* put back one after another, so the page refills rather than snapping */
                      delay: i * 0.05,
                    }
              }
            >
              <button
                type="button"
                onPointerDown={(e) => lift(e, item.id)}
                onKeyDown={(e) => captureFromKey(e, item.id)}
                aria-label={`${item.title}. Press Enter to capture`}
                className={cn(
                  "block w-full cursor-grab touch-none rounded-lg transition-opacity duration-200 active:cursor-grabbing focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-primary/15 focus-visible:ring-offset-2",
                  lifted?.id === item.id && !settling && "opacity-30",
                )}
              >
                <Card item={item} />
              </button>
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>

      {/* the empty page. Not a grid item: while the last card is still
          leaving, a grid item sits in the row after it and jumps up when the
          card unmounts. This is centred in the page's own box and waits for
          the card to finish going. */}
      <AnimatePresence>
        {items.length === 0 ? (
          <motion.div
            key="empty"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6, transition: { duration: 0.12 } }}
            transition={
              reduce
                ? { duration: 0 }
                : { type: "spring", stiffness: 380, damping: 30, delay: 0.24 }
            }
            /* centred in the whole stage, not in the card area under the
               notch: against the box the eye reads, the card area's centre
               sits 48px low */
            className="absolute inset-0 z-10 flex items-center justify-center"
          >
            {/* icon only, so it carries a tooltip, per the shared rule */}
            <TooltipProvider delayDuration={200}>
              <Tooltip label="Put the cards back">
                <button
                  type="button"
                  aria-label="Put the cards back"
                  onClick={() => {
                    setItems(ITEMS);
                    setCount(0);
                  }}
                  className="inline-flex size-10 cursor-pointer items-center justify-center rounded-full bg-fill text-text-secondary transition-colors duration-200 hover:bg-fill-hover hover:text-text-primary active:bg-fill-active active:duration-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-primary/15 focus-visible:ring-offset-2"
                >
                  <ArrowCounterClockwiseIcon
                    aria-hidden="true"
                    className="size-4"
                  />
                </button>
              </Tooltip>
            </TooltipProvider>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {/* the card in your hand: a copy following the pointer, shrinking toward
          the hand over the notch and wearing a plus while it is there. Above
          everything, the notch included, the way a drag image sits over the
          thing it is about to be dropped on. */}
      {lifted && liftedItem ? (
        <motion.div
          aria-hidden="true"
          className="pointer-events-none absolute z-40"
          style={{
            left: lifted.box.x,
            top: lifted.box.y,
            width: lifted.box.w,
            height: lifted.box.h,
            transformOrigin: `${lifted.dx}px ${lifted.dy}px`,
            x: sx,
            y: sy,
            scale,
            opacity: phase === "captured" || settling ? 0 : 0.94,
            /* the fade waits for the spring to bring it most of the way home */
            transition: settling ? "opacity 180ms 160ms" : "opacity 200ms",
          }}
        >
          <Card item={liftedItem} className="shadow-stage" />
          <AnimatePresence>
            {phase === "over" ? (
              <motion.span
                key="plus"
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1.6, opacity: 1 }}
                exit={{ scale: 0, opacity: 0 }}
                transition={pop}
                className="absolute -right-3 -bottom-3 flex size-7 items-center justify-center rounded-full text-inverse-bg ring-2 ring-bg"
                style={{ backgroundColor: GO }}
              >
                <PlusIcon
                  aria-hidden="true"
                  className="size-3.5"
                  weight="bold"
                />
              </motion.span>
            ) : null}
          </AnimatePresence>
        </motion.div>
      ) : null}
    </div>
  );
}
