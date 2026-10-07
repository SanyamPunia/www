/**
 * The scratch-off coating: how it looks, how a coin takes it off, and how much
 * of it is left. Pure apart from the canvases it draws on.
 *
 * Everything here is in the foil's own pixels, a fixed 800 by 650 whatever the
 * panel paints at, so a resize never wipes a scratch and never has to rescale
 * one. The panel is 16:13 at every width, which is what makes a fixed buffer
 * honest. The top 500 pixels are the three by three game and the 150 under
 * them are the prize strip.
 */

export const FOIL_W = 800;
export const FOIL_H = 650;
/** where the game ends and the prize strip starts */
export const PLAY_H = 500;
export const COLS = 3;
export const ROWS = 3;
/** the panel's 8px corner at the 320px it paints on a lab column */
const CORNER = 20;

/**
 * The coin is held at an angle, so what touches the card is a stretch of its
 * edge rather than a point. That stretch is the brush: an ellipse along the
 * coin's edge, which clears a wider band moving across it than along it, and
 * which is fixed to the coin rather than turning with the stroke.
 */
const RX = 38;
const RY = 25;
const ANGLE = -0.6;
const COS = Math.cos(ANGLE);
const SIN = Math.sin(ANGLE);
const SPRITE = 2 * RX + 12;
/** foil pixels between two stamps along a stroke */
const SPACING = 2.5;

/**
 * Two nicks on the coin's edge. Each one misses a hairline of coating along the
 * stroke, which is the streak a real scratch leaves, and a second pass in
 * another direction takes it.
 */
const NICKS = [-0.42, 0.18];
const NICK_CUT = 0.85;

/** coverage is tracked on a coarse grid, which is what progress and the dust read */
const GRID_W = 80;
const GRID_H = 65;
const CELL = FOIL_W / GRID_W;

export interface Foil {
  /** opaque where coating is left */
  mask: HTMLCanvasElement;
  mctx: CanvasRenderingContext2D;
  texture: HTMLCanvasElement;
  sprites: HTMLCanvasElement[];
  /** the brush for one stroke, with that stroke's nicks cut out of it */
  stamp: HTMLCanvasElement;
  sctx: CanvasRenderingContext2D;
  /** coating left per grid cell, 1 to 0 */
  cover: Float32Array;
}

/** a game cell's box in foil pixels */
export function cellBox(i: number): {
  x: number;
  y: number;
  w: number;
  h: number;
} {
  const w = FOIL_W / COLS;
  const h = PLAY_H / ROWS;
  return { x: (i % COLS) * w, y: Math.floor(i / COLS) * h, w, h };
}

function canvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
}

function context(c: HTMLCanvasElement): CanvasRenderingContext2D {
  const ctx = c.getContext("2d");
  if (!ctx) throw new Error("2d canvas unavailable");
  return ctx;
}

