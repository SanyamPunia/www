"use client";

import { motion } from "motion/react";
import Image from "next/image";
import type React from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  armPokeSound,
  poke as playPoke,
  RATE_ON_DROP,
  rateAt,
  warmPokeSound,
} from "@/components/home/poke-sound";
import { deny, useFalling } from "@/components/home/use-falling";
import { cn } from "@/lib/utils";

/** 40px exactly. `size-12.5` is 0.2rem x 12.5, which lands on a whole pixel. */
const SIZE = "size-12.5";
const SIZE_PX = 40;

/**
 * How many pokes it takes, and how long a streak survives a pause.
 *
 * The streak is what keeps this an easter egg rather than a hazard. Without it
 * the count is cumulative for the life of the page, so eight idle clicks spread
 * over a visit drop the photo on someone who never asked for it. Two seconds is
 * long enough that a deliberate flurry never resets and short enough that a
 * curious single poke leads nowhere.
 */
const POKES = 8;
const STREAK_MS = 2000;

/**
 * How hard the photo shakes on poke n.
 *
 * A circle turning shows nothing, so this only reads because what turns is the
 * portrait inside it. It ramps, which is the only thing on the page saying the
 * pokes are being counted: 4.2 degrees on the first and 9 on the last before it
 * goes. Nothing else marks the streak, since a counter would give the joke away.
 */
const wobbleAt = (poke: number) => Math.min(3.4 + poke * 0.8, 9);

/**
 * The nudge each body leaves the slot with, sideways and turning.
 *
 * **Opposite ways, and the cover a beat later.** They are two objects in a stack
 * rather than one object, so the drop has to look like two things coming loose:
 * matched velocities read as one shape splitting in half. The beat is the bigger
 * half of that, and 80ms is enough to see the front one go first without the
 * second reading as an afterthought.
 *
 * The speeds are 44 and -58 rather than the 26 and -34 they started at, because
 * at those the two landed 36px apart with 40px boxes, so they came to rest
 * touching and read as one having landed on the other. The cover carries the
 * larger of the two, since it starts 12px to the right and has that to give back
 * before it is going anywhere.
 */
const PHOTO_LAUNCH = { speed: 44, spin: -30 };
const COVER_LAUNCH = { speed: -58, spin: 22 };
const COVER_BEAT = 80;

/**
 * How the cover slides between the front of the stack and its own place behind
 * it, and where its own place is when nothing is in front of it.
 *
 * **A cover put back on its own takes the photo's spot and starts turning.** It
 * is the only thing in the slot, so sitting 12px to the right of nothing would
 * read as a misplaced disc, and a record with nothing on top of it is a record
 * playing. Putting the photo back on top is what sends it home: it slides right
 * into its usual offset and stops.
 *
 * The curve is the disc's own reveal curve from `now-playing.tsx`, so the slide
 * back and the slide the cover already does on hover are the same movement.
 */
const FRONT = { x: 0, y: 0 };
/*
 * Two properties on two clocks, so the shorthand is spelled out: the slide is the
 * disc's own reveal curve and the dim is a plain 200ms step, and Tailwind's
 * `transition-*` utilities can only carry one duration between them.
 */
const SLIDE = cn(
  "[transition:transform_460ms_cubic-bezier(0.22,1,0.36,1),opacity_200ms_ease-out]",
  "motion-reduce:[transition:opacity_200ms_ease-out]",
);

