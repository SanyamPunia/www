"use client";

import {
  AnimatePresence,
  animate,
  motion,
  useMotionValue,
  useMotionValueEvent,
  useReducedMotion,
} from "motion/react";
import { useEffect, useId, useRef, useState } from "react";
import { TextMorph } from "torph/react";
import { cn } from "@/lib/utils";

/*
 * A pill of a nav bar that opens into a menu in two moves. It grows tall
 * first, a black slab rising off the bar with the bar's three controls still
 * pinned to its foot, then wide, and only once it is the size of a menu does
 * the menu arrive in it, the links one after another and the picture after
 * them. Closing is the same three moves backwards: the content leaves, the
 * slab narrows, then it sinks back into a pill.
 */

/* ─────────────────────────────────────────────────────────
 * STORYBOARD, opening
 *
 *    0ms   the bar. A pill, three controls on one row.
 *    0ms   height starts growing, width holds. The controls ride the foot.
 *  250ms   width starts growing while height is still landing.
 *  360ms   height lands.
 *  560ms   the panel starts fading in and the first link rises.
 *  610ms   width lands.
 *  760ms   the picture arrives.
 * 1100ms   settled.
 *
 * Closing runs it backwards: content out over 200ms, then width, then
 * height, the second move starting before the first has landed. A menu that
 * grew tall then wide has to shrink wide then short, or the shape on the way
 * out is a shape it never had on the way in.
 *
 * The two axes overlap by `lap`. Butted end to end, the box stopped dead at
 * the corner between the moves and started again, which read as two
 * animations rather than one shape unfolding. Starting the second move while
 * the first is in its last third turns the corner into a curve.
 * ───────────────────────────────────────────────────────── */

const TIMING = {
  /** one move of the box, height or width */
  grow: 0.36,
  /** how far into a move the next one starts */
  lap: 0.3,
  /** the wait between the box's second move starting and the content */
  settle: 0.06,
  /** one link's entrance */
  link: 0.42,
  /** between links */
  stagger: 0.05,
  /** the content leaving on close */
  leave: 0.2,
} as const;

/**
 * The bar's box and the menu's, in px. The bar is as wide as its three
 * controls want and no wider, since the second beat is the box growing from
 * that width to the menu's, and a bar already at the menu's width has no
 * second beat: the first build set both to 380 and the width never moved.
 */
const BAR = { w: 340, h: 56, r: 28, min: 252 };
const MENU = { w: 460, h: 300, r: 22 };

/**
 * `BAR.min` is measured, not chosen. Below `sm` the bar's row runs at `gap-2
 * px-3` and its three controls come to 250.5px: the brand at 49.9, the toggle
 * at 75.5, Get started at 93.1, two 6.4px gaps and 19.2px of padding. 252 is
 * the narrowest bar that does not clip Get started's right edge.
 *
 * It exists so a phone keeps the second beat. The bar has to be narrower than
 * the menu or the width tween has nowhere to go, which is the failure the
 * first build shipped with both boxes at 380.
 */

/**
 * Each link owns a picture, and hovering a link shows its picture. The
 * stills are this site's own lab clips, so the four pictures are four
 * things that exist. The first link's picture is the one the menu opens on.
 */
const LINKS = [
  { label: "Stickers", src: "/assets/labs/sticker-peel.webp" },
  { label: "Archive", src: "/assets/labs/folder-stack.webp" },
  { label: "Stamps", src: "/assets/labs/stamp-collection.webp" },
  { label: "Library", src: "/assets/labs/book-opening.webp" },
] as const;

/** how long one picture takes to give way to the next */
const SWAP = 0.18;

/**
 * The glyph beside the label is a drawing of the box, and it moves the way the
 * box does: a wide stadium at rest, then the height grows, then the width, and
 * the corner fills out into a squircle on the way. `glyphPath` writes the
 * outline in a 22 by 22 box for two progress values, one per axis, which are
 * the box's own two moves. The corner is drawn with cubic curves whose handles
 * sit at `k` of the radius: 0.55 is a circular arc, and 0.85 is the flatter,
 * fuller curve that reads as a squircle. A CSS border cannot draw that, which
 * is why this is an SVG.
 */
