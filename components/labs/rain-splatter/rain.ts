import { clamp01, lerp } from "@/lib/lerp";

/**
 * The world behind `rain-splatter`: drops, the floor under them, and every mark
 * a landing leaves.
 *
 * No React and no canvas setup. The component owns the two contexts, the frame
 * loop and the settings, and calls `step` once a frame with the time since the
 * last one. Everything below is arithmetic and `fill`, which is what keeps the
 * physics readable next to a file that is otherwise all `useEffect`.
 *
 * ── the two surfaces ─────────────────────────────────────────────────────────
 *
 * **The stage is two canvases and the split is the whole design.** `live` is
 * cleared every frame and holds what is moving: the drops in the air, the
 * specks flying off an impact, the ring a landing throws out. `paint` is never
 * cleared and holds what has already landed. A mark is drawn onto it exactly
 * once, at the moment it is made, and then it costs nothing for the rest of the
 * demo.
 *
 * That is why the piece can accumulate a poster's worth of splatter and still
 * run at one clear and a few hundred small fills a frame. Redrawing the
 * accumulation every frame is the version that gets slower the longer you watch
 * it, and it is also the version that cannot be right: two overlapping opaque
 * marks have an order, and the order is when they landed.
 *
 * ── the floor ────────────────────────────────────────────────────────────────
 *
 * **The floor is a plane in perspective, not the bottom edge.** Every drop
 * picks a depth on arrival, and the depth sets three things at once: the y it
 * lands on, between the horizon and a little past the bottom edge, how big it
 * is, and how hard its own gravity pulls. So a far drop is small, slow and lands
 * high, a near one is fat, quick and lands low or off the bottom of the stage.
 *
 * Splatter is laid on that same plane, which is what `fore` is for: a speck's
 * ground velocity is foreshortened on the y axis before it is drawn, so a
 * splash that is a circle on the floor paints as an ellipse on screen, and more
 * of one the further back it is. Without it every splash reads as a sticker on
 * a wall.
 */

const TAU = Math.PI * 2;

/** the stage's own shape */
export const STAGE_ASPECT = 1.25;

/*
 * The floor, as fractions of the stage height. `NEAR` is past the bottom edge
 * on purpose: the closest splats then run off the frame the way the reference's
 * do, which is most of what says the plane continues past the picture.
 */
const HORIZON = 0.12;
const NEAR = 1.06;
const FAR_SCALE = 0.4;
const NEAR_SCALE = 1.18;

/** a drop's own radius, before depth and the `size` control */
const DROP_MIN = 2.4;
const DROP_SPAN = 2.1;

/** the splash body, in drop radii */
const CORE = 3.2;

/**
 * The reticle, in bodies.
 *
 * It traces the body plus the crowd of specks that lands around it, which is
 * what a press actually covers, rather than the body alone. At 1.0 the ring is
 * a 7px speck at the foot of the stage and a 4px one at the horizon: correct,
 * and too small to aim with or to notice.
 */
const RETICLE_SPAN = 2;

/** px/s² at the near edge of the floor, before the `fall` control scales it */
const FALL = 900;

/*
 * The fall's motion blur, in px of stretch per px/s of speed.
 *
 * A drop at full pelt covers around 20px between two frames at 60Hz, so a round
 * one paints as a dotted line up the stage however smooth the arithmetic under
 * it is. Stretching it along its own travel is the same trick a camera does by
 * accident, and it is also just what a falling drop looks like: the vertical
 * slivers at the top of the reference are drops that have not landed yet.
 *
 * The cap is in radii, so a small drop cannot stretch into a hair.
 */
const SMEAR = 0.018;
const SMEAR_CAP = 11;

/** px/s² pulling a speck back down to the floor it came off */
const HOP = 2100;

/** friction on a speck's travel across the floor, per second, exponential */
const DRAG = 3.2;

/*
 * A landing speck marks the last of its own flight rather than a point, and
 * only if it was still going.
 *
 * The long thin rays in the reference are droplets that came in shallow and
 * fast and skidded. Everything else in a splash lands as a dot, and there are
 * far more of those than there are rays. So the mark is a length only past a
 * floor speed, and the length is what is left over: nothing at all under
 * `SKID_MIN`, and up to `SKID_CAP` for the few thrown hardest.
 *
 * **Taking the length off the distance flown instead is what a first build
 * does, and it turns every splash into a sea urchin.** Drag is gentle here, so
 * almost every speck covers enough ground to earn a ray that way, and a stage
 * of nothing but rays has no bodies in it at all.
 */
