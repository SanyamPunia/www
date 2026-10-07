/**
 * The latex a coin takes off, as a scatter of crumbs on the card.
 *
 * The card is seen from above, so a crumb does not fall down the screen: it is
 * flicked off the coin's leading edge, hops, skids to a stop and lies where it
 * stopped, the way the shavings off a real card pile up on it. A coin or a
 * finger dragged through them pushes them on, and a quick flick across the card
 * brushes them off. A crumb that comes to rest off the card has fallen on the
 * table, and it fades rather than piling up round the demo.
 *
 * Everything is in stage pixels. Pure apart from the context it paints on.
 */

interface Crumb {
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** height off the card, for the hop */
  z: number;
  vz: number;
  rot: number;
  vr: number;
  size: number;
  shape: number;
  tone: number;
  /** when it starts to fade, in seconds, or Infinity while it stays */
  fadeAt: number;
  fadeFor: number;
}

/** the card, which a crumb lies on, and off which it falls to the table */
export interface Bounds {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** the top of a shaving, its middle and its torn underside */
const TONES = ["#e2e4e7", "#babec4", "#8e939a"];
/** enough to pile up, few enough that a frame of them stays cheap */
const MAX = 1400;
const GRAVITY = 2000;
const STAYS = Number.POSITIVE_INFINITY;

/** irregular polygons on a unit circle, so no two shavings are a dot */
const SHAPES: number[][] = Array.from({ length: 8 }, () => {
  const n = 3 + Math.floor(Math.random() * 3);
  const pts: number[] = [];
  for (let i = 0; i < n; i++) {
    const t = (i / n) * Math.PI * 2 + (Math.random() - 0.5) * 0.9;
    const r = 0.55 + Math.random() * 0.6;
    pts.push(Math.cos(t) * r, Math.sin(t) * r);
  }
  return pts;
});

export interface Dust {
  crumbs: Crumb[];
  bounds: Bounds | null;
}

export function createDust(): Dust {
  return { crumbs: [], bounds: null };
}

function add(dust: Dust, c: Crumb, now: number) {
  dust.crumbs.push(c);
  // past the cap the oldest go, quietly, rather than the newest never coming
  const over = dust.crumbs.length - MAX;
  for (let i = 0; i < over; i++) {
    const old = dust.crumbs[i];
    if (old.fadeAt === STAYS) {
      old.fadeAt = now;
      old.fadeFor = 0.4;
    }
  }
}

function crumb(
  x: number,
  y: number,
  vx: number,
  vy: number,
  vz: number,
  size: number,
): Crumb {
  return {
    x,
    y,
    vx,
    vy,
    z: 0,
    vz,
    rot: Math.random() * Math.PI * 2,
    vr: (Math.random() - 0.5) * 20,
    size,
    shape: Math.floor(Math.random() * SHAPES.length),
    tone: Math.random() < 0.55 ? 0 : Math.random() < 0.7 ? 1 : 2,
    fadeAt: STAYS,
    fadeFor: 0.6,
  };
}

/**
 * Shavings off a stroke, flicked forward off the coin's edge. `dx` and `dy` are
 * the stroke's direction and `speed` its pace in stage pixels a second.
 */
export function shave(
  dust: Dust,
  x: number,
  y: number,
  dx: number,
  dy: number,
  speed: number,
  now: number,
) {
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  const fling = Math.min(520, 60 + speed * 0.45);
  const spread = (Math.random() - 0.5) * 1.6;
  const k = 0.35 + Math.random() * 0.75;
  add(
    dust,
    crumb(
      x + ux * 6 + (Math.random() - 0.5) * 8,
      y + uy * 6 + (Math.random() - 0.5) * 8,
      (ux - uy * spread) * fling * k,
      (uy + ux * spread) * fling * k,
      40 + Math.random() * 120,
      0.6 + Math.random() ** 2 * 1.7,
    ),
    now,
  );
}

/**
 * A flake of the last coating coming away, bigger than a shaving and thrown
 * outward from where the coin stopped. It lands on the card and stays there
 * with the rest, until a hand brushes it off.
 */
export function flake(
  dust: Dust,
  x: number,
  y: number,
  fromX: number,
  fromY: number,
  now: number,
) {
  const dx = x - fromX;
  const dy = y - fromY;
  const len = Math.hypot(dx, dy) || 1;
  const v = 60 + Math.random() * 180;
  add(
    dust,
    crumb(
      x,
      y,
      (dx / len) * v + (Math.random() - 0.5) * 60,
      (dy / len) * v + (Math.random() - 0.5) * 60,
      90 + Math.random() * 160,
      1.4 + Math.random() * 2.4,
    ),
    now,
  );
}

/**
 * A coin or a finger dragged through crumbs pushes them on: anything within
 * `reach` of the stroke from `(x0, y0)` to `(x1, y1)` takes some of its speed.
 * A slow hand nudges them and a flick throws them off the card.
 */
export function push(
  dust: Dust,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  reach: number,
  speed: number,
): boolean {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return false;
  const len = Math.sqrt(len2);
  const ux = dx / len;
  const uy = dy / len;
  const shove = Math.min(900, speed * 0.7);
  let moved = false;
  for (const c of dust.crumbs) {
    const t = Math.max(
      0,
      Math.min(1, ((c.x - x0) * dx + (c.y - y0) * dy) / len2),
    );
    const ex = c.x - (x0 + dx * t);
    const ey = c.y - (y0 + dy * t);
    if (ex * ex + ey * ey > reach * reach) continue;
    // ahead of the hand and out to the side it is being swept toward
    const side = Math.sign(ex * -uy + ey * ux) || 1;
    const k = 0.7 + Math.random() * 0.5;
    c.vx = (ux * shove + -uy * side * shove * 0.3) * k;
    c.vy = (uy * shove + ux * side * shove * 0.3) * k;
    c.vz = Math.max(c.vz, 30 + Math.random() * 50 + shove * 0.15);
    c.vr += (Math.random() - 0.5) * 16;
    moved = true;
  }
  return moved;
}

/** put the card away, and its crumbs with it */
export function sweep(dust: Dust, now: number) {
  for (const c of dust.crumbs) {
    c.fadeAt = Math.min(c.fadeAt, now);
    c.fadeFor = 0.3;
  }
}

function onCard(b: Bounds | null, c: Crumb): boolean {
  if (!b) return true;
  return c.x >= b.x && c.x <= b.x + b.w && c.y >= b.y && c.y <= b.y + b.h;
}

/** one step of the crumbs. Returns whether anything is still moving or fading. */
export function step(dust: Dust, dt: number, now: number): boolean {
  let busy = false;
  const keep: Crumb[] = [];
  for (const c of dust.crumbs) {
    if (c.z > 0 || c.vz > 0) {
      c.vz -= GRAVITY * dt;
      c.z += c.vz * dt;
      if (c.z <= 0) {
        c.z = 0;
        // one small bounce and it is down
        c.vz = c.vz < -90 ? -c.vz * 0.25 : 0;
        c.vx *= 0.7;
        c.vy *= 0.7;
      }
    }
    // a crumb in the air keeps its speed, one on the card skids to a stop
    const drag = Math.exp(-(c.z > 0 ? 1.2 : 9) * dt);
    c.vx *= drag;
    c.vy *= drag;
    c.vr *= c.z > 0 ? 1 : Math.exp(-8 * dt);
    c.x += c.vx * dt;
    c.y += c.vy * dt;
    c.rot += c.vr * dt;
    if (Math.hypot(c.vx, c.vy) < 2 && c.z === 0) {
      c.vx = 0;
      c.vy = 0;
      c.vr = 0;
      // at rest on the table rather than the card: it has fallen off
      if (c.fadeAt === STAYS && !onCard(dust.bounds, c)) {
        c.fadeAt = now + 0.5;
        c.fadeFor = 0.7;
      }
    } else busy = true;

    if (c.fadeAt !== STAYS) {
      if (now >= c.fadeAt + c.fadeFor) continue;
      busy = true;
    }
    keep.push(c);
  }
  dust.crumbs = keep;
  return busy;
}

/**
 * Paint every crumb: a soft shadow under each, then the shavings themselves,
 * batched by tone and by four steps of fade so a frame is a handful of fills
 * however many crumbs there are.
 */
export function paintDust(
  ctx: CanvasRenderingContext2D,
  dust: Dust,
  now: number,
) {
  const buckets = new Map<number, Crumb[]>();
  for (const c of dust.crumbs) {
    const f = now >= c.fadeAt ? 1 - (now - c.fadeAt) / c.fadeFor : 1;
    const level = Math.max(0, Math.min(4, Math.ceil(f * 4)));
    if (level === 0) continue;
    const list = buckets.get(level);
    if (list) list.push(c);
    else buckets.set(level, [c]);
  }

  const trace = (c: Crumb, ox: number, oy: number, grow: number) => {
    const pts = SHAPES[c.shape];
    const s = c.size * grow;
    const cos = Math.cos(c.rot) * s;
    const sin = Math.sin(c.rot) * s;
    for (let i = 0; i < pts.length; i += 2) {
      const px = c.x + ox + pts[i] * cos - pts[i + 1] * sin;
      const py = c.y + oy + pts[i] * sin + pts[i + 1] * cos;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
  };

  for (const [level, list] of buckets) {
    ctx.globalAlpha = level / 4;
    // the shadow drops further from a crumb that is up off the card
    ctx.fillStyle = "rgba(20,24,30,0.22)";
    ctx.beginPath();
    for (const c of list) trace(c, 0.5 + c.z * 0.25, 0.9 + c.z * 0.35, 1);
    ctx.fill();
    for (let tone = 0; tone < TONES.length; tone++) {
      ctx.fillStyle = TONES[tone];
      ctx.beginPath();
      for (const c of list) {
        if (c.tone === tone) trace(c, 0, -c.z * 0.15, 1 + c.z * 0.012);
      }
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
}