/** a four point sparkle, the motif printed across the coating */
function sparkle(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
) {
  ctx.moveTo(x, y - r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.quadraticCurveTo(x, y, x, y + r);
  ctx.quadraticCurveTo(x, y, x - r, y);
  ctx.quadraticCurveTo(x, y, x, y - r);
  ctx.closePath();
}

/**
 * Debossed: the shape pressed into the coating, which is a light edge below it
 * and the shape itself a shade darker. Printed ink on latex would be a colour,
 * and this is a texture.
 */
function deboss(ctx: CanvasRenderingContext2D, draw: () => void, dark: number) {
  ctx.save();
  ctx.translate(0, 1.5);
  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ctx.strokeStyle = "rgba(255,255,255,0.55)";
  draw();
  ctx.restore();
  ctx.fillStyle = `rgba(40,44,52,${dark})`;
  ctx.strokeStyle = `rgba(40,44,52,${dark})`;
  draw();
}

function makeTexture(font: string): HTMLCanvasElement {
  const c = canvas(FOIL_W, FOIL_H);
  const ctx = context(c);

  // the base is a brushed silver, three bands of light across it
  const base = ctx.createLinearGradient(0, 0, FOIL_W, FOIL_H);
  base.addColorStop(0, "#b6bac1");
  base.addColorStop(0.32, "#d4d7db");
  base.addColorStop(0.58, "#aeb2b9");
  base.addColorStop(0.82, "#cdd0d5");
  base.addColorStop(1, "#b1b5bc");
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, FOIL_W, FOIL_H);

  // grain and a scatter of metal flake, per pixel, which is what keeps a flat
  // grey from reading as a fill
  const image = ctx.getImageData(0, 0, FOIL_W, FOIL_H);
  const data = image.data;
  for (let i = 0; i < data.length; i += 4) {
    const flake = Math.random() < 0.006 ? 34 : 0;
    const n = (Math.random() - 0.5) * 16 + flake;
    data[i] += n;
    data[i + 1] += n;
    data[i + 2] += n;
  }
  ctx.putImageData(image, 0, 0);
  // brushed: faint streaks along the rows
  for (let y = 0; y < FOIL_H; y += 2) {
    ctx.fillStyle = `rgba(255,255,255,${Math.random() * 0.05})`;
    ctx.fillRect(0, y, FOIL_W, 1);
  }

  // the motif, in offset rows, pressed into the coating
  deboss(
    ctx,
    () => {
      ctx.beginPath();
      for (let row = 0; row * 40 < FOIL_H + 40; row++) {
        for (let col = 0; col * 56 < FOIL_W + 56; col++) {
          sparkle(ctx, col * 56 + (row % 2) * 28, row * 40 + 8, 5);
        }
      }
      ctx.fill();
    },
    0.06,
  );

  // the cells pressed into the coating, so the hand knows where the nine are,
  // and a question mark in each, which is every scratch card's own instruction
  deboss(
    ctx,
    () => {
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 1; i < COLS; i++) {
        const x = (FOIL_W / COLS) * i;
        ctx.moveTo(x, 18);
        ctx.lineTo(x, PLAY_H - 18);
      }
      for (let i = 1; i < ROWS; i++) {
        const y = (PLAY_H / ROWS) * i;
        ctx.moveTo(18, y);
        ctx.lineTo(FOIL_W - 18, y);
      }
      ctx.moveTo(0, PLAY_H);
      ctx.lineTo(FOIL_W, PLAY_H);
      ctx.stroke();
    },
    0.2,
  );
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `600 64px ${font}`;
  deboss(
    ctx,
    () => {
      for (let i = 0; i < COLS * ROWS; i++) {
        const b = cellBox(i);
        ctx.fillText("?", b.x + b.w / 2, b.y + b.h / 2 + 3);
      }
    },
    0.24,
  );

  // the strip under them carries a zigzag, which is the gesture drawn
  deboss(
    ctx,
    () => {
      ctx.lineWidth = 3.5;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.beginPath();
      const y = PLAY_H + (FOIL_H - PLAY_H) / 2;
      for (let i = 0; i <= 10; i++) {
        const x = FOIL_W / 2 - 120 + i * 24;
        ctx.lineTo(x, i % 2 === 0 ? y - 9 : y + 9);
      }
      ctx.stroke();
    },
    0.3,
  );

  // the edge of the coating catches the light along its top and falls away
  // along its foot, which is the sticker's own thickness
  const rim = ctx.createLinearGradient(0, 0, 0, FOIL_H);
  rim.addColorStop(0, "rgba(255,255,255,0.75)");
  rim.addColorStop(0.5, "rgba(255,255,255,0)");
  rim.addColorStop(1, "rgba(30,34,40,0.35)");
  ctx.strokeStyle = rim;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(1.5, 1.5, FOIL_W - 3, FOIL_H - 3, CORNER - 1.5);
  ctx.stroke();

  return c;
}

/**
 * Four brushes, each the coin's ellipse with its own ragged edge. A stroke
 * picks one, so no two strokes leave the same edge.
 */
function makeSprites(): HTMLCanvasElement[] {
  return Array.from({ length: 4 }, () => {
    const c = canvas(SPRITE, SPRITE);
    const ctx = context(c);
    const image = ctx.createImageData(SPRITE, SPRITE);
    const p1 = Math.random() * Math.PI * 2;
    const p2 = Math.random() * Math.PI * 2;
    const half = SPRITE / 2;
    for (let y = 0; y < SPRITE; y++) {
      for (let x = 0; x < SPRITE; x++) {
        const dx = x + 0.5 - half;
        const dy = y + 0.5 - half;
        const u = dx * COS + dy * SIN;
        const v = -dx * SIN + dy * COS;
        const d = Math.hypot(u / RX, v / RY);
        const theta = Math.atan2(v, u);
        const edge =
          0.07 * Math.sin(theta * 7 + p1) +
          0.05 * Math.sin(theta * 15 + p2) +
          (Math.random() - 0.5) * 0.14;
        let a = Math.min(1, Math.max(0, (1 - d + edge) / 0.09));
        // the middle is not quite clean either, a coin skips over grit
        a *= 0.82 + Math.random() * 0.18;
        image.data[(y * SPRITE + x) * 4 + 3] = Math.round(a * 255);
      }
    }
    ctx.putImageData(image, 0, 0);
    return c;
  });
}

