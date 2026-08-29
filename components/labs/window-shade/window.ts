/*
 * The window's geometry and the two-ended palette it is painted in.
 *
 * ── why every length here is `cqw` ────────────────────────────────────────────
 *
 * One `cqw` is 1% of the stage's width, so nothing in this experiment is
 * measured in JS and the whole assembly holds whatever width the column is. The
 * `container-type` sits on the stage and on nothing else, since an element is a
 * query container for its descendants and never for itself, which is the trap
 * `document-pocket` documents at length: a `cqw` inside the window resolves
 * against the stage, which is what we want, and a `cqw` on the stage itself would
 * resolve against the viewport.
 *
 * Heights are in `cqw` too. The stage has a fixed aspect, so its height is its
 * own width over that, and one unit means the same thing on both axes.
 */

/** the stage's own shape: wall either side of a portrait window */
export const STAGE_ASPECT = 1.38;

/** and so its height, in cqw */
export const STAGE_H = 100 / STAGE_ASPECT;

/**
 * The bezel, as a share of the stage's height, and its own width over height.
 *
 * 0.62 rather than the 0.68 this started at, and the difference is the cabin. At
 * 0.68 the window ran from 16% to 84% of the stage and there was nowhere to put
 * a panel joint that did not land on the frame's own edge. This leaves 19% of
 * wall above and below, which is a wall the window is set into rather than a
 * wall it fills.
 */
const WINDOW_SHARE = 0.62;
const WINDOW_ASPECT = 0.655;

export const WIN_H = STAGE_H * WINDOW_SHARE;
export const WIN_W = WIN_H * WINDOW_ASPECT;

/**
 * Where the window sits, as a share of the stage's width.
 *
 * Off centre, which is what gives the scale on the right somewhere to be.
 * Centred with instrumentation beside it reads as a diagram with a picture in
 * it, and centred with nothing beside it is what this looked like while it was
 * still a copy of the reference.
 */
export const WINDOW_X = 0.37;

export const WIN_TOP = (STAGE_H - WIN_H) / 2;

/**
 * The bezel's corner, as a share of its own width.
 *
 * **Every radius below is this one minus the inset that box sits at**, which is
 * what concentric rounded rectangles actually are: two boxes a fixed distance
 * apart share a centre of curvature, so the inner corner is tighter by exactly
 * that distance. Scaling the radius with the box instead leaves the gap between
 * two edges wider at the corners than along the sides, which reads as a bad
 * trace rather than as a moulding.
 */
const CORNER = 0.42;

/** the bezel face, out to where it turns into the recess */
const LIP = 0.055 * WIN_W;

/** and the recess wall, from that mouth in to the pane */
const REVEAL = 0.045 * WIN_W;

export const R_BEZEL = CORNER * WIN_W;
export const R_RECESS = R_BEZEL - LIP;
export const R_PANE = R_RECESS - REVEAL;

export const RECESS_INSET = LIP;
export const PANE_INSET = REVEAL;

export const PANE_W = WIN_W - 2 * (LIP + REVEAL);
export const PANE_H = WIN_H - 2 * (LIP + REVEAL);

/** the pane's own shape, for anything drawn inside it in its own units */
export const PANE_ASPECT = PANE_W / PANE_H;

/**
 * How much narrower the shade is than the pane, each side.
 *
 * **This is the whole of what holds the closed state.** A stage that crosses to
 * near-black finishes as an empty rectangle unless something in it is still lit,
 * and a shade seated in its track leaves exactly this: hairlines of daylight down
 * its sides and along its foot, which is what a closed shade in a dark cabin
 * looks like. It is free, being a gap rather than an element, and it is honest,
 * being the clearance the panel needs to slide at all.
 */
export const SHADE_GAP = 0.012 * WIN_W;

export const SHADE_W = PANE_W - 2 * SHADE_GAP;

/**
 * **The panel starts above the pane and it is a plain rectangle**, and both of
 * those are one correction.
 *
 * It used to be inset by the clearance on all four sides, which put a strip of
 * sky above it. That strip is only ever uncovered at the instant the panel
 * seats, because at every other position the panel's own top edge is above the
 * pane: the top of the window stayed dark through the whole travel and then lit
 * in one frame at the end, which is nothing a shade does. There is no sky above
 * a shade at all. It comes down out of a slot, so the leak is the sides and the
 * foot and that is the whole of it.
 *
 * Starting a hair above the pane rather than flush with it is what keeps a
 * fractional pixel from finding a hairline there anyway.
 *
 * Squaring it follows: with the head above the clip and the foot cut back to the
 * pane's own curve, no corner of this panel is ever on screen. A rectangle in a
 * rounded aperture is also what a shade is, and it is the aperture's curve that
 * shapes what you see of it.
 */
