"use client";

import { XIcon } from "@phosphor-icons/react";
import {
  animate,
  motion,
  useMotionValue,
  useReducedMotion,
  useTransform,
} from "motion/react";
import type React from "react";
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { TextMorph } from "torph/react";
import { Tooltip, TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  CHIP_H,
  CLEAR,
  GAP,
  type Measured,
  type Plan,
  plan,
  type Rect,
  TRAY_H,
  TRAY_PAD,
  TRAY_R,
} from "./layout";
import { LENSES, matches, TAGS, type Tag } from "./lenses";

/**
 * Filter chips that merge into the tray they are dropped in.
 *
 * The trick is smaller than it looks. A hidden layer holds one plain rounded
 * rect per shape under `feGaussianBlur` into an alpha crush, so two rects near
 * each other bleed together and the crush turns the overlap into a neck. The
 * labels ride above that layer, outside the filter, which is why they stay
 * sharp. Nothing else about it is special.
 *
 * **The goo layer draws every dark shape and the elements on top are text.**
 * The reference keeps a background on each chip and strips it with a class
 * once the chip has landed, which means the hard edge of that background sits
 * over its own softened blob for the length of the flight. Here a chip that is
 * in the goo has no background at all, ever, so the silhouette is always the
 * filter's and there is no moment when the two disagree.
 *
 * **The goo is a function of the gap, not of the clock.** The reference
 * schedules `stdDeviation` on its timeline: up over half the flight, hold,
 * down at the end. This reads the distance between the flying chip and the
 * tray on every frame and takes a bump off it, zero when they are far apart,
 * peak when they are about to touch and zero again once they overlap, because
 * two shapes that have merged have no neck left to form. Nothing has to be
 * kept in step with anything, one press and six at once behave the same, and
 * the reverse falls out for free.
 *
 * `layout.ts` is the geometry, pure, and `lenses.ts` is what the chips
 * actually filter.
 */

/** how the field, the tray and a chip settling into it move */
const GLIDE = { type: "spring", stiffness: 170, damping: 24 } as const;

/**
 * A chip going back to the row, which overshoots a little where the glide does
 * not. Arriving is a chip being put down and leaving is one being let go, and
 * an overshoot on the way in would pull it back out of the goo it just entered.
 */
const RETURN = { type: "spring", stiffness: 220, damping: 18 } as const;

/** the chips that are only closing the gap behind one that left */
const REFLOW = { type: "spring", stiffness: 260, damping: 30 } as const;

/** how the count and the chip's own colours change, in seconds */
const TINT = 0.18;

/**
 * The blur the goo runs at when the neck is widest, in user units.
 *
 * Tuned against `CHIP_H`. Too little and two shapes pass through each other
 * with a seam, too much and the whole tray inflates and its corners round off
 * into a pill of soup.
 */
const GOO = 9;

/**
 * The gap at which the neck is widest, and the gap past which there is none,
 * both in pixels.
 *
 * `peak` is a little under the tray's lip, so the neck is widest with the chip
 * just outside the tray's mouth, which is where a drop of something viscous
 * actually necks. `reach` has to be under `FIELD_GAP`, or a chip resting in the
 * row is already necked to the tray and the goo has nowhere to ramp from.
 */
const NECK = { peak: 8, reach: 34 };

/**
 * The same two numbers for a neck between two chips, which is a different
 * scale and was the tray's for one build too long.
 *
 * **A chip meets the tray's mouth from a long way out and another chip only by
 * nearly touching it.** On the tray's numbers the row's own resting gap,
 * `GAP.row` at 8, is exactly `NECK.peak`, so six chips sitting still in the row
 * claimed the widest neck there is: measured, `stdDeviation` finished every
 * clear at 9.8 of a possible 9.8 and the tray painted as a lozenge until the
 * filter came off it, which is the radius snapping back rather than any radius
 * changing. Both ends are the layout's own numbers so neither can drift:
 * widest when two chips are as close as they ever get, which is the tray's
 * internal gap, and gone before they are as far apart as two chips ever rest.
 */
const PAIR = { peak: GAP.tray, reach: GAP.row - 2 };

/**
 * The floor the blur sits at whenever the filter is on.
 *
 * At zero the alpha crush has nothing to work on but the shapes' own
 * antialiasing, so every rounded corner comes back hard and stepped. This is
 * the least blur that gives the crush a gradient to find an edge in, and it is
 * also why the filter is taken off entirely at rest rather than left on at
 * zero.
 */
const FLOOR = 0.8;

/**
 * Where the label's ink swaps between the two tones, as a share of the melt,
 * and over how much of it.
 *
 * **It steps rather than crosses, which is `window-shade`'s lesson arriving at
 * a chip.** The ground under the label is going from the slab's near-black to
 * the chip's own fill while the ink has to go the other way, so the two meet:
 * half way through, the pill is a mid grey and neither tone reads on it.
 * Crossfading there is the worst of both, since the word is then two half-inks
 * over the one ground that defeats each of them, which measured about 1.5:1
 * for three frames.
 *
 * Solving `white on the ground == grey on the ground` puts the least unequal
 * point at 0.55 of the melt, where both sides measure 2.3:1, and the band is
 * narrow enough that the swap is under one frame of the return spring. So the
 * word is one solid tone throughout and merely picks the better of the two.
 */