/**
 * The empty place in the stack. There is one, and it is the photo's.
 *
 * **One ring for the stack rather than one per body.** The cover has no ring of
 * its own and does not need one: a cover put back on its own goes to the front,
 * which is this ring, and a cover going back behind a photo that is already home
 * has the photo itself as its landmark. Two overlapping dashed circles 12px apart
 * at this size said one thing twice.
 *
 * **`absolute inset-0`, never in flow, and this was a bug.** As a block it took
 * the slot's one 40px row, so with the cover loose and the photo home the two
 * shared the flow and the photo sat 40px below where it belongs. The slot is a
 * fixed `size-12.5` box, so nothing inside it needs to hold it open.
 *
 * **Arming moves the tone, and fills the ring only when the ring is empty.** The
 * dashes stay dashed either way: a dashed ring going solid changes what the thing
 * is rather than what state it is in. They step from `stroke-strong` to
 * `text-secondary`, 1.2:1 on white against 5.3:1.
 *
 * The fill is `FILLED`, and it is conditional because the ring paints above
 * whatever is in the slot. Over an empty slot an opaque `bg-fill` is the clearest
 * thing there is, and over a cover that has been put back it wiped the album art
 * out the moment the magnet caught: the cover appeared to vanish and come back.
 * So the halo case gets the tone alone and the cover dims for the other half of
 * the signal.
 *
 * Armed is written straight to the slot as a data attribute rather than held in
 * state, so a drag renders nothing at all, and it is on the slot rather than on
 * the ring because the cover has to read it too. `border-2` and not a ring: a
 * dashed ring is not a thing, and a hairline dash at this diameter reads as a
 * smudge.
 */
const PLACEHOLDER = cn(
  "absolute inset-0 rounded-full border-2 border-dashed border-stroke-strong",
  "transition-colors duration-200",
  "group-data-[armed=true]/slot:border-text-secondary",
);

/** and the fill, for a ring with nothing of its own under it */
const FILLED = "group-data-[armed=true]/slot:bg-fill";

/**
 * How the docked cover answers a photo about to land on it.
 *
 * A step of light, not a curtain: it is still the album art of what is playing,
 * and what the moment means is that something is going on top of it.
 */
const DIMMED = "group-data-[armed=true]/slot:opacity-45";

/**
 * How far round the real disc's turn had got, in degrees.
 *
 * **This is what makes the handover continuous in both directions.** The disc
 * turns whenever the avatar is whole, so at the moment a piece comes loose it is
 * at some angle, and a copy drawn at zero jumps by exactly that angle: on the
 * drop, and again when the cover is put back. The copy holds this instead, and
 * `data-loose` freezes the real one at the same place until the stack is whole
 * again, so neither swap moves it.
 *
 * A held angle rather than a matched animation, and the copy spun in phase for a
 * while. A record turning while it falls and while it lies on the floor is not
 * what a record does, and the two ideas do not have to be traded: nothing turning
 * is also nothing to disagree about.
 *
 * `rotate` rather than `transform`, since `disc-spin` animates the property, and
 * `none` before the first frame parses to nothing, which is zero.
 */
const spinAngle = (disc: Element) =>
  Number.parseFloat(getComputedStyle(disc).rotate) || 0;

/** what a loose body is, as opposed to one sitting in the slot */
const LOOSE =
  "absolute cursor-grab touch-none data-[held=true]:cursor-grabbing";

interface PortraitProps {
  /**
   * What is stacked behind the photo, which is the album cover of whatever is
   * playing, or nothing.
   *
   * Passed in rather than rendered here so `Avatar` stays a server component, and
   * hidden rather than unmounted while its copy is loose: it owns a fetch, a poll
   * and a reveal animation, and remounting it would refetch, repaint from empty
   * and slide the cover out again in the middle of a fall.
   */
  behind?: React.ReactNode;
}

/**
 * The photo at the top of the home page, which can be poked out of its slot.
 *
 * Poking it wobbles it. Poking it {@link POKES} times in one flurry knocks the
 * stack out of the page, leaving a dashed slot behind, and from there each body
 * is thrown around the page, falls where it is let go, and is caught by the
 * slot's magnet on the way back. `useFalling` owns everything one body does and
 * this file owns what they are and when they go.
 *
 * **It is not a button and it is not in the tab order.** The photo is `alt=""`
 * decorative, so a control here has no honest label: "wobble the portrait" puts
 * an unlabelled-in-practice stop at the top of every page load, forever, in
 * exchange for a joke. So the listeners are bound to the node rather than written
 * as JSX props, the same call `document-pocket` and `stamp-collection` make for
 * their stages, and a keyboard is given the one thing it actually needs: Escape
 * puts a loose body back.
 */