export const SHADE_TOP = -SHADE_GAP;
export const SHADE_H = PANE_H;

/** where the pane sits inside the bezel, which the hit target has to know too */
export const PANE_OFFSET = LIP + REVEAL;

/**
 * How much of the shade is still showing when it is fully open, as a share of
 * the pane.
 *
 * A shade does not disappear, it stows, and the strip left behind is the only
 * thing on the stage saying there is a panel up there to pull down. At 0.10 that
 * strip is the grip and a sliver of panel above it, so what shows is the part
 * you are meant to take hold of.
 */
const STOW = 0.1;

/**
 * And so how far its foot travels between the two ends, in cqw: from `STOW` of
 * the pane down to one clearance short of the pane's own foot.
 */
export const SHADE_FOOT = PANE_H - SHADE_GAP;
export const TRAVEL = SHADE_FOOT - STOW * PANE_H;

/** the moulded grip across the foot of the panel, which is what stows */
export const HANDLE_H = 0.09 * PANE_H;

/*
 * ── the scale ─────────────────────────────────────────────────────────────────
 */

/**
 * Where the scale's rule stands, in cqw, and where its top is.
 *
 * **The rule spans exactly the panel's own travel**, so a tick is level with the
 * panel's foot at that value and the marker rides the edge it is measuring
 * rather than sitting near it. The top is the panel's foot when stowed and the
 * bottom is its foot when seated, both derived from the geometry above rather
 * than placed by eye.
 */
export const SCALE_X = 66;
export const SCALE_TOP = WIN_TOP + PANE_OFFSET + STOW * PANE_H;

/** how far a tick and a labelled tick reach out from the rule */
export const TICK = 1.2;
export const TICK_LONG = 2.4;

/*
 * ── the cabin ─────────────────────────────────────────────────────────────────
 */

/**
 * The panel joints in the sidewall, as shares of the stage.
 *
 * One horizontal below the window and one vertical to its left, which is a cabin
 * panel rather than a border. Two more would frame the stage and compete with
 * the demo's own hairline.
 */
export const SEAM_Y = 0.9;
export const SEAM_X = 0.09;

/**
 * A joint is a groove, so it is drawn as one: light and shadow rather than a
 * tone.
 *
 * **This is the one line on the stage that escapes the flip below, and the
 * reason is worth keeping.** A tone crossing from dark to light has to pass
 * through the ground crossing the other way, and it is not a matter of picking
 * better endpoints: with the best pair the tokens offer, solving
 * `0.689 - 0.454t = 0.967 - 0.823t` puts the meeting at t of 0.76 and the seam
 * simply is not there. A groove has a shadow on one side and a lit lip on the
 * other, so the shadow carries it on the light wall, the lip carries it on the
 * dark one, and through the middle both show faintly, which is what a groove in a
 * half-lit surface looks like. Measured against the wall, shadow then lip: 1.22
 * and 1.01 open, 1.00 and 1.35 closed, 1.17 and 1.14 at the flip.
 *
 * That is the shared rule about shading a surface with light rather than palette,
 * which `document-pocket` sets out, arriving at a case the palette cannot solve.
 */
export const SEAM_SHADOW = "rgb(0 0 0 / 0.09)";
export const SEAM_LIP = "rgb(255 255 255 / 0.07)";

/*
 * ── the palette, as one interpolation ─────────────────────────────────────────
 */

/**
 * A tone that crosses with the shade.
 *
 * Both ends are the site's own tokens, so this lab is not inventing a dark
 * theme: it reads `--color-*` at one end and `--color-inverse-*` at the other and
 * asks the browser for the point between them. `oklab` rather than the default
 * `srgb`, because a straight sRGB ramp from a light grey to near black spends
 * most of its travel already dark and the crossing lurches at the end.
 *
 * `inverse-*` is not dark mode and nothing on this site switches to it. It is a
 * surface a component opts into when a light ground cannot serve, and every other
 * caller so far picks one end and stays there. **This is the first that treats
 * the two sets as the two ends of one lerp**, which is the only reason a light
 * only site has anything to say about a light and dark crossing.
 */
const cross = (light: string, dark: string) =>
  `color-mix(in oklab, ${light}, ${dark} calc(var(--shade, 0) * 100%))`;

/**
 * The cabin wall.
 *
 * **`fill` rather than `fill-active`, and the redraw is what allows it.** The
 * darker ground was `book-opening`'s call for its table and it was right while
 * this was a render: the bezel is white, and separating it from the wall was a
 * job only tone could do. Now that every face carries a drawn hairline the
 * drawing separates them, so the wall is free to be the quiet ground
 * `folder-stack` uses. It also sits a whole step closer to the white page the
 * frame is on, where the heavier grey read as a slab dropped onto it.
 *
 * **The two names are exported, because the scale prints them.** They labelled
 * `fill-active` for one build after the wall had already moved to `fill`, which
 * is the drift a derived value exists to stop: the one thing on the stage that
 * says what the crossing is made of has to be made of the same thing.
 */
