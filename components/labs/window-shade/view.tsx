import { cn } from "@/lib/utils";
import { cq, PANE_ASPECT } from "./window";

/**
 * What is outside.
 *
 * The reference this came from puts two `three.js` canvases behind the glass.
 * This got to the same place from the other side and overshot twice on the way:
 * first a render of a photograph, then flat plates with hard stops everywhere,
 * which read as a chart of a sky. **The third pass sorts the view by distance
 * instead.** Air is soft, so the sky's steps blend, the cloud is noise and the
 * sun is a bloom with no edge on it. The wing is the one thing near enough to be
 * drawn, and even that reads by tone rather than by outline.
 *
 * **Nothing out here is a shape any more, and that is the fix.** Four round
 * white lumps in a row is a cartoon cloud however soft its falloff, and a pale
 * yellow disc is a cartoon sun. Both were replaced by the thing they were
 * standing in for: fractal noise, and a light source too bright to have a
 * silhouette.
 *
 * The sky keeps its band structure through all of it, so the panel coming down
 * still has values to travel against.
 *
 * **These hues are scoped to this experiment and are not tokens.** Daylight is
 * the thing the shade is for, so the colour is carrying the meaning rather than
 * decorating, which is the exception `stamp-collection`, `folder-stack` and three
 * others already take. Nothing else on the site may reach for them.
 */
const SKY = {
  deep: "#5d9ad3",
  high: "#86b8e0",
  mid: "#accde8",
  pale: "#cbe0f0",
  haze: "#e8f1f8",
  below: "#c0d3e1",
  depth: "#8ba3b8",
  wingLit: "#c8d2dc",
  wingShade: "#74828f",
  winglet: "#8794a2",
  wingEdge: "#6f7d8b",
  wingSpec: "#f2f6fa",
} as const;

/**
 * The sky, and where it stops.
 *
 * **The horizon sits at 0.46 and the lower half is what is under it**, which is
 * where a seat actually looks. It was at 0.70 for one pass, with the cloud
 * straddling it, and that put every cloud in the palest part of the sky where a
 * white shape has nothing to be seen against: the deck was there and invisible.
 *
 * **One field of sky and then a graduation, not equal stripes.** Evenly spaced
 * bands at evenly spaced values is a test card, which is what an earlier pass
 * was: the top fifth is one colour and the steps compress downward, which is
 * what haze does to a sky.
 *
 * Every stop blends into the next except one pair. **The haze holds to 45.4 and
 * the ground starts at 46, six thousandths of the pane apart, about a pixel.**
 * That is the one hard edge in the drawing, because a horizon is where the air
 * stops, and it leaves the panel a real line to cut as it comes down. **The glass
 * is what takes it back**, since the whole view sits behind `BLUR`: what a reader
 * sees is a hard edge through a hazy pane, which is what a horizon out of a
 * cabin window is.
 */
const SKY_FILL = `linear-gradient(to bottom, ${[
  `${SKY.deep} 0%`,
  `${SKY.high} 20%`,
  `${SKY.mid} 32%`,
  `${SKY.pale} 40%`,
  `${SKY.haze} 45.4%`,
  `${SKY.below} 46%`,
  `${SKY.depth} 100%`,
].join(", ")})`;

/**
 * The haze that sits between the eye and everything far away.
 *
 * In front of the far cloud and behind the near one, which is where it is: it is
 * the air in between. It piles up toward the horizon and stops dead at it, since
 * there is no haze on the other side of a horizon.
 */
const HAZE =
  "linear-gradient(to bottom, rgb(255 255 255 / 0) 22%, rgb(255 255 255 / 0.42) 45.4%, rgb(255 255 255 / 0) 46.6%)";