const SKID_MIN = 240;
const SKID = 0.15;
const SKID_CAP = 62;

/** ground speed a speck needs to bounce and leave a second, smaller mark */
const BOUNCE = 150;

/*
 * The share of a splash's specks thrown in someone else's ink, and the one
 * thing on the stage that is not physical.
 *
 * A splash carries the colour of the drop that made it. Every cluster in the
 * reference is many colours, because it is many splats layered over hours, and
 * at any rate a demo can run at that layering never happens. So the stack is
 * faked per splash instead: one ink dominates and a sixth of the specks are
 * borrowed.
 */
const STRAY = 0.16;

/** ceiling on live specks, so a wide-open panel cannot walk into a stall */
const MAX_FLECKS = 1600;

/**
 * The inks, and how often each is loaded.
 *
 * **Colour is the subject here rather than a tint on it**, the same claim
 * `stamp-collection` makes for a printed stamp and `window-shade` for daylight,
 * so these six values sit beside the simulation and are not tokens. Nothing
 * outside this experiment may reach for them.
 *
 * The weights are what keep it looking like the reference rather than like a
 * palette swatch. Rose, blue and black carry it, yellow and orange are the
 * accents, and the coral is rare enough to read as a one-off.
 */
const INKS: readonly { hex: string; weight: number }[] = [
  { hex: "#e8336d", weight: 1 },
  { hex: "#4a76be", weight: 1 },
  { hex: "#141414", weight: 0.62 },
  { hex: "#f3c449", weight: 0.85 },
  { hex: "#f4703f", weight: 0.7 },
  { hex: "#f79070", weight: 0.35 },
];

const INK_WEIGHT = INKS.reduce((sum, ink) => sum + ink.weight, 0);

/*
 * The reticle is the one thing drawn on the stage that is not ink, so it is not
 * one of the inks. It is `text-primary` at low alpha, the site's own text tone,
 * written out because a canvas cannot take a token. Low enough to sit under the
 * painting and read as chrome rather than as a mark someone made.
 */
const RETICLE = "rgba(26, 26, 26, 0.26)";
const RETICLE_PIN = "rgba(26, 26, 26, 0.4)";

function pickInk(): string {
  let roll = Math.random() * INK_WEIGHT;
  for (const ink of INKS) {
    roll -= ink.weight;
    if (roll <= 0) return ink.hex;
  }
  return "#141414";
}

/** everything the panel drives, all of it live: nothing here waits for a respawn */
export interface Settings {
  /** drops per second */
  rate: number;
  /** multiplier on gravity, so it moves the fall and the stretch together */
  fall: number;
  /** multiplier on drop radius */
  size: number;
  /** multiplier on how hard a landing throws its specks */
  splash: number;
  /** specks a splash throws, before the depth scales it */
  spray: number;
  /** how fast laid paint sinks back into the paper, 0 keeps it */
  fade: number;
}

export const DEFAULTS: Settings = {
  rate: 1.4,
  fall: 1,
  size: 1,
  splash: 1,
  spray: 60,
  fade: 0.25,
};

interface Drop {
  x: number;
  /** the drop's leading edge, not its centre, see `drawDrop` */
  y: number;
  vy: number;
  /** px/s², already scaled by depth and not by the control */
  g: number;
  r: number;
  floor: number;
  scale: number;
  fore: number;
  ink: string;
  /** leaves a permanent outline round its splash */
  ring: boolean;
}

interface Fleck {
  /** where it is on the floor */
  gx: number;
  gy: number;
  vx: number;
  vy: number;
  /** height above the floor, and its rate. Drawn at `gy - h` */
  h: number;
  vh: number;
  r: number;
  fore: number;
  ink: string;
  bounced: boolean;
}

interface Corona {
  x: number;
  y: number;
  r0: number;
  r1: number;
  fore: number;
  t: number;
  life: number;
  ink: string;
}

/**
 * Where a press would land, and whether to draw it.
 *
 * It is chrome rather than ink: it lives on the live layer, it never touches
 * the paint, and it is the same object whether a pointer or the arrow keys are
 * moving it. That is the point of keeping it here rather than in React. One
 * reticle, two ways to drive it, and the keyboard gets the gesture the pointer
 * has instead of an approximation of it.
 */
