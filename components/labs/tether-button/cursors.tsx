/**
 * The two cursor hands, and the point inside each one the pointer actually sits
 * on.
 *
 * OpenMoji, CC BY-SA 4.0, https://openmoji.org. `1F446` (backhand index pointing
 * up) and `1F91F` (love-you gesture). `paths` is the `black` set's outline,
 * copied verbatim apart from the stroke, which becomes `currentColor`, and its
 * `<line>` elements, which became `M ... L ...` so a hand is one list of path
 * data. `silhouette` is the same glyph's `#skin` group out of the `color` set,
 * with the skin tone dropped for `bg`.
 *
 * Emoji as artwork rather than as a text glyph, which is the form of the request
 * that survives. A colour emoji cannot be tinted, renders as different art on
 * every OS, and puts its ink at an unpredictable place inside the glyph box,
 * which is the one coordinate the web has to launch from. The monochrome font was
 * the other route and costs 880KB for two glyphs, since Google serves Noto Emoji
 * as a single file with no unicode-range split.
 *
 * Both glyphs share OpenMoji's 72 unit box, so `hotspot` is in the same units
 * for both and the swap cannot lurch. It names each hand's business end: the
 * fingertip of the pointing hand, the thumb tip of the horns hand. Both sit at
 * the drawing's upper left with the body below and to the right, which is what
 * lets one replace the other.
 *
 * The values are the apex of the ink, not a guess. The pointing hand's fingertip
 * is the semicircular cap centred on (30.95, 11.4) with radius 3.5. The horns
 * hand's thumb tip is the extremum of the cubic leaving (16, 14.25), which
 * solves to t = 0.434.
 */

/** OpenMoji draws every glyph in a 72 unit square */
const HAND_BOX = 72;

interface Hand {
  /**
   * The filled shape under the outline, which is what makes the hand opaque.
   *
   * It has to come from the colour set. The outline alone cannot be filled: the
   * black glyph draws the pointing hand's index finger as two bare lines and its
   * back as open arcs, so a fill on those has no interior to fill and the
   * button's label read straight through the finger.
   */
  silhouette: readonly string[];
  paths: readonly string[];
  /** where the pointer sits in the drawing, in `HAND_BOX` units */
  hotspot: readonly [number, number];
}

export const POINTING_HAND: Hand = {
  hotspot: [30.95, 7.9],
  silhouette: [
    "M55.36,33.7297c-0.38-1.44-1.66-2.53-3.23-2.6c-1.67-0.07-3.12,1.04-3.52,2.6h-0.19 c0,0.02,0.01,0.05,0.01,0.08c-0.01-0.03-0.01-0.06-0.02-0.08v-0.0099c0,0,0,0,0-0.01c-0.11-0.56-0.35-1.06-0.69-1.49 c-0.06-0.08-0.1299-0.16-0.21-0.2401c-0.17-0.18-0.35-0.34-0.56-0.47c-0.07-0.05-0.14-0.1-0.21-0.14c-0.17-0.1-0.34-0.18-0.52-0.25 c-0.1-0.04-0.2-0.07-0.3-0.09c-0.12-0.04-0.25-0.07-0.38-0.09c-0.08-0.01-0.16-0.02-0.24-0.03h-0.04c-0.01,0-0.01,0-0.02,0 c-0.09-0.01-0.17-0.01-0.26-0.01c-0.12,0-0.23,0-0.34,0.02c-0.23,0.02-0.44,0.06-0.65,0.12c-0.43,0.13-0.83,0.34-1.18,0.6201 c-0.08,0.06-0.16,0.1299-0.24,0.21c-0.09,0.07-0.16,0.15-0.23,0.24c-0.07,0.08-0.14,0.16-0.2,0.25c-0.06,0.09-0.12,0.18-0.18,0.28 c-0.11,0.19-0.2,0.39-0.28,0.6c-0.05,0.16-0.1,0.32-0.12,0.49h-0.13c-0.12-1.72-1.49-3.12-3.26-3.23c-1.74-0.11-3.25,1.06-3.63,2.7 v0.58l-0.09-0.01v-22.37c0-0.11-0.01-0.23-0.02-0.34c-0.17-1.78-1.65-3.16-3.48-3.16c-1.93,0-3.5,1.56-3.5,3.5v24.27l0.02,0.03 l-0.02,1.25v-1.28l-0.79-1.0699l-1.35-1.83l-0.69,0.45c-0.22-0.23-0.51-0.48-0.87-0.71l-0.01-0.01c-1.8-1.28-5-2.58-6.16-1.46 c-1.35,1.3101-0.56,4.23,4.86,11.3701c0.99,20.84,8.68,19.56,16.58,21.69c7.66,0.71,16.13-6.3101,16.25-18.14h0.21v-11.34 C55.48,34.3098,55.44,34.0198,55.36,33.7297z M41.5,34.1097h-0.01c0.01-0.07,0.01-0.14,0.03-0.21 C41.51,33.9698,41.5,34.0397,41.5,34.1097z",
  ],
  paths: [
    "M55.4792,47.6473c0,9.0883-7.3675,16.4558-16.4558,16.4558s-16.4558-7.3675-16.4558-16.4558",
    "M48.4869,34.4804c0.081-1.9313,1.7123-3.4313,3.6436-3.3502c1.9313,0.081,3.4312,1.7123,3.3502,3.6436",
    "M41.49,34.2475c0.081-1.9313,1.7123-3.4312,3.6436-3.3502s3.4313,1.7123,3.3502,3.6436",
    "M41.494,34.1136c0.155-1.9268,1.8426-3.3631,3.7694-3.2081s3.3631,1.8426,3.2081,3.7694",
    "M34.4524,33.7692c0.1237-1.929,1.7878-3.3925,3.7168-3.2688s3.3925,1.7878,3.2688,3.7168",
    "M17.4986,35.9928c-1.3429-1.3904-1.3044-3.6061,0.086-4.949c1.3904-1.3429,3.6061-1.3044,4.949,0.086",
    "M27.4524,11.3969c0-1.933,1.567-3.5,3.5-3.5s3.5,1.567,3.5,3.5",
    "M19.2663,38.3125c1.9526,2.1439,3.3734,5.1677,3.3013,9.5218",
    "M55.4792 46.7738L55.4792 34.7738",
    "M34.4524 33.7321L34.4524 11.3969",
    "M27.4524 11.3969L27.4524 39.1875",
    "M24.4916 33.3435L22.5336 31.1298",
    "M17.4986 35.9928L19.32 38.373",
  ],
};

