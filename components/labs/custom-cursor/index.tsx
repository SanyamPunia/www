"use client";

import { gsap } from "gsap";
import Link from "next/link";
import type { PointerEvent } from "react";
import { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { getLabBySlug } from "@/lib/labs";
import { approach } from "@/lib/lerp";

/*
 * A gallery of four cards under a cursor of its own. Crossing into the stage
 * swaps the arrow for a dot that follows the hand a beat behind, and hovering a
 * card grows the dot into a pill naming the lab the card opens. Moving to the
 * next card morphs the name rather than popping it out and back in, and the
 * pill leans with the speed of the chase.
 *
 * This is the one lab on GSAP. Two positions, not one: the hand is where the
 * browser says it is, and the drawn cursor is a tween chasing that point,
 * retargeted by `quickTo` on every move, so it arrives a beat late and settles
 * rather than stopping dead. The lean is read off that chase on GSAP's ticker.
 *
 * The dot and the pill are one element. The pill is always there, and a clip
 * decides how much of it shows: a 3.2px hole at rest, which is the dot, and
 * the whole pill over a card. Nothing scales, and there is no torph here:
 * torph sizes its box from `getBoundingClientRect`, which is the transformed
 * rect, so a pill measured mid-scale got a background a fraction of its word's
 * width, and a leaning pill measured half as tall again. A word change is a
 * width tween read off `offsetWidth`, which no transform touches.
 */

/** the cards, one lab still each. The registry supplies the name and the link */
const PICKS = [
  "stamp-collection",
  "sticker-peel",
  "window-shade",
  "document-pocket",
] as const;

const cards = PICKS.flatMap((slug) => {
  const lab = getLabBySlug(slug);
  return lab ? [lab] : [];
});

/**
 * The badge's hue over each card, drawn from the still it names: the stamps'
 * cobalt, the lightning sticker's amber, the shade's sky and a coral for the
 * pocket. The twelfth lab to scope a hue, on the same claim as the others: the
 * colour says which card the pointer is on. The dot stays `text-primary`, and
 * the pill mixes into its hue as it opens and back as it closes. Each text
 * colour clears 4.5:1 on its pill: 6.13, 9.26, 8.92 and 6.79.
 */
const TONE: Record<(typeof PICKS)[number], { bg: string; fg: string }> = {
  "stamp-collection": { bg: "#2857d6", fg: "#ffffff" },
  "sticker-peel": { bg: "#f0b323", fg: "#1a1a1a" },
  "window-shade": { bg: "#6cc3f5", fg: "#1a1a1a" },
  "document-pocket": { bg: "#ff7a5c", fg: "#1a1a1a" },
};

/**
 * The chase. `quickTo` keeps one tween per axis and retargets it on every
 * move, so the drawn cursor always heads for the latest point from wherever
 * it is. `expo.out` covers most of the gap at once and spends the rest of the
 * duration settling, which is what reads as smooth: a linear or a stiff ease
 * is the arrow with a frame of lag added.
 */
const FOLLOW = { duration: 0.6, ease: "expo.out" } as const;

/**
 * The dot is the pill seen through a 6.4px hole, the size of a `size-2` on
 * this scale. Opening grows that hole into the pill's own box as a window
 * with fully round corners, so what the eye sees is a small pill inflating
 * into the badge and revealing its word from the middle out. A circle was the
 * first shape and it read as a pop: a circle covers a wide pill long before
 * its radius reaches the corners, so the visible part of the open was the
 * first 50ms of the tween, and a circle growing out of a pill is a wipe
 * rather than a badge expanding. The window's edges reach the box exactly at
 * the tween's end, so the whole duration is visible growth. `power3.out` over
 * 220ms is the snappy end of watchable: a quarter of the width lands in the
 * first frame and the rest arrives over the next ten. 400ms read as slow and
 * 300 as soft, and a 280ms circle that showed for three frames read as a
 * pop, which is the other side of the line.
 */
const DOT = 3.2;
const OPEN = { duration: 0.22, ease: "power3.out" } as const;
const CLOSE = { duration: 0.14, ease: "power2.out" } as const;
/** the fade at the stage's edge, where the cursor comes and goes */
const FADE = { duration: 0.15, ease: "power2.out" } as const;
/** a word replacing another while the pill is open: the box tweens to the
 * new width and the new word rises into it */
const SWAP = { duration: 0.2, ease: "power2.out" } as const;
/** the resting hole, independent of the word's width */
const HOLE = `circle(${DOT}px at 50% 50%)`;
/**
 * Where on the window's progress the word fades in and out. The hole sits at
 * the pill's centre, which is the middle of the word, so a word left visible
 * showed white strokes through the dot after every hover and read as a
 * glyph inside it. Below a quarter open the word is gone, so the dot is
 * solid, and it is whole by 60%, when the window is about half the pill.
 */
const WORD = { from: 0.25, to: 0.6 } as const;
/**
 * The window at a progress from 0, the hole, to 1, the whole box. Written
 * from a number every frame rather than tweened as a string: GSAP reads a
 * tween's start value back off the element, and the browser normalises
 * `inset()` to its shortest form, so a start written with four insets came
 * back with two and an all-zero end with one. GSAP then paired the numbers by
 * position, the right inset went to zero on the first frame and the corner
 * radius tweened toward an inset, and the pill opened from its left edge in
 * one jump. A number cannot be normalised.
 */
const windowAt = (el: HTMLElement, t: number) => {
  if (t <= 0) return HOLE;
  const y = Math.max(0, el.offsetHeight / 2 - DOT) * (1 - t);
  const x = Math.max(0, el.offsetWidth / 2 - DOT) * (1 - t);
  return `inset(${y}px ${x}px round 999px)`;
};

/**
 * The lean: degrees per px/s of the chase and a clamp. Stronger per px/s than
 * `event-stacking`'s 1/180, since an `expo.out` chase moves slower than the
 * hand for most of a sweep and read 4 degrees at the old rate. The velocity
 * is smoothed and the angle approaches its target on a time constant, so a
 * stop swings the pill level rather than snapping it.
 */
const LEAN_PER_PX = 1 / 120;
const LEAN_MAX = 12;
/** seconds. How long the lean takes to close most of the gap to its target */
const LEAN_TAU = 0.08;
/** seconds. How long the velocity estimate remembers the last frame */
const VEL_TAU = 0.05;

/** a pointer that hovers. A touch has no hover to take a cursor from */
const hovers = (event: PointerEvent) =>
  event.pointerType === "mouse" || event.pointerType === "pen";

const clamp = (v: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, v));