const INK = { at: 0.55, over: 0.06 };

/**
 * How far a press has to travel before it is a drag rather than a click, and
 * how close a carried chip has to get to the tray to merge with it.
 *
 * **Both are the rule stated in the one unit the whole lab runs on:** drop a
 * chip while it is still drawing a neck and the tray takes it, and pull a
 * seated one until that neck breaks and it leaves. Neither is a threshold
 * invented for the gesture.
 *
 * `merge` is 12 because that is where the neck goes, measured rather than
 * picked: the midpoint between the two shapes reads solid at gaps of 2, 4, 6,
 * 8 and 10 and white at 12. `NECK.peak` is where the blur is widest and not
 * where it stops bridging, so it is the wrong end of the same curve to commit
 * on, and at 8 it asked for a precision the gesture does not need.
 */
const DRAG = { slop: 6, merge: 12 };

/**
 * The stage's height, which is fixed.
 *
 * Tall enough for the deepest arrangement there is, a tray wrapped to three
 * rows with a row of chips under it, and everything shorter is centred in it.
 * What the chips do changes how tall the field is, and a demo that grows and
 * shrinks with it shoves the page underneath up and down while a reader is
 * pressing things.
 *
 * **It is not the tallest arrangement plus a margin, it is the tallest
 * arrangement plus the room a hand needs.** At 200 the widest tray there is,
 * six picked on a 320px screen, left under `NECK.reach` of stage beneath it, so
 * a chip could not be carried far enough to break its own neck and the drag
 * could not take one out at that size. A tear wants `NECK.reach` plus a chip
 * below the tray's foot, which is 64, and centring gives half the slack to each
 * end, so the stage owes the deepest tray twice that.
 *
 * 298 also makes the demo 336 tall against the column's 538, which is the 8:5
 * the lab index's preview card is, so the recorded clip is the whole demo with
 * nothing padded or cut.
 */
const STAGE_H = 298;

/**
 * How much of itself a shape has given up to the goo at this gap: 1 while it is
 * touching the tray, 0 once the neck has broken.
 *
 * **It shares `NECK.reach` with the goo, and that is the whole idea.** A chip
 * going back to the row used to keep the tray's colours for the length of its
 * flight and change them once it had parked, which reads as the pill correcting
 * itself after the fact rather than as a drop separating. Driving it off the
 * same gap the neck is drawn from means the chip takes its own pill back over
 * exactly the distance the goo is still drawing one, so the two cannot disagree
 * about whether it is still part of the tray.
 */
function meltAt(gap: number): number {
  return Math.max(0, Math.min(1, 1 - gap / NECK.reach));
}

/**
 * How much of the tray's own edge a chip is wearing at this gap.
 *
 * **A chip takes that edge when it is inside the tray, not when it stops
 * moving.** It used to be a boolean off "picked, and no longer in flight", so a
 * chip pushed into the tray by hand sat on the slab wearing nothing until the
 * release and the flight after it had both finished, and a chip that had just
 * landed was the one plate missing from a full tray. What the edge means is
 * that the chip is on the slab, which is a fact about where it is, so it comes
 * off the gap: full while the two overlap and gone a few pixels out.
 */
function seatAt(gap: number): number {
  return Math.max(0, Math.min(1, 1 - gap / 6));
}

/** how wide a bump of goo the gap makes, peaked at `peak` and gone at `reach` */
function neckAt(
  gap: number,
  { peak, reach }: { peak: number; reach: number } = NECK,
): number {
  if (gap <= 0 || gap >= reach) return 0;
  const t = gap < peak ? gap / peak : 1 - (gap - peak) / (reach - peak);
  return Math.max(0, Math.min(1, t));
}

function clamp(value: number, low: number, high: number): number {
  return Math.max(low, Math.min(high, value));
}

/** the shortest distance between two rects, which is 0 once they overlap */
function gapBetween(a: Rect, b: Rect): number {
  const dx = Math.max(0, Math.max(a.x - (b.x + b.w), b.x - (a.x + a.w)));
  const dy = Math.max(0, Math.max(a.y - (b.y + b.h), b.y - (a.y + a.h)));
  return Math.hypot(dx, dy);
}

interface Box {
  x: ReturnType<typeof useMotionValue<number>>;
  y: ReturnType<typeof useMotionValue<number>>;
  w: ReturnType<typeof useMotionValue<number>>;
  h: ReturnType<typeof useMotionValue<number>>;
  /** what `meltAt` returns, written per frame while the chip is separating */
  melt: ReturnType<typeof useMotionValue<number>>;
  /** what `seatAt` returns, which is always the gap and never a clock */
  seat: ReturnType<typeof useMotionValue<number>>;
}

/**
 * Whether a shape has an animation attached to it.
 *
 * **Not whether it is moving, which this asked before and is a different
 * question for exactly one frame.** `move` creates four springs and none of
 * them writes a value until the frame after that, so every velocity on a box
 * about to glide right across the stage reads zero. The loop believed it and
 * shut itself down in the middle of a gesture: measured on a chip released at
 * the tray's mouth, the last frame ran with the chip 8px out, which is
 * `NECK.peak`, so it took the filter off on the widest blur there is and the
 * glide that followed was drawn with no goo on it at all. An attached
 * animation is the fact the loop actually wants. A value being dragged rather
 * than animated has no animation on it, which is what `carried` is for.
 */