export const HORNS_HAND: Hand = {
  hotspot: [12.59, 11.36],
  silhouette: [
    "M18,25.4375L16,14.25C15.125,9.7518,8.3125,10.625,8.8125,16c0,0,3.8903,21.9482,4.4479,29.3481v-0.2559 c0.5404,10.5716,9.8613,17.3382,20.4303,16.7979c6.0957-0.3376,11.8562-2.898,16.1913-7.1966 c3.7118-3.9314,12.8301-14.6738,12.8301-14.6738c1.861-2.7454,0.4175-6.9889-1.0186-5.9441l-12.563,5.9165l0.3194-0.107 c-2.3974,0.8467-3.0395-1.5318-2.8249-3.2447l2.1111-27.8841c0.5272-6.7684-7.2581-6.5855-7.2581-0.9621L40.3125,23.5 l-9.6782,0.8404l-0.5949,0.6013l-0.6767-0.4909L18,25.4375z",
  ],
  paths: [
    "M18,25.4375L16,14.25 C15.125,9.7518,8.3125,10.625,8.8125,16c0,0,3.8903,21.9482,4.4479,29.3481v-0.2559c0.5404,10.5716,9.8613,17.3382,20.4303,16.7979 c6.0957-0.3376,11.8562-2.898,16.1913-7.1966c3.7118-3.9314,12.8301-14.6738,12.8301-14.6738 c1.861-2.7454,0.4175-6.9889-1.0186-5.9441l-12.563,5.9165l0.3194-0.107c-2.3974,0.8467-3.0395-1.5318-2.8249-3.2447 l2.1111-27.8841c0.5272-6.7684-7.2581-6.5855-7.2581-0.9621L40.3125,23.5",
    "M30.0394,27.604 c0.2371-2.1519,1.7598-3.4091,3.8076-3.4552c1.9138-0.043,3.9409,0.9576,3.9591,3.2774c0,0,0.1972,6.9598,0.1592,7.3048 c-0.2371,2.1519-2.1736,3.7041-4.3255,3.467c-2.1518-0.237-3.3818-2.198-3.467-4.3254L30.0394,27.604z",
    "M22.1086,27.604 c0.2371-2.1519,1.7598-3.4091,3.8076-3.4552c1.9138-0.043,3.9409,0.9576,3.9591,3.2774c0,0,0.1972,6.9598,0.1592,7.3048 c-0.2371,2.1519-2.1736,3.7041-4.3255,3.467c-2.1518-0.237-3.3818-2.198-3.467-4.3254L22.1086,27.604z",
  ],
};

/**
 * The direction the horns hand's mass lies in, as a unit vector from its hotspot,
 * in the drawing's own units. Its thumb is a 14 unit stroke leaving the hotspot,
 * so a shot heading into the hand runs straight down that stroke and paints the
 * thumb out of the drawing. The strand's visible start slides along the run in
 * proportion to how far the shot points this way, and a shot heading away, which
 * is the case the reference draws, still leaves the thumb tip.
 */
export const HORNS_BODY = { x: 0.574, y: 0.82 };

/**
 * One hand, hung off its own hotspot so the wrapper can be positioned at the
 * bare pointer coordinate and every hand lines up on it.
 *
 * Two groups: the silhouette in `bg`, then the outline over it. The strand is
 * drawn below the whole layer, so an opaque hand also tucks its last few px
 * behind the palm rather than letting it cross.
 *
 * `aria-hidden` and `focusable` are what keep Biome's `a11y/noSvgWithoutTitle`
 * quiet on a drawing that is purely decorative.
 */
export function HandGlyph({
  hand,
  size,
  className,
}: {
  hand: Hand;
  size: number;
  className?: string;
}) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox={`0 0 ${HAND_BOX} ${HAND_BOX}`}
      width={size}
      height={size}
      className={className}
      style={{
        left: -(hand.hotspot[0] / HAND_BOX) * size,
        top: -(hand.hotspot[1] / HAND_BOX) * size,
      }}
    >
      <g fill="var(--color-bg)">
        {hand.silhouette.map((d) => (
          <path key={d} d={d} />
        ))}
      </g>
      <g
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {hand.paths.map((d) => (
          <path key={d} d={d} />
        ))}
      </g>
    </svg>
  );
}
