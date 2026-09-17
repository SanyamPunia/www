"use client";

import { ArrowCounterClockwiseIcon, XIcon } from "@phosphor-icons/react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { FOCUS } from "@/components/lab/controls";
import { Tooltip, TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { NOTICES, type Notice } from "./notices";
import {
  BLUR,
  DROP_EASE,
  DROP_FADE,
  DROP_MS,
  DROP_SCALE,
  DROP_TIMES,
  DROP_Y,
  LEAVE,
  LEAVE_MS,
  LIFT,
  pose,
  RADIUS,
  REACH,
  SNAP,
  SPENT,
  type Stance,
  stanceAt,
} from "./stack";

/*
 * A pile of notices in a tray. Point at it and the one behind rises into a
 * thicker edge, move onto that edge and it rises again to say what it is, and
 * press to advance: the front notice lifts toward you and dissolves while the
 * one that was peeking comes forward into its place.
 *
 * **Nothing in here crossfades content.** Every card owns its own copy for the
 * whole session and what changes is which depth it is at, so a card arriving
 * at the front is not being filled in, it is being uncovered. That is
 * `folder-stack`'s claim about occlusion, arriving at a pile that stacks up
 * instead of a drawer that stacks back.
 */

export default function NoticeStack() {
  const reduce = useReducedMotion();
  const [items, setItems] = useState<Notice[]>(NOTICES);
  const [front, setFront] = useState(0);
  const [stance, setStance] = useState<Stance>("shut");
  /** the notice that just gave up the front slot, while its exit plays */
  const [spent, setSpent] = useState<string | null>(null);

  /** the close control owns the stance while the pointer is on it */
  const closing = useRef(false);
  const spentTimer = useRef<number | null>(null);
  const stage = useRef<HTMLDivElement>(null);
  /** set when a press came from the keyboard, so the next face takes focus */
  const chase = useRef(false);

  /*
   * **The face that advances the pile belongs to the card behind the front
   * one, so pressing it unmounts it**: that card is now the front and the next
   * one back grows the face instead. A keyboard user would be left on `body`
   * after one press, which is the same trap `inert` on the pile would have
   * been, so focus is handed along.
   *
   * Only when the press was a keyboard one. Moving focus on a mouse press
   * paints a focus ring on every click, since Chrome judges a scripted focus
   * rather than the press that led to it, which is what `sticker-peel`
   * documents running into from the other direction.
   */
  // biome-ignore lint/correctness/useExhaustiveDependencies: the face to chase is whichever card is at depth 1 after `front` moved, and the query finds it
  useEffect(() => {
    if (!chase.current) return;
    chase.current = false;
    stage.current?.querySelector<HTMLElement>("[data-face]")?.focus();
  }, [front]);

  useEffect(
    () => () => {
      if (spentTimer.current) window.clearTimeout(spentTimer.current);
    },
    [],
  );

  const cycle = useCallback(() => {
    if (items.length < 2) return;
    const on = document.activeElement;
    chase.current =
      on instanceof HTMLElement &&
      on.dataset.face !== undefined &&
      on.matches(":focus-visible");
    setSpent(items[front].id);
    setFront((f) => (f + 1) % items.length);
    if (spentTimer.current) window.clearTimeout(spentTimer.current);
    spentTimer.current = window.setTimeout(() => setSpent(null), SPENT);
  }, [items, front]);

  /*
   * Acting on a notice retires that one. Only the front notice carries a live
   * action, so the index check is also what stops a press landing on a card
   * already on its way out: it has left the list, so its index comes back -1
   * and never matches.
   */
  const retire = useCallback(
    (id: string) => {
      if (items.findIndex((n) => n.id === id) !== front) return;
      const rest = items.filter((_, i) => i !== front);
      setItems(rest);
      // the notice that slid into the retired one's index is the next in the
      // cycle, and the list running out is the only case that wraps
      setFront(front >= rest.length ? 0 : front);
      setSpent(null);
    },
    [items, front],
  );

  /*
   * The close control clears the tray rather than retiring one notice, which
   * is what the collapse it is already holding was a preview of: by the time
   * it is pressed the pile is one card, and one card is what drops.
   *
   * It unmounts under the pointer, so no `pointerleave` is coming to release
   * the stance it owns. Without clearing the lock here the pile would stay
   * collapsed with nothing on screen saying why.
   */
  const clear = useCallback(() => {
    setItems([]);
    setFront(0);
    setSpent(null);
    closing.current = false;
    setStance("shut");
  }, []);

  const reset = useCallback(() => {
    setItems(NOTICES);
    setFront(0);
    setSpent(null);
    setStance("shut");
  }, []);

  /*
   * One `pointermove` on the region, tested against the front card's own top
   * edge, which is the one line here that never moves. Mouse and pen only,
   * which is `folder-stack`'s gate and not a test against a finger: a pointer
   * naming itself neither is one a device has no way to take a hover back
   * from. So on a phone this is the resting pile and a tap that advances it.
   */
  const moved = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== "mouse" && event.pointerType !== "pen") return;
    const top = event.currentTarget.getBoundingClientRect().top + REACH;
    const offsetY = event.clientY - top;
    setStance((was) =>
      closing.current || items.length === 0 ? was : stanceAt(offsetY, was),
    );
  };

  const transition = reduce
    ? { duration: 0 }
    : {
        default: SNAP,
        opacity: { duration: 0.13, ease: "easeOut" as const },
      };

  /*
   * **A tap opens the pile, and that is the only thing a finger does to the
   * front card.** With the cycle target on the second card's strip and no
   * hover to raise it, a phone would be left aiming at the 8px the resting
   * pile shows, so a tap on the front card's face opens it to the stance a
   * pointer would have reached and a second tap shuts it again. `folder-stack`
   * makes the same trade for the same reason.
   *
   * A tap that landed on a button is that button's, which is what keeps a tap
   * on the strip a cycle rather than a cycle and then a close.
   */
  const tapped = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "mouse" || event.pointerType === "pen") return;
    if ((event.target as HTMLElement).closest("button")) return;
    setStance((was) => (was === "title" ? "shut" : "title"));
  };

  return (
    <TooltipProvider delayDuration={200}>
      {/* `h-105` is 336px at every width, which is the 8:5 of the index's own
          preview card at the lab column's 538 and a taller box on a phone,
          where 8:5 would leave 220px for a pile that wants 215 of them. */}
      <div
        ref={stage}
        className="@container relative flex h-105 w-full select-none items-center justify-center overflow-hidden rounded-lg bg-fill ring-1 ring-stroke ring-inset"
      >
        <p aria-live="polite" className="sr-only">
          {items.length === 0
            ? "No notices left."
            : `${front + 1} of ${items.length}: ${items[front]?.title}`}
        </p>

        {/* the pile plus the room it opens into, as one box that never
            resizes, so nothing in the stage moves when the pile does */}
        <div
          onPointerMove={moved}
          onPointerUp={tapped}
          /*
           * **A touch `pointerleave` is a lift, not a departure**, and it
           * lands after the `pointerup` the tap is heard on, so ungated it
           * shut the pile inside the same gesture that opened it. That is
           * `book-opening`'s trap arriving at a tray. A finger closes the pile
           * by tapping the card again.
           */
          onPointerLeave={(event) => {
            if (event.pointerType !== "mouse" && event.pointerType !== "pen")
              return;
            closing.current = false;
            setStance("shut");
          }}
          style={{ paddingTop: REACH }}
          className="w-[min(72cqw,17.5rem)]"
        >
          {/*
           * A grid stack rather than absolute boxes: every card lands in the
           * same cell, so the pile is as tall as the tallest card in it and
           * each one is stretched to that, with no measuring anywhere.
           */}
          <ul className="relative grid">
            <AnimatePresence initial={false}>
              {items.map((notice, i) => {
                const depth = (i - front + items.length) % items.length;
                const at = pose(stance, depth);
                const leaving = spent === notice.id;

                return (
                  <motion.li
                    key={notice.id}
                    className="col-start-1 row-start-1"
                    style={{
                      zIndex: leaving ? 40 : items.length - depth,
                      transformOrigin: "50% 0",
                    }}
                    initial={{ opacity: 0, y: 16 }}
                    animate={
                      leaving
                        ? { ...LEAVE, filter: `blur(${BLUR}px)` }
                        : {
                            y: -at.peek,
                            scale: at.scale,
                            opacity: at.opacity,
                            filter: "blur(0px)",
                          }
                    }
                    /*
                     * Leaving the tray is two beats on one tween, a shrink and
                     * then a fall, and the fade is held back until the card is
                     * already moving. The keyframes open on `null`, which is
                     * Motion's "whatever it is now", so a card deeper in the
                     * pile does not jump to the front card's scale on the
                     * frame it is asked to leave.
                     *
                     * **No `zIndex` here, and that was a bug.** Pinning every
                     * exiting card to one layer hands the top of the pile to
                     * whichever is last in the DOM, so clearing the tray put
                     * the third notice over the one being read. A card on its
                     * way out keeps the `zIndex` it was rendered with, which
                     * is already higher than anything left behind it, since
                     * the list it was counted against is one longer.
                     */
                    exit={{
                      scale: DROP_SCALE,
                      y: DROP_Y,
                      opacity: 0,
                      filter: `blur(${BLUR}px)`,
                      transition: reduce
                        ? { duration: 0 }
                        : {
                            duration: DROP_MS,
                            times: DROP_TIMES,
                            ease: DROP_EASE,
                            opacity: {
                              delay: DROP_MS * DROP_FADE,
                              duration: DROP_MS * (1 - DROP_FADE),
                            },
                            filter: {
                              delay: DROP_MS * DROP_FADE,
                              duration: DROP_MS * (1 - DROP_FADE),
                            },
                          },
                    }}
                    /* one tween carries the lift, the fade and the blur
                       together, so the notice is at its softest exactly where
                       it is nearest and nothing is kept in step by hand */
                    transition={
                      leaving && !reduce
                        ? { duration: LEAVE_MS, ease: "easeOut" }
                        : transition
                    }
                  >
                    <Card
                      notice={notice}
                      front={depth === 0 && !leaving}
                      next={depth === 1 && !leaving}
                      onCycle={cycle}
                      onRetire={retire}
                      onClear={clear}
                      onCloseHover={(on) => {
                        closing.current = on;
                        setStance(on ? "one" : "lift");
                      }}
                    />
                  </motion.li>
                );
              })}
            </AnimatePresence>
          </ul>
        </div>

        {/* the empty tray. Not inside the pile, which has collapsed to nothing
            by the time this is wanted, and it waits for the cards to finish
            dropping before it arrives. */}
        <AnimatePresence>
          {items.length === 0 ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, transition: { duration: 0.1 } }}
              transition={
                reduce ? { duration: 0 } : { ...SNAP, delay: DROP_MS }
              }
              className="absolute inset-0 z-50 flex items-center justify-center"
            >
              <Tooltip label="Put the notices back">
                <button
                  type="button"
                  aria-label="Put the notices back"
                  onClick={reset}
                  className={cn(
                    "inline-flex size-10 cursor-pointer items-center justify-center rounded-full bg-bg text-text-secondary transition-colors duration-200",
                    "hover:bg-fill-hover hover:text-text-primary active:bg-fill-active active:duration-0",
                    FOCUS,
                  )}
                >
                  <ArrowCounterClockwiseIcon
                    aria-hidden="true"
                    className="size-4"
                  />
                </button>
              </Tooltip>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </TooltipProvider>
  );
}