export function createFoil(font: string): Foil {
  const mask = canvas(FOIL_W, FOIL_H);
  const mctx = context(mask);
  mctx.fillStyle = "#fff";
  mctx.beginPath();
  mctx.roundRect(0, 0, FOIL_W, FOIL_H, CORNER);
  mctx.fill();
  const stamp = canvas(SPRITE, SPRITE);
  return {
    mask,
    mctx,
    texture: makeTexture(font),
    sprites: makeSprites(),
    stamp,
    sctx: context(stamp),
    cover: new Float32Array(GRID_W * GRID_H).fill(1),
  };
}

/** cut this stroke's brush: a sprite, less the two hairlines its nicks miss */
function prepare(foil: Foil, dx: number, dy: number) {
  const { sctx } = foil;
  const sprite = foil.sprites[Math.floor(Math.random() * foil.sprites.length)];
  sctx.globalCompositeOperation = "source-over";
  sctx.clearRect(0, 0, SPRITE, SPRITE);
  sctx.drawImage(sprite, 0, 0);
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  sctx.globalCompositeOperation = "destination-out";
  sctx.strokeStyle = `rgba(0,0,0,${NICK_CUT})`;
  sctx.lineWidth = 1.6;
  sctx.beginPath();
  for (const n of NICKS) {
    const px = SPRITE / 2 + COS * RX * n;
    const py = SPRITE / 2 + SIN * RX * n;
    sctx.moveTo(px - ux * SPRITE, py - uy * SPRITE);
    sctx.lineTo(px + ux * SPRITE, py + uy * SPRITE);
  }
  sctx.stroke();
}

/** one stamp's worth of coverage off the grid, returning how much came off */
function wear(foil: Foil, x: number, y: number, a: number, k: number): number {
  const { cover } = foil;
  const rx = RX * k;
  const ry = RY * k;
  const c0 = Math.max(0, Math.floor((x - rx) / CELL));
  const c1 = Math.min(GRID_W - 1, Math.floor((x + rx) / CELL));
  const r0 = Math.max(0, Math.floor((y - rx) / CELL));
  const r1 = Math.min(GRID_H - 1, Math.floor((y + rx) / CELL));
  let removed = 0;
  for (let r = r0; r <= r1; r++) {
    for (let c = c0; c <= c1; c++) {
      const dx = (c + 0.5) * CELL - x;
      const dy = (r + 0.5) * CELL - y;
      const u = dx * COS + dy * SIN;
      const v = -dx * SIN + dy * COS;
      const d = (u / rx) ** 2 + (v / ry) ** 2;
      if (d >= 1) continue;
      const i = r * GRID_W + c;
      const before = cover[i];
      if (before <= 0) continue;
      const after = before * (1 - a * (1 - d * 0.35));
      cover[i] = after < 0.02 ? 0 : after;
      removed += before - cover[i];
    }
  }
  return removed;
}

/** where a stamp tore coating off, and how much, for the dust to spawn from */
export interface Tear {
  x: number;
  y: number;
  amount: number;
}

/**
 * A coin dragged from one point to the next. `speed` is foil pixels a second,
 * and a fast stroke presses lighter, which is what leaves a fast scratch
 * streaky and a slow one clean. `size` scales the coin's edge, which is how a
 * pen's pressure and a finger's contact patch reach the brush.
 *
 * Returns the tears along the way and how much coating the coin was on, which
 * is what the sound reads.
 */
export function scratch(
  foil: Foil,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  speed: number,
  size = 1,
): { tears: Tear[]; on: number } {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const len = Math.hypot(dx, dy);
  const steps = Math.max(1, Math.ceil(len / SPACING));
  const a = 0.95 - 0.38 * Math.min(1, speed / 3200);
  prepare(foil, len > 0 ? dx : 1, len > 0 ? dy : 0);

  const { mctx, stamp } = foil;
  const span = SPRITE * size;
  mctx.globalCompositeOperation = "destination-out";
  mctx.globalAlpha = a;
  const tears: Tear[] = [];
  let on = 0;
  let count = 0;
  for (let i = len > 0 ? 1 : 0; i <= steps; i++) {
    const t = i / steps;
    const x = x0 + dx * t;
    const y = y0 + dy * t;
    on += coverAt(foil, x, y);
    count++;
    const jx = (Math.random() - 0.5) * 1.5;
    const jy = (Math.random() - 0.5) * 1.5;
    mctx.drawImage(stamp, x - span / 2 + jx, y - span / 2 + jy, span, span);
    const removed = wear(foil, x, y, a, size);
    if (removed > 0) tears.push({ x, y, amount: removed });
  }
  mctx.globalAlpha = 1;
  mctx.globalCompositeOperation = "source-over";
  return { tears, on: on / count };
}