/**
 * A cloud deck, as fractal noise.
 *
 * **This is the third cloud and the first one that is not a drawing.** The
 * others were overlapping ellipses, hard-edged and then soft-edged, and a lump
 * is a lump: four white ovals in a row read as a cartoon at any falloff. Cloud
 * is not made of ovals, it is made of turbulence, and the browser has a
 * turbulence generator sitting in every SVG filter.
 *
 * `feTurbulence` makes the noise, then one `feColorMatrix` throws away its
 * colour and keeps a biased slice of one channel as alpha, which is what turns a
 * grey field into cloud and clear air. `slope` is the contrast and `bias` is how
 * much sky is left between the clouds.
 *
 * **The frequency is anisotropic, lower across than down.** A deck seen at a
 * shallow angle is stretched along the line of sight, so equal frequencies give
 * a field of round puffs, which is the cartoon arriving by another door.
 *
 * The vertical fade is inside the tile rather than a CSS `mask-image`, so the
 * whole deck is one image: it repeats horizontally and the fade is full height,
 * so nothing about it needs to know it is being repeated. And `stitchTiles`
 * means the noise itself wraps at the tile's own edge, which is what replaced
 * the hand-placed copies the ellipse version needed to hide its seam.
 *
 * One rasterised image either way, so the drift costs no filter work per frame.
 */
const cloud = ({
  freq,
  octaves,
  seed,
  slope,
  bias,
  tint,
  fade,
}: {
  freq: string;
  octaves: number;
  seed: number;
  slope: number;
  bias: number;
  tint: [number, number, number];
  fade: [number, number];
}) => {
  const [r, g, b] = tint;
  const matrix = `0 0 0 0 ${r} 0 0 0 0 ${g} 0 0 0 0 ${b} ${slope} 0 0 0 ${bias}`;
  const svg =
    `%3Csvg xmlns='http://www.w3.org/2000/svg' width='320' height='160'%3E` +
    `%3Cdefs%3E` +
    `%3Cfilter id='c' x='0' y='0' width='100%25' height='100%25'%3E` +
    `%3CfeTurbulence type='fractalNoise' baseFrequency='${freq}' numOctaves='${octaves}' seed='${seed}' stitchTiles='stitch'/%3E` +
    `%3CfeColorMatrix values='${matrix}'/%3E` +
    `%3C/filter%3E` +
    `%3ClinearGradient id='f' x1='0' y1='0' x2='0' y2='1'%3E` +
    `%3Cstop offset='0' stop-color='%23fff' stop-opacity='0'/%3E` +
    `%3Cstop offset='${fade[0]}' stop-color='%23fff' stop-opacity='1'/%3E` +
    `%3Cstop offset='${fade[1]}' stop-color='%23fff' stop-opacity='1'/%3E` +
    `%3Cstop offset='1' stop-color='%23fff' stop-opacity='0'/%3E` +
    `%3C/linearGradient%3E` +
    `%3Cmask id='m'%3E%3Crect width='320' height='160' fill='url(%23f)'/%3E%3C/mask%3E` +
    `%3C/defs%3E` +
    `%3Cg mask='url(%23m)'%3E%3Crect width='320' height='160' filter='url(%23c)'/%3E%3C/g%3E` +
    `%3C/svg%3E`;
  return `url("data:image/svg+xml,${svg}")`;
};

/** further away, so finer and flatter, and a shade cooler than the near one */
const DECK_FAR = cloud({
  freq: "0.022 0.055",
  octaves: 5,
  seed: 7,
  slope: 1.15,
  bias: -0.42,
  tint: [0.94, 0.97, 1],
  fade: [0.2, 0.78],
});

/** and nearer, so coarser, whiter and with more sky showing between */
const DECK_NEAR = cloud({
  freq: "0.009 0.03",
  octaves: 6,
  seed: 3,
  slope: 1.7,
  bias: -0.55,
  tint: [1, 1, 1],
  fade: [0.1, 0.72],
});

/**
 * The sun.
 *
 * **A bloom with no disc in it.** A pale yellow circle is a cartoon sun, and it
 * is also wrong: the sun through two panes of acrylic at altitude is far too
 * bright to hold an edge, so what you get is a hot core with no silhouette. The
 * core is near-white rather than yellow for the same reason, since only a low
 * sun is warm.
 */
const SUN =
  "radial-gradient(24% 15% at 76% 15%, rgb(255 253 246 / 0.95) 0%, rgb(255 251 236 / 0.55) 22%, rgb(255 250 232 / 0.16) 52%, rgb(255 250 232 / 0) 100%)";

/**
 * Two layers of glass at an angle.
 *
 * One band, soft, and low. At 0.15 with hard edges it was a pair of shafts
 * crossing the wing and it owned the view, which is what a highlight does when it
 * is the sharpest thing in a frame of air.
 */
