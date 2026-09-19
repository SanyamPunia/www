/**
 * The two boxes, the one padding they share, and what happens between them.
 *
 * Pure. Everything here is px against the stage, and the card's own contents
 * are `cqw` against the card, so this is the whole of what has to be a number.
 */

export interface Box {
  w: number;
  h: number;
}

/**
 * The card's padding, and the only length in the piece that does not scale with
 * the card.
 *
 * It cannot, because the pill is made of it: the button is the card cropped to
 * its title, so the pill's box is the title's box plus this on all four sides.
 * A padding that shrank with the card would take the pill with it, and the
 * pill is a button rather than a share of a picture.
 */
export const PAD = 18;

/**
 * The gap under the title, which is also the floor on it.
 *
 * The crop is what hides everything but the title while the card is shut, so
 * the first thing under the title has to start below the pill's own bottom
 * edge. That edge is `PAD` under the title, so anything closer than `PAD` would
 * be showing inside the button. 20 is that floor plus a little.
 */
export const HEAD_GAP = 20;

/** the biggest the card is allowed to get, whatever the column gives it */
export const CARD_MAX: Box = { w: 404, h: 244 };

const ASPECT = CARD_MAX.w / CARD_MAX.h;

/**
 * Clear stage held round the card. The sides are a share, since a narrow stage
 * cannot spare 26px twice and still have a card in it, and the head and foot
 * are a number, since the stage is tall enough at every width to give them.
 */
const GUTTER = { x: 0.06, xMin: 16, y: 20 };

/**
 * The shortest the card may be, whatever its width works out at.
 *
 * Everything inside the card is `cqw` against it, so a card scaled to a phone
 * is a miniature of the same drawing, and at some width that stops being true:
 * the meta row is 3cqw, which is 12.1px on a column and 7.4px at 320, and a
 * 7px readout is not a readout. So the small type carries a floor in px, and
 * once a floor binds the rows stop shrinking with the card and the card has to
 * stop getting shorter or they run out of its bottom edge.
 *
 * 184 is what those rows measure at their floors plus the two gaps between
 * them. Past it the card is no longer 404 by 244 in miniature, it is a
 * narrower card with the same type in it, which is the honest thing for a
 * drawing that has to stay readable.
 */
const CARD_MIN_H = 184;

/**
 * The card's box for a given stage.
 *
 * Which bound binds says what kind of screen it is: the cap binds on a lab
 * column, where the stage has width to spare, and the width binds on a phone.
 * Measured, 404 by 244 on a 538px column, 310 by 187 at 390 and 248 by 184 at
 * 320, where the height floor is what is holding it.
 */
export function cardBox(stage: Box): Box {
  const gutter = Math.max(GUTTER.xMin, stage.w * GUTTER.x);
  const w = Math.min(
    CARD_MAX.w,
    stage.w - gutter * 2,
    (stage.h - GUTTER.y * 2) * ASPECT,
  );
  return {
    w,
    h: Math.max(w / ASPECT, Math.min(CARD_MIN_H, stage.h - GUTTER.y * 2)),
  };
}

/**
 * The pill, from the title's own measured box.
 *
 * Nothing about the label is animated, positioned or restated, because the
 * button is a crop: the title sits at `PAD` from the card's top left, and a box
 * exactly `PAD` bigger than the title on every side shows that and nothing
 * else. So the label is centred in the pill and top left in the card by the
 * same one rule, and `overflow-hidden` is the whole of the morph.
 */
export function pillBox(title: Box): Box {
  return { w: title.w + PAD * 2, h: title.h + PAD * 2 };
}

/**
 * **The corner is never animated, because it never changes.**
 *
 * `rounded-full` on a pill is half its height, so a box `PAD` taller than a
 * 19.2px line box carries a 27.6px corner, and giving the card that same corner
 * is what lets one `border-radius` serve both ends of the morph. The pill reads
 * as a pill because it is 55px tall, not because its radius is doing anything.
 *
 * It is a constraint rather than a saving. A card that wanted a tighter corner
 * would have to animate the radius against a box that is already resizing, and
 * a radius easing under a moving edge reads as the shape wobbling rather than
 * as it growing. 27.6px on a 404 by 244 card is 11% of its height, which is
 * generous and is what the reference draws.
 */
