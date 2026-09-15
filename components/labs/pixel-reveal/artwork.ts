/**
 * The five pictures the mosaic resolves into, generated rather than fetched.
 *
 * Every one of them is built for the same test, which is the only reason a
 * picture belongs in this demo at all. A mosaic is a box filter, so what
 * survives at four cells across is whatever the picture's largest areas are,
 * and what only arrives at sixty-four is its finest. A subject built of nested
 * areas at every scale has something new to show at every level of the run. A
 * photograph of a face would be a grey square until halfway through.
 *
 * So each is a family of shapes rather than a scene: rings inside rings, beds
 * under beds, clouds inside clouds, a branch that is two smaller branches, a
 * patch beside a patch. The five use different geometry on purpose, since five
 * variations of one family would resolve the same way and there would be
 * nothing to choose between them.
 *
 * **The palettes are chosen for range rather than for hue.** A box filter
 * averages, so a set sitting in one narrow band of lightness resolves into
 * porridge at every level. Each of these runs most of the way from black to
 * white, and no two of them average to the same colour, which matters because
 * one flat tile is what the board rests on: switching pattern at rest has to
 * change something.
 *
 * Nothing rolls at runtime. Every wobble is a hash of its own index, so the
 * same slice is cut, the same tree grown and the same field scattered on every
 * load, and the swatch a reader picks is the picture they get.
 */

/** the picture's own square, in its own units */
export const ART = 512;

/**
 * A fixed wobble per shape.
 *
 * An integer hash rather than `Math.sin(x) * 43758.5453`, which is a GLSL trick
 * that degenerates on small integer inputs. `stem-picker` documents measuring
 * that one and finding five of its nine stems on the same tilt.
 */
function seed(index: number, salt: number): number {
  let hash = Math.imul(index + 1, 374761393) + Math.imul(salt + 1, 668265263);
  hash = Math.imul(hash ^ (hash >>> 13), 1274126177);
  return ((hash ^ (hash >>> 16)) >>> 0) / 4294967296;
}

const fix = (value: number) => value.toFixed(1);

/**
 * One closed outline, as a polygon.
 *
 * Three harmonics, because one gives an egg and two give a peanut. The
 * amplitudes fall with the harmonic so the shape reads as a lobed ring rather
 * than a gear, and every shape gets its own phases so no two are concentric in
 * the same direction. A sum of harmonics is also what guarantees the path
 * closes on itself exactly, where a noise walk has to be talked into it.
 */
function blob(
  cx: number,
  cy: number,
  radius: number,
  index: number,
  rough = 1,
): string {
  const STEPS = 64;
  const lobes = [
    {
      k: 2 + Math.floor(seed(index, 1) * 2),
      amp: 0.055 + seed(index, 2) * 0.05,
    },
    {
      k: 4 + Math.floor(seed(index, 3) * 3),
      amp: 0.028 + seed(index, 4) * 0.026,
    },
    {
      k: 8 + Math.floor(seed(index, 5) * 5),
      amp: 0.012 + seed(index, 6) * 0.012,
    },
  ];
  const phase = lobes.map((_, n) => seed(index, 20 + n) * Math.PI * 2);

  const points: string[] = [];
  for (let step = 0; step < STEPS; step += 1) {
    const angle = (step / STEPS) * Math.PI * 2;
    let scale = 1;
    for (const [n, lobe] of lobes.entries()) {
      scale += lobe.amp * rough * Math.sin(lobe.k * angle + phase[n]);
    }
    const r = radius * scale;
    points.push(
      `${fix(cx + Math.cos(angle) * r)} ${fix(cy + Math.sin(angle) * r)}`,
    );
  }
  return `M${points.join("L")}Z`;
}