type Follow = { x: gsap.QuickToFunc; y: gsap.QuickToFunc };

export default function CustomCursor() {
  const stage = useRef<HTMLDivElement>(null);
  const root = useRef<HTMLDivElement>(null);
  const pill = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);
  /*
   * The pill's word. It stays through a close, so the pill never empties
   * mid-exit, and it is written with `flushSync` so the box can be measured
   * on the same tick the word changes.
   */
  const [text, setText] = useState("");
  const word = useRef<HTMLSpanElement>(null);
  /* whether the pill is open or still closing, read by the handlers */
  const pillOpen = useRef(false);
  /* the window's progress, the one thing GSAP tweens for the clip */
  const clip = useRef({ t: 0 });

  /* read in an effect, since the setting is the reader's and not the server's */
  const reduce = useRef(false);
  const follow = useRef<Follow | null>(null);
  /* the dot's colours, read off the tokens at mount since a tween cannot take a var() */
  const rest = useRef({ bg: "#1a1a1a", fg: "#ffffff" });

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const read = () => {
      reduce.current = query.matches;
    };
    read();
    query.addEventListener("change", read);
    const tokens = getComputedStyle(document.documentElement);
    rest.current = {
      bg: tokens.getPropertyValue("--color-text-primary").trim(),
      fg: tokens.getPropertyValue("--color-bg").trim(),
    };
    const ctx = gsap.context(() => {
      follow.current = {
        x: gsap.quickTo(el, "x", FOLLOW),
        y: gsap.quickTo(el, "y", FOLLOW),
      };
    });
    return () => {
      query.removeEventListener("change", read);
      follow.current = null;
      gsap.killTweensOf(clip.current);
      ctx.revert();
    };
  }, []);

  /*
   * The hand is read once a frame, at the front of GSAP's tick, however many
   * `pointermove`s arrived. The stage's rect is a layout read, and taking it
   * between the tweens' own writes forces a layout per event at 120Hz.
   */
  const hand = useRef<{ x: number; y: number; jump: boolean } | null>(null);
  const write = useRef(() => {
    const h = hand.current;
    const rect = stage.current?.getBoundingClientRect();
    const to = follow.current;
    if (!h || !rect || !to) return;
    hand.current = null;
    const x = h.x - rect.left;
    const y = h.y - rect.top;
    // a fresh cursor appears under the hand rather than flying in from
    // wherever the last one was left, and reduced motion sits on it always
    if (h.jump || reduce.current) {
      to.x(x, x);
      to.y(y, y);
    } else {
      to.x(x);
      to.y(y);
    }
  });
  const place = (event: PointerEvent, jump: boolean) => {
    const queued = hand.current !== null;
    hand.current = {
      x: event.clientX,
      y: event.clientY,
      jump: jump || (hand.current?.jump ?? false),
    };
    if (!queued) gsap.ticker.add(write.current, true, true);
  };

  /*
   * The lean, on the ticker while the cursor is out. It reads the drawn
   * cursor's own x, so what tips the pill is the chase and not the hand, and
   * it is off the ticker at rest so an idle page requests no frames.
   */
  useEffect(() => {
    const el = root.current;
    const p = pill.current;
    if (!shown || !el || !p) return;
    let prev = Number(gsap.getProperty(el, "x"));
    let velocity = 0;
    let angle = 0;
    const tick = (_time: number, deltaMs: number) => {
      const dt = Math.min(deltaMs, 50) / 1000;
      if (dt <= 0) return;
      const x = Number(gsap.getProperty(el, "x"));
      velocity += ((x - prev) / dt - velocity) * approach(VEL_TAU, dt);
      prev = x;
      const target = reduce.current
        ? 0
        : clamp(velocity * LEAN_PER_PX, -LEAN_MAX, LEAN_MAX);
      const next = angle + (target - angle) * approach(LEAN_TAU, dt);
      if (Math.abs(next - angle) < 0.005 && Math.abs(next) < 0.005) return;
      angle = next;
      gsap.set(p, { rotation: angle });
    };
    gsap.ticker.add(tick);
    return () => {
      gsap.ticker.remove(tick);
      gsap.set(p, { rotation: 0 });
    };
  }, [shown]);

  /*
   * The clip is driven from the handlers, never through state and an effect.
   * A hover that goes event, render, commit, passive effect, tween is two to
   * three frames before anything moves, which is the lag `stamp-collection`
   * measured on its lift, and here it was on every dot-to-chip change.
   */
  const seconds = (d: number) => (reduce.current ? 0 : d);
  const paint = () => {
    const p = pill.current;
    if (!p) return;
    const t = clip.current.t;
    p.style.clipPath = windowAt(p, t);
    const word = p.firstElementChild;
    if (word instanceof HTMLElement) {
      word.style.opacity = String(
        clamp((t - WORD.from) / (WORD.to - WORD.from), 0, 1),
      );
    }
  };
  const tint = (colours: { bg: string; fg: string }, duration: number) => {
    const p = pill.current;
    if (!p) return;
    gsap.to(p, {
      backgroundColor: colours.bg,
      color: colours.fg,
      duration: seconds(duration),
      ease: OPEN.ease,
      overwrite: "auto",
    });
  };
  const openPill = (tone: { bg: string; fg: string }) => {
    pillOpen.current = true;
    tint(tone, OPEN.duration);
    gsap.to(clip.current, {
      t: 1,
      duration: seconds(OPEN.duration),
      ease: OPEN.ease,
      overwrite: "auto",
      onUpdate: paint,
    });
  };
  const closePill = () => {
    tint(rest.current, CLOSE.duration);
    gsap.to(clip.current, {
      t: 0,
      duration: seconds(CLOSE.duration),
      ease: CLOSE.ease,
      overwrite: "auto",
      onUpdate: paint,
      onComplete: () => {
        // back to the width-independent hole, so a word swapped while the
        // pill is shut cannot move or resize the dot
        pillOpen.current = false;
        paint();
      },
    });
  };
  const show = () => {
    const el = root.current;
    if (!el) return;
    gsap.to(el, {
      autoAlpha: 1,
      duration: seconds(FADE.duration),
      ease: FADE.ease,
      overwrite: "auto",
    });
  };
  const hide = () => {
    const el = root.current;
    const p = pill.current;
    if (!el || !p) return;
    gsap.to(el, {
      autoAlpha: 0,
      duration: seconds(FADE.duration),
      ease: FADE.ease,
      overwrite: "auto",
      onComplete: () => {
        gsap.killTweensOf(clip.current);
        clip.current.t = 0;
        pillOpen.current = false;
        paint();
        gsap.set(p, {
          backgroundColor: rest.current.bg,
          color: rest.current.fg,
        });
      },
    });
  };

  /*
   * A card's leave is answered one frame out, so crossing straight from one
   * card to its neighbour swaps the name instead of shrinking the pill and
   * growing it again. `folder-stack` makes the same call for its pile.
   */
  const clearing = useRef(0);
  const enterCard = (
    event: PointerEvent,
    title: string,
    tone: { bg: string; fg: string },
  ) => {
    if (!hovers(event)) return;
    cancelAnimationFrame(clearing.current);
    const p = pill.current;
    const w = word.current;
    const swapping = pillOpen.current && title !== text;
    const from = p?.offsetWidth ?? 0;
    // the word is committed before anything moves, so the box can be measured
    // now and the open's first frame carries the new word. `pointerenter` is a
    // continuous event to React, and without the flush the render lands a
    // frame after the tween.
    flushSync(() => setText(title));
    if (swapping && p && w) {
      // from the old width to the new one, both read off the layout box, and
      // the box goes back to sizing itself when the tween lands
      gsap.fromTo(
        p,
        { width: from },
        {
          width: p.offsetWidth,
          duration: seconds(SWAP.duration),
          ease: SWAP.ease,
          clearProps: "width",
          overwrite: "auto",
        },
      );
      // only when the window is open. While it is still opening, `paint`
      // owns the word's opacity and the two would fight
      if (clip.current.t >= 1) {
        gsap.fromTo(
          w,
          { opacity: 0, y: 3 },
          {
            opacity: 1,
            y: 0,
            duration: seconds(SWAP.duration),
            ease: SWAP.ease,
            overwrite: "auto",
          },
        );
      }
    }
    openPill(tone);
  };
  const leaveCard = () => {
    cancelAnimationFrame(clearing.current);
    clearing.current = requestAnimationFrame(closePill);
  };

  return (
    <div
      ref={stage}
      onPointerEnter={(event) => {
        if (!hovers(event)) return;
        place(event, true);
        show();
        setShown(true);
      }}
      onPointerMove={(event) => {
        if (!hovers(event)) return;
        place(event, !shown);
        if (!shown) {
          show();
          setShown(true);
        }
      }}
      onPointerLeave={(event) => {
        if (!hovers(event)) return;
        cancelAnimationFrame(clearing.current);
        hide();
        setShown(false);
      }}
      /*
       * `cursor-none` on the whole subtree, the call `tether-button` documents:
       * `cursor` inherits, but the UA stylesheet sets a real `cursor` on links,
       * which beats an inherited value, so the arrow would come back over the
       * one thing being pointed at.
       */
      className="relative flex h-140 w-full cursor-none select-none items-center justify-center overflow-hidden rounded-lg bg-bg px-6 ring-1 ring-stroke ring-inset [&_*]:cursor-none"
    >
      {/* the cards take a third less than the column so the dot has ground to
          float on before it reaches one. Measured: 93px of stage either side
          and 108px above and below on a wide column */}
      <div className="grid w-full max-w-110 grid-cols-2 gap-10">
        {cards.map((lab) => (
          <Link
            key={lab.slug}
            href={`/lab/${lab.slug}`}
            onPointerEnter={(event) =>
              enterCard(
                event,
                lab.title,
                TONE[lab.slug as (typeof PICKS)[number]],
              )
            }
            onPointerLeave={leaveCard}
            className="relative block aspect-8/5 overflow-hidden rounded-lg bg-fill ring-1 ring-stroke transition-all duration-200 hover:ring-stroke-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-primary/15 focus-visible:ring-offset-2"
          >
            {/* biome-ignore lint/performance/noImgElement: stills already on disk, painted into a card a quarter of the column wide */}
            <img
              src={`/assets/labs/${lab.slug}.webp`}
              alt={lab.title}
              draggable={false}
              className="size-full select-none object-cover"
            />
          </Link>
        ))}
      </div>

      {/* the drawn cursor. Transparent to the pointer, or it would take the
          hover away from the card under it */}
      <div
        ref={root}
        aria-hidden="true"
        style={{ opacity: 0, visibility: "hidden" }}
        className="pointer-events-none absolute top-0 left-0 z-10"
      >
        <div
          ref={pill}
          style={{ clipPath: HOLE }}
          className="absolute top-0 left-0 -translate-1/2 whitespace-nowrap rounded-full bg-text-primary px-3 py-1.5 text-action font-medium text-bg ring-1 ring-bg/20"
        >
          {/* hidden until the window has room for it, see `WORD` */}
          <span ref={word} style={{ opacity: 0 }} className="inline-block">
            {text}
          </span>
        </div>
      </div>
    </div>
  );
}