/**
 * One notice.
 *
 * **The card you are reading is not a button, and the one behind it is.** What
 * advances the pile is the strip the second card is showing, so a press lands
 * on the notice it brings forward rather than on the one it takes away, and
 * that strip is also the only part of that card a pointer can reach: the rest
 * of it is under the front card. The front card's own face does nothing, and
 * its copy is `pointer-events-none` with only its two real controls turned
 * back on.
 *
 * Nothing is nested. The cycle button is the peeked card's whole face and the
 * action and the close control are the front card's, so it is three buttons on
 * two different cards rather than two inside a third.
 *
 * That face sits last in the DOM and under the copy in paint order, so a
 * screen reader hears a notice before what to do with it.
 */
function Card({
  notice,
  front,
  next,
  onCycle,
  onRetire,
  onClear,
  onCloseHover,
}: {
  notice: Notice;
  front: boolean;
  /** the one card behind the front, whose strip is what advances the pile */
  next: boolean;
  onCycle: () => void;
  onRetire: (id: string) => void;
  onClear: () => void;
  onCloseHover: (on: boolean) => void;
}) {
  return (
    /*
     * The hairline is an `outline` rather than a ring, since a ring is a
     * box-shadow and the inline lift would replace it outright.
     * `book-opening` documents the same swap. The radius is inline beside it
     * so the card, the button lying under it and that button's focus ring all
     * read the one number.
     */
    <div
      className="relative h-full bg-bg outline-1 -outline-offset-1 outline-stroke"
      style={{ boxShadow: LIFT, borderRadius: RADIUS.card }}
    >
      <div className="pointer-events-none relative z-10 flex h-full flex-col p-6">
        <div className="flex items-start justify-between gap-3">
          {/* the tone is the only thing saying which notice you are reading,
              and it steps while the card travels, under the blur. The peek
              takes `text-secondary` rather than `text-muted`: muted is 2.86:1,
              which is the site's tone for a caption, and this line is the
              whole of what the second hover stage exists to show. */}
          <h3
            className={cn(
              /* `leading-tight`, not the prose 1.6 the token carries: this
                 heading truncates rather than wrapping, so the extra leading
                 buys nothing and it is 5px of the peeked strip's height. */
              "min-w-0 truncate text-body leading-tight transition-colors duration-200",
              front ? "text-text-primary" : "text-text-secondary",
            )}
          >
            {notice.title}
          </h3>

          <Tooltip label="Clear the tray">
            <button
              type="button"
              aria-label="Clear the tray"
              tabIndex={front ? 0 : -1}
              onClick={onClear}
              onPointerEnter={(event) => {
                if (
                  event.pointerType === "mouse" ||
                  event.pointerType === "pen"
                )
                  onCloseHover(true);
              }}
              onPointerLeave={() => onCloseHover(false)}
              className={cn(
                "-mr-1.5 -mt-0.5 pointer-events-auto flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-full text-text-muted transition-all duration-200",
                "hover:bg-fill-hover hover:text-text-primary active:bg-fill-active active:duration-0",
                FOCUS,
                /* a control for a notice you cannot read is not a control, so
                   a peeked card shows its title and nothing else */
                !front && "pointer-events-none opacity-0",
              )}
            >
              <XIcon aria-hidden="true" className="size-3.5" />
            </button>
          </Tooltip>
        </div>

        <p className="mt-2 mb-4 text-body text-text-secondary">{notice.body}</p>

        {/* `mt-auto` rather than a gap, so every card's action sits on the same
            line whatever its body ran to */}
        <button
          type="button"
          tabIndex={front ? 0 : -1}
          onClick={() => onRetire(notice.id)}
          style={{ borderRadius: RADIUS.action }}
          className={cn(
            "pointer-events-auto mt-auto flex h-10 w-full cursor-pointer items-center justify-center bg-text-primary text-action text-bg transition-colors duration-200",
            "hover:bg-text-primary/85 active:bg-text-primary/70 active:duration-0",
            FOCUS,
          )}
        >
          {notice.action}
        </button>
      </div>

      {/* only the card behind the front one carries it, and only the strip
          it is showing can be reached, since the rest is under the front card */}
      {next ? (
        <button
          type="button"
          data-face=""
          onClick={onCycle}
          aria-label={`Show ${notice.title}`}
          style={{ borderRadius: RADIUS.card }}
          className={cn("absolute inset-0 cursor-pointer", FOCUS)}
        />
      ) : null}
    </div>
  );
}