const GLYPH = 22;
function glyphPath(hp: number, wp: number): string {
  const w = 16 + 4 * wp;
  const h = 10 + 10 * hp;
  const x = (GLYPH - w) / 2;
  const y = (GLYPH - h) / 2;
  const t = (hp + wp) / 2;
  const r = Math.min(w, h) / 2 - t * 2.4;
  const k = 0.55 + 0.3 * t;
  const c = r * k;
  return [
    `M ${x + r} ${y}`,
    `H ${x + w - r}`,
    `C ${x + w - r + c} ${y} ${x + w} ${y + r - c} ${x + w} ${y + r}`,
    `V ${y + h - r}`,
    `C ${x + w} ${y + h - r + c} ${x + w - r + c} ${y + h} ${x + w - r} ${y + h}`,
    `H ${x + r}`,
    `C ${x + r - c} ${y + h} ${x} ${y + h - r + c} ${x} ${y + h - r}`,
    `V ${y + r}`,
    `C ${x} ${y + r - c} ${x + r - c} ${y} ${x + r} ${y}`,
    "Z",
  ].join(" ");
}

/** when the box's second move starts, measured from the first */
const second = TIMING.grow * (1 - TIMING.lap);

/**
 * One curve for the box and the content. It leaves slowly and arrives
 * slowly, with the speed in the middle, so neither end of a move is a step.
 * The earlier `[0.22, 1, 0.36, 1]` arrived hard, which is right for a hover
 * and wrong for a box the eye is following.
 */
const EASE = [0.4, 0, 0.2, 1] as const;