export interface Aim {
  x: number;
  y: number;
  live: boolean;
}

export interface World {
  w: number;
  h: number;
  drops: Drop[];
  flecks: Fleck[];
  coronas: Corona[];
  aim: Aim;
  /** fractional drops the rate has earned but not yet spent */
  due: number;
  /** and the same for the fade, see `sink` */
  owed: number;
}

export function createWorld(): World {
  return {
    w: 0,
    h: 0,
    drops: [],
    flecks: [],
    coronas: [],
    aim: { x: 0, y: 0, live: false },
    due: 0,
    owed: 0,
  };
}

/**
 * Take the stage's new size, carrying everything in flight across with it.
 *
 * The paint layer is rescaled by the component, since that is a bitmap copy
 * rather than arithmetic. This is the other half: positions are absolute px, so
 * without it a resize leaves every drop aiming at a floor that has moved.
 */
export function resizeWorld(world: World, w: number, h: number): void {
  const kx = world.w > 0 ? w / world.w : 1;
  const ky = world.h > 0 ? h / world.h : 1;
  world.w = w;
  world.h = h;
  if (kx === 1 && ky === 1) return;

  for (const drop of world.drops) {
    drop.x *= kx;
    drop.y *= ky;
    drop.floor *= ky;
  }
  for (const fleck of world.flecks) {
    fleck.gx *= kx;
    fleck.gy *= ky;
  }
  for (const corona of world.coronas) {
    corona.x *= kx;
    corona.y *= ky;
  }

  world.aim.x *= kx;
  world.aim.y *= ky;
}

/** Point the reticle at a place on the stage, in stage pixels. */
export function setAim(world: World, x: number, y: number): void {
  world.aim.x = x < 0 ? 0 : x > world.w ? world.w : x;
  world.aim.y = y < 0 ? 0 : y > world.h ? world.h : y;
  world.aim.live = true;
}

export function hideAim(world: World): void {
  world.aim.live = false;
}

/**
 * Move the reticle by a step, for the arrow keys.
 *
 * **The first press places it and does not move it.** A reader who has just
 * tabbed to the stage has no idea where the aim is, so the first key has to
 * answer that before any key can change it. It lands in the near half, where the
 * splash is big enough to see what the gesture does.
 */
export function nudgeAim(world: World, dx: number, dy: number): void {
  if (!world.aim.live) {
    setAim(world, world.w / 2, world.h * 0.62);
    return;
  }
  setAim(world, world.aim.x + dx, world.aim.y + dy);
}

export function clearWorld(world: World): void {
  world.drops.length = 0;
  world.flecks.length = 0;
  world.coronas.length = 0;
}

export function population(world: World): { drops: number; flecks: number } {
  return { drops: world.drops.length, flecks: world.flecks.length };
}

/** the depth a point on the stage sits at, which is what a pointer is choosing */
function depthAt(world: World, y: number): number {
  const far = world.h * HORIZON;
  const near = world.h * NEAR;
  return clamp01((y - far) / (near - far));
}

/**
 * What a depth means, in one place.
 *
 * A drop reads it on arrival and the reticle reads it under the pointer, and
 * the two have to agree or the ring is a promise the splash does not keep.
 */
function profile(depth: number): { scale: number; fore: number } {
  return {
    scale: lerp(FAR_SCALE, NEAR_SCALE, depth),
    /* a splash near the horizon is seen edge on, one at your feet nearly flat */
    fore: lerp(0.48, 0.86, depth),
  };
}

function newDrop(world: World, s: Settings, x: number, depth: number): Drop {
  const { scale, fore } = profile(depth);
  const r = (DROP_MIN + Math.random() * DROP_SPAN) * scale * s.size;

  return {
    x,
    y: -r * 4,
    /*
     * It arrives already moving, since it has been falling for as long as it
     * took to reach the top of the frame. Starting one at rest paints a round
     * bead for the first fifth of its travel, which is a bubble rising rather
     * than a drop landing.
     */
    vy: 200 * scale,
    g: FALL * lerp(0.45, 1.15, depth),
    r,
    floor: lerp(world.h * HORIZON, world.h * NEAR, depth),
    scale,
    fore,
    ink: pickInk(),
    /*
     * Every reference splat does not get an outline and the ones that do are
     * the big ones. It is the crown a heavy drop throws standing up and falling
     * back on itself, so it is a depth-gated dice roll rather than a decoration
     * on all of them.
     */
    ring: Math.random() < 0.16 && scale > 0.72,
  };
}

