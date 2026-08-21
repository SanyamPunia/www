/**
 * Where the pocket sits and where every card sits inside it.
 *
 * Pure functions. The stage's own width is the only measurement taken, and
 * everything here is a proportion of it, so one number rescales the whole
 * experiment and no call site carries a size.
 *
 * Card poses come back in stage pixels rather than percentages, which the
 * reference this is built from does not do. It has to there: its cards are five
 * different widths, and a `translateX` percentage resolves against the element's
 * own width, so an identical offset moves a narrow card further than a wide one
 * and every value needs converting per card. Uniform cards remove that, and
 * pixels then buy the thing percentages cannot: a card is staged by animating its
 * width rather than scaling it, so its hairline stays one pixel and its corners
 * stay corners at three times the size.
 */

/*
 * The stage's aspect, as two integers so the CSS string and the ratio come from
 * one place. Tall enough for the fan to clear the pocket with headroom.
 */
const W_UNITS = 13;
const H_UNITS = 9;

/** the stage's height, as a fraction of its width */
const STAGE = H_UNITS / W_UNITS;

/** the pocket's width, as a fraction of the stage's */
const POCKET_W = 0.48;
/** the pocket's height, as a fraction of its own width */
const POCKET_RATIO = 17 / 20;
/** the gap under the pocket, so it is seated on the stage rather than cropped */
const FLOOR = 0.03;
/**
 * Where the front panel starts, as a fraction of the pocket's height. The panel
 * is the only other edge the pocket has, so it has to read as a fold rather than
 * a second box: one shorter face in front of the wall, and the cards between.
 */
const PANEL = 0.24;

const pocketH = POCKET_W * POCKET_RATIO;
const pocketTop = STAGE - FLOOR - pocketH;

/** a card's width, as a fraction of the pocket's */
const CARD_W = 0.5;
/** a card's height, as a fraction of its own width */
const CARD_RATIO = 4 / 5;

/**
 * How far down the pocket a card rests, as a fraction of the pocket's height.
 *
 * This is the whole of the closed state: it decides how much paper shows above
 * the front panel, and that strip is the only thing saying the pocket has
 * anything in it. At 0.18 it was 14% of a card, which read as a seam rather than
 * as paper. 0.10 shows about a third.
 *
 * The floor is where the card's own top passes the pocket's, which is where paper
 * starts poking out of the back of a shut pocket.
 */
const SLOT = 0.1;

/**
 * How much a card grows once it is out of the pocket.
 *
 * A sheet pulled clear of the stack is nearer the eye than one still filed, and
 * this is the whole of that. It has to stay subtle: it is applied to every card
 * in the fan, so it multiplies with `GROW` on whichever one is singled out, and
 * two visible size steps on one card read as a zoom.
 *
 * It cannot affect how stable a hover is, because it applies whether or not
 * anything is hovered, so it is constant across the transition that matters.
 */
const FAN_GROW = 1.08;

/** the stack's spread when closed and when fanned, in fractions of pocket width */
const STEP_SHUT = 0.04;
const STEP_FAN = 0.3;

/** how far the fan rises out of the pocket, as a fraction of stage width */
const RISE = 0.2;
/**
 * How far the rest of the fan sinks to let the singled-out card stand clear.
 *
 * The others sink rather than the hovered card rising, and that is not a style
 * choice. A card that rises when hovered moves its own bottom edge off the
 * pointer that just arrived there, which drops the hover, which drops the card,
 * which picks the hover straight back up. The fan flickers, and a card cannot be
 * reached at all unless the pointer crosses the whole band inside one frame.
 *
 * Sinking the others reads identically and moves nothing out from under the
 * pointer. Any term added here has to keep that property.
 */
const SINK = 0.03;
/** how far its neighbours lean away to make room */
const YIELD = 0.035;
/** and how much it grows, which is a real width rather than a scale */
const GROW = 1.06;

const TILT_SHUT = 1.5;
const TILT_FAN = 5;

/** the staged card's width, as a fraction of the stage's */
const STAGED_W = 0.6;
/** how much of a card pushed off to the side still shows */
const SLIVER = 0.12;
/**
 * And how much further out each one past the first goes.
 *
 * Small, because it has to keep the deepest card in the pile on screen. At 0.05
 * the fourth card out cleared the stage's edge completely, so the two cards
 * furthest from a staged one simply were not there, and the arrow keys had
 * nothing saying they went anywhere.
 */
const SLIVER_STEP = 0.03;

