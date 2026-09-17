/**
 * Where a card sits at each depth, in the four stances the pile has. Pure and
 * DOM-free, the split `document-pocket` makes with `poses.ts`.
 *
 * **`peek` is exactly what it says: how far a card's top edge stands above the
 * front card's own.** That is only true because a card scales about its top
 * edge rather than its centre, which makes the peek and the scale independent
 * of each other. About the centre they are not: a card at 0.85 drags its own
 * top down by 7.5% of a height nothing here knows, so every peek would carry a
 * correction and the geometry would need a `ResizeObserver` before it could
 * say anything at all.
 *
 * The other half of that choice is free. Scaling about the top edge lifts a
 * card's foot as well, and the foot is the end hidden behind the card in
 * front, so a card can shrink as far as it likes and never poke out from under
 * the pile.
 */
export interface Pose {
  /** px above the front card's top edge */
  peek: number;
  scale: number;
}

/**
 * How many depths are drawn. Anything deeper parks at the last one's pose with
 * nothing showing, so a card leaving the front travels to a place it is
 * already invisible at and a card arriving from behind fades in without having
 * to move.
 */
const DEPTHS = 3;

/**
 * **The pile opens in two steps, not one, and the second one is what the first
 * is for.** Pointing at the front card lifts the one behind it into a thicker
 * edge, which says there is something there and does not yet say what. Moving
 * onto that edge is a second question, and it gets the answer: the card rises
 * far enough to read its title. A single hover that jumped straight to the
 * title would spend the reveal on a pointer that was only passing over the
 * card on its way somewhere else.
 *
 * `one` is the fourth, and it belongs to the close control. Pointing at it
 * collapses every card behind the front one to nothing, so the pile reads as a
 * single card for exactly as long as the pointer is on the thing that will
 * drop it. That control clears the whole tray, so the collapse is a preview of
 * what is about to leave rather than a flourish.
 */
export type Stance = "shut" | "lift" | "title" | "one";

/**
 * **Only the second card ever moves, and the third is what it moves over.**
 * Shut, the pile is three edges and says how many there are. From there every
 * stance lifts the second card and leaves the third exactly where it is, so
 * the first hover covers it rather than fanning beside it: one card behind,
 * whatever question is being asked of the pile. A pile that opened both would
 * be saying the same thing twice, once in a strip too thin to read.
 *
 * `lift` clears the third card's edge by 3px and stops inside the second
 * card's own top padding, which is 19.2px before its scale and 17.95 after, so
 * what it uncovers is blank paper rather than the top of a line of type. A
 * card with its heading sliced off is the one thing this stage must not show.
 *
 * `title` is that padding plus the title's own line and a little under it, and
 * **the padding is the floor under every one of these numbers.** The strip a
 * reveal opens runs from the card's top edge to the front card's, so the space
 * above the title in it is that padding and nothing else can be done about it.
 * Cutting the padding to shorten the strip cuts the whole cascade with it,
 * since `lift` has to fit inside the padding and the resting pile has to fit
 * under `lift`: at `p-4` the pile is two 4px seams. So the strip was shortened
 * at the other end instead, by taking the title's line height to 1.25. A
 * heading that truncates rather than wrapping has no use for prose leading,
 * and 5px of it was being spent on nothing. 44px to 38.
 *
 * **The scales are deeper than they look like they need to be, and that is
 * what carries the arrival.** A press moves the second card 19px, which is
 * nothing to watch, so what says it came from the back is that it grows 7% on
 * the way, 0.935 of the front card's width to all of it. At 0.955, which was
 * the first build, the same press read as a card fading out over a card that
 * was already where it ended up.
 */
const POSES: Record<Stance, Pose[]> = {
  shut: [
    { peek: 0, scale: 1 },
    { peek: 8, scale: 0.92 },
    { peek: 14, scale: 0.85 },
  ],
  lift: [
    { peek: 0, scale: 1 },
    { peek: 17, scale: 0.935 },
    { peek: 14, scale: 0.85 },
  ],
  title: [
    { peek: 0, scale: 1 },
    { peek: 38, scale: 0.955 },
    { peek: 14, scale: 0.85 },
  ],
  one: [
    { peek: 0, scale: 1 },
    { peek: 0, scale: 0.92 },
    { peek: 0, scale: 0.85 },
  ],
};

/**
 * The room reserved above the front card, which is the deepest peek any stance
 * reaches plus a little. The pile is laid out inside it whatever it is doing,
 * so nothing in the stage moves when the pile opens.
 */
export const REACH = POSES.title[1].peek + 6;

export function pose(
  stance: Stance,
  depth: number,
): Pose & { opacity: number } {
  return {
    ...POSES[stance][Math.min(depth, DEPTHS - 1)],
    opacity: depth < DEPTHS ? 1 : 0,
  };
}

/**
 * Which stance a pointer is asking for, measured against the front card's top
 * edge.
 *
 * **That edge is the one line in this experiment that never moves**, since the
 * front card is the only card with the same pose in every stance, and it is
 * what makes the whole thing hit-testable without the loop `document-pocket`
 * has to design its way out of. Below the line is the card itself, which is
 * `lift`. Above it is whatever the card behind is currently reaching into,
 * which is `title`.
 *
 * The band above the line is read off the stance the pile is already in, and
 * that is deliberate: every stance the pointer can move *into* has a band at
 * least as tall as the one it left, 9 then 19 then 44, so the region only ever
 * grows under a pointer and a hover can never take itself back. `book-opening`
 * makes the same argument for its own reach.
 */