function busy(box: Box): boolean {
  return (
    box.x.isAnimating() ||
    box.y.isAnimating() ||
    box.w.isAnimating() ||
    box.h.isAnimating()
  );
}

export default function GooeyChips() {
  const [chosen, setChosen] = useState<Tag[]>([]);
  const reduce = useReducedMotion();
  /* React 19 hands back guillemets, and a filter id goes in a `url(#...)` */
  const filterId = `goo-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;

  const stage = useRef<HTMLDivElement>(null);
  /** the box the chips are positioned in, which a drag is measured against */
  const field = useRef<HTMLDivElement>(null);
  const blur = useRef<SVGFEGaussianBlurElement>(null);
  const goo = useRef<HTMLDivElement>(null);
  const rule = useRef<HTMLSpanElement>(null);
  const countRef = useRef<HTMLSpanElement>(null);

  /** every chip's natural width, plus the one chrome width the tray needs */
  const [sizes, setSizes] = useState<{
    width: number;
    chips: Record<string, number>;
    count: number;
  } | null>(null);

  /**
   * Chips whose flight has not landed. State rather than a ref, because what
   * is in the goo is derived from it and from the selection together, and two
   * places keeping that set in step is how the blob under a chip goes missing.
   */
  const [flying, setFlying] = useState<Tag[]>([]);
  /** the chip in the hand, which is in the goo whether or not it is picked */
  const [carried, setCarried] = useState<Tag | null>(null);
  const still = useRef(false);
  const frame = useRef(0);

  /*
   * One set of values per shape, read by the chip and by its blob. The
   * reference tweens the two as a pair, which holds until a gesture interrupts
   * one of them: two springs handed the same target still diverge if they were
   * not at the same place when it arrived. One value with two readers cannot.
   */
  const boxes = useRef(new Map<string, Box>());
  const trayBox = useBox(boxes, "tray");
  /*
   * The tray and every chip that is selected or still on its way there, which
   * is exactly the set the goo layer draws and exactly the set the neck is
   * measured across. An unselected chip resting in the row is 14px under the
   * tray, so counting it would leave the goo on for ever.
   */
  const inGoo = useMemo(
    () =>
      TAGS.filter(
        (tag) =>
          chosen.includes(tag) || flying.includes(tag) || carried === tag,
      ),
    [carried, chosen, flying],
  );
  const gooRef = useRef<readonly Tag[]>(inGoo);
  gooRef.current = inGoo;
  /* the set the melt's clock owns rather than the gap, which is one case */
  const enteringRef = useRef<readonly Tag[]>([]);
  enteringRef.current = flying.filter((tag) => chosen.includes(tag));
  const flyRef = useRef<readonly Tag[]>(flying);
  flyRef.current = flying;
  const carriedRef = useRef<Tag | null>(carried);
  carriedRef.current = carried;
  const chosenRef = useRef<readonly Tag[]>(chosen);
  chosenRef.current = chosen;
  const height = useMotionValue(TRAY_H);
  const clearAt = useMotionValue(0);
  const clearY = useMotionValue(0);
  const clearIn = useMotionValue(0);

  useEffect(() => {
    still.current = reduce ?? false;
  }, [reduce]);

  /* measure once, and again when the face arrives or the column changes */
  useEffect(() => {
    const el = rule.current;
    const box = stage.current;
    if (!el || !box) return;

    const read = () => {
      const chips: Record<string, number> = {};
      for (const tag of TAGS) {
        const node = el.querySelector<HTMLElement>(`[data-rule="${tag}"]`);
        if (node) chips[tag] = Math.ceil(node.getBoundingClientRect().width);
      }
      const count = countRef.current?.getBoundingClientRect().width ?? 0;
      const width = Math.floor(box.getBoundingClientRect().width);
      if (width < 1) return;
      setSizes({ width, chips, count: Math.ceil(count) });
    };

    read();
    const observer = new ResizeObserver(read);
    observer.observe(box);
    void document.fonts?.ready.then(read);
    return () => observer.disconnect();
  }, []);

  /** the arrangement the current selection asks for, mirrored for the handlers */
  const targetRef = useRef<Plan | null>(null);
  const target: Plan | null = useMemo(() => {
    if (!sizes) return null;
    const chips: Measured[] = TAGS.map((tag) => ({
      id: tag,
      w: sizes.chips[tag] ?? 0,
      selected: chosen.includes(tag),
    }));
    return plan({ width: sizes.width, chips, countW: sizes.count });
  }, [chosen, sizes]);
  targetRef.current = target;

  /**
   * Read every shape's live rect and write the blur the widest neck among them
   * asks for. Runs only while something is moving, and takes the filter off
   * when it stops: at rest the crush has nothing to soften and would hand every
   * rounded corner back hard.
   */
  const paint = useCallback(() => {
    const node = blur.current;
    const layer = goo.current;
    if (!node || !layer) {
      frame.current = 0;
      return;
    }

    const tray = read(trayBox);
    let widest = 0;
    /* a hand on a chip is movement the velocities cannot report, since a drag
       that has paused is still a drag and the neck it is holding is live */
    let moving = carriedRef.current !== null || busy(trayBox);
    const shapes: Array<{ rect: Rect; out: number }> = [];

    for (const [id, box] of boxes.current) {
      if (id === "tray") continue;
      if (busy(box)) moving = true;
      /* only a shape the goo layer is drawing can grow a neck with the tray */
      if (!gooRef.current.includes(id as Tag)) continue;
      const rect = read(box);
      const gap = gapBetween(rect, tray);
      widest = Math.max(widest, neckAt(gap));
      /* how much of this chip is still its own body rather than the slab's:
         1 out in the row, 0 once it is inside the tray. See the pair loop. */
      shapes.push({ rect, out: 1 - meltAt(gap) });

      /*
       * **The gap owns a chip's clothes, and the clock owns exactly one case.**
       * A chip that has been picked up gives its pill away at once, since what
       * carries it the rest of the way is the blob already under it. Everything
       * else, a chip tearing out, a chip in the hand, a chip springing back
       * from a drag that committed to nothing, resolves at the distance it
       * actually is from the tray. At rest the two ends fall out of the same
       * rule: a seated chip overlaps the tray, so its gap is 0 and its melt 1,
       * and one in the row is a field gap away, which is past the reach.
       */
      if (!enteringRef.current.includes(id as Tag)) box.melt.set(meltAt(gap));
      /* the edge is the gap even for a chip the clock is melting, or one still
         in the air would be wearing a slab it has not reached */
      box.seat.set(seatAt(gap));
    }

    /*
     * **And to each other, not only to the tray.** Two chips crossing are two
     * shapes with a gap between them, so the same bump applies: clear six at
     * once and they web together on the way out instead of passing through one
     * another. On `PAIR`'s scale, not the tray's.
     *
     * **Each one's share is how far out of the slab it is, and that replaced a
     * flag saying whether it was in flight.** Two chips parked in the tray sit
     * `GAP.tray` apart for ever and would hold the blur off its floor through
     * every flight near them, which is what that flag was for. It was read off
     * the `flying` list, which outlives the motion by however long the spring
     * takes to be declared finished, so the last frame of every flight was
     * still counting chips that had arrived: a clear ended on the widest blur
     * there is and a pick ended on 4.18 of 9.8. Two chips inside the slab are
     * not two shapes with a neck between them, they are one body, and `melt`
     * already says exactly that as a function of the gap. So does the release:
     * nothing here is a list any more.
     */
    for (let i = 0; i < shapes.length; i += 1) {
      for (let j = i + 1; j < shapes.length; j += 1) {
        const share = shapes[i].out * shapes[j].out;
        if (share === 0) continue;
        widest = Math.max(
          widest,
          share * neckAt(gapBetween(shapes[i].rect, shapes[j].rect), PAIR),
        );
      }
    }

    node.setAttribute("stdDeviation", String(FLOOR + GOO * widest));
    if (moving) {
      frame.current = requestAnimationFrame(paint);
      return;
    }
    layer.style.filter = "none";
    frame.current = 0;
  }, [trayBox]);

  const run = useCallback(() => {
    if (frame.current || still.current) return;
    if (goo.current) goo.current.style.filter = `url(#${filterId})`;
    frame.current = requestAnimationFrame(paint);
  }, [filterId, paint]);

  useEffect(
    () => () => {
      cancelAnimationFrame(frame.current);
    },
    [],
  );

  /*
   * The drag. **The lab's claim is that the goo is a function of the gap, and
   * until this the only thing that ever set that gap was a spring.** A hand on
   * a chip owns it directly: carry one to the tray's mouth and hold it there
   * and the neck sits at its widest for as long as you like, pull a seated one
   * and the neck stretches until it breaks. Nothing in the model changes, since
   * a drag writes the same motion values the blob already reads and `neckAt`
   * was always measuring live rects.
   */
  const grab = useRef<{
    tag: Tag;
    px: number;
    py: number;
    x: number;
    y: number;
    moved: boolean;
    /** the stage, in the chip's own coordinates. See `start`. */
    within: { x1: number; y1: number; x2: number; y2: number } | null;
  } | null>(null);
  /** set while a press has become a drag, so the click it ends on is not a toggle */
  const dragged = useRef(false);

  /** send a chip back where the plan says it lives, with its melt still on the gap */
  const homeward = useCallback(
    (tag: Tag) => {
      const rect = targetRef.current?.chips[tag];
      const box = boxes.current.get(tag);
      if (!rect || !box) return;
      setFlying((were) => (were.includes(tag) ? were : [...were, tag]));
      move(box, rect, RETURN, () =>
        setFlying((were) => were.filter((one) => one !== tag)),
      );
      run();
    },
    [run],
  );

  const start = useCallback((tag: Tag, event: React.PointerEvent) => {
    if (event.button !== 0) return;
    const box = boxes.current.get(tag);
    if (!box) return;
    event.currentTarget.setPointerCapture?.(event.pointerId);

    /*
     * **A chip is carried inside the stage and nowhere else.** The board keeps
     * the pointer, so without a bound a hand can walk a chip off the demo and
     * across the page, which is a filter chip lying on the prose. The two boxes
     * are read once here rather than per frame, since neither moves while a
     * hand is down, and the result is the stage expressed in the chip's own
     * coordinates so the clamp is two comparisons.
     */
    const room = stage.current?.getBoundingClientRect();
    const from = field.current?.getBoundingClientRect();
    grab.current = {
      tag,
      px: event.clientX,
      py: event.clientY,
      x: box.x.get(),
      y: box.y.get(),
      moved: false,
      within:
        room && from
          ? {
              x1: room.left - from.left,
              y1: room.top - from.top,
              x2: room.right - from.left - box.w.get(),
              y2: room.bottom - from.top - box.h.get(),
            }
          : null,
    };
  }, []);

  const carry = useCallback(
    (tag: Tag, event: React.PointerEvent) => {
      const held = grab.current;
      if (!held || held.tag !== tag) return;
      const dx = event.clientX - held.px;
      const dy = event.clientY - held.py;
      if (!held.moved) {
        if (Math.hypot(dx, dy) < DRAG.slop) return;
        held.moved = true;
        dragged.current = true;
        setCarried(tag);
        run();
      }
      const box = boxes.current.get(tag);
      if (!box) return;
      const room = held.within;
      box.x.set(room ? clamp(held.x + dx, room.x1, room.x2) : held.x + dx);
      box.y.set(room ? clamp(held.y + dy, room.y1, room.y2) : held.y + dy);
    },
    [run],
  );

  /**
   * Let go.
   *
   * Both commits are the gap, so the gesture and the goo cannot say different
   * things: a chip dropped inside the widest neck merges, and a seated one
   * pulled past the neck's reach has broken it and leaves. Anything between is
   * a change of mind and goes home.
   */
  const release = useCallback(
    (tag: Tag) => {
      const held = grab.current;
      grab.current = null;
      if (!held || held.tag !== tag) return;
      if (!held.moved) return;
      setCarried(null);

      const box = boxes.current.get(tag);
      if (!box) return;
      const gap = gapBetween(read(box), read(trayBox));
      const seated = chosenRef.current.includes(tag);

      if (!seated && gap <= DRAG.merge) {
        setChosen((were) => [...were, tag]);
        return;
      }
      if (seated && gap >= NECK.reach) {
        setChosen((were) => were.filter((one) => one !== tag));
        return;
      }
      homeward(tag);
    },
    [homeward, trayBox],
  );

  const placed = useRef(false);
  const was = useRef<readonly Tag[]>([]);
  /** which flight the completions belong to, so a stale one cannot clear a live one */
  const gen = useRef(0);

  /* send every shape to where the plan says it goes */
  useEffect(() => {
    if (!target) return;

    const before = was.current;
    was.current = chosen;

    /*
     * What flies is what changed sides, and nothing else. Deriving it from
     * "this rect differs from that one" instead counts every chip closing the
     * gap behind the one that left, which puts the whole row in the goo.
     */
    const changed = TAGS.filter(
      (tag) => chosen.includes(tag) !== before.includes(tag),
    );

    /*
     * **A re-measure is not a gesture, so it is set rather than animated.**
     * `read` runs on mount, on the observer and again on `document.fonts.ready`,
     * and the metrics differ between those runs: a first paint in the fallback
     * face measures a chip at 108px where Inter measures it at 57. Every run
     * past the first was animating to its new numbers, so a page whose font
     * arrived late sprang the whole arrangement from a stale layout into the
     * real one, which reads as the demo sliding in. Measured on a load with the
     * font held back 1.2s: the row went 57, 84, 108 and back to 57 over 340ms.
     * Nothing about a corrected measurement is a thing to watch, and the same
     * goes for a window being resized.
     *
     * The first arrangement is set for the older half of the same reason: it is
     * where everything already is, not somewhere to travel to, and without it
     * the whole set flies in from the stage's corner on load.
     */
    const still_ =
      !placed.current ||
      still.current ||
      (changed.length === 0 &&
        flyRef.current.length === 0 &&
        carriedRef.current === null);

    if (still_) {
      placed.current = true;
      set(trayBox, target.tray);
      height.set(target.height);
      clearAt.set(target.clear.x);
      clearY.set(target.clear.y);
      clearIn.set(chosen.length ? 1 : 0);
      for (const tag of TAGS) {
        const rect = target.chips[tag];
        const box = boxes.current.get(tag);
        if (!rect || !box) continue;
        set(box, rect);
        box.melt.set(chosen.includes(tag) ? 1 : 0);
        box.seat.set(chosen.includes(tag) ? 1 : 0);
      }
      return;
    }

    setFlying(changed);

    const mine = ++gen.current;
    let left = changed.length;
    const landed = () => {
      if (gen.current !== mine) return;
      left -= 1;
      if (left <= 0) setFlying([]);
    };

    move(trayBox, target.tray, GLIDE);
    animate(height, target.height, GLIDE);
    animate(clearAt, target.clear.x, GLIDE);
    animate(clearY, target.clear.y, GLIDE);
    animate(clearIn, chosen.length ? 1 : 0, { duration: TINT });

    for (const tag of TAGS) {
      const rect = target.chips[tag];
      const box = boxes.current.get(tag);
      if (!rect || !box) continue;
      if (!changed.includes(tag)) {
        move(box, rect, REFLOW);
        continue;
      }
      /*
       * **Going in is a clock and coming out is the gap, and the asymmetry is
       * the honest one.** A chip that has been picked up gives its pill up at
       * once, since what carries it the rest of the way is the blob already
       * under it. A chip coming out is not given a target here at all: `paint`
       * writes it off the distance to the tray, so it re-forms where the neck
       * breaks. The two springs are asymmetric for the same reason.
       */
      if (chosen.includes(tag)) animate(box.melt, 1, { duration: TINT });
      move(box, rect, chosen.includes(tag) ? GLIDE : RETURN, landed);
    }

    run();
  }, [chosen, clearAt, clearIn, clearY, height, run, target, trayBox]);

  const count = matches(chosen).length;

  return (
    /*
     * No gap and no column: there is one visible child now, and the gap was
     * still adding its 19px above the stage, which pushed the whole
     * arrangement that far below the middle of the frame.
     *
     * **`select-none` on the whole component, not on the stage alone.** Every
     * gesture here is a press on a small pill, and a drag that starts on the
     * stage and leaves it anchors a selection on the nearest text, which is the
     * readout and every chip label. A chip carries its label twice, once in each
     * of the two tones it steps between, so what that selection paints is
     * `primeprime`, in the site's own emerald with a pair of `SelectionPins`
     * carets, and what a select-all copies out of the demo is
     * `primezoomwidetelemacrofast`. It covers the measuring copy as well as the
     * stage, since that is a second set of the same words sitting in the tree.
     * Everything in here is a control or a readout about one, so there is
     * nothing a reader would want to copy, which is the signature player's call.
     */
    <div className="w-full select-none">
      {/*
       * The measuring copy: the same chips in the same type, in flow, invisible
       * and out of the tree for a reader. Every real chip is absolutely
       * positioned with a width this hands it, so there is nowhere else its
       * natural size could come from.
       */}
      {/*
       * The measuring copy sits inside a box with no size, no overflow and its
       * own positioning, and all three of those are load-bearing. Absolutely
       * positioned on its own it still counts toward an ancestor's scroll
       * width, and this row is wider than a phone: on a 390px viewport it
       * pushed the document to 450 and the whole page scrolled sideways.
       * `relative` is what makes this box the containing block, since
       * `overflow: hidden` does not clip an absolute child whose containing
       * block is somewhere above it. Clipping is paint only, so the measurement
       * is unaffected.
       */}
      <div className="relative h-0 w-0 overflow-hidden">
        <span
          ref={rule}
          aria-hidden="true"
          /*
           * `w-max` is not decoration. An absolutely positioned box shrinks to
           * fit its containing block, and this one's is zero wide, so without
           * it every measurement collapses to the longest word it contains: the
           * single-word chips still came out right and "20 lenses" measured as
           * "lenses", which left the tray too narrow to hold its own readout.
           */
          className="pointer-events-none invisible absolute flex w-max gap-2 whitespace-nowrap"
        >
          {TAGS.map((tag) => (
            <span key={tag} data-rule={tag} className={CHIP}>
              {tag}
            </span>
          ))}
          {/* the tray's own readout is absolutely positioned, so it cannot be
            measured where it lives. This is the same span in the same type. */}
          <span
            ref={countRef}
            className="flex items-center font-mono text-meta"
          >
            <span className="tabular-nums">{said(LENSES.length)}</span>
          </span>
        </span>
      </div>

      {/*
       * One height, and the field centred in it. What the chips do changes how
       * tall the field is, and a demo that grows and shrinks with it shoves the
       * page underneath up and down while a reader is pressing things.
       */}
      <div
        ref={stage}
        data-carry={carried !== null}
        className="relative flex w-full items-center justify-center py-2 data-[carry=true]:cursor-grabbing data-[carry=true]:[&_*]:cursor-grabbing"
        style={{ height: STAGE_H }}
      >
        <motion.div ref={field} className="relative w-full" style={{ height }}>
          <svg aria-hidden="true" className="absolute size-0" focusable="false">
            <title>Gooey merge filter</title>
            <defs>
              {/*
               * `sRGB` is load-bearing. The default is linearRGB, where the
               * same crush lands somewhere else entirely and the neck comes out
               * thin and grey.
               */}
              <filter
                id={filterId}
                x="-30%"
                y="-30%"
                width="160%"
                height="160%"
                colorInterpolationFilters="sRGB"
              >
                <feGaussianBlur
                  ref={blur}
                  in="SourceGraphic"
                  stdDeviation="0"
                  result="soft"
                />
                {/*
                 * The crush: alpha times 20 minus 10, so anything under half
                 * opacity goes to nothing and anything over goes to solid. Two
                 * blurs overlapping clear the threshold between them, which is
                 * the neck.
                 */}
                <feColorMatrix
                  in="soft"
                  mode="matrix"
                  values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 20 -10"
                  result="goo"
                />
                <feComposite in="SourceGraphic" in2="goo" operator="atop" />
              </filter>
            </defs>
          </svg>

          {/* every dark shape on the stage, and nothing else */}
          <div
            ref={goo}
            aria-hidden="true"
            className="pointer-events-none absolute inset-0"
          >
            <Blob box={trayBox} radius={TRAY_R} />
            {inGoo.map((tag) => (
              <Blob key={tag} box={boxes.current.get(tag)} />
            ))}
          </div>

          {/* the tray's own readout, which is text over the slab */}
          <Readout box={trayBox} count={count} reduce={still.current} />

          {TAGS.map((tag) => (
            <Chip
              key={tag}
              tag={tag}
              boxes={boxes}
              on={chosen.includes(tag)}
              ready={Boolean(target)}
              onDown={start}
              onMove={carry}
              onUp={release}
              onClick={() => {
                /* the drag ends on a click over the chip it started on, so
                   without this every drop would also toggle what it dropped */
                if (dragged.current) {
                  dragged.current = false;
                  return;
                }
                setChosen((was) =>
                  was.includes(tag)
                    ? was.filter((t) => t !== tag)
                    : [...was, tag],
                );
              }}
            />
          ))}

          {/*
           * The clear control, at the tray's own end. It is the last child, so
           * it paints over the slab it sits on, and it is outside the goo
           * layer: it is a glyph on the tray rather than a shape of it.
           */}
          <TooltipProvider delayDuration={200}>
            <Tooltip label="Clear the picks">
              <motion.button
                type="button"
                aria-label="Clear the picks"
                onClick={() => setChosen([])}
                disabled={chosen.length === 0}
                style={{
                  x: clearAt,
                  y: clearY,
                  width: CLEAR,
                  height: CLEAR,
                  opacity: clearIn,
                }}
                className={cn(
                  "absolute top-0 left-0 flex cursor-pointer items-center justify-center rounded-full",
                  "text-inverse-text-secondary transition-colors duration-200",
                  "hover:bg-bg/10 hover:text-inverse-text",
                  /* it is already at zero opacity with nothing picked, so the
                     shared `disabled:opacity-50` would fight the value that
                     hides it. What it must not do is take a pointer. */
                  "disabled:pointer-events-none",
                  /*
                   * The site's focus pattern pins `text-primary` and paints a
                   * white offset band, and this sits on a near-black slab, so
                   * the ring would be invisible and its offset would be the
                   * brightest thing in the frame. `window-shade`'s call: the
                   * same ring in the flipped ink, as an outline.
                   *
                   * **The colour is named and cannot be left off.** An outline
                   * with a width and a style but no colour keeps the one the UA
                   * put on `:focus-visible`, which in Chrome is its own blue,
                   * measured `rgb(0, 95, 204)` on this button before the token
                   * went back in.
                   */
                  "focus-visible:text-inverse-text focus-visible:outline-2 focus-visible:outline-inverse-text focus-visible:outline-offset-2",
                )}
              >
                <XIcon aria-hidden="true" className="size-3.5" />
              </motion.button>
            </Tooltip>
          </TooltipProvider>
        </motion.div>
      </div>
    </div>
  );
}