/**
 * Aim a drop at a point, for the pointer.
 *
 * The point is where it lands rather than where it starts, so the depth comes
 * off the y and the drop still falls the whole height of the stage to get
 * there. Pointing at the horizon and pointing at your feet are two different
 * sizes of splash, which is the whole reason the floor is a plane.
 */
export function dropAt(world: World, s: Settings, x: number, y: number): void {
  if (world.h <= 0) return;
  world.drops.push(newDrop(world, s, x, Math.max(depthAt(world, y), 0.02)));
}

/* ── marks ──────────────────────────────────────────────────────────────────
 *
 * Everything below writes to the paint layer, once, and is never touched again.
 */

function stampCore(paint: CanvasRenderingContext2D, d: Drop): void {
  const r = d.r * CORE;

  /*
   * One path and one fill, not a fill per lobe. A blob is a splash's body and
   * two or three satellites off it, and drawing them as separate opaque circles
   * is the same picture with three times the calls.
   *
   * `moveTo` before every `arc`, or each one is joined to the last by a line
   * that the winding rule then has an opinion about.
   */
  paint.fillStyle = d.ink;
  paint.beginPath();
  paint.moveTo(d.x + r, d.floor);
  paint.ellipse(d.x, d.floor, r, r * d.fore, 0, 0, TAU);

  const lobes = 2 + Math.floor(Math.random() * 4);
  for (let i = 0; i < lobes; i++) {
    const angle = Math.random() * TAU;
    const away = r * (0.55 + Math.random() * 0.9);
    const lobe = r * (0.16 + Math.random() * 0.36);
    const x = d.x + Math.cos(angle) * away;
    const y = d.floor + Math.sin(angle) * away * d.fore;
    paint.moveTo(x + lobe, y);
    paint.ellipse(x, y, lobe, lobe * d.fore, 0, 0, TAU);
  }
  paint.fill();
}

function stampRing(paint: CanvasRenderingContext2D, d: Drop): void {
  const r = d.r * (3.6 + Math.random() * 2.2);
  paint.strokeStyle = d.ink;
  paint.lineWidth = Math.max(0.9, d.r * 0.34);
  paint.beginPath();
  paint.ellipse(d.x, d.floor, r, r * d.fore, 0, 0, TAU);
  paint.stroke();
}

function stampFleck(paint: CanvasRenderingContext2D, f: Fleck): void {
  const speed = Math.hypot(f.vx, f.vy * f.fore);
  const skid = Math.min(Math.max(speed - SKID_MIN, 0) * SKID, SKID_CAP);

  /* a speck that arrived steeply, or barely moved, has no length to give */
  if (skid < f.r * 2.2) {
    paint.fillStyle = f.ink;
    paint.beginPath();
    paint.ellipse(f.gx, f.gy, f.r, f.r * lerp(1, f.fore, 0.5), 0, 0, TAU);
    paint.fill();
    return;
  }

  /*
   * The mark runs back up its own approach and ends on the landing point, so a
   * ray points at the splash it came from rather than straddling where it
   * stopped. Round caps, since a droplet has no corners.
   */
  const ux = f.vx / speed;
  const uy = (f.vy * f.fore) / speed;
  paint.strokeStyle = f.ink;
  paint.lineWidth = Math.max(0.8, f.r * 2);
  paint.lineCap = "round";
  paint.beginPath();
  paint.moveTo(f.gx - ux * skid, f.gy - uy * skid);
  paint.lineTo(f.gx, f.gy);
  paint.stroke();
}

/* ── the frame ────────────────────────────────────────────────────────────── */

/**
 * Sink the laid paint back into the paper, in visible steps.
 *
 * `destination-out` rather than a wash of the ground colour: the paint layer
 * stays transparent, so the marks fade toward whatever the stage is painted
 * rather than toward a hardcoded copy of it.
 *
 * **The steps are the point.** A canvas holds 8 bits a channel, so an erase at
 * an alpha under about 1/255 rounds to nothing and the oldest splatter simply
 * never leaves. Owing the fade and spending it in whole 3% steps costs one
 * `fillRect` every few frames and cannot round away, and at these rates the
 * step is far too small to see arrive.
 */
const SINK_STEP = 0.03;
const SINK_RATE = 0.25;