export function stanceAt(offsetY: number, from: Stance): Stance {
  if (offsetY >= 0) return "lift";
  const band = POSES[from === "one" ? "shut" : from][1].peek;
  return offsetY >= -band ? "title" : "shut";
}

/**
 * The card's own corners and its action's, off the radius scale on purpose.
 *
 * `rounded-lg` is 6.4px, which is the site's card radius and what the frame
 * around this demo uses, and on a drawn object 280px wide it reads as a square
 * with the corners taken off. These are drawn objects rather than surfaces,
 * the same standing `folder-stack` and `document-pocket` give their own pixel
 * geometry, and they live here so the card, the button lying under it and its
 * focus ring cannot drift apart.
 */
export const RADIUS = { card: 12, action: 10 } as const;

/**
 * **One spring, and everything the pile does is on it.** The peek, the pass,
 * the collapse and the promotion after a drop are all answers to something the
 * pointer just did, and a preview that eases while a press snaps reads as two
 * demos in one frame. Settles in about 200ms with 6% of overshoot, which is
 * what keeps quick from reading as abrupt.
 *
 * It replaced a pair, a slow spring for the hover and a fast one for the
 * press, plus the state and the timer that chose between them. Nothing about
 * the pile was better for having two.
 */
export const SNAP = { type: "spring", stiffness: 720, damping: 40 } as const;

/**
 * How soft a notice goes on its way out.
 *
 * **The blur belongs to the exit, not to the pile.** A notice leaving softens
 * as it goes and nothing that is staying ever does, at any depth, which is why
 * there is no resting blur on the peeked cards and nothing to schedule: each
 * exit already has a tween and the blur rides it, at zero where the card is
 * still in the pile and widest where it is gone.
 *
 * **Only the card leaving carries it.** Blurring the one arriving as well was
 * the first build and it is what the reference does, and both cards soft at
 * once is 160ms of mush with nothing in it to read: the pass stops being a
 * notice being replaced and becomes a smear. Sharp underneath, the arriving
 * notice is legible from the first frame and the one dissolving off it is the
 * only thing moving.
 *
 * Without it the two are both sharp and both legible on top of each other,
 * which is worse than either: two notices' worth of type in one box reads as a
 * rendering fault rather than as one of them leaving.
 */
export const BLUR = 6;

/**
 * **A cycled notice leaves toward the reader and a dismissed one leaves the
 * tray, and the two directions are the whole difference between them.**
 *
 * Cycling lifts the front card off the top of the pile: a little larger, a
 * little lower, gone. It is nearer for the moment it is in the air, which is
 * what a card taken off a deck does and what stops it reading as the same
 * event as the one below. `LEAVE_MS` is the tween the lift, the fade and the
 * blur all run on, a tween rather than a spring since what this is is a
 * dissolve and a spring's settle would hold a card at nothing for the tail of
 * it.
 *
 * Neither of them is the back of the pile. A cycled card does go there, but it
 * is already invisible by then, so where it travels after the fade is
 * bookkeeping rather than motion.
 */
export const LEAVE = { y: 12, scale: 1.05, opacity: 0 } as const;
export const LEAVE_MS = 0.18;

/**
 * Leaving the tray is two beats on one tween: the card draws itself in, then
 * it falls. `DROP_TIMES` gives the shrink the first third, so it is a small
 * thing that happens before the drop rather than something the drop carries
 * with it.
 *
 * **The fall is 110px and the fade is held back for two thirds of it**, which
 * is about 60px of travel a reader sees before anything starts going. At 56px
 * over a tween that faded from a third, the card was gone before it had been
 * anywhere: what that read as was a notice dissolving in place with a little
 * downward drift, not one leaving the tray. The stage clips, so 110px carries
 * it past its own bottom edge and the drop has somewhere to actually go.
 *
 * `DROP_EASE` accelerates, since what this is is a card falling, but it is a
 * gentler curve than a plain ease-in: that one crawls for its first third,
 * which here is the third the fade has been held back to make visible.
 */
export const DROP_SCALE = [null, 0.95, 0.9];
export const DROP_Y = [null, 0, 110];
export const DROP_TIMES = [0, 0.22, 1];
export const DROP_EASE = [0.4, 0, 0.9, 1] as const;
export const DROP_MS = 0.34;
/** how far into the drop the fade and the blur start */
export const DROP_FADE = 0.68;

/** how long a cycled card holds its exit before it parks at the back */
export const SPENT = 240;

/**
 * The lift under a card: a contact line, a short cast and a wide ambient,
 * which is the recipe `document-pocket` sets, since one shadow dark enough to
 * read at this size looks like a drop shadow rather than like light.
 *
 * Every card carries it, unlike `folder-stack`, where a shadow at rest reaches
 * nothing because the card in front paints over it. Here the pile stacks
 * upward, so a card's own top edge is the part nobody is covering, and the
 * halo above it is what separates one peeked edge from the next.
 *
 * Inline, so the hairline has to be an `outline` rather than a ring: a ring is
 * a box-shadow too, and an inline value replaces it outright. `book-opening`
 * makes the same call for the same reason.
 */
export const LIFT = [
  "0 1px 2px rgb(0 0 0 / 0.05)",
  "0 6px 12px -4px rgb(0 0 0 / 0.06)",
  "0 16px 32px -12px rgb(0 0 0 / 0.08)",
].join(", ");