export function radius(pill: Box): number {
  return pill.h / 2;
}

/**
 * The lift under the box, scaled by how big the box currently is.
 *
 * Derived rather than animated, the same call the corner makes: a bigger object
 * casts a bigger shadow, so the card's lift is the pill's with one number
 * changed and there is no second tween to keep in step with the first.
 *
 * Three layers, each faint on its own: a contact line, a short cast for form
 * and a wide ambient one for depth. One shadow dark enough to read at this size
 * looks like a drop shadow rather than like light, which is the recipe
 * `document-pocket` sets.
 */
export function lift(height: number): string {
  const k = Math.min(1, height / CARD_MAX.h);
  return [
    "0 1px 2px rgb(0 0 0 / 0.05)",
    `0 ${6 * k}px ${14 * k}px ${-6 * k}px rgb(0 0 0 / 0.10)`,
    `0 ${22 * k}px ${40 * k}px ${-24 * k}px rgb(0 0 0 / 0.24)`,
  ].join(", ");
}

/**
 * One curve for the box and for the content, and it is the drawer curve rather
 * than `island-menu`'s.
 *
 * **What decides it is the slope the curve leaves at, which is `y1 / x1`.** A
 * press is answered in the first few frames or it is not answered, and that is
 * the one moment a reader is watching closely. `island-menu`'s `[0.4, 0, 0.2,
 * 1]` leaves at a slope of zero, which is an ease-in start on an element
 * responding to input: measured, 4.6% of the move in the first 80ms, so the
 * box sits still for five frames after the press. `[0.22, 1, 0.36, 1]` leaves
 * at 4.55 times its own average speed, which is the lurch that lab rejected as
 * arriving hard, and it is right that it did.
 *
 * This one leaves at 2.25, exactly between them: 40.8% of the move in the
 * first 80ms and no frame carrying more than an eighth of it. It is the same
 * curve `MORPH` uses below and the same one Ionic gives its drawers, so the
 * lab has one curve for a box and one for text and they are the same shape.
 */
export const EASE = [0.32, 0.72, 0, 1] as const;

/**
 * **The content's clock is linear and every curve on it is a function applied
 * to that one number.** The box is animated the ordinary way, with an ease
 * handed to Motion, because the box is one property moving. The rows are three
 * of them each running two properties on their own share of one clock, and a
 * global ease plus a windowed mapping does not compose: the later a row's
 * window sits, the flatter the part of the global curve it lands on, so the
 * last row would slide slower than the first for no reason anyone chose.
 *
 * A linear clock with the shaping per band is exact instead. It is also what
 * lets one entrance carry two curves, which it has to, because a row is doing
 * two different things at once.
 */
export function bezier(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): (x: number) => number {
  const on = (t: number, a: number, b: number) =>
    3 * (1 - t) ** 2 * t * a + 3 * (1 - t) * t * t * b + t ** 3;
  return (x) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let lo = 0;
    let hi = 1;
    let t = x;
    // 24 bisections, which lands the parameter inside a ten-millionth
    for (let i = 0; i < 24; i++) {
      t = (lo + hi) / 2;
      if (on(t, x1, x2) < x) lo = t;
      else hi = t;
    }
    return on(t, y1, y2);
  };
}

/**
 * The focus curve, which is an `ease`.
 *
 * A press is answered in the first frames or it is not answered, which is what
 * the box's curve is for. A row coming into focus is not answering anything,
 * and on the box's own curve it does not read as focus at all: measured, a row
 * went from 14px of blur to none in 117ms of a 365ms window, because a curve
 * that front-loads spends a reveal before the eye has found it. What a rack of
 * focus looks like is a barrel turned at a near constant rate with a soft
 * landing.
 */
