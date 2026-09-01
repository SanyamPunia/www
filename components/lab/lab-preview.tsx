"use client";

import {
  AnimatePresence,
  motion,
  useReducedMotion,
  useSpring,
} from "motion/react";
import type React from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

/**
 * The clip the index plays beside the pointer, and the hit testing that decides
 * which one.
 *
 * A row's title says what an experiment is called and nothing about what it
 * does, and every one of them answers to a gesture, so there is no still that
 * shows it. `scripts/record-lab-previews.mjs` records the real thing being
 * used, and this plays it.
 *
 * Two things follow from wanting the preview to change on a scroll as well as
 * on a move, and they are most of the file:
 *
 * - **One `pointermove` on the list, tested against measured bands**, never a
 *   `pointerenter` per row. Scrolling moves the list under a pointer that has
 *   not moved, so no pointer event fires at all, and per-row events cannot
 *   express "the row under the cursor changed because the page did". The same
 *   test answers both, off the last known pointer position.
 * - **The bands are page coordinates and the pointer is viewport
 *   coordinates**, since a scroll changes one and not the other. The rows are a
 *   static list, so they are measured once on the first move and again on a
 *   resize.
 *
 * The row's own highlight is written from that same test rather than left to
 * `:hover`. A browser is not required to re-run `:hover` until the pointer
 * moves again, so on a scroll the mark and the clip could disagree about which
 * row is being read, which is the one thing this cannot do.
 */

/**
 * The card is `h-60 w-96`, which on this scale is 307.2 by 192, and the clips
 * are encoded 8:5 to match. Restated as numbers because the placement is
 * arithmetic against the viewport rather than layout. The two move together.
 */
const CARD = { w: 307.2, h: 192 };

/** Below and right of the pointer, and never under it. */
const GAP = { x: 18, y: 14 };
const EDGE = 12;

const FOLLOW = { stiffness: 520, damping: 42, mass: 0.6 };

/**
 * Critically damped, so a swap does not overshoot into a bounce. What the card
 * is doing is replacing one clip with the next, not throwing it.
 */
const SWAP = { type: "spring" as const, stiffness: 380, damping: 40 };

const OPEN = { duration: 0.18, ease: "easeOut" as const };

/**
 * How long a row has to be the one under the pointer before its clip is
 * fetched, in ms.
 *
 * Without it a single flick down the list mounts a video per row and pulls every
 * clip in the directory, which is 772KB and twenty decoders for a gesture that
 * was on its way somewhere else. Measured on a 20 row sweep: 19 clips requested
 * before, 1 after. The row's own mark is not deferred, since that is the
 * affordance and the clip is only the payload, and 55ms is under the threshold
 * where a hover reads as delayed at all.
 */
const SETTLE = 55;

/**
 * The outgoing clip leaves the way the pointer is travelling and the incoming
 * one arrives behind it, so moving down the list runs both upward. The card
 * clips, so the two are on screen together through the swap, which is what
 * makes it read as one strip moving rather than as a cut.
 */
const SLIDE = {
  enter: (down: boolean) => ({ y: down ? "100%" : "-100%" }),
  center: { y: "0%" },
  exit: (down: boolean) => ({ y: down ? "-100%" : "100%" }),
};

type Band = { slug: string; node: HTMLElement; top: number; bottom: number };

type Active = { slug: string; index: number; down: boolean };