/**
 * The count, which has to agree with itself at one.
 *
 * **It says `results` rather than naming what is being filtered.** It read
 * `20 lenses` for a while, and the rows it was counting are not on screen, so
 * the only thing a reader had to go on was a noun that appears nowhere else in
 * the demo: the chips say `prime` and `tele`, and what a lens has to do with
 * either is camera knowledge the demo has no business assuming. `results` is
 * what a filter produces whatever it is filtering. The subject is named once,
 * in the registry's `hint`, where a reader who wants it can find it.
 */
function said(n: number): string {
  return `${n} ${n === 1 ? "result" : "results"}`;
}

/** the chip's own type and padding, shared with the copy that measures it */
const CHIP =
  "inline-flex h-[30px] items-center rounded-full px-3.5 text-action whitespace-nowrap";

function Chip({
  tag,
  boxes,
  on,
  ready,
  onDown,
  onMove,
  onUp,
  onClick,
}: {
  tag: Tag;
  boxes: React.RefObject<Map<string, Box>>;
  on: boolean;
  ready: boolean;
  onDown: (tag: Tag, event: React.PointerEvent) => void;
  onMove: (tag: Tag, event: React.PointerEvent) => void;
  onUp: (tag: Tag) => void;
  onClick: () => void;
}) {
  const box = useBox(boxes, tag);
  /* what it is wearing of its own, which is the other half of the melt */
  const own = useTransform(box.melt, (melt) => 1 - melt);
  const lit = useTransform(box.melt, (melt) =>
    Math.max(0, Math.min(1, (melt - INK.at) / INK.over + 0.5)),
  );
  const unlit = useTransform(lit, (v) => 1 - v);

  return (
    <motion.button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      onPointerDown={(event) => onDown(tag, event)}
      onPointerMove={(event) => onMove(tag, event)}
      onPointerUp={() => onUp(tag)}
      onPointerCancel={() => onUp(tag)}
      style={{ x: box.x, y: box.y, width: box.w, height: box.h }}
      className={cn(
        CHIP,
        /*
         * **`cursor-pointer` at rest, and the grab cursor only once a press has
         * become a drag.** A chip is a toggle first and carried second, so a
         * grab cursor sitting on it before anything is held says the click it
         * is about to get will not work. `active:cursor-grabbing` is the same
         * lie a frame shorter, since it fires on the press that is only ever a
         * click. The grabbing cursor is the stage's, and the descendant half of
         * that pair is what does the work: the label spans under the pointer
         * inherit this declaration, so an inherited `grabbing` loses to it,
         * which is the order `tether-button` documents for a button's own UA
         * cursor. `sticker-peel` writes the same pair.
         *
         * `touch-none` is on the chip alone, never the stage, so a thumb
         * scrolling past the demo is only trapped on a 30px target.
         */
        "group absolute top-0 left-0 cursor-pointer touch-none justify-center",
        !ready && "invisible",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-primary/15 focus-visible:ring-offset-2",
      )}
    >
      {/*
       * **A chip in the goo has no pill of its own**, so nothing hard-edged
       * sits over the neck while it is forming: the blob under it is the whole
       * of its shape. This is that pill, at the opacity the distance to the
       * tray asks for.
       */}
      <motion.span
        aria-hidden="true"
        style={{ opacity: own }}
        className="absolute inset-0 rounded-full bg-fill transition-colors duration-200 group-hover:bg-fill-hover"
      />
      {/*
       * **A chip on the slab takes an edge back**, light at a tenth over it.
       * Without it a full tray is one black bar with six words spaced across
       * it, which is a navigation bar and not a tray with things in it, and a
       * chip stops being an object the moment it arrives. So it dissolves into
       * the goo and then resolves out of it.
       *
       * Its opacity is `seatAt`, so the edge belongs to where the chip is
       * rather than to a flight having finished: pushed in by hand it wears the
       * slab before the release, and torn out it gives it up as it clears.
       */}
      <motion.span
        aria-hidden="true"
        style={{ opacity: box.seat }}
        className="absolute inset-0 rounded-full bg-bg/10 group-hover:bg-bg/20"
      />
      {/*
       * The label in two tones, one of which is on at a time. A `var()` cannot
       * be interpolated, so a tone that moved would mean reading both tokens off
       * the root at mount and mixing them by hand, which is what
       * `halftone-ripple` has to do for a canvas fill. Two spans need none of
       * that, and this one does not want a moving tone anyway: see `INK`.
       */}
      <motion.span
        style={{ opacity: unlit }}
        className="relative text-text-secondary transition-colors duration-200 group-hover:text-text-primary"
      >
        {tag}
      </motion.span>
      <motion.span
        aria-hidden="true"
        style={{ opacity: lit }}
        className="absolute inset-0 flex items-center justify-center text-bg"
      >
        {tag}
      </motion.span>
    </motion.button>
  );
}