export default function IslandMenu() {
  const reduce = useReducedMotion();
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const menu = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  /** how wide the menu may open, the constant or the stage, whichever is less */
  const [room, setRoom] = useState(MENU.w);

  useEffect(() => {
    const el = stage.current;
    if (!el) return;
    const fit = () =>
      setRoom(Math.min(MENU.w, el.getBoundingClientRect().width));
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  /* Escape closes, from anywhere on the page */
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const instant = { duration: 0 };
  const move = { duration: TIMING.grow, ease: EASE };

  /*
   * The label follows the box, not the press. It swaps to Close as the box
   * lands tall and back to Menu as it lands short, so the word on the button
   * describes the shape it sits in rather than the state it was just told.
   */
  const [label, setLabel] = useState<"Menu" | "Close">("Menu");
  /** which link's picture is showing */
  const [shown, setShown] = useState(0);

  /*
   * The glyph's two axes, motion values written to the path each frame rather
   * than through a render. They run on the box's own clocks: height then width
   * on open, width then height on close, lapped the same way.
   */
  const glyphH = useMotionValue(0);
  const glyphW = useMotionValue(0);
  const glyphPathRef = useRef<SVGPathElement>(null);
  const drawGlyph = () => {
    glyphPathRef.current?.setAttribute(
      "d",
      glyphPath(glyphH.get(), glyphW.get()),
    );
  };
  useMotionValueEvent(glyphH, "change", drawGlyph);
  useMotionValueEvent(glyphW, "change", drawGlyph);
  useEffect(() => {
    const to = open ? 1 : 0;
    const tween = reduce
      ? { duration: 0 }
      : { duration: TIMING.grow, ease: EASE };
    const heightDelay = reduce ? 0 : open ? 0 : TIMING.leave + second;
    const widthDelay = reduce ? 0 : open ? second : TIMING.leave;
    const h = animate(glyphH, to, { ...tween, delay: heightDelay });
    const w = animate(glyphW, to, { ...tween, delay: widthDelay });
    return () => {
      h.stop();
      w.stop();
    };
  }, [open, reduce, glyphH, glyphW]);
  useEffect(() => {
    const wait = reduce
      ? 0
      : (open ? second : TIMING.leave + second + TIMING.grow * 0.5) * 1000;
    const id = setTimeout(() => setLabel(open ? "Close" : "Menu"), wait);
    return () => clearTimeout(id);
  }, [open, reduce]);

  /*
   * The box is two tweens in sequence, not one, and the order flips with the
   * direction. Opening: height, then width after `grow`. Closing: width first,
   * then height after `grow`. A spring would run them together.
   */
  const box = open
    ? {
        height: { ...move, delay: 0 },
        width: { ...move, delay: second },
        borderRadius: { ...move, delay: 0 },
      }
    : {
        width: { ...move, delay: TIMING.leave },
        height: { ...move, delay: TIMING.leave + second },
        borderRadius: { ...move, delay: TIMING.leave + second },
      };

  /** when the content may start, on open: as the width move is landing */
  const contentIn = second + TIMING.grow * (1 - TIMING.lap) + TIMING.settle;

  /*
   * The two widths, both derived from the room rather than taken from the
   * constants.
   *
   * The bar keeps its share of the menu's width, so a narrow stage shrinks
   * both and the second beat survives instead of being squeezed out: at the
   * 313px a 390px phone leaves, the menu opens to 313 and the bar sits at its
   * 252 floor, which is 61px of travel. `barW` is capped at `menuW` as well,
   * so a stage narrower than the floor degrades to one move rather than
   * overflowing.
   */
  const menuW = Math.min(MENU.w, room);
  const barW = Math.min(
    menuW,
    Math.max(BAR.min, Math.min(BAR.w, Math.round(menuW * (BAR.w / MENU.w)))),
  );

  return (
    <div
      ref={stage}
      /*
       * `min-w-0` is what makes the measurement above mean anything.
       *
       * Without it the stage is a flex item at `min-width: auto`, so its used
       * width is its own min-content, and its min-content is the box's inline
       * width. The box was 340px, so the stage became 340px, so the room read
       * 340px, so `Math.min` never bound and the bar stayed 340 however narrow
       * the frame was. Measured on a 390px viewport: a 351.6px frame, a 340px
       * stage whose right edge sat 7.6px past the frame's border, and on a
       * 360px one the page scrolled 18px sideways. The ruler was elastic and
       * it was being stretched by the thing it was measuring.
       */
      className="flex h-114 w-full min-w-0 items-end justify-center pb-10"
    >
      <motion.div
        ref={menu}
        initial={false}
        animate={{
          width: open ? menuW : barW,
          height: open ? MENU.h : BAR.h,
          borderRadius: open ? MENU.r : BAR.r,
        }}
        transition={reduce ? instant : box}
        /* Both widths come from `room`, which is the stage's width and is
           only trustworthy because the stage carries `min-w-0`. `max-w-full`
           here does not hold it: a flex item's `min-width: auto` lets the
           child's width win, which is the same rule that made the stage lie
           about how much room there was. */
        className="relative overflow-hidden bg-inverse-bg text-inverse-text"
      >
        {/* the menu, in the room above the bar */}
        <motion.div
          id={panelId}
          aria-hidden={!open}
          initial={false}
          animate={{ opacity: open ? 1 : 0 }}
          transition={
            reduce
              ? instant
              : open
                ? { duration: 0.26, ease: EASE, delay: contentIn }
                : { duration: TIMING.leave, ease: EASE }
          }
          className={cn(
            "absolute inset-x-0 top-0 grid gap-6 p-7 pb-0",
            /* one column below sm: the picture ran off a 340px menu's edge */
            "grid-cols-1 sm:grid-cols-[auto_1fr]",
            !open && "pointer-events-none",
          )}
          style={{ height: MENU.h - BAR.h }}
        >
          <ul className="flex flex-col gap-1">
            {LINKS.map(({ label }, i) => (
              <motion.li
                key={label}
                initial={false}
                animate={
                  open
                    ? { opacity: 1, y: 0, filter: "blur(0px)" }
                    : { opacity: 0, y: 10, filter: "blur(4px)" }
                }
                transition={
                  reduce
                    ? instant
                    : open
                      ? {
                          duration: TIMING.link,
                          ease: EASE,
                          delay: contentIn + i * TIMING.stagger,
                        }
                      : { duration: TIMING.leave, ease: EASE }
                }
              >
                {/* buttons, since a menu on a stage goes nowhere and an anchor
                    with a dead href is a lie to the keyboard */}
                {/* hover and focus both pick the picture, so the keyboard
                    sees the same swap the pointer does. The link the pointer
                    is on holds full ink and the rest step back, so the list
                    says which picture is showing. */}
                <button
                  type="button"
                  tabIndex={open ? 0 : -1}
                  onPointerEnter={() => setShown(i)}
                  onFocus={() => setShown(i)}
                  className={cn(
                    "block cursor-pointer text-left leading-tight transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inverse-text/30 focus-visible:ring-offset-2 focus-visible:ring-offset-inverse-bg",
                    shown === i
                      ? "text-inverse-text"
                      : "text-inverse-text-secondary hover:text-inverse-text",
                  )}
                  style={{ fontSize: "1.6rem" }}
                >
                  {label}
                </button>
              </motion.li>
            ))}
            <motion.li
              initial={false}
              animate={open ? { opacity: 1, y: 0 } : { opacity: 0, y: 8 }}
              transition={
                reduce
                  ? instant
                  : open
                    ? {
                        duration: TIMING.link,
                        ease: EASE,
                        delay: contentIn + LINKS.length * TIMING.stagger,
                      }
                    : { duration: TIMING.leave, ease: EASE }
              }
              className="mt-2"
            >
              <button
                type="button"
                tabIndex={open ? 0 : -1}
                className="cursor-pointer text-body text-inverse-text-secondary transition-colors duration-200 hover:text-inverse-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inverse-text/30 focus-visible:ring-offset-2 focus-visible:ring-offset-inverse-bg"
              >
                Contact
              </button>
            </motion.li>
          </ul>

          {/* the picture, last to arrive and first to go */}
          <motion.div
            initial={false}
            animate={
              open
                ? { opacity: 1, scale: 1, y: 0 }
                : { opacity: 0, scale: 0.96, y: 8 }
            }
            transition={
              reduce
                ? instant
                : open
                  ? {
                      duration: TIMING.link + 0.1,
                      ease: EASE,
                      delay: contentIn + 2 * TIMING.stagger,
                    }
                  : { duration: TIMING.leave, ease: EASE }
            }
            className="relative hidden min-w-0 overflow-hidden rounded-lg bg-inverse-fill ring-1 ring-inverse-stroke ring-inset sm:block"
          >
            {/*
             * A crossfade, not a fade out and in. `mode="sync"` keeps the
             * old picture mounted while the new one arrives, both absolute
             * in the same frame, so the box is never empty between them. The
             * incoming picture also comes in a touch large and settles, which
             * is what says a new thing arrived rather than the old one
             * changing colour.
             */}
            <AnimatePresence initial={false} mode="sync">
              {/* biome-ignore lint/performance/noImgElement: stills already on disk, painted into a 170px box */}
              <motion.img
                key={LINKS[shown].src}
                src={LINKS[shown].src}
                alt=""
                draggable={false}
                initial={{ opacity: 0, scale: 1.04 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                transition={reduce ? instant : { duration: SWAP, ease: EASE }}
                className="absolute inset-0 size-full select-none object-cover"
              />
            </AnimatePresence>
          </motion.div>
        </motion.div>

        {/* the bar, pinned to the foot so it rides the growing box */}
        <div
          /* tighter below sm, which is what lets the bar reach `BAR.min`
             and keep a second beat on a phone */
          className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 px-3 sm:gap-4 sm:px-4"
          style={{ height: BAR.h }}
        >
          <span className="font-mono text-body font-semibold tracking-tight text-inverse-text sm:pl-2 [text-transform:none]">
            SANYAM
          </span>

          <button
            type="button"
            aria-expanded={open}
            aria-controls={panelId}
            /* torph renders the label as aria-hidden character spans, so the
               button has no name of its own without this */
            aria-label={open ? "Close the menu" : "Open the menu"}
            onClick={() => setOpen((o) => !o)}
            className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-full px-3 text-action font-medium text-inverse-text-secondary transition-colors duration-200 hover:text-inverse-text aria-expanded:text-inverse-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inverse-text/30 focus-visible:ring-offset-2 focus-visible:ring-offset-inverse-bg"
          >
            {/* the glyph is a drawing of the box, a stadium that grows into a
                squircle as the box opens, on the box's own clocks. The flex row
                centres it on the line box, and a lowercase word's centre is its
                x-height centre, which for Inter at 1.5 leading sits 0.09em lower
                (baseline at 1.113em, x-height 0.546em, line centre at 0.75em) */}
            <svg
              aria-hidden="true"
              viewBox={`0 0 ${GLYPH} ${GLYPH}`}
              className="relative top-[0.09em] size-5 shrink-0"
            >
              <path
                ref={glyphPathRef}
                d={glyphPath(0, 0)}
                fill="none"
                stroke="currentColor"
                strokeWidth={1.5}
              />
            </svg>
            <TextMorph duration={320} ease="cubic-bezier(0.4, 0, 0.2, 1)">
              {label}
            </TextMorph>
          </button>

          <button
            type="button"
            /* the ring is white at alpha, not `inverse-stroke`: that token is
               1.13:1 on the button's own fill and the edge vanished. 20% lands
               at 1.85:1, an edge that reads without becoming a stripe. Light
               on a dark ground, the document pocket's rule, not palette. */
            className="inline-flex h-10 cursor-pointer items-center rounded-full bg-inverse-fill px-4 text-action font-medium text-inverse-text ring-1 ring-inverse-text/20 ring-inset transition-colors duration-200 hover:bg-inverse-stroke hover:ring-inverse-text/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inverse-text/30 focus-visible:ring-offset-2 focus-visible:ring-offset-inverse-bg"
          >
            Get started
          </button>
        </div>
      </motion.div>
    </div>
  );
}
