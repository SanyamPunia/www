"use client";

import {
  AnimatePresence,
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
  useVelocity,
} from "motion/react";
import { useEffect, useRef, useState } from "react";
import { TextMorph } from "torph/react";
import { cn } from "@/lib/utils";
import {
  type Bounds,
  type Box,
  type Cell,
  cellFrom,
  cellLabel,
  clamp,
  DAYS,
  HOURS,
  hourLabel,
  limits,
  place,
  ROW,
  TODAY,
  timeLabel,
} from "./layout";

/*
 * A four-day calendar whose events are dragged between slots, and pile up into
 * a stack when one lands on another.
 *
 * Two Motion props carry the whole thing, and both answer the same question:
 * what stops a card being mangled on the way down.
 *
 *   `layout`             moves a card between cells. It measures the box before
 *                        the state change and after it, and animates the delta,
 *                        so nothing here computes a path.
 *   `layout="position"`  on the card's content, so the content does not stretch
 *                        while the card resizes around it. A layout animation
 *                        resizes with a transform, and a stack compresses every
 *                        member, so without this every line of every card in a
 *                        stack squashes and springs back on every drop.
 *
 * The drop needs a third thing that is easy to miss, and `SNAP` below is where
 * it is written down.
 */

/**
 * One hue per event, at two strengths.
 *
 * The same exception `tab-overview` and `document-pocket` take: colour is the
 * differentiator between cards built from the same two lines of text, so it
 * carries meaning rather than decorating. It stays in this file, these are not
 * design-system tokens, and nothing outside this experiment may reach for them.
 *
 * `tint` is the card's fill and lands between 1.24 and 1.42 on white, the band
 * `document-pocket` set, so a card reads as coloured without reading as heavy.
 * `mark` paints exactly one element, the dot beside the time.
 *
 * **The marks are the 700 step where `document-pocket`'s are the 600**, because
 * there a mark sits on white paper and here it sits on the card's own tint.
 * Amber-600 on amber-200 is 2.56:1 and fails the 3:1 a meaningful graphic needs.
 * Every pairing below clears 4:1 on its own tint.
 */
const HUES = {
  amber: { tint: "#fde68a", mark: "#b45309" },
  rose: { tint: "#fecdd3", mark: "#be123c" },
  blue: { tint: "#bfdbfe", mark: "#1d4ed8" },
  violet: { tint: "#ddd6fe", mark: "#6d28d9" },
  teal: { tint: "#99f6e4", mark: "#0f766e" },
} as const;

interface CalendarEvent {
  id: string;
  title: string;
  hue: keyof typeof HUES;
  day: number;
  slot: number;
  /**
   * Position in its cell's pile, compared and never read as an index. Landing
   * on a cell takes the highest order there plus one, so a card always arrives
   * on top, and cycling a pile drops the front card below the lowest.
   *
   * This is why the events array order never changes. `layout` only animates an
   * element that stayed mounted, and reordering the array to reorder the pile
   * would work, but it puts a DOM move in the middle of every drop for no gain.
   */
  order: number;
}

/**
 * One pile already made, at Thu 9:00.
 *
 * It is the only thing on the board saying stacking exists. Everything else
 * about the demo reads as a calendar, and a calendar with five loose events
 * gives a reader no reason to drop one onto another.
 */
const EVENTS: CalendarEvent[] = [
  { id: "standup", title: "Standup", hue: "amber", day: 0, slot: 0, order: 0 },
  { id: "gym", title: "Gym", hue: "rose", day: 1, slot: 2, order: 1 },
  { id: "sync", title: "Design sync", hue: "blue", day: 2, slot: 1, order: 2 },
  { id: "ana", title: "Ana 1:1", hue: "violet", day: 3, slot: 0, order: 3 },
  { id: "coffee", title: "Coffee", hue: "teal", day: 3, slot: 0, order: 4 },
];