/**
 * Corner radius at rest and staged, as fractions of stage width.
 *
 * Not proportional to the card, deliberately. A radius that keeps its ratio to a
 * card three times the size reads as a stadium rather than a corner, so it grows
 * by roughly the square root of the growth instead.
 */
const RADIUS = 0.012;
const RADIUS_STAGED = 0.024;

/**
 * The front panel's tilt, in degrees, at each of the three states.
 *
 * `staged` used to be -78, which lays the panel nearly flat, and it was paired
 * with the panel fading to nothing. Both are gone. A staged card renders above
 * the panel anyway, so the panel never had to get out of the way, and a panel
 * that dissolves and re-materialises is not something a panel does: the fade
 * looked deliberate on the way out and wrong on the way back.
 *
 * So it leans, and stays a real object behind the scrim. -52 is the most it can
 * lean and still read as a panel: its top edge comes 131px toward the viewer,
 * which magnifies it by 1.15 and leaves 110px of visible face. At -78 that face
 * is 38px, which is a bar rather than a panel.
 */
export const TILT = { shut: 0, fan: -26, staged: -52 } as const;

const round = (v: number) => Math.round(v * 100) / 100;
const pct = (v: number) => `${round(v * 100)}%`;

/**
 * The pocket's two faces, as percentages of the stage.
 *
 * Percentages rather than measured pixels because neither face ever changes
 * shape, so nothing here needs the stage's width. Vertical values divide by
 * `STAGE`, since a top or a height resolves against the stage's height and every
 * fraction above is of its width.
 */
export const POCKET = {
  left: pct((1 - POCKET_W) / 2),
  width: pct(POCKET_W),
  top: pct(pocketTop / STAGE),
  height: pct(pocketH / STAGE),
  /** the front panel shares the left and width, and runs to the floor */
  panelTop: pct((pocketTop + PANEL * pocketH) / STAGE),
  panelBottom: pct(FLOOR / STAGE),
} as const;

/**
 * The contact shadow's box, as percentages of the stage.
 *
 * Narrower than the pocket and centred on the pocket's own bottom edge, so the
 * pocket hides the top half and only the spill onto the floor shows. `FLOOR` is
 * all the room there is underneath, which is why this is short and wide rather
 * than deep: anything taller blurs straight into the frame's edge.
 */
const CONTACT_H = 0.026;
export const CONTACT = {
  left: pct((1 - POCKET_W * 0.86) / 2),
  width: pct(POCKET_W * 0.86),
  top: pct((pocketTop + pocketH - CONTACT_H / 2) / STAGE),
  height: pct(CONTACT_H / STAGE),
} as const;

export const STAGE_ASPECT = `${W_UNITS} / ${H_UNITS}`;

/**
 * A viewBox spanning the whole stage, at 100 units per aspect unit.
 *
 * Derived from the aspect rather than written out, so an overlay drawn in these
 * units cannot drift from the stage's real shape. It maps 1:1 with no distortion,
 * which means a stroke width in these units scales with the stage the same way
 * every other value here does.
 */
export const STAGE_VIEWBOX = `0 0 ${W_UNITS * 100} ${H_UNITS * 100}`;

/** the pocket's corner, as a fraction of its own width */
const CORNER = 0.095;

/**
 * The pocket's corner radius, in pixels off the measured stage.
 *
 * One number for both faces, and pixels rather than a percentage pair.
 *
 * A percentage radius tracks its own box, which sounds like the right answer and
 * was the first one: two faces of different heights need `x% / y%` each, picked
 * so both land on the same pixel, or the panel's bottom corners do not match the
 * wall's underneath them. It did not paint. The panel came out with square
 * corners while the wall, which had the same treatment, was correctly round, and
 * the cause was never isolated.
 *
 * Motion was the first suspect and is not guilty. It only pulls `borderRadius`
 * out of `style` and into its own values when `layout` or `layoutId` is set,
 * since that is when its scale correctors matter, and `getValueAsType` coerces
 * numbers only, so a string passes through untouched either way. Worth knowing
 * before blaming it for something else.
 *
 * A single pixel value sidesteps whatever it was and still tracks the pocket,
 * because the stage is measured anyway and everything here is a proportion of it.
 * One number also serves both faces, which the percentage form could not.
 */
export const corner = (stage: number) => CORNER * POCKET_W * stage;