function sink(
  world: World,
  paint: CanvasRenderingContext2D,
  fade: number,
  dt: number,
): void {
  if (fade <= 0) return;

  /*
   * Squared, so the low half of the slider is a long fade rather than a dead
   * zone. At the top a mark is gone in about four seconds, at the middle in
   * around sixteen, and at a quarter it outlives anyone watching.
   */
  world.owed += fade * fade * SINK_RATE * dt;
  if (world.owed < SINK_STEP) return;
  world.owed -= SINK_STEP;

  paint.globalCompositeOperation = "destination-out";
  paint.fillStyle = `rgba(0, 0, 0, ${SINK_STEP})`;
  paint.fillRect(0, 0, world.w, world.h);
  paint.globalCompositeOperation = "source-over";
}

function rain(world: World, s: Settings, dt: number): void {
  world.due += s.rate * dt;
  while (world.due >= 1) {
    world.due -= 1;
    /* a little off each edge, so splats clip on the sides as well as the foot */
    const x = (Math.random() * 1.1 - 0.05) * world.w;
    world.drops.push(newDrop(world, s, x, Math.random()));
  }
}

function burst(
  world: World,
  s: Settings,
  d: Drop,
  paint: CanvasRenderingContext2D,
  crown = true,
): void {
  stampCore(paint, d);
  if (d.ring) stampRing(paint, d);

  if (crown)
    world.coronas.push({
      x: d.x,
      y: d.floor,
      r0: d.r * 1.5,
      r1: d.r * 7,
      fore: d.fore,
      t: 0,
      life: 0.36,
      ink: d.ink,
    });

  /*
   * Where this splash throws its rays.
   *
   * A crown does not break evenly. It tears at a handful of points and the
   * fast droplets leave along those, which is why the reference's rays come in
   * fans of three and four off one side of a blob rather than as a ring of
   * spokes. Uniform angles are the version that reads as a firework.
   *
   * Only the fast specks are aimed. The crowd close in stays uniform, since
   * that is the body of the splash rather than the tear.
   */
  const jets = 3 + Math.floor(Math.random() * 4);
  const jetAt: number[] = [];
  for (let j = 0; j < jets; j++) jetAt.push(Math.random() * TAU);

  const count = Math.round(s.spray * lerp(0.55, 1.2, d.scale));
  for (let i = 0; i < count && world.flecks.length < MAX_FLECKS; i++) {
    /*
     * `t` is one droplet's share of the splash's energy, and the curve on it is
     * what makes a splash read as a splash. Uniform speeds give a ring of
     * identical specks. Cubed puts most of the droplets in the crowd around the
     * body, a few at mid range and the odd one thrown clear across the floor,
     * which is the distribution the reference has.
     */
    const t = Math.random();
    const speed = (40 + t ** 1.5 * 1150) * s.splash * lerp(0.6, 1.1, d.scale);

    const angle =
      t > 0.72
        ? (jetAt[i % jets] ?? 0) + (Math.random() - 0.5) * 0.9
        : Math.random() * TAU;

    world.flecks.push({
      gx: d.x,
      gy: d.floor,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      h: 0.01,
      /*
       * How high it is thrown, and **the spread on this is what fills a splash
       * in.** Height is airtime, airtime is how far the drag has to work, and
       * the landing speed is what decides between a ray and a dot. So one throw
       * sent flat comes down fast and near and skids, and the same throw sent
       * high comes down slow and far and beads.
       *
       * **Most of a splash goes up and only a few go flat**, which is what the
       * squared roll is doing: it sits near zero most of the time, so the
       * bracket sits near its top and the throw is high. Around one speck in
       * seven comes out flat enough to still be moving when it arrives, and
       * those are the rays. Roll it the other way and every splash is a
       * dandelion, which is the same picture with none of the beads in it.
       *
       * The floor is a constant rather than a share of the speed, so a hard
       * flat throw lands close: those are the rays that start at the body
       * instead of hanging in the air past it.
       */
      vh: Math.min(30 + speed * (0.5 - 0.45 * Math.random() ** 2), 460),
      /*
       * Size is mostly its own roll rather than a reading of the speed.
       *
       * A splash does throw its finest droplets hardest, which is the `t` term,
       * but coupling the two tightly sorts a splash into a big ring and a small
       * one. The squared roll over the top is what puts a 4px bead and a
       * hairline speck next to each other at the same radius, which is what the
       * reference has everywhere.
       */
      r: Math.max(
        0.4,
        d.r * lerp(0.55, 0.2, t) * (0.3 + Math.random() ** 2 * 1.6),
      ),
      fore: d.fore,
      ink: Math.random() < STRAY ? pickInk() : d.ink,
      bounced: false,
    });
  }
}