/**
 * The card being dropped, and the wash travelling ahead of it.
 *
 * Mass is left at Motion's default 1, deliberately, because `SNAP` cannot set
 * one and the two have to match.
 */
const TRAVEL = { type: "spring", stiffness: 420, damping: 34 } as const;

/**
 * Every other card's move, which is the pile opening a slot or closing one.
 *
 * A spring's duration does not depend on how far it goes, and these two moves
 * are 7px where a drop is up to 500px. On `TRAVEL` the resize measured 181ms to
 * cover those 7px, which reads as a card easing rather than a pile reacting,
 * while the same spring over a whole grid reads as a throw. So the small move
 * gets its own, landing at about the 140ms the wash fades in.
 *
 * Overshoot is 1.3% at this damping ratio, which on 7px is 0.09px. It is a fast
 * ease in practice, and a spring only so the lab has one kind of curve in it.
 */
const SNAPPY = { type: "spring", stiffness: 1200, damping: 56 } as const;

/**
 * The drop is **two animations at once**, and they have to be the same spring.
 *
 * `dragSnapToOrigin` is what keeps the card from jumping the moment it lands.
 * Drag writes a plain `x`/`y` transform, an offset from wherever the card's box
 * currently is, and the drop moves that box to another cell. So at the instant
 * of the commit the offset is measured from a box that is no longer there, and
 * the card is wrong by the distance between the two cells.
 *
 * `layout` covers exactly that distance: its own transform starts at the old
 * cell and unwinds to the new one, so the two compose to the pointer's position
 * on the first frame and to the target cell on the last. Both ends are right
 * whatever the springs are. What the springs decide is the path in between, and
 * two different ones send the card round a curve on its way into the slot.
 *
 * An inertia bounce is a spring with `stiffness` and `damping` under other
 * names, at the default mass, so matching it is a matter of naming the same two
 * numbers. There is no decay phase to worry about: `dragMomentum={false}` hands
 * it a velocity of zero.
 *
 * Resetting `x` and `y` in `onDragEnd` instead does not work, and it is the
 * obvious first try. `layout` snapshots the box with the transform backed out,
 * so its animation starts at the origin cell rather than at the pointer, and the
 * card teleports home before setting off.
 */
const SNAP = {
  bounceStiffness: 420,
  bounceDamping: 34,
  restDelta: 0.5,
  restSpeed: 5,
} as const;

const FADE = { duration: 0.14, ease: "easeOut" } as const;

/**
 * The two labels that say where a card is, morphed rather than swapped.
 *
 * A card's time is derived from the row it sits in and the airborne label from
 * the cell under the pointer, so both are rewritten by a move rather than by
 * anything the reader typed. "9:00 AM" to "10:00 AM" and "Wed 10:00 AM" to "Thu
 * 11:00 AM" keep most of their characters, so morphing the few that change reads
 * as the same label being corrected, where a swap reads as a different label
 * arriving.
 *
 * `torph` takes text children only, never elements, which is why the dot beside
 * the time stays outside it.
 *
 * 220ms rather than its own 400ms default. The airborne label is rewritten every
 * time the pointer crosses a cell boundary, which is far more often than that,
 * and a morph still running when the next one starts reads as a smear.
 *
 * Milliseconds, unlike every other duration here. `torph` is not Motion.
 *
 * It reads `prefers-reduced-motion` itself, through `respectReducedMotion`,
 * which defaults on. So this is the one animation in the lab that neither
 * `MotionProvider` nor a `useReducedMotion` call governs.
 */