export interface State {
  /** the fan is out */
  open: boolean;
  /** the card under the pointer, singled out from the fan */
  hovered: number | null;
  /** the card being read, which owns the whole stage */
  active: number | null;
  /**
   * The last card staged, which keeps the top of the pile after it lands.
   *
   * A real folder remembers what you last pulled out of it. Restacking on
   * landing is also a visible z-snap the instant the cards settle, which is what
   * this avoids.
   */
  touched: number | null;
}

export interface Point {
  x: number;
  y: number;
}

export interface Hit {
  /** within the pocket's reach, which is what holds the fan open */
  reach: boolean;
  /** the card under the pointer, or null */
  card: number | null;
}

/** the pocket's footprint in stage pixels, for hit testing */
const pocketBox = (stage: number) => ({
  x: ((1 - POCKET_W) / 2) * stage,
  y: pocketTop * stage,
  width: POCKET_W * stage,
  height: pocketH * stage,
});

/** is `p` inside this pose's box, rotation included */
function inBox(box: Pose, p: Point): boolean {
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  const t = (-box.rotate * Math.PI) / 180;
  const dx = p.x - cx;
  const dy = p.y - cy;
  const lx = dx * Math.cos(t) - dy * Math.sin(t);
  const ly = dx * Math.sin(t) + dy * Math.cos(t);
  return Math.abs(lx) <= box.width / 2 && Math.abs(ly) <= box.height / 2;
}

/**
 * The region that counts as being on the pocket, in stage pixels.
 *
 * Shut, this is the pocket's own footprint, so the fan only ever *opens* from the
 * pocket itself and never from empty stage.
 *
 * Open, it is the box around the pocket and the whole fan together. A fanned card
 * reaches well past the pocket's sides, so testing the footprint alone leaves a
 * dead band: outside the pocket's left or right edge and below the cards' bottom
 * edges, nothing is hit at all. Any shallow diagonal from the front face out to an
 * outer card crosses it, the fan shuts halfway, and the card being reached for
 * drops back into the pocket.
 *
 * One box rather than the union of the two, because a union of rectangles has the
 * same hole. The pocket and the fan overlap vertically by only about 30px, so a
 * path leaving the pocket below that band escapes both.
 *
 * This cannot oscillate. Opening only widens the region, so the pointer that
 * opened it stays inside, and the shut region is a subset of the open one, so a
 * pointer outside the open region is outside the shut one too.
 */
function reachBox(count: number, state: State, stage: number) {
  const box = pocketBox(stage);
  let left = box.x;
  let right = box.x + box.width;
  let top = box.y;
  let bottom = box.y + box.height;

  if (state.open) {
    const neutral: State = { ...state, hovered: null, active: null };
    for (let i = 0; i < count; i++) {
      const card = pose(i, count, neutral, stage);
      // a rotated rect's own axis-aligned bounds, so a tilted corner is included
      const t = (card.rotate * Math.PI) / 180;
      const halfW =
        (Math.abs(Math.cos(t)) * card.width +
          Math.abs(Math.sin(t)) * card.height) /
        2;
      const halfH =
        (Math.abs(Math.sin(t)) * card.width +
          Math.abs(Math.cos(t)) * card.height) /
        2;
      const cx = card.x + card.width / 2;
      const cy = card.y + card.height / 2;
      left = Math.min(left, cx - halfW);
      right = Math.max(right, cx + halfW);
      top = Math.min(top, cy - halfH);
      bottom = Math.max(bottom, cy + halfH);
    }
  }

  return { left, right, top, bottom };
}

/**
 * What is under the pointer, tested against the fan's own geometry rather than
 * against the DOM.
 *
 * **The boxes tested are the neutral ones, with nothing hovered, and that is the
 * whole point.** A hover cannot change the geometry that decides the hover, so
 * the feedback loop that makes a fan flicker cannot exist: not for a rise, not
 * for growth, not for a card straightening out of the fan.
 *
 * Letting the DOM answer instead was the first version and could not be made
 * stable. A singled-out card straightens from as much as 10 degrees, which sweeps
 * its corners up to 6.4px outside its new box, so a pointer near a corner falls
 * out of the very card that is following it. Containing that sweep needs `GROW`
 * at 1.20, and a card that jumps a fifth bigger under the pointer reads as a zoom
 * rather than as one sheet being picked out of a stack.
 *
 * The cost is that the outermost few pixels of a straightened card are not
 * hoverable, being outside the box tested. That is a few pixels at four corners,
 * against a fan that could not be used at all.
 *
 * Cards are only tested while the fan is out. Shut, they sit behind the front
 * panel, so the pocket is the only thing there is to be over.
 */