const SHEEN =
  "linear-gradient(114deg, rgb(255 255 255 / 0) 32%, rgb(255 255 255 / 0.09) 39%, rgb(255 255 255 / 0.02) 46%, rgb(255 255 255 / 0) 54%)";

/**
 * What the glass and the recess do at the edges: a little darker at the corners
 * and a breath of the cabin's own reflection over the whole pane.
 *
 * A photograph through a window has this and a drawing does not, which is most
 * of why it is here.
 */
const VIGNETTE =
  "radial-gradient(118% 96% at 50% 42%, rgb(0 0 0 / 0) 56%, rgb(20 30 45 / 0.16) 100%)";

/**
 * And the grain, at a fifth of the strength the cabin wall carries.
 *
 * The single cheapest thing separating a photograph from an illustration is that
 * one of them has noise in it. Over the pane it also ties the sky, the cloud and
 * the wing into one image rather than three layers.
 */
const FILM = `url("data:image/svg+xml,%3Csvg viewBox='0 0 120 120' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='f'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23f)'/%3E%3C/svg%3E")`;

/**
 * How far out of focus everything beyond the glass is, and how far past the pane
 * that layer reaches, both in cqw.
 *
 * **The blur is what makes this a window rather than a picture.** A view drawn
 * this precisely competes with the panel that is the actual demo, and it is also
 * a lie: the inner pane of a cabin window is scratched acrylic, so nothing out
 * there is ever sharp. Enough that no detail survives, little enough that the
 * sky, the deck and the wing are all still legible as what they are: at twice
 * this the wing was an unreadable smudge and the horizon had dissolved, which is
 * a window with nothing out of it rather than a window you cannot focus through.
 *
 * **The bleed is not optional.** A filter samples transparent outside its own
 * element, so a blurred layer fades out at its own edges: without the overhang,
 * the sky would go clear against the pane's border all the way round and leave a
 * soft halo of the recess showing through. Twice the radius covers it, since a
 * CSS blur's visible reach is about 1.5 times the value it is given.
 *
 * It sits on the outside alone. The sheen, the vignette and the grain are the
 * glass and the lens, which are the two things in this frame that are in focus.
 */
const BLUR = 0.62;
const BLEED = 1.6;

/**
 * The wing, in the pane's own units.
 *
 * The viewBox matches the pane's aspect, so the default `meet` fits it exactly
 * and nothing is stretched. The wing runs off three edges of the box on purpose:
 * one that fits inside the window is a model of a wing, where one whose root is
 * somewhere behind you is the view from a seat.
 *
 * **It reads by tone now, not by outline, and that was the last cartoon in the
 * frame.** A flat plate with a dark line round it is clip art whatever shape the
 * plate is. A wing at cruise is a ramp from a lit leading edge to a shaded
 * trailing one with a hot line along the very front, so that is what it is, and
 * the outline drops to a faint edge that only has to hold the silhouette where
 * the tonal contrast runs out.
 *
 * The ramp went a step darker twice: once because the cloud became a real cloud
 * and a pale wing is a ghost against a white deck, and once because `BLUR` sits
 * over all of it and a blur is a contrast reduction. This is the one thing in the
 * pane that still has to read as solid after both.
 *
 * **It is shallow and it tapers, and both were wrong first.** At 26 degrees on a
 * near-constant chord it read as a blade laid across the window: a wing seen from
 * a seat runs out almost level and its root chord is three times its tip.
 */
const VIEW_H = 100 / PANE_ASPECT;

const WING = "M-26 132 L86 108 L91 119 L-26 168 Z";
const WINGLET = "M86 108 L88.5 93 L93.5 96 L91 119 Z";
const FLAP = "M-26 158 L84.5 113";
const LEADING = "M-26 132 L86 108";

