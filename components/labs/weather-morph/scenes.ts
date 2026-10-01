import {
  circle,
  cloud,
  drop,
  moon,
  type Outline,
  placed,
  polygon,
} from "./shapes";

/*
 * The four icons, flat, after the reference:
 * grey shapes with one accent in the primary ink. An earlier pass gave each
 * scene a sky, a glow, gradients and weather drawn round it, and it read as a
 * cartoon. What carries this lab is the morph, so nothing else competes.
 */

/*
 * One hue per state, and that hue is what says which state it is: slate for
 * cloud, indigo for night, amber for sun, blue for rain, teal for snow.
 * Where a state has an
 * accent it is a deeper shade of its own hue, never a second colour. A pass
 * with a sky, gradients, a glow and weather drawn round each icon read as a
 * cartoon, so the colour stays on the shapes and nowhere else.
 *
 * Scoped to this lab, the exception `forecast-list` takes: the weather is the
 * subject and colour is part of what says which weather. Not tokens, and
 * nothing else may reach for them. Each is muted on purpose and clears 3:1 on
 * white, a graphic's floor, except the amber, which no amber does.
 */
export const HUE = {
  slate: "#7f93ab",
  indigo: "#6b70cf",
  amber: "#f0a93b",
  amberDeep: "#dd8a12",
  rainCloud: "#9aabbf",
  blue: "#4f93dc",
  blueDeep: "#2d6fc6",
  teal: "#3f9fb6",
} as const;

export interface Part {
  pts: Outline;
  /** a CSS colour, so a morph can `color-mix` one into the next */
  color: string;
}

/*
 * Every icon is one body and the small parts that belong to it. A morph only
 * ever turns a body into the next body, and the small parts go home into
 * their own body or come out of the new one. The first build paired parts by
 * distance across icons, so the sun's rays were dealt out to become the drops
 * and the cloud's edges, and that one change read as the sun coming apart
 * where the others read as one thing turning into another.
 */
export interface Scene {
  name: string;
  body: Part;
  satellites: Part[];
  /** radians the satellites turn about the centre as they come out */
  spin: number;
}

const CLOUD = cloud();

const RAYS = Array.from({ length: 8 }, (_, i) => {
  const a = -Math.PI / 2 + (i * Math.PI) / 4;
  return circle(60 + 38.25 * Math.cos(a), 60 + 38.25 * Math.sin(a), 4.4);
});

/*
 * Rain is a small cloud with three drops under it, and it was three drops on
 * their own, which left the sun's disc nothing to become. Now the disc turns
 * into the cloud and the drops fall out of it.
 */
const RAIN_CLOUD = placed(CLOUD, 0.74, 60, 42);
const DROPS = [drop(36, 86, 0.6), drop(60, 94, 0.6), drop(84, 86, 0.6)];

/*
 * Snow is one large flake and no cloud. Six arms, each with one pair of
 * branches, built as a single outline in an arm's own frame and turned round
 * the centre. An arm is `2 * W` wide; the hub corner between two arms is where
 * their edges meet, at `2 * W` from the centre on the bisector, and each
 * branch is a strip of the same width leaving the arm at 50 degrees.
 */
function flake(): Outline {
  const W = 3;
  const R = 44;
  const B = 24;
  const L = 12;
  const c = Math.cos((50 * Math.PI) / 180);
  const s = Math.sin((50 * Math.PI) / 180);
  // one side of an arm, from the hub corner out to the tip, on the side the
  // outline arrives from
  const side: [number, number][] = [
    [Math.sqrt(3) * W, -W],
    [B - 0.466 * W, -W],
    [B + c * L - s * W, -s * L - c * W],
    [B + c * L + s * W, -s * L + c * W],
    [B + 2.145 * W, -W],
    [R, -W],
  ];
  const arm = [
    ...side,
    ...side
      .slice(1)
      .reverse()
      .map(([x, y]): [number, number] => [x, -y]),
  ];
  const corners: [number, number][] = [];
  for (let k = 0; k < 6; k++) {
    const a = -Math.PI / 2 + (k * Math.PI) / 3;
    const ca = Math.cos(a);
    const sa = Math.sin(a);
    for (const [x, y] of arm)
      corners.push([60 + x * ca - y * sa, 60 + x * sa + y * ca]);
  }
  return polygon(corners);
}

export const SCENES: readonly Scene[] = [
  {
    name: "Cloudy",
    body: { pts: CLOUD, color: HUE.slate },
    satellites: [],
    spin: 0,
  },
  {
    name: "Clear night",
    body: { pts: moon(), color: HUE.indigo },
    satellites: [],
    spin: 0,
  },
  {
    name: "Sunny",
    body: { pts: circle(60, 60, 25.25), color: HUE.amber },
    satellites: RAYS.map((pts) => ({ pts, color: HUE.amberDeep })),
    // the rays bloom round the disc
    spin: 0.55,
  },
  {
    name: "Light rain",
    body: { pts: RAIN_CLOUD, color: HUE.rainCloud },
    satellites: [
      { pts: DROPS[0], color: HUE.blue },
      { pts: DROPS[1], color: HUE.blueDeep },
      { pts: DROPS[2], color: HUE.blue },
    ],
    // drops fall straight out of the cloud
    spin: 0,
  },
  {
    name: "Snow",
    body: { pts: flake(), color: HUE.teal },
    satellites: [],
    spin: 0,
  },
];