/**
 * A drop, drawn from its leading edge.
 *
 * `y` is the tip rather than the centre, so the ellipse grows backwards up the
 * stage as the smear does. The tip meets the floor at the frame the splash
 * fires, which is the only arrangement where a stretched drop does not either
 * punch through the floor or splash a body-length above it.
 *
 * It narrows as it stretches, by a little. A drop pulled thin is thin, and the
 * two together are what stop the fastest ones reading as bars.
 */
function drawDrop(ctx: CanvasRenderingContext2D, d: Drop): void {
  const smear = Math.min(d.vy * SMEAR, d.r * SMEAR_CAP);
  const ry = d.r + smear;
  const rx = d.r * lerp(1, 0.66, clamp01(d.vy / 1100));

  ctx.fillStyle = d.ink;
  ctx.beginPath();
  ctx.ellipse(d.x, d.y - ry, rx, ry, 0, 0, TAU);
  ctx.fill();
}

/**
 * A speck in the air, drawn as the ground it is about to cover.
 *
 * Same mark it will leave when it lands, and for the same reason: at these
 * speeds a dot is a dotted line. The tail follows its screen velocity, which is
 * its travel across the floor foreshortened plus whatever the hop is doing, so
 * a speck at the top of its arc is a dot and one coming down fast is a streak.
 */
function drawFleck(ctx: CanvasRenderingContext2D, f: Fleck): void {
  const sx = f.vx;
  const sy = f.vy * f.fore - f.vh;
  const speed = Math.hypot(sx, sy);
  const y = f.gy - f.h;

  ctx.strokeStyle = f.ink;
  ctx.lineWidth = Math.max(0.8, f.r * 2);
  ctx.lineCap = "round";
  ctx.beginPath();
  if (speed < 1) {
    ctx.moveTo(f.gx, y);
  } else {
    const tail = Math.min(speed * 0.016, 14);
    ctx.moveTo(f.gx - (sx / speed) * tail, y - (sy / speed) * tail);
  }
  ctx.lineTo(f.gx, y);
  ctx.stroke();
}

/** One speck's step. Returns false on the frame it comes back to the floor. */
function moveFleck(f: Fleck, dt: number, decay: number): boolean {
  f.vx *= decay;
  f.vy *= decay;
  f.gx += f.vx * dt;
  f.gy += f.vy * f.fore * dt;
  f.vh -= HOP * dt;
  f.h += f.vh * dt;

  if (f.h > 0) return true;
  f.h = 0;
  return false;
}

/**
 * One bounce, and only for a speck that landed still carrying something.
 *
 * It is what leaves the little outriders past the end of a ray in the
 * reference, and capping it at one is what stops a splash rattling its way
 * across the floor. Returns whether the speck is still in play.
 */
function rebound(f: Fleck): boolean {
  const speed = Math.hypot(f.vx, f.vy);
  if (f.bounced || speed < BOUNCE) return false;

  f.bounced = true;
  f.vx *= 0.42;
  f.vy *= 0.42;
  f.vh = 50 + speed * 0.1;
  f.r = Math.max(0.4, f.r * 0.55);
  f.h = 0.01;
  return true;
}

/**
 * One frame: sink, rain, then advance and draw everything in flight.
 *
 * Backwards through each list, because a landing removes its own entry and
 * `splice` under a forward index skips the next one. The clear is here rather
 * than in the component so a paused stage keeps its last frame on screen: what
 * is in the air is part of the picture, and blanking it on pause reads as a
 * different demo.
 */
