/**
 * The mosaic: a mip pyramid of the picture, a quadtree of split times, and a
 * painter that draws the tree at any moment.
 *
 * **There are no levels.** An earlier build stepped the whole canvas from one
 * grid to the next, and even with the tiles staggered it read as a set of
 * layers arriving rather than as detail growing: at every boundary the timing
 * re-randomised, so a region that had resolved early had no reason to stay
 * early. Here every tile splits on its own schedule and that schedule is
 * inherited, so a tile that went early has children that go early. Detail
 * spreads out of the places it already reached, and at any moment the canvas
 * holds tiles of four or five different sizes at once.
 *
 * The colour is still a box filter at every depth, which is what makes the
 * reveal work without a second mechanism. Nothing fades in. The picture is
 * complete from the first frame and the filter is what throws it away.
 */

/**
 * How many times a tile may split, and what the reader may ask for.
 *
 * It stops at six, which is 64 cells across and 4,096 tiles. Seven was offered
 * and taken away: 16,384 tiles is 16,384 fills a frame, and measured under a 4x
 * CPU throttle it put the 95th percentile frame at 33ms even with the small
 * tiles drawn as plain rects. Six holds 16.7 with nothing dropped. The knob
 * only goes coarser than the default, which is the honest direction: what it is
 * for is choosing how chunky the picture stays, not how fine it gets.
 */
export const DEPTH = { min: 3, max: 6, start: 6 } as const;

export type Pyramid = Map<number, Uint8ClampedArray>;

/**
 * Every level down to one cell, each built by halving the one above it.
 *
 * Halving repeatedly rather than averaging each level out of the source, since
 * the pyramid is the same arithmetic either way and this is one pass over each
 * level instead of one pass over the source per level.
 */
export function pyramid(source: ImageData): Pyramid {
  const levels: Pyramid = new Map();
  let size = source.width;
  let rgb = new Uint8ClampedArray(size * size * 3);
  for (let i = 0; i < size * size; i += 1) {
    rgb[i * 3] = source.data[i * 4];
    rgb[i * 3 + 1] = source.data[i * 4 + 1];
    rgb[i * 3 + 2] = source.data[i * 4 + 2];
  }
  levels.set(size, rgb);

  while (size > 1) {
    const half = size / 2;
    const next = new Uint8ClampedArray(half * half * 3);
    for (let y = 0; y < half; y += 1) {
      for (let x = 0; x < half; x += 1) {
        for (let channel = 0; channel < 3; channel += 1) {
          const a = rgb[(y * 2 * size + x * 2) * 3 + channel];
          const b = rgb[(y * 2 * size + x * 2 + 1) * 3 + channel];
          const c = rgb[((y * 2 + 1) * size + x * 2) * 3 + channel];
          const d = rgb[((y * 2 + 1) * size + x * 2 + 1) * 3 + channel];
          next[(y * half + x) * 3 + channel] = (a + b + c + d) / 4;
        }
      }
    }
    levels.set(half, next);
    rgb = next;
    size = half;
  }
  return levels;
}

/**
 * How long one tile takes to leave its parent and reach its own corner, and how
 * much later than its parent it goes.
 *
 * `WAIT` is the floor on that delay and has to be at least `FLIGHT`, or a tile
 * would split while still travelling and its children would come out of a box
 * that is itself moving. `DRIFT` is how much later than the floor it can be,
 * and it is what makes one region resolve ahead of another.
 */
const FLIGHT = 0.5;
const WAIT = 0.55;
/** what the reader may ask of the drift, where 0 is every tile on the beat */
export const DRIFT = { min: 0, max: 1.6, start: 0.72 } as const;

/** a tile leaves at speed and arrives gently, and never eases in */
const depart = (t: number) => 1 - (1 - t) ** 2.4;
const clamp = (t: number) => Math.max(0, Math.min(1, t));
const smooth = (t: number) => t * t * (3 - 2 * t);

/** below this edge a tile stops paying for a seam and a corner it cannot show */
const SHARP = 6;

/** a fixed roll per tile, so a run never shimmers */
function roll(depth: number, x: number, y: number): number {
  let hash =
    Math.imul(depth + 1, 668265263) +
    Math.imul(x + 1, 374761393) +
    Math.imul(y + 1, 2246822519);
  hash = Math.imul(hash ^ (hash >>> 13), 1274126177);
  return ((hash ^ (hash >>> 16)) >>> 0) / 4294967296;
}

export interface Tree {
  /** when each tile splits, one array per depth, indexed row major */
  splits: Float32Array[];
  /** when the last tile has finished arriving */
  span: number;
  /** how many times a tile may split in this tree */
  depth: number;
}

/**
 * The split time of every tile, grown down from the root.
 *
 * A tile's time is its parent's plus a wait, so lineage is carried: a region
 * that went early keeps going early and detail spreads out of where it already
 * reached rather than restarting across the whole canvas. Without the
 * inheritance this is noise re-rolled per level, which is the build this
 * replaced.
 */