/**
 * One shape in the goo layer.
 *
 * A chip is always one row tall, so it takes `rounded-full` and is a stadium.
 * The tray is handed an explicit radius instead, since `rounded-full` on a
 * wrapped one is half its height. See `TRAY_R`.
 */
function Blob({ box, radius }: { box: Box | undefined; radius?: number }) {
  if (!box) return null;
  return (
    <motion.span
      className={cn(
        "absolute top-0 left-0 block bg-text-primary",
        radius === undefined && "rounded-full",
      )}
      style={{
        x: box.x,
        y: box.y,
        width: box.w,
        height: box.h,
        borderRadius: radius,
      }}
    />
  );
}

function Readout({
  box,
  count,
  reduce,
}: {
  box: Box;
  count: number;
  reduce: boolean;
}) {
  return (
    <motion.span
      aria-live="polite"
      /*
       * **`TRAY_H` and never the tray's own height**, so the count sits on the
       * tray's first row rather than in the middle of however many rows it
       * currently has. Centred on the whole slab it drifts downward as the tray
       * wraps, and the second row starts at the tray's own padding, which is
       * under the count: at two rows the first wrapped chip was drawn straight
       * through the word. A field's count sits on its first line and the tokens
       * wrap beneath it.
       */
      style={{ x: box.x, y: box.y, height: TRAY_H, paddingLeft: TRAY_PAD }}
      className="pointer-events-none absolute top-0 left-0 flex items-center whitespace-nowrap font-mono text-meta text-bg"
    >
      {/* one phrase rather than a number with a fixed word beside it, or the
          tray says "1 lenses". The tray's width is measured from the widest
          case, so a shorter phrase leaves space rather than moving anything. */}
      <span className="tabular-nums">
        {reduce ? (
          said(count)
        ) : (
          <TextMorph duration={200} ease="cubic-bezier(0.32, 0.72, 0, 1)">
            {said(count)}
          </TextMorph>
        )}
      </span>
    </motion.span>
  );
}

/* ------------------------------------------------------------------ values */

function useBox(boxes: React.RefObject<Map<string, Box>>, id: string): Box {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const w = useMotionValue(0);
  const h = useMotionValue(id === "tray" ? TRAY_H : CHIP_H);
  const melt = useMotionValue(0);
  const seat = useMotionValue(0);
  const existing = boxes.current.get(id);
  if (existing) return existing;
  const box = { x, y, w, h, melt, seat };
  boxes.current.set(id, box);
  return box;
}

function read(box: Box): Rect {
  return { x: box.x.get(), y: box.y.get(), w: box.w.get(), h: box.h.get() };
}

function set(box: Box, rect: Rect): void {
  box.x.set(rect.x);
  box.y.set(rect.y);
  box.w.set(rect.w);
  box.h.set(rect.h);
}

function move(
  box: Box,
  rect: Rect,
  transition: object,
  onComplete?: () => void,
): void {
  animate(box.x, rect.x, { ...transition, onComplete });
  animate(box.y, rect.y, transition);
  animate(box.w, rect.w, transition);
  animate(box.h, rect.h, transition);
}