/**
 * How a card leans while it is being carried.
 *
 * Rotation off the horizontal velocity of the drag, so the card trails the hand
 * the way a held sheet of paper does. Nothing else on this site rotates and
 * nothing scales, so this is the whole of the physics: the lean says the card is
 * in the air and being moved, where a fixed tilt only said it was in the air.
 *
 * `MAX` is 12 degrees and `PER_DEGREE` is the velocity in px per second that buys
 * one of them, both calibrated against real drags rather than picked: 213px/s
 * leans 2.4 degrees and 2167px/s leans 9.5. A slow reposition should still barely
 * register, since the lean is meant to say the card is being carried and not that
 * it is selected.
 *
 * The spring's own rise time is what holds a very short flick short of the clamp,
 * which is correct: a carry that is over inside 100ms has not had time to lean.
 * It is also why raising `MAX` alone changes little, and why the tilt is turned up
 * by lowering `PER_DEGREE`.
 *
 * The spring is deliberately the loosest in the file. Damping ratio 0.57 puts
 * 11% of overshoot on it, which is 0.9 degrees at full lean, and that wobble as
 * the hand stops is the part that reads as weight. The others here are tuned to
 * arrive without one.
 */
const LEAN = { MAX: 12, PER_DEGREE: 110 } as const;
const LEAN_SPRING = { stiffness: 500, damping: 18, mass: 0.5 } as const;

const MORPH = {
  duration: 220,
  ease: "cubic-bezier(0.32, 0.72, 0, 1)",
} as const;

/**
 * `rounded-lg` as a number, passed through `style` rather than as that class.
 *
 * Motion animates size with a transform, which stretches a corner radius along
 * whichever axis grew, and it undoes that only for values it renders itself. A
 * radius that lives in a class is invisible to its scale corrector, so the
 * corners flatten for the length of every drop and snap back at the end. It also
 * has to be px or a percentage, since Motion returns any other unit untouched.
 */
const RADIUS = 8;

/**
 * The hour gutter's width, in both places that need it: the column itself and
 * the spacer that holds the day heads off it. `w-12` was the first pick and is
 * 38.4px, which wraps "10 am" onto two lines.
 *
 * A literal string rather than a value, since Tailwind only compiles class names
 * it can read in the source.
 */
const GUTTER = "w-14 shrink-0";

/*
 * The project's focus pattern, unchanged.
 *
 * It was an `outline` for a while, because a ring is a box-shadow and so was the
 * hairline each card used to carry in its own hue, and the ring won. The cards
 * have no border now, so there is nothing left for it to replace.
 */
const FOCUS =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-primary/15 focus-visible:ring-offset-2";

/** which way each arrow key moves a focused card */
const STEP: Record<string, Cell> = {
  ArrowLeft: { day: -1, slot: 0 },
  ArrowRight: { day: 1, slot: 0 },
  ArrowUp: { day: 0, slot: -1 },
  ArrowDown: { day: 0, slot: 1 },
};

/** a card in the air: which one, and the cell it is currently over */
interface Lift extends Cell {
  id: string;
}