export const FOCUS_EASE = [0.25, 0.1, 0.25, 1] as const;
export const focusAt = bezier(...FOCUS_EASE);

/**
 * The settle curve, which is the strongest ease-out in the piece, and the one
 * place a lurch is the point.
 *
 * Each row slides its last few pixels into place as it comes into focus, so the
 * sequence reads at a glance rather than only under a careful eye. That move is
 * entering, so it leaves at once: `[0.23, 1, 0.32, 1]` leaves at 4.35 times its
 * own average speed, which is the lurch the box's curve is chosen to avoid. It
 * is not a problem here for the reason it was there: the box crosses 280px of
 * stage and a row crosses 12, so front-loading 12px is what snappy means and
 * there is no distance for the eye to be thrown across.
 */
export const SETTLE_EASE = [0.23, 1, 0.32, 1] as const;
export const settleAt = bezier(...SETTLE_EASE);

/**
 * How far a row travels, and what share of its own band it spends travelling.
 *
 * **The layout never moves.** Every row is where it will end up for the whole
 * of the morph and a transform carries it the last 12px, so nothing here
 * reflows and the claim that the card is laid out once survives the slide.
 *
 * 12px is a third of a row's height and about 3% of the card, which is enough
 * to read as arriving and little enough that it never reads as a row falling
 * in. The travel takes 42% of the band, which at a 620ms content beat is 198ms
 * against the 471ms that row spends coming into focus: the row lands, and then
 * it sharpens. That ordering is the whole of what makes it snappy, since the
 * fast half is the half the eye tracks.
 */
export const SLIDE = 12;
export const SETTLE_SHARE = 0.42;

/* ─────────────────────────────────────────────────────────
 * STORYBOARD, opening
 *
 *    0ms   the pill. The card is already under it, cropped to its title.
 *    0ms   both axes start together. The crop opens.
 *   11ms   the box has moved, which is one frame after the press.
 *   70ms   the meta row starts, out of focus and 12px low. The box is a third
 *          of the way there, so the row is arriving into a box still growing
 *          round it and is cropped at both ends while it does.
 *   80ms   the box is 33 to 44% of the way there.
 *  144ms   the readout row starts.
 *  218ms   the chart row starts.
 *  268ms   the meta row has landed. It is in place and still soft.
 *  375ms   the box is 99% of the way there.
 *  416ms   the chart row has landed.
 *  460ms   the water starts coming in.
 *  520ms   the box lands. The close control is uncropped.
 *  541ms   the meta row is sharp, then the readouts, then the chart.
 *  690ms   the last row is sharp.
 * 1260ms   the water has caught the tide up. Settled.
 *
 * **The rows start while the box is still forming, and being cropped on the way
 * in is the point.** A card that finishes growing and then fills itself is two
 * events. A row arriving into a box that is still opening is the box uncovering
 * it, which is the thing this whole piece claims. The reference gives the same
 * frame away: its meta row is cut off at both ends by a box that has not
 * finished.
 *
 * **Both axes are on one clock, and that is this piece's whole difference from
 * `island-menu`.** There a nav bar grows tall and then wide, because what is
 * being watched is a shape changing and two moves are what make it read as one.
 * Here the shape never changes: the card is already the card and the box is a
 * window onto it, so two clocks would be a window that opens in an L. Measured
 * off the reference's own frames, its two axes track each other to within four
 * points of progress the whole way, which is one clock within the error of
 * reading a still.
 *
 * So what is staged is the content instead, and it is staged down the card
 * rather than all at once. See `BANDS`.
 *
 * Closing runs it back with the content going out of focus first. The blur
 * leads and the opacity follows it, since the opacity is the first 60% of the
 * same number read backwards, so by the time the box has moved a fifth the card
 * is already unreadable and the box never shrinks around type anyone is still
 * trying to read. The first build took the content away in 180ms flat, which
 * left the box shrinking around an empty ground with a label in the corner of
 * it.
 *
 * The exit is shorter than the entrance at every step, which is the shape a
 * press wants: slow where the reader is looking and fast where the system is
 * only getting out of the way.
 * ───────────────────────────────────────────────────────── */