export function hitTest(
  p: Point,
  count: number,
  state: State,
  stage: number,
): Hit {
  if (state.open) {
    const neutral: State = { ...state, hovered: null, active: null };
    const cards = Array.from({ length: count }, (_, i) => ({
      i,
      box: pose(i, count, neutral, stage),
    }));
    // topmost first, so the answer matches whichever card is painted on top
    cards.sort((a, b) => b.box.z - a.box.z);
    for (const { i, box } of cards) {
      if (inBox(box, p)) return { reach: true, card: i };
    }
  }

  const box = reachBox(count, state, stage);
  return {
    reach:
      p.x >= box.left &&
      p.x <= box.right &&
      p.y >= box.top &&
      p.y <= box.bottom,
    card: null,
  };
}

export interface Pose {
  /** the card's top left corner, in stage pixels */
  x: number;
  y: number;
  width: number;
  height: number;
  rotate: number;
  opacity: number;
  borderRadius: number;
  z: number;
}

/**
 * One card's pose, from its index and the state alone.
 *
 * Every branch sets the card's box as well as its position, because staging
 * changes its size and the two cannot be resolved separately: a card is anchored
 * by its top left corner, so growing it without moving that corner grows it down
 * and to the right instead of about its middle.
 */
export function pose(
  i: number,
  count: number,
  state: State,
  stage: number,
): Pose {
  const offset = i - (count - 1) / 2;
  const rest = CARD_W * POCKET_W * stage;
  const restHeight = rest * CARD_RATIO;
  const centre = (stage - rest) / 2;
  const slot = (pocketTop + SLOT * pocketH) * stage;
  const middle = (STAGE * stage - restHeight) / 2;

  if (state.active !== null) {
    if (i === state.active) {
      const width = STAGED_W * stage;
      const height = width * CARD_RATIO;
      return {
        x: (stage - width) / 2,
        y: (STAGE * stage - height) / 2,
        width,
        height,
        rotate: 0,
        opacity: 1,
        borderRadius: RADIUS_STAGED * stage,
        z: 40,
      };
    }

    /*
     * Everything else is pushed off the side it already sat on, far enough that
     * a sliver of it shows. That sliver is the only thing saying the arrow keys
     * have somewhere to go.
     */
    const distance = i - state.active;
    const out = (Math.abs(distance) - 1) * SLIVER_STEP * stage;
    const edge = SLIVER * stage;
    return {
      x: distance < 0 ? edge - rest - out : stage - edge + out,
      y: middle,
      width: rest,
      height: restHeight,
      rotate: 0,
      opacity: Math.max(0.2, 0.45 - (Math.abs(distance) - 1) * 0.12),
      z: 30 + count - Math.abs(distance),
      borderRadius: RADIUS * stage,
    };
  }

  // a singled-out card only exists in an open fan, or a hover landing during the
  // opening transition straightens a card still down inside the pocket
  const singled = state.open && i === state.hovered;
  const grow = (state.open ? FAN_GROW : 1) * (singled ? GROW : 1);
  const width = rest * grow;
  const height = restHeight * grow;

  const spread = state.open ? STEP_FAN : STEP_SHUT;
  const yields =
    state.open && state.hovered !== null && !singled
      ? Math.sign(i - state.hovered) * YIELD
      : 0;

  /*
   * Growth is centred, which is the other half of what keeps a hover stable:
   * every edge of a singled-out card moves outward, so a pointer already inside
   * it cannot end up outside it. Neighbours only ever lean away from the card
   * under the pointer, for the same reason.
   */
  const x =
    centre + (offset * spread * POCKET_W + yields) * stage - (width - rest) / 2;
  const rise = state.open
    ? (state.hovered === null || singled ? RISE : RISE - SINK) * stage
    : 0;
  const y = slot - rise - (height - restHeight) / 2;

  return {
    x,
    y,
    width,
    height,
    rotate: singled ? 0 : offset * (state.open ? TILT_FAN : TILT_SHUT),
    opacity: 1,
    borderRadius: RADIUS * stage,
    /*
     * The middle of the stack sits on top and the rest tuck behind it, which is
     * what a stack of paper does. Every value stays under the front panel's own
     * layer, or the pocket stops being a pocket.
     */
    z: singled
      ? count + 2
      : i === state.touched
        ? count + 1
        : count - Math.round(Math.abs(offset)),
  };
}