function EventCard({
  event,
  box,
  zIndex,
  depth,
  count,
  lifted,
  move,
  label,
  constraints,
  onLift,
  onOver,
  onDrop,
  onCycle,
  onNudge,
}: {
  event: CalendarEvent;
  box: Box;
  zIndex: number;
  depth: number;
  count: number;
  lifted: boolean;
  /** `TRAVEL` for the card a drop is carrying, `SNAPPY` for everything else */
  move: typeof TRAVEL | typeof SNAPPY;
  /** the target cell's name, while this card is the one in the air */
  label: string | null;
  /** how far this card may go, in transform offsets. See `limits`. */
  constraints: ReturnType<typeof limits> | false;
  onLift: (id: string) => void;
  onOver: (point: { x: number; y: number }) => void;
  onDrop: (id: string, point: { x: number; y: number }) => void;
  onCycle: (id: string) => void;
  onNudge: (id: string, step: Cell) => void;
}) {
  const hue = HUES[event.hue];
  const reduce = useReducedMotion();

  /*
   * Owned here rather than left to Motion, so reduced motion can end the snap
   * on the frame it starts. `MotionProvider` covers the layout animation, which
   * it drops to `type: false`, but not the drag's own return to origin, and an
   * instant relocation beside a springing offset is the jump `SNAP` exists to
   * prevent, arriving from the other side.
   */
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  /*
   * 1 while the card is being carried, 0 otherwise, and an input to the lean
   * rather than a branch around it.
   *
   * It has to gate the lean, because `x` keeps moving after the release: it is
   * what `dragSnapToOrigin` unwinds, and that unwind is the residual of the drag
   * offset rather than the card's own travel. A card carried right across the
   * grid would read a large leftward velocity on landing and snap the wrong way
   * over. Zeroing this at the release lets the spring level the card out while it
   * flies into the slot, which is what a card being put down does.
   *
   * Set in the gesture handlers rather than from `lifted` in an effect, since the
   * card already knows both moments and neither needs a render.
   */
  const grip = useMotionValue(0);
  const velocity = useVelocity(x);
  const rotate = useSpring(
    useTransform([velocity, grip], ([carried, held]: number[]) =>
      held === 0
        ? 0
        : Math.max(-LEAN.MAX, Math.min(LEAN.MAX, carried / LEAN.PER_DEGREE)),
    ),
    LEAN_SPRING,
  );

  /*
   * A drag ends with a `click` on the button it started on, so the pile would
   * cycle on every drop. Set at drag start, which is past the gesture's own
   * threshold, so a real click never sees it.
   */
  const dragged = useRef(false);

  return (
    <motion.button
      type="button"
      layout
      transition={move}
      drag
      dragConstraints={constraints}
      dragElastic={0}
      dragMomentum={false}
      dragSnapToOrigin
      dragTransition={SNAP}
      onDragStart={() => {
        dragged.current = true;
        // reduced motion gets no lean at all. `useSpring` is a hook rather than a
        // motion component, so `MotionProvider` does not reach it.
        grip.set(reduce ? 0 : 1);
        onLift(event.id);
      }}
      onDrag={(_, info) => onOver(info.point)}
      onDragEnd={(_, info) => {
        grip.set(0);
        if (reduce) {
          x.jump(0);
          y.jump(0);
        }
        onDrop(event.id, info.point);
      }}
      onClick={() => {
        if (dragged.current) {
          dragged.current = false;
          return;
        }
        onCycle(event.id);
      }}
      onKeyDown={(keyEvent) => {
        const step = STEP[keyEvent.key];
        if (!step) return;
        // or the page scrolls out from under the card being moved
        keyEvent.preventDefault();
        onNudge(event.id, step);
      }}
      aria-label={
        count > 1
          ? `${event.title}, ${cellLabel(event.day, event.slot)}, card ${depth + 1} of ${count}`
          : `${event.title}, ${cellLabel(event.day, event.slot)}`
      }
      style={{
        ...box,
        x,
        y,
        rotate,
        zIndex,
        borderRadius: RADIUS,
        ...({ "--mark": hue.mark, "--tint": hue.tint } as React.CSSProperties),
      }}
      /*
       * `cursor-grab`, the second place this project's "cursor-pointer on every
       * clickable element" rule is off, after `tether-button`. A card is grabbed
       * far more often than it is clicked.
       *
       * `overflow-hidden` clips content to the box the card is currently
       * painting, which during a layout animation is the destination while the
       * transform is still the source. `place` never takes a card under the
       * height its content needs, so this is a guard rather than the mechanism.
       *
       * The lift is paint and rotation, never scale. Nothing on this site scales,
       * and a card growing under the pointer would move the box the drag offset
       * is measured from as well. The shadow arrives at once and only its
       * departure is timed, the same asymmetry `cursor-origin-button` uses: a
       * flick of a drag shorter than the transition would otherwise never reach
       * its own lift.
       */
      className={cn(
        "absolute cursor-grab overflow-hidden bg-[var(--tint)] text-left active:cursor-grabbing",
        lifted ? "shadow-lg" : "transition-shadow duration-200",
        FOCUS,
      )}
    >
      {/*
       * Position-locked, which is the point of the whole experiment.
       *
       * The card's height is its cell's minus the peek of every card above it,
       * so landing on a pile takes 70px to 63px and every member of that pile
       * with it. `layout` covers a resize with a transform, and a plain child
       * inherits its parent's scale, so both lines and the dot would squash
       * vertically on the way in and spring back at the end. `layout="position"`
       * gives this box a projection node of its own that holds its real size
       * through the parent's, so the box moves and the content does not.
       *
       * Not `layout`, which would animate its size too and put it a frame
       * behind. Its size is not meant to change at all.
       */}
      <motion.span
        layout="position"
        transition={move}
        className={cn(
          // A title losing its tail is what `truncate` is for. A time losing
          // one character is a bug, and at 390px it was 0.72px from fitting:
          // 52.25px of "10:00 AM" in a 51.53px box, measured. `px-2` costs the
          // card 6.4px it does not have at that width and `px-1.5` costs 3.2 of
          // them, so the padding steps up with the column rather than the time
          // being shortened to clear a rounding error.
          "block px-1 py-1.5 sm:px-1.5",
          lifted && "opacity-10",
          "transition-opacity duration-150",
        )}
      >
        <span className="flex items-center gap-1">
          <span
            aria-hidden="true"
            className="inline-block size-1 shrink-0 rounded-full bg-[var(--mark)]"
          />
          {/*
           * `whitespace-nowrap` rather than `truncate`, since `torph` lays its
           * characters out itself and an `overflow-hidden` box would clip them
           * mid-morph. The card clips instead, which it already does.
           */}
          <TextMorph
            className="whitespace-nowrap text-meta text-text-secondary"
            duration={MORPH.duration}
            ease={MORPH.ease}
          >
            {timeLabel(event.slot)}
          </TextMorph>
        </span>
        <span className="block truncate text-meta text-text-primary">
          {event.title}
        </span>
      </motion.span>

      {/* the slot the card would land in, which is the one thing a reader
          cannot see while the card is covering it */}
      <AnimatePresence>
        {label && (
          <motion.span
            key="target"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={FADE}
            className="pointer-events-none absolute inset-0 flex items-center justify-center px-1 text-center text-meta text-text-primary"
          >
            {/* mounted by `AnimatePresence`, and `torph` skips its first render,
                so the label fades in whole and only later changes morph */}
            <TextMorph duration={MORPH.duration} ease={MORPH.ease}>
              {label}
            </TextMorph>
          </motion.span>
        )}
      </AnimatePresence>
    </motion.button>
  );
}