export function step(
  world: World,
  dt: number,
  s: Settings,
  live: CanvasRenderingContext2D,
  paint: CanvasRenderingContext2D,
): void {
  sink(world, paint, s.fade, dt);
  rain(world, s, dt);

  live.clearRect(0, 0, world.w, world.h);

  for (let i = world.drops.length - 1; i >= 0; i--) {
    const d = world.drops[i];
    if (!d) continue;
    d.vy += d.g * s.fall * dt;
    d.y += d.vy * dt;

    if (d.y >= d.floor) {
      burst(world, s, d, paint);
      world.drops.splice(i, 1);
      continue;
    }
    drawDrop(live, d);
  }

  const decay = Math.exp(-DRAG * dt);
  for (let i = world.flecks.length - 1; i >= 0; i--) {
    const f = world.flecks[i];
    if (!f) continue;

    if (moveFleck(f, dt, decay)) {
      drawFleck(live, f);
      continue;
    }

    stampFleck(paint, f);
    if (!rebound(f)) world.flecks.splice(i, 1);
  }

  for (let i = world.coronas.length - 1; i >= 0; i--) {
    const c = world.coronas[i];
    if (!c) continue;
    c.t += dt;
    if (c.t >= c.life) {
      world.coronas.splice(i, 1);
      continue;
    }

    /*
     * The crown a landing throws, on the live layer alone: it is the moment of
     * the impact rather than a mark, so it never touches the paint. Out fast and
     * gone, on the gap between where it is and where it ends, which is the same
     * ease-out every lerp on this site runs.
     */
    const p = c.t / c.life;
    const r = lerp(c.r0, c.r1, 1 - (1 - p) ** 2);
    live.globalAlpha = (1 - p) ** 1.6 * 0.5;
    live.strokeStyle = c.ink;
    live.lineWidth = lerp(1.7, 0.5, p);
    live.beginPath();
    live.ellipse(c.x, c.y, r, r * c.fore, 0, 0, TAU);
    live.stroke();
    live.globalAlpha = 1;
  }

  drawAim(live, world, s);
}

/**
 * The reticle: where a press lands, and how big the splash will be there.
 *
 * **It is a preview and not a cursor.** A crosshair says the surface answers a
 * pointer and nothing more. This says what the answer will be, which on a stage
 * whose whole subject is that depth changes the size of a splash is the one
 * thing worth showing before the press. Move up the stage and the ring shrinks
 * and flattens, which is the perspective explaining itself.
 *
 * It is the average drop rather than a promise, since a drop's own radius is a
 * roll inside a range. The ring is right to within that roll, and it traces the
 * body with its close spray rather than the body alone. See `RETICLE_SPAN`.
 */
function drawAim(
  ctx: CanvasRenderingContext2D,
  world: World,
  s: Settings,
): void {
  if (!world.aim.live) return;

  const { x, y } = world.aim;
  const { scale, fore } = profile(depthAt(world, y));
  const r = (DROP_MIN + DROP_SPAN / 2) * scale * s.size * CORE * RETICLE_SPAN;

  ctx.strokeStyle = RETICLE;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.ellipse(x, y, r, r * fore, 0, 0, TAU);
  ctx.stroke();

  ctx.fillStyle = RETICLE_PIN;
  ctx.beginPath();
  ctx.ellipse(x, y, 1.2, 1.2, 0, 0, TAU);
  ctx.fill();
}

/**
 * Lay a few finished splats, with no time passing.
 *
 * **One caller: `prefers-reduced-motion`, where nothing is going to fall and
 * this is the whole of the experiment.** Everyone else starts on clean paper
 * and watches it fill, which is the piece. Seeding the normal first frame was
 * the earlier call and it was wrong: it hands the reader an accumulation
 * without the accumulating, so the first thing they see is the one thing they
 * did not watch happen.
 *
 * It is the same simulation rather than a second drawing of one. Each splash is
 * a real drop bursting on its own depth, and the specks are then run out at a
 * fixed step with nothing drawing them, so what lands is what would have landed
 * had you watched it. `crown` is off, since a crown is the moment of an impact
 * and these have already happened.
 */
export function seed(
  world: World,
  s: Settings,
  paint: CanvasRenderingContext2D,
  count: number,
): void {
  if (world.h <= 0) return;

  for (let i = 0; i < count; i++) {
    const x = (Math.random() * 1.1 - 0.05) * world.w;
    burst(world, s, newDrop(world, s, x, Math.random()), paint, false);
  }

  const dt = 1 / 120;
  const decay = Math.exp(-DRAG * dt);
  /* the guard is for the arithmetic, not for the specks: the longest hop any
     splash can throw is under half a second, which is sixty of these */
  for (let guard = 0; guard < 600 && world.flecks.length > 0; guard++) {
    for (let i = world.flecks.length - 1; i >= 0; i--) {
      const f = world.flecks[i];
      if (!f) continue;
      if (moveFleck(f, dt, decay)) continue;
      stampFleck(paint, f);
      if (!rebound(f)) world.flecks.splice(i, 1);
    }
  }
}