export const OPEN = {
  box: { duration: 0.52 },
  /**
   * The master clock for the content. Every row reads a window of it rather
   * than a tween of its own, so the stagger is a mapping and there is still one
   * number carrying the reveal. See `BANDS`.
   */
  content: { delay: 0.07, duration: 0.62 },
  /** the water coming in to where the tide actually is */
  water: { delay: 0.46, duration: 0.8 },
} as const;

export const SHUT = {
  content: { duration: 0.26 },
  box: { delay: 0.05, duration: 0.38 },
} as const;

/**
 * Where each row sits in that clock.
 *
 * **The rows do not resolve together, they resolve down the card**, which is
 * what a lens racking focus over something with depth does rather than what a
 * list being dealt does. That is the same claim the blur already makes: the
 * card was there the whole time, and things at different depths come good at
 * different moments. A stagger built out of three separate tweens would be a
 * list arriving, and would need three delays kept in step with one duration.
 *
 * Each row owns 76% of the clock and they start 12% apart, which at a 620ms
 * content beat is 74ms between rows, inside the 30 to 80ms a stagger has to
 * stay in to read as one movement rather than as a queue. The slide inside a
 * band is 198ms, so the rows land 74ms apart and read as a sequence rather
 * than as three things that happened to overlap.
 *
 * **The focus reverses for free and the position must not.** The windows are
 * offsets into one number, so running that number back down takes the last row
 * out first, which is the order a hand would put them away in and which nothing
 * anywhere has to say. That is right for the focus, since the card really is
 * going out of focus. It is wrong for the slide: a row that rose into place
 * sank back out of it on the way out, 12px inside a 260ms exit, and did it
 * while it could still be read. So position is a second value, held through the
 * close and put back once the rows are at zero opacity.
 *
 * The title is not in here. It is the anchor the whole morph hangs on, and it
 * is never faded, blurred or moved.
 */
export const BAND = 0.76;
export const BANDS = [0, 0.12, 0.24] as const;

/**
 * How far out of focus the content starts.
 *
 * **A blur is distance and an opacity is existence**, which is the whole reason
 * the content resolves rather than fades: it was behind the button the whole
 * time, at the card's own size, too near to read. Something that fades in is
 * something that was not there.
 *
 * `notice-stack` gives its blur to the exit for the same reason from the other
 * end: there a notice leaving softens because it is going away, and nothing
 * that is staying is ever soft.
 */
export const BLUR = 14;

/**
 * The one hue in the piece, and it is a state rather than a subject.
 *
 * The site ships one status tone and it means wrong, and a tide coming in is
 * not wrong. This is the scoped exception `halftone-ripple` takes in its
 * narrowest form: one value, marking one of two states, with the other state
 * taking the quiet tone rather than a second hue. There the ripple goes out in
 * `text-muted` when a press turns the button off. Here the tide goes
 * `inverse-text-secondary` when it turns and starts going out.
 *
 * Scoped to this experiment, not a token, and nothing else may reach for it.
 * 7.64:1 on the card's `text-primary` ground.
 */
export const RISING = "#22c55e";

/**
 * `torph`'s numbers, the same 200ms on the same ease `book-opening` and
 * `halftone-ripple` use.
 *
 * **It carries the two words and neither of the two numbers.** A morph is for a
 * value being corrected, and a tide turning is exactly that: one state replaces
 * another and the characters they share stay put. The height and the countdown
 * are a clock instead, rewritten about every six seconds and about every one,
 * so a morph still running when the next one starts read as a smear.
 */
export const MORPH = {
  duration: 200,
  ease: "cubic-bezier(0.32, 0.72, 0, 1)",
} as const;