function coverAt(foil: Foil, x: number, y: number): number {
  const c = Math.floor(x / CELL);
  const r = Math.floor(y / CELL);
  if (c < 0 || r < 0 || c >= GRID_W || r >= GRID_H) return 0;
  return foil.cover[r * GRID_W + c];
}

/** coating left inside a box, 1 to 0 */
export function coverIn(
  foil: Foil,
  x: number,
  y: number,
  w: number,
  h: number,
): number {
  const c0 = Math.max(0, Math.floor(x / CELL));
  const c1 = Math.min(GRID_W, Math.ceil((x + w) / CELL));
  const r0 = Math.max(0, Math.floor(y / CELL));
  const r1 = Math.min(GRID_H, Math.ceil((y + h) / CELL));
  let sum = 0;
  for (let r = r0; r < r1; r++) {
    for (let c = c0; c < c1; c++) sum += foil.cover[r * GRID_W + c];
  }
  return sum / Math.max(1, (r1 - r0) * (c1 - c0));
}

/** the corner furthest from a point, which is how far the last of it has to go */
export function reach(x: number, y: number): number {
  return Math.max(
    Math.hypot(x, y),
    Math.hypot(FOIL_W - x, y),
    Math.hypot(x, FOIL_H - y),
    Math.hypot(FOIL_W - x, FOIL_H - y),
  );
}

/**
 * The last of the coating coming away, as a ragged hole growing out of the
 * point the coin left off. Returns the cells it took this frame that still had
 * coating on them, which is where the flakes come from.
 */
export function clearTo(
  foil: Foil,
  cx: number,
  cy: number,
  radius: number,
  seed: number,
): Tear[] {
  const { mctx, cover } = foil;
  mctx.globalCompositeOperation = "destination-out";
  mctx.beginPath();
  const n = 72;
  for (let i = 0; i <= n; i++) {
    const t = (i / n) * Math.PI * 2;
    const r =
      radius *
      (1 + 0.07 * Math.sin(t * 5 + seed) + 0.04 * Math.sin(t * 11 - seed * 2));
    mctx.lineTo(cx + Math.cos(t) * r, cy + Math.sin(t) * r);
  }
  mctx.fill();
  mctx.globalCompositeOperation = "source-over";

  const tears: Tear[] = [];
  const inner = radius * 0.9;
  for (let r = 0; r < GRID_H; r++) {
    for (let c = 0; c < GRID_W; c++) {
      const i = r * GRID_W + c;
      if (cover[i] <= 0) continue;
      const x = (c + 0.5) * CELL;
      const y = (r + 0.5) * CELL;
      if (Math.hypot(x - cx, y - cy) > inner) continue;
      tears.push({ x, y, amount: cover[i] });
      cover[i] = 0;
    }
  }
  return tears;
}

/** take every last speck, for a reveal with no travel */
export function clearAll(foil: Foil): void {
  foil.mctx.clearRect(0, 0, FOIL_W, FOIL_H);
  foil.cover.fill(0);
}

/**
 * The coating as it paints: the texture, a band of light across it, and the
 * mask cutting out everything a coin has taken.
 *
 * `lx` and `ly` are the light's place on the panel, 0 to 1, which the card's
 * tilt decides.
 */
export function paintFoil(
  ctx: CanvasRenderingContext2D,
  foil: Foil,
  lx: number,
  ly: number,
): void {
  ctx.globalCompositeOperation = "source-over";
  ctx.clearRect(0, 0, FOIL_W, FOIL_H);
  ctx.drawImage(foil.texture, 0, 0);

  // a steep diagonal band, the light a sheet of foil throws back as it tilts
  const px = lx * FOIL_W;
  const py = ly * FOIL_H;
  const nx = Math.cos(-0.45);
  const ny = Math.sin(-0.45);
  ctx.globalCompositeOperation = "screen";
  for (const [w, alpha] of [
    [320, 0.26],
    [75, 0.44],
  ] as const) {
    const g = ctx.createLinearGradient(
      px - nx * w,
      py - ny * w,
      px + nx * w,
      py + ny * w,
    );
    g.addColorStop(0, "rgba(255,255,255,0)");
    g.addColorStop(0.5, `rgba(255,255,255,${alpha})`);
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, FOIL_W, FOIL_H);
  }

  ctx.globalCompositeOperation = "destination-in";
  ctx.drawImage(foil.mask, 0, 0);
  ctx.globalCompositeOperation = "source-over";
}
