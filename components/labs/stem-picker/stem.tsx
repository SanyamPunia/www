import {
  bendAt,
  FOLIAGE,
  FOLIAGE_DEEP,
  leafAt,
  leafSideAt,
  tiltAt,
  type Variety,
} from "./stems";

/**
 * One stem, drawn upright.
 *
 * It is drawn vertically and nothing here knows about the fan. The bunch leans
 * it by rotating the box this sits in, which is what keeps the drawing free of
 * the SVG transform-origin trap: a rotation in SVG resolves against the viewBox
 * origin unless it is told otherwise, where `transform-origin` on an HTML
 * element is simply the corner you name.
 *
 * The base is at the foot of the viewBox and the bloom at the head, so every
 * stem in the bunch meets at one point however long it was cut.
 */

/** the drawing's own units. the box this renders into matches the ratio */
export const VIEW_W = 64;
export const VIEW_H = 200;

const BASE_Y = VIEW_H;
const BLOOM_Y = 38;
const CX = VIEW_W / 2;

/**
 * The angles of one ring, so a petal is mapped from its own angle rather than
 * from a position in a generated array. A petal has no identity beyond where it
 * points, and that is what keys it.
 */
function ring(count: number, offset = 0): number[] {
  return Array.from(
    { length: count },
    (_, step) => (360 / count) * step + offset,
  );
}

/** an open bloom: one ring of petals around an eye */
function Open({ variety }: { variety: Variety }) {
  return (
    <>
      {ring(variety.petals).map((angle) => (
        <ellipse
          key={angle}
          cx={CX}
          cy={BLOOM_Y - 15.5}
          rx={8.5}
          ry={16}
          fill={variety.petal}
          stroke={variety.edge}
          strokeWidth={1}
          transform={`rotate(${angle} ${CX} ${BLOOM_Y})`}
        />
      ))}
      <circle
        cx={CX}
        cy={BLOOM_Y}
        r={7}
        fill={variety.centre}
        stroke={variety.edge}
        strokeWidth={0.9}
      />
    </>
  );
}

/** a pompom: two rings of florets rather than petals, so it reads as a button */
function Round({ variety }: { variety: Variety }) {
  const outer = variety.petals;
  const inner = Math.max(5, Math.round(outer * 0.6));
  return (
    <>
      <circle cx={CX} cy={BLOOM_Y} r={17} fill={variety.edge} opacity={0.26} />
      {ring(outer).map((angle) => (
        <circle
          key={`outer-${angle}`}
          cx={CX}
          cy={BLOOM_Y - 12.5}
          r={5}
          fill={variety.petal}
          stroke={variety.edge}
          strokeWidth={0.8}
          transform={`rotate(${angle} ${CX} ${BLOOM_Y})`}
        />
      ))}
      {ring(inner, 18).map((angle) => (
        <circle
          key={`inner-${angle}`}
          cx={CX}
          cy={BLOOM_Y - 5.8}
          r={4.1}
          fill={variety.petal}
          stroke={variety.edge}
          strokeWidth={0.8}
          transform={`rotate(${angle} ${CX} ${BLOOM_Y})`}
        />
      ))}
      <circle cx={CX} cy={BLOOM_Y} r={3.9} fill={variety.centre} />
    </>
  );
}

/** a cup: three petals closed over each other, with no eye to show */
function Cup({ variety }: { variety: Variety }) {
  return (
    <>
      <ellipse
        cx={CX - 6}
        cy={BLOOM_Y - 3}
        rx={9}
        ry={18}
        fill={variety.petal}
        stroke={variety.edge}
        strokeWidth={1}
        transform={`rotate(-16 ${CX} ${BLOOM_Y})`}
      />
      <ellipse
        cx={CX + 6}
        cy={BLOOM_Y - 3}
        rx={9}
        ry={18}
        fill={variety.petal}
        stroke={variety.edge}
        strokeWidth={1}
        transform={`rotate(16 ${CX} ${BLOOM_Y})`}
      />
      <ellipse
        cx={CX}
        cy={BLOOM_Y - 1}
        rx={9.5}
        ry={17}
        fill={variety.petal}
        stroke={variety.edge}
        strokeWidth={1}
      />
    </>
  );
}

const FORMS = { open: Open, round: Round, cup: Cup } as const;

interface StemProps {
  index: number;
  /** how far the stem leans in the fan, which is how far its face is turned */
  lean: number;
  /** which variety is in this slot, which the shuffle changes under it */
  variety: Variety;
}

export function Stem({ index, lean, variety }: StemProps) {
  const bend = bendAt(index);
  const side = leafSideAt(index);
  const tilt = tiltAt(index);
  const leaf = leafAt(index);
  const Bloom = FORMS[variety.form];
  /*
   * A bloom on a leaning stem faces along the lean, so at the edges of the fan
   * it is seen turned away and its face is narrower. That is a cosine, and
   * doing it as a plain `scaleX` keeps the whole experiment out of 3D: nothing
   * here needs a perspective, and adding one to squash a shape would be a
   * stacking context per stem for nothing.
   */
  const face = Math.cos((lean * Math.PI) / 180);

  // a leaf is drawn on the right and mirrored about the stem for the left,
  // rather than kept as two sets of coordinates that can drift apart
  const mirror = side === 1 ? undefined : `translate(${VIEW_W} 0) scale(-1 1)`;

  return (
    <svg
      viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
      className="size-full overflow-visible"
      aria-hidden="true"
      focusable="false"
    >
      <title>{variety.name}</title>

      {/* the stem, bowed by its own amount so no two run parallel */}
      <path
        d={`M${CX} ${BASE_Y} Q${CX + bend} ${(BASE_Y + BLOOM_Y) / 2} ${CX} ${BLOOM_Y + 12}`}
        fill="none"
        stroke={FOLIAGE}
        strokeWidth={3.4}
        strokeLinecap="round"
      />

      {leaf === null ? null : (
        <g transform={mirror}>
          <path
            d={`M${CX} ${leaf} C${CX + 9} ${leaf - 6} ${CX + 17} ${leaf - 1} ${CX + 18} ${leaf + 9}
                C${CX + 9} ${leaf + 14} ${CX + 1} ${leaf + 9} ${CX} ${leaf} Z`}
            fill={FOLIAGE}
            stroke={FOLIAGE_DEEP}
            strokeWidth={1}
            strokeLinejoin="round"
          />
        </g>
      )}

      {/* the bloom, turned on its own stem, sized to its own variety and
          foreshortened by how far the stem leans */}
      <g
        transform={`rotate(${tilt} ${CX} ${BLOOM_Y}) translate(${CX} ${BLOOM_Y}) scale(${variety.size * face} ${variety.size}) translate(${-CX} ${-BLOOM_Y})`}
      >
        {/*
         * The bloom opens as it arrives, and again when a shuffle puts a
         * different flower in this slot, which is what the key re-triggers.
         *
         * A nested group of its own, because a CSS `transform` replaces an SVG
         * `transform` attribute outright rather than composing with it, and the
         * group above carries the lean, the tilt and the variety's size as an
         * attribute. `transform-box: fill-box` is what makes `transform-origin`
         * resolve against the bloom's own box rather than the viewBox origin,
         * which is the trap this file already avoids for rotation.
         */}
        <g
          key={variety.id}
          className="origin-center [transform-box:fill-box] motion-safe:animate-[stem-bloom_420ms_cubic-bezier(0.22,1.2,0.36,1)_both]"
        >
          <Bloom variety={variety} />
        </g>
      </g>
    </svg>
  );
}