export const WALL_ENDS = ["fill", "inverse-bg"] as const;

export const WALL = cross(
  `var(--color-${WALL_ENDS[0]})`,
  `var(--color-${WALL_ENDS[1]})`,
);

/** the bezel face, the one thing here that stays an object at the dark end */
export const BEZEL = cross("var(--color-bg)", "var(--color-inverse-stroke)");

/** the recess wall, a step into the sidewall and in shadow at both ends */
export const RECESS = cross(
  "var(--color-stroke-strong)",
  "var(--color-inverse-bg)",
);

/**
 * Every hairline on the window itself.
 *
 * It needs no flip, because it never sits on the wall: `outline-offset` is
 * negative everywhere it is used, so each line paints on the face it belongs to.
 * On the bezel that is 1.30:1 open and 4.6:1 closed.
 *
 * The dark end is `inverse-text-secondary` rather than `inverse-stroke`, which
 * would be the bezel's own tone and so no edge at all. A bright hairline round a
 * window in a dark cabin is also what is physically there, since the daylight
 * leaking past the shade is catching that edge.
 */
export const EDGE = cross(
  "var(--color-stroke-strong)",
  "var(--color-inverse-text-secondary)",
);

/** the panel, which is in the cabin and so darkens with it */
export const SHADE_FACE = cross(
  "var(--color-surface)",
  "var(--color-inverse-stroke)",
);

/**
 * **Anything that has to stay legible against the wall cannot interpolate with
 * it, so it flips instead.**
 *
 * A colour crossing from dark to light passes through the ground it is sitting
 * on, and the ground is crossing the other way at the same time, so the two
 * meet. It is not a matter of choosing better endpoints: any monotone crossing
 * over a monotone ground has a solution. Measured on the readout, `text-secondary`
 * and the wall at half travel are the same value to a rounding error, and even
 * `text-primary` against that wall is 3.2:1.
 *
 * So these step over 0.04 of travel, at the point where the two sides are least
 * unequal. **That point moves with the wall**, and it did move when the light end
 * went from `fill-active` to `fill`: setting the two contrasts equal solves for a
 * wall luminance of 0.196, which the lighter ramp reaches at 0.47 rather than at
 * 0.42, and both sides then measure 4.1:1 for the width of one drag frame. Either
 * side of it, 15.8:1 open and 19.0:1 closed.
 *
 * The step is still derived from `--shade` rather than decided in JS, so the
 * claim that one number drives the whole stage survives it. A joint in the wall
 * is the one thing that escapes it, by being light rather than paint. See
 * `SEAM_SHADOW`.
 */
const FLIP = `clamp(0, (var(--shade, 0) - 0.47) * 25, 1)`;

const flip = (light: string, dark: string) =>
  `color-mix(in oklab, ${light}, ${dark} calc(${FLIP} * 100%))`;

/** the live value, and the loudest thing in the instrumentation: 13.2 and 19.0 */
export const INK = flip(
  "var(--color-text-primary)",
  "var(--color-inverse-text)",
);

/**
 * The rule and its ticks, quiet at both ends: 2.5:1 open and 1.35:1 closed.
 *
 * **Everything typographic takes `INK` instead, including the two token names
 * and the focus ring, and that is a finding rather than a preference.** They had
 * a quieter pair of their own, `text-secondary` to `inverse-text-secondary`, and
 * it measured 4.0 and 6.1 at the two ends and 1.3 through the flip, because how
 * much contrast a flipping tone keeps at the crossing is decided by how far its
 * endpoints sit from mid grey and by nothing else. A quiet tone has nowhere to
 * be. So a hairline may be quiet, since a hairline at 1.5:1 is still a line, and
 * a word may not.
 *
 * The focus ring is the same argument arriving from accessibility. **It cannot
 * be the project's own focus pattern** either way: that pattern pins a colour,
 * `ring-text-primary/15`, which composites to a 1.1:1 step on the open wall and
 * is a near-black ring on near-black at the other end, and Tailwind's ring also
 * paints a 2px offset in `--tw-ring-offset-color`, which defaults to white, so
 * the closed cabin would carry a bright band round the control. The rule this
 * bends says never to use a *weaker* ring than the declared one, and an outline
 * at the same width and offset in `INK` is stronger at both ends.
 */
export const MARK = flip(
  "var(--color-text-muted)",
  "var(--color-inverse-stroke)",
);

/** a length in stage units */
export const cq = (n: number) => `${n.toFixed(3)}cqw`;

/** and a share of the stage, for the few things placed against its own box */
export const pc = (n: number) => `${(n * 100).toFixed(3)}%`;