export function Portrait({ behind }: PortraitProps) {
  /*
   * One node is the slot and the armed flag both: it is the box everything is
   * measured against, and it is what the ring and the docked cover read the arm
   * off, so there is nothing for a second element to do.
   */
  const slot = useRef<HTMLDivElement>(null);
  const nest = useRef<HTMLDivElement>(null);

  /*
   * Where the cover sits inside the slot, captured when it comes loose.
   *
   * A ref rather than state because `useFalling` re-reads it whenever the column
   * reflows, and by then the real cover is hidden and would measure zero.
   */
  const coverAt = useRef({ x: 0, y: 0 });

  /* both bodies arm the same thing, since there is one place in the stack to
     arm and the slot is what carries the flag for the ring and the cover alike */
  const photo = useFalling({ slot, mark: slot, ...PHOTO_LAUNCH });
  const cover = useFalling({
    slot,
    mark: slot,
    offset: coverAt,
    delay: COVER_BEAT,
    ...COVER_LAUNCH,
  });

  /**
   * The cover's own art, snapshotted when it comes loose.
   *
   * **Read off the rendered disc rather than fetched again or passed down.** The
   * now-playing state belongs to the component in `behind`, which owns the fetch
   * and the poll, and lifting it up here to answer one question would put Spotify
   * inside the portrait. `PostRail` makes the same call for the same reason: it
   * reads the headings the page rendered rather than reimplementing where they
   * came from.
   *
   * It is a snapshot, so a track change while the cover is on the floor leaves
   * the old art lying there, which is what a fallen object does.
   */
  const [art, setArt] = useState<string | null>(null);

  /** and how far round its turn the disc was when the snapshot was taken */
  const [artAngle, setArtAngle] = useState(0);

  /*
   * The same offset again, for the ring to sit on. `coverAt` is the copy the hook
   * reads on a reflow and a ref cannot be read during a render, so the value the
   * markup needs is state.
   */
  const [coverFrom, setCoverFrom] = useState({ x: 0, y: 0 });

  /**
   * The cover is home, at the front of the stack, with nothing on top of it.
   *
   * All this decides now is where the ring goes, since the ring has to become a
   * halo rather than draw on the cover's own edge. It used to run the cover's spin
   * as well, and see `now-playing.tsx` for why it does not.
   */
  const solo = photo.out && !cover.out && art !== null;

  /**
   * Where the cover's home is inside the slot: the front of the stack while the
   * photo is out of it, its own offset behind the photo otherwise.
   *
   * **One value for the dock and for what paints, and having two was a bug.** The
   * loose copy was drawn from the cover's own offset while the magnet measured
   * against the front, so it came to rest 12px right of where it was aiming and
   * then jumped left as the real one took over: placing the cover moved it right
   * and then into place. Whatever the magnet calls zero has to be what zero
   * paints at.
   */
  const coverHome = useMemo(
    () => (photo.out ? FRONT : coverFrom),
    [coverFrom, photo.out],
  );

  const pokes = useRef(0);
  const streak = useRef(0);

  /**
   * Knock the stack out of the slot, front first.
   *
   * **The cover's place is measured off its anchor and its art off the image
   * inside it, and reading both off the image was a bug.** That image is the part
   * that turns, so once the disc has been hovered its own rect is the bounding
   * box of a rotated square: 56.4px across at 45 degrees, sitting 8.2px above and
   * left of where the disc actually is. The anchor never turns, so its box is the
   * disc's box.
   */
  const knock = useCallback(() => {
    const live = nest.current?.querySelector("a");
    const art = live?.querySelector("img");
    const box = slot.current?.getBoundingClientRect();

    if (live && art && box) {
      const at = live.getBoundingClientRect();
      const from = { x: at.left - box.left, y: at.top - box.top };
      setCoverFrom(from);
      setArt(art.currentSrc || art.src);
      setArtAngle(spinAngle(art));

      /*
       * **It leaves now and falls a beat later, and it leaves from where it
       * is.** Its home is the front from this moment, since the photo is going,
       * so zero is 12px left of where the cover is sitting: starting the loose
       * copy at the offset it really has is what stops the swap from jumping.
       * Leaving now rather than in 80ms is what stops the slot painting a cover
       * whose place has already moved.
       */
      coverAt.current = FRONT;
      cover.x.set(from.x);
      cover.y.set(from.y);
      cover.drop();
    }

    photo.drop();
  }, [cover.drop, cover.x, cover.y, photo]);

  /*
   * The poke, while the photo is in its slot.
   *
   * Heard on `pointerup` rather than `click`, which keeps it a poke rather than
   * an activation, and is the same call `book-opening` makes for its tap. There
   * is no drag available in this state, so the two are the same gesture anyway,
   * and `deny` is a second reason: preventing a pointerdown suppresses the
   * compatibility mouse events it would have produced, `click` among them.
   */
  useEffect(() => {
    const node = photo.body.current;
    if (!node || photo.out) return;

    const poke = () => {
      window.clearTimeout(streak.current);
      streak.current = window.setTimeout(() => {
        pokes.current = 0;
      }, STREAK_MS);
      pokes.current += 1;

      if (pokes.current >= POKES) {
        window.clearTimeout(streak.current);
        playPoke(RATE_ON_DROP);
        pokes.current = 0;
        knock();
        return;
      }

      playPoke(rateAt(pokes.current));
      photo.wobble(wobbleAt(pokes.current));
    };

    /* the press is also where the audio clock is unlocked, since it is a real
       gesture and the sound is one event later */
    const press = (event: PointerEvent) => {
      deny(event);
      armPokeSound();
    };

    node.addEventListener("pointerup", poke);
    node.addEventListener("pointerdown", press);
    /* fetched and decoded on the way in, so the first poke is not the silent one */
    node.addEventListener("pointerenter", warmPokeSound);
    return () => {
      node.removeEventListener("pointerup", poke);
      node.removeEventListener("pointerdown", press);
      node.removeEventListener("pointerenter", warmPokeSound);
    };
  }, [knock, photo.body, photo.out, photo.wobble]);

  /*
   * **No selection ever starts anywhere in the slot, and putting this on the
   * photo alone was not enough.** A flurry does not stop when the stack leaves:
   * the eighth poke takes the photo out from under the pointer and the clicks
   * after it land on the empty slot, where a rapid multi-click anchors a selection
   * on the nearest text it can find, which up here is the page's `sr-only`
   * heading. A pair of `SelectionPins` carets then appears beside the placeholder
   * for a gesture that was aimed at a picture. The slot is the whole region the
   * gesture happens in, and `pointerdown` bubbles, so denying it here covers the
   * photo, the ring, the loose cover and the empty box between them. The loose
   * photo is portaled out of here and denies its own, in the hook.
   */
  useEffect(() => {
    const node = slot.current;
    if (!node) return;
    node.addEventListener("pointerdown", deny);
    return () => node.removeEventListener("pointerdown", deny);
  }, []);

  /*
   * The snapshot is dropped once the whole stack is home, not when the cover
   * lands: while the photo is still out it is what says this stack has a cover in
   * it at all, which the ring below needs and which a no-song page must not
   * claim.
   */
  useEffect(() => {
    if (!cover.out && !photo.out) setArt(null);
  }, [cover.out, photo.out]);

  /*
   * Where the cover's home is, which is the front of the stack while the photo is
   * not in it.
   *
   * Re-measured on the crossing rather than only at the drop, or a cover still
   * loose when the photo lands would keep homing to the spot the photo just took.
   * `remeasure` corrects its offsets by however far its dock moved, so a cover in
   * mid-air does not jump when the front is given back.
   */
  useEffect(() => {
    coverAt.current = coverHome;
    cover.remeasure();
  }, [cover.remeasure, coverHome]);

  useEffect(() => () => window.clearTimeout(streak.current), []);

  /*
   * One element in two places. Moving a body between the slot and the portal
   * remounts it, which costs nothing here: the browser has the file and the src
   * does not change.
   *
   * **The portal is not a preference.** `RevealItem` animates `filter` and
   * finishes at `blur(0px)`, which is still a filter, and a filter makes its
   * element the containing block for absolutely and fixed positioned descendants
   * alike. So a body positioned inside the reveal could never leave it. In `body`
   * with no positioned ancestor, `absolute` resolves against the initial
   * containing block, which is page coordinates: a loose body lies on the page
   * and scrolls with it rather than sticking to the glass, and no scroll listener
   * is needed to keep the magnet honest.
   */
  const portrait = (
    <motion.div
      ref={photo.body}
      style={
        photo.out
          ? {
              x: photo.x,
              y: photo.y,
              rotate: photo.angle,
              left: photo.dock.left,
              top: photo.dock.top,
            }
          : { x: photo.x, y: photo.y, rotate: photo.angle }
      }
      className={cn(
        SIZE,
        "select-none rounded-full",
        photo.out ? cn(LOOSE, "z-40") : "relative cursor-pointer",
      )}
    >
      {/*
       * `ring-2 ring-bg` is what makes this read as a stack rather than two
       * circles overlapping. The ring is the page background, so the photo cuts
       * a clean gap out of the cover behind it, the same trick a stacked avatar
       * group uses. A `ring-stroke` hairline here instead would draw a grey line
       * across the cover and the two would read as one flat shape. Loose it is
       * what keeps the photo an object lying on the page: this site has no shadow
       * outside the labs, so the gap is the whole edge.
       *
       * `alt=""`. The photo is adjacent to the page's `h1`, which already reads
       * "Sanyam Punia", so naming it again would just repeat that. What a
       * portrait actually conveys is not something alt text can carry.
       *
       * `priority` because it is the first paint above the fold and the only
       * image on the route, so lazy-loading it only delays the thing a visitor
       * sees first.
       */}
      <Image
        src="/assets/sanyam.png"
        alt=""
        width={SIZE_PX}
        height={SIZE_PX}
        priority
        draggable={false}
        className={cn(
          SIZE,
          "select-none rounded-full object-cover ring-2 ring-bg",
        )}
      />
    </motion.div>
  );

  /*
   * **The loose cover stays in the slot rather than going to the portal, and that
   * is what fixes the stacking.** A portal appends to `body`, so a loose cover
   * painted above the whole page including a photo already home: carrying it in
   * showed it on top of the photo, and landing it snapped 70% of it behind the
   * photo in one frame. Left in the slot and before the photo in document order,
   * it is behind the photo the entire time it is being carried, which is where it
   * is going, so the landing changes no layer at all.
   *
   * It costs nothing else. `absolute` here resolves against the slot rather than
   * the page, so its `left` and `top` are the offset it already had rather than
   * page coordinates, and everything the hook measures is in offsets from the
   * dock either way. Nothing in the column clips, so it still travels the whole
   * viewport, and it still scrolls with the page.
   *
   * The photo keeps its portal, and has to: it is what `RevealItem`'s `blur(0px)`
   * would trap, and nothing needs to paint above it.
   *
   * The loose cover is a plain circle of the art and nothing else.
   *
   * **Not the disc itself, which stays mounted and hidden.** That one is a link
   * with a tooltip and a reveal keyed off its own hover, neither of which belongs
   * on something lying on the floor: a fallen object is not a control. Keeping it
   * mounted is also what keeps the fetch and the poll behind it alive, so putting
   * the cover back is instant rather than a refetch.
   *
   * **It does keep the turn, at the phase the real one was at.** The record is
   * still playing while it falls, and matching the phase is what stops the
   * handover jumping by whatever angle the real one had reached. See
   * {@link spinPhase}.
   *
   * `ring-1 ring-stroke` rather than the photo's `ring-2 ring-bg`, because the
   * hairline is the edge the real disc carries, and out here there is no photo in
   * front of it for a background-coloured ring to cut a gap out of.
   */
  const record = art ? (
    <motion.div
      ref={cover.body}
      style={{
        x: cover.x,
        y: cover.y,
        rotate: cover.angle,
        left: coverHome.x,
        top: coverHome.y,
      }}
      className={cn(SIZE, "select-none rounded-full", LOOSE)}
    >
      {/*
        biome-ignore lint/performance/noImgElement: a remote Spotify CDN url, so
        next/image would need `i.scdn.co` in remotePatterns and would route a
        40px disc through the image optimiser on every track change
      */}
      <img
        src={art}
        alt=""
        width={SIZE_PX}
        height={SIZE_PX}
        draggable={false}
        /* held at the angle the turn had reached, which the real one is frozen at
           too for as long as any piece of the stack is out of the slot */
        style={{ rotate: `${artAngle}deg` }}
        className={cn(
          SIZE,
          "select-none rounded-full object-cover ring-1 ring-stroke",
        )}
      />
    </motion.div>
  ) : null;

  return (
    <div
      ref={slot}
      /* a record off the turntable does not turn. See `now-playing.tsx`. */
      data-loose={photo.out || cover.out ? "true" : undefined}
      className={cn("group/slot relative", SIZE)}
    >
      {/*
       * What is behind the photo, in a box of exactly the slot's own size, so the
       * cover inside it keeps the geometry it would have had against the avatar.
       *
       * **A real box rather than `display: contents`, because it is what slides.**
       * A `contents` element has no box to transform, and the cover's own
       * position is markup this file does not own. Shifting the box it resolves
       * against is what puts the cover at the front of the stack and slides it
       * back when the photo returns.
       *
       * **`invisible` while the loose copy is out, never `hidden`, and this was a
       * bug with a very visible tell.** `display: none` cancels a CSS animation
       * and restoring display replays it from the start, so the moment the cover
       * was put back its own `cover-reveal` ran again: it began at `translate: 0`
       * and `opacity: 0`, which is 12px left of where it rests and invisible, and
       * slid right. Placing the cover made it jump left, fade, and crawl back.
       * `visibility: hidden` leaves the animation alone, takes the copy out of
       * hit testing just the same, and the reveal stays finished where it
       * finished.
       *
       * Measured through the swap, as offset from home over opacity: on `hidden`
       * it was -12/0, -5.5/0.54, -2.8/0.77, -1/0.92, -0.1/0.99, 0/1, and on
       * `invisible` it is 0/1 on every frame.
       *
       * **And `hidden` for the other case, which wants the opposite.** A song
       * starting while the photo is out puts a cover in a slot whose front is
       * empty, and it painted at its own indented offset with nothing to be
       * indented from. That one was never part of the drop, so there is nothing
       * to hand over to and nothing to hold still for: it stays out of the layout
       * until the photo is home, and `display: none` is what makes its own
       * `cover-reveal` play when it finally arrives, which is the introduction it
       * would have had. `art` is what tells the two apart, being the snapshot the
       * drop takes: a cover that came loose has one and a cover that turned up
       * afterwards does not.
       */}
      <div
        ref={nest}
        className={cn(
          "absolute inset-0",
          SLIDE,
          DIMMED,
          cover.out && "invisible",
          photo.out && art === null && "hidden",
        )}
        style={
          photo.out
            ? { transform: `translate(${-coverFrom.x}px, ${-coverFrom.y}px)` }
            : undefined
        }
      >
        {behind}
      </div>

      {/*
       * **The photo's ring steps outside the cover once the cover is home, and
       * this was a real mess.** On its own box it draws on the cover's own edge,
       * which at 40px reads as a perforated disc rather than as a place for
       * something: the dashes look like they belong to the album art. Four pixels
       * out it is a halo around the cover instead, which is what "the photo goes
       * on this" looks like, and it still lights when the magnet arms.
       */}
      {photo.out ? (
        <span
          aria-hidden="true"
          className={cn(PLACEHOLDER, solo ? "-inset-1" : FILLED)}
        />
      ) : null}

      {cover.out ? record : null}
      {photo.out ? createPortal(portrait, document.body) : portrait}
    </div>
  );
}