export function grow(limit: number, drift: number): Tree {
  const splits: Float32Array[] = [];
  let span = 0;
  for (let depth = 0; depth < limit; depth += 1) {
    const side = 1 << depth;
    const times = new Float32Array(side * side);
    for (let y = 0; y < side; y += 1) {
      for (let x = 0; x < side; x += 1) {
        const parent =
          depth === 0
            ? 0
            : splits[depth - 1][(y >> 1) * (side >> 1) + (x >> 1)];
        const at = parent + WAIT + drift * roll(depth, x, y) ** 2.2;
        times[y * side + x] = at;
        span = Math.max(span, at + FLIGHT);
      }
    }
    splits.push(times);
  }
  return { splits, span, depth: limit };
}

/** how much of its own colour the picture has found yet */
function bleach(r: number, g: number, b: number, amount: number): string {
  const grey = r * 0.2126 + g * 0.7152 + b * 0.0722;
  const mix = (channel: number) => Math.round(grey + (channel - grey) * amount);
  return `rgb(${mix(r)} ${mix(g)} ${mix(b)})`;
}

interface PaintOptions {
  ctx: CanvasRenderingContext2D;
  levels: Pyramid;
  tree: Tree;
  /** the picture at full resolution, for the last beat */
  art: CanvasImageSource;
  /** where the run is, from 0 to the tree's span */
  detail: number;
  /** the canvas edge in CSS pixels */
  size: number;
}

export function paint({
  ctx,
  levels,
  tree,
  art,
  detail,
  size,
}: PaintOptions): void {
  const eased = smooth(clamp(detail / (tree.span * 0.45)));

  const mean = levels.get(1);
  ctx.fillStyle = mean ? bleach(mean[0], mean[1], mean[2], eased) : "#ffffff";
  ctx.fillRect(0, 0, size, size);

  /** fills one tile, with the seam and the corner taken from its own size */
  const tile = (
    left: number,
    top: number,
    edge: number,
    r: number,
    g: number,
    b: number,
  ) => {
    /*
     * The seam belongs to the tile's size, never to its flight. Tied to the
     * flight it collapsed to nothing the moment a tile became a parent, which
     * put a jump on screen every time anything split.
     */
    ctx.fillStyle = bleach(r, g, b, eased);
    /*
     * Below a few pixels a tile is drawn as a plain rect.
     *
     * Its seam would be a twentieth of two pixels and its corner a ninth, so
     * neither can show, and a path plus a radius per tile is the whole cost at
     * this size. At 128 across that is 16,384 paths a frame: measured under a
     * 4x CPU throttle it put the 95th percentile frame at 50ms against 16.7 at
     * 64 across. The same run with `fillRect` holds the budget.
     */
    if (edge < SHARP) {
      ctx.fillRect(left, top, edge, edge);
      return;
    }
    const gap = Math.min(edge * 0.05, 5);
    ctx.beginPath();
    ctx.roundRect(
      left + gap / 2,
      top + gap / 2,
      edge - gap,
      edge - gap,
      Math.min(edge * 0.11, 4),
    );
    ctx.fill();
  };

  const shade = (depth: number, x: number, y: number): number[] => {
    const side = 1 << depth;
    const level = levels.get(side);
    if (!level) return [0, 0, 0];
    const at = (y * side + x) * 3;
    return [level[at], level[at + 1], level[at + 2]];
  };

  const walk = (
    depth: number,
    x: number,
    y: number,
    left: number,
    top: number,
    edge: number,
  ) => {
    const own = shade(depth, x, y);
    if (depth === tree.depth) {
      tile(left, top, edge, own[0], own[1], own[2]);
      return;
    }

    const side = 1 << depth;
    const at = tree.splits[depth][y * side + x];
    if (detail < at) {
      tile(left, top, edge, own[0], own[1], own[2]);
      return;
    }

    const t = depart(clamp((detail - at) / FLIGHT));
    const half = edge / 2;

    /* arrived: each child stands on its own box and may have split itself */
    if (t >= 1) {
      for (let j = 0; j < 2; j += 1) {
        for (let i = 0; i < 2; i += 1) {
          walk(
            depth + 1,
            x * 2 + i,
            y * 2 + j,
            left + i * half,
            top + j * half,
            half,
          );
        }
      }
      return;
    }

    /*
     * In flight. Four children sitting on their parent's box in its colour are
     * that parent pixel for pixel, and over the flight each shrinks to a
     * quarter of it and slides to its corner. None of them can have split yet,
     * since `WAIT` is at least `FLIGHT`.
     */
    const edgeNow = edge + (half - edge) * t;
    for (let j = 0; j < 2; j += 1) {
      for (let i = 0; i < 2; i += 1) {
        const child = shade(depth + 1, x * 2 + i, y * 2 + j);
        tile(
          left + i * half * t,
          top + j * half * t,
          edgeNow,
          own[0] + (child[0] - own[0]) * t,
          own[1] + (child[1] - own[1]) * t,
          own[2] + (child[2] - own[2]) * t,
        );
      }
    }
  };

  walk(0, 0, 0, 0, 0, size);

  /*
   * The last beat is the picture itself, not a finer mosaic. Sixty-four cells
   * is where the tiles stop being the subject and start being a screen door
   * over it, so the sharp image arrives over the top rather than the tree
   * growing another two levels.
   */
  const sharp = clamp((detail - (tree.span - 0.9)) / 0.9);
  if (sharp > 0) {
    ctx.globalAlpha = smooth(sharp);
    ctx.drawImage(art, 0, 0, size, size);
    ctx.globalAlpha = 1;
  }
}