export function View() {
  return (
    <>
      {/* Everything beyond the glass, blurred as one layer and overhanging the
          pane on every side so the filter has real content to sample at the
          edges rather than transparency. */}
      <span
        aria-hidden="true"
        className="absolute"
        style={{ inset: cq(-BLEED), filter: `blur(${cq(BLUR)})` }}
      >
        <span
          className="absolute inset-0"
          style={{ backgroundImage: SKY_FILL }}
        />

        {/* Far cloud, haze, then near cloud. **The two decks are at a 2.8 ratio,
            not a 1.7**, since parallax is the whole reason there are two of them:
            closer together they read as one thing moving rather than as depth.
            Perceptible and no more, at about 4px a second on a wide column. */}
        <Deck
          fill={DECK_FAR}
          top={42}
          height={26}
          drift="motion-safe:animate-[cloud-drift_96s_linear_infinite]"
        />

        <span className="absolute inset-0" style={{ backgroundImage: HAZE }} />

        <Deck
          fill={DECK_NEAR}
          top={48}
          height={34}
          drift="motion-safe:animate-[cloud-drift_34s_linear_infinite]"
        />

        <span className="absolute inset-0" style={{ backgroundImage: SUN }} />

        {/* Back at the pane's own box, so its viewBox keeps the pane's aspect and
            the wing is not letterboxed by the overhang. `overflow-visible` is
            what lets its paths run out into that overhang, which is the wing's
            own bleed. */}
        <svg
          aria-hidden="true"
          focusable="false"
          viewBox={`0 0 100 ${VIEW_H.toFixed(2)}`}
          className="absolute overflow-visible"
          style={{ inset: cq(BLEED) }}
        >
          <defs>
            <linearGradient
              id="ws-wing"
              gradientUnits="userSpaceOnUse"
              x1="0"
              y1="104"
              x2="0"
              y2="174"
            >
              <stop offset="0%" stopColor={SKY.wingLit} />
              <stop offset="100%" stopColor={SKY.wingShade} />
            </linearGradient>
          </defs>

          <path d={WING} fill="url(#ws-wing)" />
          <path d={WINGLET} fill={SKY.winglet} />

          {/* a real hairline at any column width, since the viewBox scales with
              the pane and a stroke in its own units would scale with it */}
          <g
            fill="none"
            strokeWidth={1}
            vectorEffect="non-scaling-stroke"
            stroke={SKY.wingEdge}
          >
            <path d={WING} opacity={0.5} />
            <path d={WINGLET} opacity={0.55} />
            <path d={FLAP} opacity={0.22} />
          </g>
          <path
            d={LEADING}
            fill="none"
            stroke={SKY.wingSpec}
            strokeWidth={1}
            vectorEffect="non-scaling-stroke"
            opacity={0.75}
          />
        </svg>
      </span>

      {/* And the glass, which is the near side of the blur and stays sharp. */}
      <span
        aria-hidden="true"
        className="absolute inset-0"
        style={{ backgroundImage: SHEEN }}
      />
      <span
        aria-hidden="true"
        className="absolute inset-0"
        style={{ backgroundImage: VIGNETTE }}
      />
      <span
        aria-hidden="true"
        className="absolute inset-0 opacity-[0.07] mix-blend-overlay"
        style={{ backgroundImage: FILM }}
      />
    </>
  );
}

/**
 * One band of cloud.
 *
 * Each tile is half the element and the travel is half the element, so a tile
 * lands exactly where the one before it was and the loop has no seam. **That
 * holds whatever the element's width is**, which is what lets it overhang the
 * pane for the blur: at `left: -B` and `200% + 4B` wide, its right edge finishes
 * the cycle a clear `B` past the pane rather than exactly on it, so neither edge
 * is ever inside the filter's reach.
 *
 * **The whole animation arrives as one class, duration included, and that is not
 * tidiness.** `animate-[...]` compiles to the `animation` shorthand, which resets
 * every longhand it does not name, so a duration set beside it in `style` is one
 * cascade change away from being the thing that loses. `disc-spin` documents the
 * same trap from the other side. Passing the literal class in is also what lets
 * Tailwind see the value at all, since it only emits utilities it can read in the
 * source.
 *
 * `motion-safe:` rather than a `useReducedMotion` read, since this is a raw
 * keyframe and `MotionProvider` governs Motion's own animations only. With the
 * setting on, the deck is simply where it started.
 */
function Deck({
  fill,
  top,
  height,
  drift,
}: {
  fill: string;
  top: number;
  height: number;
  drift: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn("absolute", drift)}
      style={{
        left: cq(-BLEED),
        width: `calc(200% + ${cq(BLEED * 4)})`,
        top: `${top}%`,
        height: `${height}%`,
        backgroundImage: fill,
        backgroundSize: "50% 100%",
      }}
    />
  );
}
