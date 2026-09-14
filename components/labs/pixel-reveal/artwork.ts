/**
 * The picture the mosaic resolves into, generated rather than fetched.
 *
 * An agate slice: concentric bands of colour round an off-centre nucleus, with
 * a crystalline core and a rough rind. It is the right subject for this demo
 * for a reason that is not decorative. A mosaic is a box filter, so what
 * survives at four cells across is whatever the picture's largest areas are,
 * and what only arrives at sixty-four is its finest. An agate is built of
 * nothing but nested areas at every scale, so every level of the run has
 * something new to show. A photograph of a face would be a grey square until
 * halfway through.
 *
 * Every ring is a sum of three harmonics rather than a noise walk, which is
 * what guarantees the path closes on itself exactly. The seeds are fixed, so
 * the same slice is cut every time and nothing here rolls at runtime.
 */

/** the picture's own square, in its own units */
export const ART = 512;

/**
 * Deep slate ground through teal to a pale core.
 *
 * The range matters more than the hues: a box filter averages, so a palette
 * that sits in one narrow band of lightness resolves into porridge at every
 * level. These run 0.09 to 0.97 in relative luminance.
 */
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

/** a fixed wobble per ring. see `stem-picker` for why this is not `Math.sin` */
function seed(ring: number, salt: number): number {
  let hash = Math.imul(ring + 1, 374761393) + Math.imul(salt + 1, 668265263);
  hash = Math.imul(hash ^ (hash >>> 13), 1274126177);
  return ((hash ^ (hash >>> 16)) >>> 0) / 4294967296;
}

/**
 * One band's outline, as a closed polygon.
 *
 * Three harmonics, because one gives an egg and two give a peanut. The
 * amplitudes fall with the harmonic so the shape reads as a lobed ring rather
 * than a gear, and every ring gets its own phases so no two are concentric in
 * the same direction.
 */
function ring(cx: number, cy: number, radius: number, index: number): string {
  const STEPS = 84;
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
      scale += lobe.amp * Math.sin(lobe.k * angle + phase[n]);
    }
    const r = radius * scale;
    points.push(
      `${(cx + Math.cos(angle) * r).toFixed(2)} ${(cy + Math.sin(angle) * r).toFixed(2)}`,
    );
  }
  return `M${points.join("L")}Z`;
}

/**
 * The slice, largest band first, so each one is painted over the last and only
 * the difference between two radii ever shows. Drawing rings as strokes instead
 * leaves seams wherever two wobbles cross.
 */
function bands(): string {
  /* off centre, since a slice cut through the middle of a nodule is the one
     arrangement that carries no information at four cells across */
  const cx = ART * 0.44;
  const cy = ART * 0.53;
  const outer = ART * 0.47;

  const paths = [`<path d="${ring(cx, cy, outer, 0)}" fill="${RIND}"/>`];
  BANDS.forEach((fill, index) => {
    const radius = outer * (0.9 - (index * 0.82) / BANDS.length);
    paths.push(`<path d="${ring(cx, cy, radius, index + 1)}" fill="${fill}"/>`);
  });
  paths.push(
    `<path d="${ring(cx, cy, outer * 0.11, 30)}" fill="${CORE_EDGE}"/>`,
    `<path d="${ring(cx, cy, outer * 0.075, 31)}" fill="${CORE}"/>`,
  );
  return paths.join("");
}

/**
 * A few crystals in the core, which are the only thing in the picture small
 * enough to arrive at the last level. Without them the run has nothing left to
 * give after thirty-two cells across.
 */
function crystals(): string {
  const cx = ART * 0.44;
  const cy = ART * 0.53;
  const shards: string[] = [];
  for (let i = 0; i < 7; i += 1) {
    const angle = seed(i, 40) * Math.PI * 2;
    const reach = ART * (0.03 + seed(i, 41) * 0.05);
    const x = cx + Math.cos(angle) * reach;
    const y = cy + Math.sin(angle) * reach;
    const size = ART * (0.008 + seed(i, 42) * 0.012);
    const turn = seed(i, 43) * 90;
    shards.push(
      `<rect x="${(x - size).toFixed(2)}" y="${(y - size * 1.6).toFixed(2)}" width="${(size * 2).toFixed(2)}" height="${(size * 3.2).toFixed(2)}" rx="${(size * 0.35).toFixed(2)}" fill="${CORE}" opacity="${(0.55 + seed(i, 44) * 0.4).toFixed(2)}" transform="rotate(${turn.toFixed(1)} ${x.toFixed(2)} ${y.toFixed(2)})"/>`,
    );
  }
  return shards.join("");
}

/** the whole picture as one string, built once at module load */
export const ARTWORK = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${ART} ${ART}" width="${ART}" height="${ART}">
<defs>
<radialGradient id="sheen" cx="34%" cy="28%" r="78%">
<stop offset="0" stop-color="#ffffff" stop-opacity="0.16"/>
<stop offset="1" stop-color="#ffffff" stop-opacity="0"/>
</radialGradient>
</defs>
<rect width="${ART}" height="${ART}" fill="${GROUND}"/>
${bands()}
${crystals()}
<rect width="${ART}" height="${ART}" fill="url(#sheen)"/>
</svg>`;

/** a data URI the browser can decode into an `Image` with no request */
export const ARTWORK_URI = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(ARTWORK)}`;
