import { memo } from "react";
import { hash, WORLD } from "./places";

/*
 * The town under the sheet: one SVG drawn once and never again, since all the
 * map ever does is move. Blocks on a grid, a park round the garden, a hill
 * round the lookout, a river with a bay, and a few roads that cross it as
 * bridges. Every variation is a hash of its index, so it is the same town on
 * every load.
 *
 * The inks are scoped here and are not tokens, the claim `loupe` makes for its
 * printed map: a map's colours are what tell land, water, park and road apart.
 * SVG text does not take the stylesheet's lowercase, so the labels are written
 * lowercase.
 */

const INK = {
  land: "#f2efe9",
  block: "#e7e2d9",
  blockAlt: "#e2ddd3",
  park: "#cfe5c2",
  hill: "#e4ecd9",
  water: "#a9d0ec",
  waterEdge: "#97c3e3",
  road: "#ffffff",
  casing: "#ddd6ca",
  label: "#958d80",
  waterLabel: "#5f8db0",
} as const;

const STEP = 80;
const ORIGIN = 20;

const RIVER = "M -40 790 C 160 720 300 820 470 742 S 760 610 1080 650";

const BAY = "M 760 1080 C 780 900 900 820 1080 800 L 1080 1080 Z";

export const TownMap = memo(function TownMap() {
  const blocks: React.ReactNode[] = [];
  let n = 0;
  for (let gx = ORIGIN; gx < WORLD; gx += STEP) {
    for (let gy = ORIGIN; gy < WORLD; gy += STEP) {
      const r = hash(n++);
      // a block is sometimes split in two, which is what keeps a grid from
      // reading as graph paper
      const split = r > 0.62;
      const fill = r > 0.4 ? INK.block : INK.blockAlt;
      if (split) {
        const cut = 0.38 + hash(n + 999) * 0.24;
        const w = STEP - 14;
        blocks.push(
          <rect
            key={`${gx}-${gy}-a`}
            x={gx + 7}
            y={gy + 7}
            width={w * cut - 2}
            height={STEP - 14}
            rx={4}
            fill={fill}
          />,
          <rect
            key={`${gx}-${gy}-b`}
            x={gx + 7 + w * cut + 2}
            y={gy + 7}
            width={w * (1 - cut) - 2}
            height={STEP - 14}
            rx={4}
            fill={fill}
          />,
        );
      } else {
        blocks.push(
          <rect
            key={`${gx}-${gy}`}
            x={gx + 7}
            y={gy + 7}
            width={STEP - 14}
            height={STEP - 14}
            rx={4}
            fill={fill}
          />,
        );
      }
    }
  }

  const minor: React.ReactNode[] = [];
  for (let v = ORIGIN; v <= WORLD; v += STEP) {
    minor.push(
      <line key={`h${v}`} x1={0} x2={WORLD} y1={v} y2={v} />,
      <line key={`v${v}`} x1={v} x2={v} y1={0} y2={WORLD} />,
    );
  }

  return (
    <svg
      aria-hidden="true"
      focusable="false"
      width={WORLD}
      height={WORLD}
      viewBox={`0 0 ${WORLD} ${WORLD}`}
      className="absolute top-0 left-0 block select-none"
    >
      <rect width={WORLD} height={WORLD} fill={INK.land} />
      <g>{blocks}</g>

      {/* the hill round the lookout, two soft contours */}
      <circle cx={680} cy={420} r={92} fill={INK.hill} />
      <circle
        cx={680}
        cy={420}
        r={62}
        fill="none"
        stroke={INK.park}
        strokeWidth={1.5}
        strokeDasharray="2 5"
        strokeLinecap="round"
      />

      {/* the park round the garden, with a path through it */}
      <rect x={487} y={393} width={146} height={146} rx={10} fill={INK.park} />
      <path
        d="M 495 520 C 540 470 560 470 620 410"
        fill="none"
        stroke="#e3efd9"
        strokeWidth={4}
        strokeLinecap="round"
      />

      {/* the minor streets, under the river so it cuts them */}
      <g stroke={INK.road} strokeWidth={6}>
        {minor}
      </g>

      <path d={BAY} fill={INK.water} />
      <path
        d={RIVER}
        fill="none"
        stroke={INK.waterEdge}
        strokeWidth={62}
        strokeLinecap="round"
      />
      <path
        d={RIVER}
        fill="none"
        stroke={INK.water}
        strokeWidth={58}
        strokeLinecap="round"
      />

      {/* the main roads, over the river as bridges */}
      <g fill="none" strokeLinecap="round">
        <g stroke={INK.casing} strokeWidth={15}>
          <line x1={0} x2={WORLD} y1={500} y2={500} />
          <line x1={420} x2={420} y1={0} y2={WORLD} />
          <line x1={120} y1={1000} x2={1000} y2={120} />
        </g>
        <g stroke={INK.road} strokeWidth={12}>
          <line x1={0} x2={WORLD} y1={500} y2={500} />
          <line x1={420} x2={420} y1={0} y2={WORLD} />
          <line x1={120} y1={1000} x2={1000} y2={120} />
        </g>
      </g>

      <g
        fill={INK.label}
        fontSize={11}
        fontWeight={500}
        letterSpacing={0.4}
        fontFamily="var(--font-inter), system-ui, sans-serif"
      >
        <text x={150} y={494}>
          harbour road
        </text>
        <text x={426} y={210} transform="rotate(90 426 210)">
          mill lane
        </text>
        <text x={760} y={364} transform="rotate(-45 760 364)">
          long avenue
        </text>
        <text x={497} y={530} fill="#5c8a4c">
          botanic garden
        </text>
        <text x={622} y={346} fill="#7c8a6a">
          signal hill
        </text>
      </g>
      <text
        x={170}
        y={770}
        fill={INK.waterLabel}
        fontSize={12}
        fontStyle="italic"
        letterSpacing={1.2}
        fontFamily="var(--font-inter), system-ui, sans-serif"
      >
        the cut
      </text>
      <text
        x={880}
        y={940}
        fill={INK.waterLabel}
        fontSize={12}
        fontStyle="italic"
        letterSpacing={1.2}
        fontFamily="var(--font-inter), system-ui, sans-serif"
      >
        the bay
      </text>
    </svg>
  );
});