export default function EventStacking() {
  const [events, setEvents] = useState(EVENTS);
  const [lift, setLift] = useState<Lift | null>(null);

  const gridRef = useRef<HTMLDivElement>(null);
  /*
   * The grid's width in pixels, which is the one thing the constraints cannot be
   * written without: a card's box is a percentage across and the constraints are
   * transform offsets. Observed rather than measured once, since the column is
   * fluid, and it has to be in props before the gesture starts, because Motion
   * resolves constraints in its own `pointerdown` handler and that runs before
   * any React handler on the same element.
   */
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const grid = gridRef.current;
    if (!grid) return;

    const observer = new ResizeObserver(([entry]) =>
      setWidth(entry.contentRect.width),
    );
    observer.observe(grid);
    return () => observer.disconnect();
  }, []);
  /*
   * Measured once per gesture rather than per frame. The grid does not move
   * while a card is being dragged, and `getBoundingClientRect` in a pointer
   * handler is a layout read on every sample.
   */
  const bounds = useRef<Bounds>({ left: 0, top: 0, column: 0 });

  /*
   * The card a drop is still carrying, and the only one whose layout animation
   * has to be `TRAVEL`: it runs alongside the drag's own return to origin, and
   * the two compose only while they are the same spring. Nothing else on the
   * board is composed with anything, so nothing else is held to it.
   *
   * Set by the drop and cleared by every other way a card moves, rather than by
   * an animation callback, since a drop back into the cell it came from changes
   * no geometry and so completes no animation to hear about.
   */
  const [landing, setLanding] = useState<string | null>(null);

  const moveTo = (id: string, cell: Cell, dropped = false) => {
    setLanding(dropped ? id : null);
    setEvents((prev) => {
      const top = Math.max(...prev.map((event) => event.order)) + 1;
      return prev.map((event) =>
        event.id === id ? { ...event, ...cell, order: top } : event,
      );
    });
  };

  const onLift = (id: string) => {
    const grid = gridRef.current;
    const event = events.find((candidate) => candidate.id === id);
    if (!grid || !event) return;

    setLanding(null);
    const rect = grid.getBoundingClientRect();
    bounds.current = {
      left: rect.left + window.scrollX,
      top: rect.top + window.scrollY,
      column: rect.width / DAYS.length,
    };
    setLift({ id, day: event.day, slot: event.slot });
  };

  const onOver = (point: { x: number; y: number }) => {
    const cell = cellFrom(point, bounds.current);
    /*
     * Returning the same object when the cell has not changed is what keeps a
     * pointermove out of the render path. Motion fires `onDrag` on every sample,
     * and the only thing downstream of it is which cell is highlighted.
     */
    setLift((prev) =>
      !prev || (prev.day === cell.day && prev.slot === cell.slot)
        ? prev
        : { ...prev, ...cell },
    );
  };

  const onDrop = (id: string, point: { x: number; y: number }) => {
    setLift(null);
    // read from the point again rather than from `lift`, so the commit cannot
    // disagree with the pointer that made it
    moveTo(id, cellFrom(point, bounds.current), true);
  };

  /**
   * Bring a card to the front of its pile, or send the front card to the back.
   *
   * One rule covers both directions, which is what makes a pair of cards a
   * toggle and a pile of three a deck.
   */
  const onCycle = (id: string) => {
    setLanding(null);
    setEvents((prev) => {
      const card = prev.find((event) => event.id === id);
      if (!card) return prev;

      const pile = prev.filter(
        (event) => event.day === card.day && event.slot === card.slot,
      );
      if (pile.length < 2) return prev;

      const orders = pile.map((event) => event.order);
      const front = card.order === Math.max(...orders);
      const order = front ? Math.min(...orders) - 1 : Math.max(...orders) + 1;

      return prev.map((event) =>
        event.id === id ? { ...event, order } : event,
      );
    });
  };

  const onNudge = (id: string, step: Cell) => {
    const card = events.find((event) => event.id === id);
    if (!card) return;
    moveTo(id, {
      day: clamp(card.day + step.day, DAYS.length - 1),
      slot: clamp(card.slot + step.slot, HOURS.length - 1),
    });
  };

  const lifted = lift
    ? events.find((event) => event.id === lift.id)
    : undefined;

  /*
   * A pile, bottom card first. Which of these the drag adds to or takes from is
   * decided per card, at the call site.
   *
   * The one card it never changes is the lifted one, which keeps the box it had
   * at rest for the whole gesture. Motion would survive it moving, it watches
   * its own `didUpdate` and adds the layout delta back into both the drag origin
   * and the offset, so that is a design call rather than a workaround: a card
   * that resizes under the pointer reads as the pointer doing it, and the piles
   * around it are what should be reacting.
   */
  const pileAt = (day: number, slot: number) =>
    events
      .filter((event) => event.day === day && event.slot === slot)
      .sort((a, b) => a.order - b.order);

  return (
    /*
     * `select-none`, since every gesture here is a drag across type: without it a
     * pointer that misses a card by a few pixels selects the day heads and the
     * hour labels, and one that hits a card leaves its own two lines highlighted
     * behind it. Scoped to the window, so the hint the page renders under it
     * stays selectable prose.
     */
    <div className="flex w-full select-none flex-col gap-2 rounded-2xl bg-surface p-2 ring-1 ring-stroke-soft ring-inset">
      <div className="flex">
        <div className={GUTTER} />
        {DAYS.map((day, index) => (
          <div
            key={day.label}
            className="flex flex-1 flex-col items-center gap-0.5"
          >
            <span className="text-meta text-text-muted">{day.label}</span>
            <span
              className={cn(
                "flex size-6 items-center justify-center rounded-full text-meta",
                index === TODAY
                  ? "bg-text-primary text-bg"
                  : "text-text-secondary",
              )}
            >
              {day.date}
            </span>
          </div>
        ))}
      </div>

      <div className="flex">
        <div className={GUTTER}>
          {HOURS.map((hour, slot) => (
            <div
              key={hour}
              className="flex justify-end pr-2"
              style={{ height: ROW }}
            >
              <span className="whitespace-nowrap text-meta text-text-muted">
                {hourLabel(slot)}
              </span>
            </div>
          ))}
        </div>

        {/* the cards are absolute inside this, so it is the box every
              measurement and every constraint is taken from */}
        <div ref={gridRef} className="relative flex-1">
          {HOURS.map((hour, slot) => (
            <div key={hour} className="flex" style={{ height: ROW }}>
              {DAYS.map((day, index) => (
                <div
                  key={day.label}
                  className={cn(
                    "flex-1 border-stroke",
                    slot > 0 && "border-t",
                    index > 0 && "border-l",
                  )}
                />
              ))}
            </div>
          ))}

          {/* one highlight that travels, rather than a class on each cell. It
                carries `layout`, so crossing into the next slot slides it. */}
          <AnimatePresence>
            {lift && (
              <motion.div
                key="target"
                layout
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ ...FADE, layout: TRAVEL }}
                className="pointer-events-none absolute bg-fill-hover"
                style={{
                  left: `${(lift.day * 100) / DAYS.length}%`,
                  width: `${100 / DAYS.length}%`,
                  top: lift.slot * ROW,
                  height: ROW,
                  // the card's own corner, since this reads as the shape the
                  // card is about to take rather than as a filled cell
                  borderRadius: RADIUS,
                }}
              />
            )}
          </AnimatePresence>

          {events.map((event) => {
            const isLifted = lift?.id === event.id;
            const resting = pileAt(event.day, event.slot);

            /*
             * Both piles answer the drag, and the card in the air does not.
             *
             * The cell it is heading for counts it before it lands, so the
             * cards already there keep their order, shift down and open the
             * slot on top. The cell it left drops it as soon as it is over
             * another one, so that pile closes up: a pair leaves a lone card
             * holding the whole cell, and a three leaves its new top card
             * relaxed and back at the top of it. Coming home reverses both,
             * since the two tests are the same test.
             *
             * `resting` is what the lifted card itself is placed from, so its
             * own box holds the size and the slot it had before the gesture.
             */
            let members = resting;
            let arriving = 0;

            if (!isLifted && lift && lifted) {
              const home =
                lifted.day === event.day && lifted.slot === event.slot;
              const over = lift.day === event.day && lift.slot === event.slot;

              if (home && !over) {
                members = resting.filter(
                  (candidate) => candidate.id !== lift.id,
                );
              } else if (over && !home) {
                arriving = 1;
              }
            }

            const rank = members.findIndex(
              (candidate) => candidate.id === event.id,
            );
            const count = members.length + arriving;
            const depth = count - 1 - rank;
            const box = place(event.day, event.slot, depth, count);

            return (
              <EventCard
                key={event.id}
                event={event}
                box={box}
                zIndex={isLifted ? 40 : 10 + rank}
                depth={depth}
                count={count}
                lifted={isLifted}
                move={landing === event.id ? TRAVEL : SNAPPY}
                label={isLifted ? cellLabel(lift.day, lift.slot) : null}
                constraints={width > 0 ? limits(event.day, box, width) : false}
                onLift={onLift}
                onOver={onOver}
                onDrop={onDrop}
                onCycle={onCycle}
                onNudge={onNudge}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