/** the picture's frame, and the one thing every subject has in common */
const svg = (body: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${ART} ${ART}" width="${ART}" height="${ART}">${body}</svg>`;

/* ------------------------------------------------------------------ agate */

/**
 * An agate slice: concentric bands round an off-centre nucleus, a crystalline
 * core and a rough rind. The first subject this demo had, and still the
 * clearest statement of what it wants: nothing in it but nested areas.
 */
function agate(): string {
  const GROUND = "#12222a";
  const RIND = "#1d3a45";
  const BANDS = [
    "#24505e",
    "#2f6b78",
    "#3d8792",
    "#55a3aa",
    "#74bcbf",
    "#98d2d1",
    "#bee3df",
    "#dcf0eb",
    "#f0f8f4",
  ];
  const CORE = "#ffffff";
  const CORE_EDGE = "#cfe6e4";

  /* off centre, since a slice cut through the middle of a nodule is the one
     arrangement that carries no information at four cells across */
  const cx = ART * 0.44;
  const cy = ART * 0.53;
  const outer = ART * 0.47;

  /* largest band first, so each is painted over the last and only the
     difference between two radii ever shows. Drawing them as strokes instead
     leaves seams wherever two wobbles cross. */
  const parts = [
    `<rect width="${ART}" height="${ART}" fill="${GROUND}"/>`,
    `<path d="${blob(cx, cy, outer, 0)}" fill="${RIND}"/>`,
  ];
  BANDS.forEach((fill, index) => {
    const radius = outer * (0.9 - (index * 0.82) / BANDS.length);
    parts.push(`<path d="${blob(cx, cy, radius, index + 1)}" fill="${fill}"/>`);
  });
  parts.push(
    `<path d="${blob(cx, cy, outer * 0.11, 30)}" fill="${CORE_EDGE}"/>`,
    `<path d="${blob(cx, cy, outer * 0.075, 31)}" fill="${CORE}"/>`,
  );

  /* a few crystals in the core, which are the only thing in the picture small
     enough to arrive at the last level */
  for (let i = 0; i < 7; i += 1) {
    const angle = seed(i, 40) * Math.PI * 2;
    const reach = ART * (0.03 + seed(i, 41) * 0.05);
    const x = cx + Math.cos(angle) * reach;
    const y = cy + Math.sin(angle) * reach;
    const size = ART * (0.008 + seed(i, 42) * 0.012);
    parts.push(
      `<rect x="${fix(x - size)}" y="${fix(y - size * 1.6)}" width="${fix(size * 2)}" height="${fix(size * 3.2)}" rx="${fix(size * 0.35)}" fill="${CORE}" opacity="${(0.55 + seed(i, 44) * 0.4).toFixed(2)}" transform="rotate(${fix(seed(i, 43) * 90)} ${fix(x)} ${fix(y)})"/>`,
    );
  }

  return svg(
    `<defs><radialGradient id="sheen" cx="34%" cy="28%" r="78%"><stop offset="0" stop-color="#ffffff" stop-opacity="0.16"/><stop offset="1" stop-color="#ffffff" stop-opacity="0"/></radialGradient></defs>${parts.join("")}<rect width="${ART}" height="${ART}" fill="url(#sheen)"/>`,
  );
}

/* ----------------------------------------------------------------- strata */

/**
 * A cliff face in section: beds of sandstone laid down lightest first.
 *
 * The one subject whose nesting runs one way rather than outward, which is
 * what a box filter sees first: at two cells across it is a pale half over a
 * dark one, where the agate at two cells is four of about the same thing.
 */
function strata(): string {
  const GROUND = "#2a1b13";
  const BEDS = [
    "#f3e9d7",
    "#e6d2ab",
    "#d6b17c",
    "#c28f55",
    "#ab6c3c",
    "#8e502c",
    "#6f3b21",
    "#4f2a19",
    "#351c11",
  ];

  /** one bed's top edge, as a run of points across the picture */
  const edge = (y: number, index: number, amp: number): string[] => {
    const STEPS = 48;
    const lobes = [
      {
        k: 1 + Math.floor(seed(index, 11) * 2),
        amp: 0.6 + seed(index, 12) * 0.5,
      },
      {
        k: 3 + Math.floor(seed(index, 13) * 3),
        amp: 0.3 + seed(index, 14) * 0.24,
      },
      {
        k: 7 + Math.floor(seed(index, 15) * 5),
        amp: 0.1 + seed(index, 16) * 0.12,
      },
    ];
    const phase = lobes.map((_, n) => seed(index, 30 + n) * Math.PI * 2);
    const points: string[] = [];
    for (let step = 0; step <= STEPS; step += 1) {
      const x = (step / STEPS) * ART;
      let drop = 0;
      for (const [n, lobe] of lobes.entries()) {
        drop +=
          lobe.amp * Math.sin((lobe.k * x * Math.PI * 2) / ART + phase[n]);
      }
      points.push(`${fix(x)} ${fix(y + drop * amp)}`);
    }
    return points;
  };

  /* each bed is filled to the foot of the picture and the next one is painted
     over it, so only the band between two edges ever shows */
  const parts = [`<rect width="${ART}" height="${ART}" fill="${GROUND}"/>`];
  BEDS.forEach((fill, index) => {
    const y = ART * (0.06 + index * 0.098);
    const points = edge(y, index, ART * (0.02 + seed(index, 17) * 0.024));
    parts.push(
      `<path d="M${points.join("L")}L${ART} ${ART}L0 ${ART}Z" fill="${fill}"/>`,
    );
  });

  /* grain: a hairline inside a bed, on that bed's own edge shifted down, which
     is the only thing here fine enough to arrive at the last level */
  for (let index = 1; index < BEDS.length; index += 1) {
    const y = ART * (0.06 + index * 0.098);
    const points = edge(
      y + ART * (0.03 + seed(index, 18) * 0.03),
      index,
      ART * (0.02 + seed(index, 17) * 0.024),
    );
    parts.push(
      `<path d="M${points.join("L")}" fill="none" stroke="${BEDS[index + 1] ?? GROUND}" stroke-width="${fix(1.5 + seed(index, 19) * 2)}" opacity="0.7"/>`,
    );
  }

  /* pebbles in the lower beds, the medium detail between a bed and a grain */
  for (let i = 0; i < 14; i += 1) {
    const x = ART * (0.05 + seed(i, 50) * 0.9);
    const y = ART * (0.55 + seed(i, 51) * 0.4);
    const r = ART * (0.008 + seed(i, 52) * 0.016);
    parts.push(
      `<ellipse cx="${fix(x)}" cy="${fix(y)}" rx="${fix(r * 1.4)}" ry="${fix(r)}" fill="${BEDS[3 + Math.floor(seed(i, 53) * 3)]}" opacity="0.85"/>`,
    );
  }

  return svg(parts.join(""));
}

/* ----------------------------------------------------------------- nebula */

/**
 * A deep field: clouds inside clouds along one diagonal, a dust lane across
 * them, and a scatter of stars.
 *
 * The widest range of the five, near black to white, and the only one whose
 * finest detail is separate objects rather than an edge. The stars are what the
 * last level is for: nothing else in the picture is small enough to be lost at
 * thirty-two cells across and found at sixty-four.
 */
function nebula(): string {
  const GROUND = "#070a17";
  const CLOUDS = [
    "#111a3a",
    "#1f2456",
    "#33296c",
    "#4f3277",
    "#76407a",
    "#a1547a",
    "#c97b84",
    "#e5a897",
    "#f7d9c6",
  ];

  const parts = [`<rect width="${ART}" height="${ART}" fill="${GROUND}"/>`];

  /* a chain rather than a target: each cloud is smaller, lighter and a step
     along the diagonal, so the picture has a direction at four cells across */
  CLOUDS.forEach((fill, index) => {
    const t = index / (CLOUDS.length - 1);
    const cx = ART * (0.29 + t * 0.34 + (seed(index, 60) - 0.5) * 0.06);
    const cy = ART * (0.72 - t * 0.37 + (seed(index, 61) - 0.5) * 0.06);
    const r = ART * (0.46 - t * 0.4);
    parts.push(
      `<path d="${blob(cx, cy, r, index + 60, 1.5)}" fill="${fill}"/>`,
    );
  });
  parts.push(
    `<path d="${blob(ART * 0.63, ART * 0.35, ART * 0.026, 71)}" fill="#ffffff"/>`,
  );

  /*
   * The dust lane, which is the one mid-scale feature: without it the chain
   * resolves as a smooth ramp and every level in the middle looks alike.
   *
   * A ragged chain of dark clouds rather than a stroke along a curve. Drawn as
   * a stroke it was a smooth band of even width, which over a bright cloud read
   * as a ring round a planet, and thinning it only turned the ring into a
   * scratch. Dust is the same shape as what it is cutting across.
   */
  const lane: string[] = [];
  for (let i = 0; i < 15; i += 1) {
    const t = i / 14;
    /* across the chain rather than along it, and below the core. Laid along
       the chain it swallowed the bright end, which is the one part of the
       picture the last two levels are for. */
    const cx = ART * (0.06 + t * 0.62 + (seed(i, 70) - 0.5) * 0.04);
    const cy = ART * (0.42 + t * 0.34 + (seed(i, 71) - 0.5) * 0.04);
    const r = ART * (0.05 + seed(i, 72) * 0.028);
    lane.push(`<path d="${blob(cx, cy, r, i + 80, 1.8)}"/>`);
  }
  /* one group at one opacity, not fifteen shapes each at its own. Overlapping
     translucent blobs compound where they meet, which drew the lane as a row
     of beads: what makes it one ragged band is that they overlap and the
     overlaps cost nothing. */
  parts.push(`<g fill="${GROUND}" opacity="0.62">${lane.join("")}</g>`);

  /* stars, kept off the core, which is already the brightest thing there is */
  for (let i = 0; i < 110; i += 1) {
    const x = ART * seed(i, 80);
    const y = ART * seed(i, 81);
    const near = Math.hypot(x - ART * 0.63, y - ART * 0.35) < ART * 0.09;
    if (near) continue;
    const r = 0.5 + seed(i, 82) ** 2.5 * 2.4;
    parts.push(
      `<circle cx="${fix(x)}" cy="${fix(y)}" r="${r.toFixed(2)}" fill="#ffffff" opacity="${(0.3 + seed(i, 83) * 0.7).toFixed(2)}"/>`,
    );
  }

  return svg(parts.join(""));
}

/* ----------------------------------------------------------------- canopy */

/**
 * A bare tree against a low sun: one branch that is two smaller branches, six
 * times over.
 *
 * The only subject here that is self-similar by construction rather than by
 * arrangement, and the only one drawn dark on light. Its coarse levels are the
 * sun and the ground, its middle ones the trunk and the boughs, and its last
 * one the twigs, which is the same ladder the other four climb with areas.
 */
function canopy(): string {
  const SKY = "#dde5e9";
  const HALO = "#f2ecdc";
  const SUN = "#fffbee";
  const EARTH = "#5f6a68";
  const INK = "#231f1e";

  /* one sky and one disc rather than a stack of bands. Banded, its coarse
     levels were a row of horizontal stripes, which is what `strata` already
     is, and two patterns that resolve alike are one pattern. */
  const parts = [
    `<rect width="${ART}" height="${ART}" fill="${SKY}"/>`,
    `<circle cx="${fix(ART * 0.68)}" cy="${fix(ART * 0.42)}" r="${fix(ART * 0.29)}" fill="${HALO}"/>`,
    `<circle cx="${fix(ART * 0.68)}" cy="${fix(ART * 0.42)}" r="${fix(ART * 0.17)}" fill="${SUN}"/>`,
    `<path d="M0 ${fix(ART * 0.84)}L${ART} ${fix(ART * 0.88)}L${ART} ${ART}L0 ${ART}Z" fill="${EARTH}"/>`,
  ];

  /** a bough, and then the two smaller boughs it forks into */
  const limbs: string[] = [];
  const bough = (
    x: number,
    y: number,
    angle: number,
    len: number,
    width: number,
    left: number,
    index: number,
  ) => {
    const bend = (seed(index, 90) - 0.5) * 0.6;
    const x2 = x + Math.cos(angle) * len;
    const y2 = y + Math.sin(angle) * len;
    const mx = x + Math.cos(angle + bend) * len * 0.5;
    const my = y + Math.sin(angle + bend) * len * 0.5;
    limbs.push(
      `<path d="M${fix(x)} ${fix(y)}Q${fix(mx)} ${fix(my)} ${fix(x2)} ${fix(y2)}" stroke-width="${width.toFixed(2)}"/>`,
    );
    if (left === 0) return;
    const spread = 0.36 + seed(index, 91) * 0.32;
    bough(
      x2,
      y2,
      angle - spread,
      len * (0.68 + seed(index, 92) * 0.14),
      width * 0.66,
      left - 1,
      index * 2 + 1,
    );
    bough(
      x2,
      y2,
      angle + spread * (0.7 + seed(index, 93) * 0.7),
      len * (0.68 + seed(index, 94) * 0.14),
      width * 0.66,
      left - 1,
      index * 2 + 2,
    );
    /* the lowest two forks carry a third limb. A strict binary tree is a thin
       Y at every scale, and what makes a crown read as mass is the odd limb */
    if (left > 4) {
      bough(
        x2,
        y2,
        angle + (seed(index, 95) - 0.5) * 0.3,
        len * 0.72,
        width * 0.5,
        left - 2,
        index * 2 + 40,
      );
    }
  };
  bough(ART * 0.44, ART * 0.97, -Math.PI / 2, ART * 0.235, ART * 0.062, 6, 0);
  parts.push(
    `<g fill="none" stroke="${INK}" stroke-linecap="round">${limbs.join("")}</g>`,
  );

  return svg(parts.join(""));
}

/* ----------------------------------------------------------------- lichen */

/**
 * A colony on stone: patches packed until they meet, each with its own rim.
 *
 * The one subject built by tiling rather than by nesting. What it has at every
 * scale is the patches, then the gaps of stone between them, then the rims,
 * then the fruiting bodies, and a box filter finds them in that order.
 */
function lichen(): string {
  const STONE = "#e9e6dd";
  const CRUST = [
    { skin: "#7f8f5d", rim: "#4c5a33" },
    { skin: "#a8b177", rim: "#6b7444" },
    { skin: "#cfc79a", rim: "#8d8557" },
    { skin: "#5f7a63", rim: "#33462f" },
    { skin: "#b78a52", rim: "#6f4f28" },
    { skin: "#8b9aa2", rim: "#4f5d66" },
  ];

  const parts = [`<rect width="${ART}" height="${ART}" fill="${STONE}"/>`];

  /* a jittered grid rather than a scatter, since a scatter leaves holes in one
     half and a pile in the other, and a colony is packed */
  const CELLS = 5;
  const patches: { x: number; y: number; r: number; index: number }[] = [];
  for (let row = 0; row < CELLS; row += 1) {
    for (let col = 0; col < CELLS; col += 1) {
      const index = row * CELLS + col;
      const cell = ART / CELLS;
      patches.push({
        x: (col + 0.5 + (seed(index, 100) - 0.5) * 0.7) * cell,
        y: (row + 0.5 + (seed(index, 101) - 0.5) * 0.7) * cell,
        /* a wide range on purpose: patches all one size are one area repeated,
           and a box filter has nothing new to show at any level of it */
        r: cell * (0.3 + seed(index, 102) ** 1.7 * 0.85),
        index,
      });
    }
  }

  /* largest first, so a small patch always sits on a large one and the eye
     reads which grew over which */
  patches.sort((a, b) => b.r - a.r);
  for (const patch of patches) {
    const hue = CRUST[Math.floor(seed(patch.index, 103) * CRUST.length)];
    parts.push(
      `<path d="${blob(patch.x, patch.y, patch.r, patch.index + 100, 1.6)}" fill="${hue.skin}" stroke="${hue.rim}" stroke-width="${fix(2 + seed(patch.index, 104) * 3)}"/>`,
    );
  }

  /* fruiting bodies: the last thing a reader gets, and the reason the run has
     anything left to give after thirty-two cells across */
  for (let i = 0; i < 70; i += 1) {
    const host = patches[Math.floor(seed(i, 110) * patches.length)];
    const angle = seed(i, 111) * Math.PI * 2;
    const reach = host.r * 0.72 * seed(i, 112) ** 0.6;
    parts.push(
      `<circle cx="${fix(host.x + Math.cos(angle) * reach)}" cy="${fix(host.y + Math.sin(angle) * reach)}" r="${(1.6 + seed(i, 113) * 2.6).toFixed(2)}" fill="${CRUST[Math.floor(seed(host.index, 103) * CRUST.length)].rim}" opacity="0.85"/>`,
    );
  }

  return svg(parts.join(""));
}

/* --------------------------------------------------------------- registry */

export interface Pattern {
  slug: string;
  /** what it is, for the board's accessible name and the swatch's label */
  name: string;
  /** the picture as a data URI, so a swatch and the board cost no request */
  uri: string;
}

/**
 * The five, in the order they are offered.
 *
 * `agate` leads because it is the one the demo was built around and the one
 * whose bands say most plainly what a box filter does to a picture. The rest
 * alternate dark ground and light so the strip does not read as one long fade.
 */
export const PATTERNS: readonly Pattern[] = [
  { slug: "agate", name: "An agate slice", draw: agate },
  { slug: "strata", name: "A cliff face in section", draw: strata },
  { slug: "nebula", name: "A deep field", draw: nebula },
  { slug: "canopy", name: "A bare tree at sunset", draw: canopy },
  { slug: "lichen", name: "A lichen colony on stone", draw: lichen },
].map(({ slug, name, draw }) => ({
  slug,
  name,
  /* a data URI the browser can decode into an `Image` with no request */
  uri: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(draw())}`,
}));