export function LabPreview({
  previews,
  children,
}: {
  /** the slugs with a recorded clip, from `labPreviewSlugs()` */
  previews: string[];
  children: React.ReactNode;
}) {
  const recorded = useMemo(() => new Set(previews), [previews]);
  const listRef = useRef<HTMLDivElement>(null);
  const bandsRef = useRef<Band[]>([]);
  const sidesRef = useRef<{ left: number; right: number } | null>(null);
  const pointerRef = useRef<{ x: number; y: number } | null>(null);
  const markedRef = useRef<HTMLElement | null>(null);
  const openRef = useRef(false);
  const shownRef = useRef<string | null>(null);
  const pendingRef = useRef<string | null>(null);
  const timerRef = useRef<number | null>(null);
  const [active, setActive] = useState<Active | null>(null);
  const [mounted, setMounted] = useState(false);

  const reduced = useReducedMotion();
  const x = useSpring(0, FOLLOW);
  const y = useSpring(0, FOLLOW);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    const list = listRef.current;
    if (list === null) return;

    const measure = () => {
      const rows = [...list.querySelectorAll<HTMLElement>("[data-lab-slug]")];
      const scroll = window.scrollY;
      const bands = rows.map((node) => {
        const rect = node.getBoundingClientRect();
        return {
          slug: node.dataset.labSlug ?? "",
          node,
          top: rect.top + scroll,
          bottom: rect.bottom + scroll,
        };
      });

      // Hand each gap to whichever row it is nearer, so a pointer crossing the
      // 3.2px between two rows is always on one of them. Left as a real gap the
      // preview blinks shut and open again on the way past, and a scroll can
      // land in it and close the card under a stationary pointer.
      for (let i = 0; i < bands.length - 1; i += 1) {
        const seam = (bands[i].bottom + bands[i + 1].top) / 2;
        bands[i].bottom = seam;
        bands[i + 1].top = seam;
      }

      bandsRef.current = bands;

      // The sides are the rows' own, never the container's. A row is the whole
      // `-mx-4` pill, which reaches 12.8px past the column this sits in, so a
      // pointer on the outer edge of a row is outside the wrapper and inside
      // the thing it is pointing at.
      const box = rows[0]?.getBoundingClientRect();
      sidesRef.current =
        box === undefined ? null : { left: box.left, right: box.right };
    };

    const hit = (clientX: number, clientY: number) => {
      const sides = sidesRef.current;
      if (sides === null) return -1;
      if (clientX < sides.left || clientX > sides.right) return -1;
      const page = clientY + window.scrollY;
      return bandsRef.current.findIndex(
        (band) => page >= band.top && page < band.bottom,
      );
    };

    const mark = (node: HTMLElement | null) => {
      if (markedRef.current === node) return;
      if (markedRef.current !== null) delete markedRef.current.dataset.active;
      if (node !== null) node.dataset.active = "true";
      markedRef.current = node;
    };

    /** Beside the pointer, flipped rather than clamped when there is no room. */
    const place = (clientX: number, clientY: number, snap: boolean) => {
      const right = window.innerWidth - clientX - GAP.x - EDGE >= CARD.w;
      const below = window.innerHeight - clientY - GAP.y - EDGE >= CARD.h;
      const next = {
        x: Math.max(EDGE, right ? clientX + GAP.x : clientX - GAP.x - CARD.w),
        y: Math.max(EDGE, below ? clientY + GAP.y : clientY - GAP.y - CARD.h),
      };
      // A fresh card is put where the pointer already is. Letting the spring
      // travel there means it flies in from the last row read, or from the
      // corner on the first open.
      if (snap || reduced) {
        x.jump(next.x);
        y.jump(next.y);
      } else {
        x.set(next.x);
        y.set(next.y);
      }
    };

    const cancel = () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
      timerRef.current = null;
      pendingRef.current = null;
    };

    const close = () => {
      cancel();
      openRef.current = false;
      shownRef.current = null;
      setActive(null);
    };

    const aim = (clientX: number, clientY: number, moved: boolean) => {
      const index = hit(clientX, clientY);
      const band = index < 0 ? null : bandsRef.current[index];
      mark(band?.node ?? null);

      // An open card follows the pointer whatever it is showing, so a swap
      // being held never holds the card still as well.
      if (openRef.current && moved) place(clientX, clientY, false);

      const slug = band !== null && recorded.has(band.slug) ? band.slug : null;
      if (slug === null) {
        close();
        return;
      }
      // A close is immediate and only an open waits: there is nothing to spend
      // on taking a card away.
      if (shownRef.current === slug || pendingRef.current === slug) return;

      cancel();
      pendingRef.current = slug;
      timerRef.current = window.setTimeout(() => {
        pendingRef.current = null;
        timerRef.current = null;
        const pointer = pointerRef.current;
        if (pointer !== null) place(pointer.x, pointer.y, !openRef.current);
        openRef.current = true;
        shownRef.current = slug;
        setActive((previous) => ({
          slug,
          index,
          down: previous === null || index > previous.index,
        }));
      }, SETTLE);
    };

    const onMove = (event: PointerEvent) => {
      // A touch has no hover to take back, so a tap would leave a card on
      // screen with nothing to close it. The same call `folder-stack` makes,
      // and for the same reason it reads the event rather than a
      // `(hover: hover)` query: a laptop with a touchscreen answers true to
      // that query for both of its pointers.
      if (event.pointerType !== "mouse" && event.pointerType !== "pen") return;
      if (bandsRef.current.length === 0) measure();
      pointerRef.current = { x: event.clientX, y: event.clientY };
      aim(event.clientX, event.clientY, true);
    };

    const onLeave = () => {
      pointerRef.current = null;
      mark(null);
      close();
    };

    // The card is `fixed`, so it stays under the pointer on its own and only
    // which row it is reading has to be answered again.
    const onScroll = () => {
      const pointer = pointerRef.current;
      if (pointer !== null) aim(pointer.x, pointer.y, false);
    };

    const onResize = () => {
      measure();
      onScroll();
    };

    list.addEventListener("pointermove", onMove);
    list.addEventListener("pointerleave", onLeave);
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize);
    return () => {
      cancel();
      list.removeEventListener("pointermove", onMove);
      list.removeEventListener("pointerleave", onLeave);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
    };
  }, [recorded, reduced, x, y]);

  return (
    <div ref={listRef}>
      {children}

      {mounted &&
        createPortal(
          // Portalled, for two reasons. `RevealItem` animates a transform, and
          // an element with one is the containing block for a fixed descendant,
          // so a card left inside the list could never leave it. And the card
          // lies over the rows it is reading: `pointer-events-none` is what
          // keeps it from taking the pointer away from the hit test that put it
          // there.
          <AnimatePresence>
            {active !== null && (
              <motion.div
                aria-hidden="true"
                className="pointer-events-none fixed top-0 left-0 z-50"
                style={{ x, y }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={OPEN}
              >
                {/*
                  Not `ring-inset`. The clip is `size-full`, so it paints over
                  an inset ring and the card has no edge at all, which is the
                  same trap `now-playing` documents for the album cover. It
                  needs one: half the clips are a white demo on a white ground,
                  and this is a card lying over a list rather than something in
                  the layout.
                */}
                <div className="relative h-60 w-96 overflow-hidden rounded-lg bg-bg ring-1 ring-stroke">
                  {/*
                    No `initial={false}`, which is the obvious way to stop the
                    first clip sliding in and does not work: Motion says it by
                    putting `initial: false` on a context every motion component
                    below reads, so a keyed child mounts at `animate` instead of
                    at `initial` and no later swap slides either. `tab-overview`
                    documents the same trap at length. So the first clip arrives
                    the same way every later one does, under the card's own fade.
                  */}
                  <AnimatePresence custom={active.down}>
                    {reduced ? (
                      /*
                        The poster alone. A clip that loops until the pointer
                        leaves is exactly the motion this setting is about, and
                        nobody asked for it: the reader hovered a row, they did
                        not press play. The still is what the old index showed
                        for every entry.

                        biome-ignore lint/performance/noImgElement: a 2 to 6KB
                        local webp already encoded at twice the card's own box,
                        so the optimiser has nothing to do, and the same file is
                        the clip's `poster`, which can only be a plain url.
                        Through next/image the two paths would fetch two
                        encodings of one picture.
                      */
                      <img
                        key={active.slug}
                        src={`/assets/labs/${active.slug}.webp`}
                        alt=""
                        width={640}
                        height={400}
                        className="absolute inset-0 size-full select-none object-cover"
                        draggable={false}
                      />
                    ) : (
                      <motion.video
                        key={active.slug}
                        custom={active.down}
                        variants={SLIDE}
                        initial="enter"
                        animate="center"
                        exit="exit"
                        transition={SWAP}
                        // The clip is fetched on the first hover that needs it,
                        // so the index itself loads none of them.
                        src={`/assets/labs/${active.slug}.mp4`}
                        poster={`/assets/labs/${active.slug}.webp`}
                        autoPlay
                        muted
                        loop
                        playsInline
                        className="absolute inset-0 size-full select-none object-cover"
                      />
                    )}
                  </AnimatePresence>
                </div>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body,
        )}
    </div>
  );
}
