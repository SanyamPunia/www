/*
 * The burst, as bodies rather than as a rail.
 *
 * Pure maths on a 2D context, no React and no DOM beyond the canvas and the
 * sprites it is handed. A press pushes a handful of `Body` records into a list,
 * and every frame integrates them and paints them, which is what makes two
 * presses different from each other: nothing here knows where anything is going
 * to end up, and a press while the last burst is still in the air adds to it
 * rather than replacing it.
 *
 * Both directions of the toggle emit, and they emit different things. Striking
 * throws embers, which rise, cool and go out. Snuffing throws smoke, which
 * spreads, thins and does not glow at all. They are one list and one loop
 * because they almost never share the stage, and two of everything for a state
 * change that alternates is two of everything to keep in step.
 *
 * The first build was a shower of uniform teardrops thrown in one frame at one
 * instant, and it read as a particle system rather than as fire. Six things
 * separate it from one, and each is a property real sparks have that a tweened
 * ring of glyphs does not. A spark is a **streak** rather than a dot. It
 * **sputters** rather than dimming smoothly. A small one **drags** to a stop
 * while a big one carries, and a small one also **burns out sooner**. A strike
 * **sprays over a tenth of a second** rather than emitting at once. And some of
 * them **pop**, throwing fragments of their own. Each is marked below.
 */

const TAU = Math.PI * 2;

export type Kind = "ember" | "smoke";

export interface Body {
  kind: Kind;
  /** stage pixels, measured from the canvas's own top left */
  x: number;
  y: number;
  /** pixels a second */
  vx: number;
  vy: number;
  /**
   * When it is thrown, which is not when the press happened: a strike sprays
   * over `Tuning.spray` rather than emitting every ember on one frame. Until
   * `now` reaches this the body is alive, counted, and nowhere.
   */
  born: number;
  /** how long it has, in milliseconds */
  life: number;
  /** an ember's flame height, or a puff's radius, in pixels */
  size: number;
  /**
   * The unit vector the flame's tip points along, which is the way it came
   * from: hot gas trails behind a spark, so a burst reads as rays pointing back
   * at the thing that threw them.
   *
   * It is carried rather than derived from the velocity each frame because a
   * body under reduced motion has no velocity to derive it from, and because a
   * body that has nearly stopped would otherwise spin on its own rounding.
   */
  ax: number;
  ay: number;
  /** 0 to 1, the sputter's phase and the turbulence's */
  seed: number;
  /** the stage's scale at the moment it was thrown, see `Spawn.scale` */
  k: number;
  /**
   * Its own share of the air resistance, around 1. Drag goes with a spark's
   * area and its momentum with its mass, so a small one stops far sooner than a
   * big one: across this spread the smallest travels about a sixth as far. One
   * constant for all of them is most of what made the first build read as a
   * ring expanding rather than as a shower thinning out.
   *
   * A scale rather than a rate, so `Tuning.drag` multiplies it in `step` and
   * moving that knob changes what is already in the air.
   */
  dragScale: number;
  /**
   * Where in its life it breaks up, as a share of that life, or 0 for never. A
   * spark is a fragment of burning material and some of them come apart on the
   * way. What the break exposes is fresh surface, so the pieces start at full
   * heat rather than carrying the parent's.
   */
  pop: number;
  /**
   * The last `Tuning.trail` of positions, flat, oldest first, as x, y, t triples.
   *
   * A spark covers several pixels between two frames and both the eye and a
   * camera read that as a streak, so what is drawn is a tapering chain of glows
   * through these rather than a shape at a point. It is pruned by age and not
   * by count, so the streak is the same length in pixels at 60Hz and at 120Hz.
   */
  trail: number[];
}

/* ---------------------------------------------------------------- the ember */

/**
 * The launch, in pixels a second. The spread is what turns a ring into a cloud:
 * every ember leaves at the same instant and none of them arrives anywhere at
 * the same time.
 */
const SPEED = { min: 210, max: 700 };

/**
 * Milliseconds, thrown to nothing left. A body takes its share of this from the
 * same roll that sizes it, since a bigger ember is a bigger piece of burning
 * material and lasts longer. Rolled independently it puts long-lived specks and
 * short-lived lumps in one shower, which reads as noise rather than as a spread.
 */
const LIFE = { min: 680, max: 1550 };

/** the flame's height in pixels at launch */
const SIZE = { min: 5, max: 14 };

/**
 * Where an ember leaves from, as a radius off the button's centre. A spark
 * comes off the flame's rim rather than out of the middle of it, and starting
 * them on the centre also stacks every glow on one point for the first frame,
 * which washes the glyph the press is about.
 */
const RIM = 16;

/**
 * Air resistance, as a rate per second: `v *= exp(-drag * dt)`. An exponential
 * rather than a share of the speed per frame, so the reach is the same on a
 * 60Hz display and a 120Hz one. It also sets how far a body gets, since one
 * under drag alone travels `v0 / drag` and no further. `small` is the extra the
 * lightest ember carries, so at the default the reach runs from about 65px for
 * a slow speck to 368px for the biggest and fastest, which is off the stage.
 *
 * `base` is only the reference `Tuning.drag` is quoted against, since what a
 * body stores is its share and the knob is the rate.
 */
const DRAG = { base: 1.9, small: 0.7 };

/** pixels a second squared, the pull every body is under */
const FALL = 340;

/**
 * The six numbers the reader can move, and what each one is for.
 *
 * Every one of them turns off a different one of the six things that separate a
 * spark from a particle, so the panel is not a settings tray: run `spray`,
 * `drag`, `lift`, `pops` and `trail` all down to their floors and what comes
 * back is the build this replaced, an even ring of dots expanding forever at
 * one speed. `pixel-reveal` makes the same argument about its own `drift`
 * reaching zero. Leaving the floor reachable is what makes the difference
 * visible rather than asserted.
 *
 * They are applied in `step` rather than baked into a body at launch, so moving
 * one changes what is already in the air instead of only the next press.
 */
export interface Tuning {
  /** embers a cold strike throws */
  count: number;
  /** air resistance, as a rate per second */
  drag: number;
  /** buoyancy at full heat, in pixels a second squared */
  lift: number;
  /** how long a strike takes to throw the last of what it has, in milliseconds */
  spray: number;
  /** the share of a strike's embers that break up on the way */
  pops: number;
  /** how much of the last stretch of flight a streak covers, in milliseconds */
  trail: number;
}

export const TUNING: Tuning = {
  count: 18,
  drag: 1.9,
  lift: 900,
  spray: 85,
  pops: 0.22,
  trail: 92,
};

export const RANGE = {
  count: { min: 4, max: 48, step: 1 },
  drag: { min: 0, max: 4, step: 0.05 },
  lift: { min: 0, max: 1800, step: 20 },
  spray: { min: 0, max: 260, step: 5 },
  pops: { min: 0, max: 0.6, step: 0.02 },
  trail: { min: 0, max: 200, step: 4 },
} as const;

/** pixels a second squared, the turbulence hot air carries */
const SWIRL = 150;

/** where in a life a break can happen, as a share of it */
const POP_AT = { min: 0.22, max: 0.5 };
/** how many pieces one makes */
const POP_PIECES = { min: 2, max: 3 };

/** the most points one streak holds, which is a full `Tuning.trail` at 168Hz */
const TRAIL_MAX = 34;

/* ---------------------------------------------------------------- the smoke */

const SMOKE_SPEED = { min: 55, max: 130 };
const SMOKE_LIFE = { min: 1100, max: 1800 };
/** a puff's radius at launch, in pixels. It billows to 2.4 times this. */
const SMOKE_SIZE = { min: 13, max: 24 };
const SMOKE_DRAG = 1.3;
/** smoke is lighter than the air it is in, and it does not cool */
const SMOKE_RISE = 130;
/** pixels a second squared, the wander a puff picks up as it rises */
const SMOKE_SWIRL = 46;
/**
 * The lean a puff leaves with, on top of its share of the ring. A snuffed wick
 * does puff outward, and then all of it goes up: a ring of smoke that stayed a
 * ring would be an ember burst drawn in grey, which is the one thing the second
 * emission exists not to be.
 */
const SMOKE_LOFT = 78;

/* ------------------------------------------------------- reduced motion */

/**
 * Under the setting the burst does not travel. It arrives as a ring at this
 * radius and fades where it stands, which is `halftone-ripple`'s call for the
 * same question: the press is what happened, the flight is how it looked.
 */
const STILL_REACH = 96;
const STILL_LIFE = 460;

/* ------------------------------------------------------------ temperature */

/**
 * An ember's colour is its age, and that is the whole argument for building the
 * burst this way rather than fading a ring of glyphs out. A spark leaves the
 * flame near white, runs down through yellow and orange into a deep red and
 * stops being visible against the ground before its alpha has finished, so what
 * the eye reads is cooling rather than a fade.
 *
 * Six stops, lerped in plain RGB. The set is scoped to this experiment, the
 * values are not tokens, and nothing else may paint with them. It is the
 * exception fifteen other labs already take, in its narrowest form: these are
 * not a palette picked for a subject, they are what a temperature looks like.
 */
const RAMP: Array<readonly [number, readonly [number, number, number]]> = [
  [0.0, [92, 19, 13]],
  [0.14, [168, 35, 21]],
  [0.34, [222, 68, 34]],
  [0.56, [247, 142, 45]],
  [0.78, [255, 201, 92]],
  [1.0, [255, 247, 216]],
];

/** the colour of an ember at `heat`, as an `rgb()` triple */
export function tempAt(heat: number): [number, number, number] {
  const h = heat < 0 ? 0 : heat > 1 ? 1 : heat;
  for (let i = 1; i < RAMP.length; i++) {
    const [stop, hi] = RAMP[i];
    if (h > stop && i < RAMP.length - 1) continue;
    const [prev, lo] = RAMP[i - 1];
    const t = stop === prev ? 0 : (h - prev) / (stop - prev);
    return [
      Math.round(lo[0] * (1 - t) + hi[0] * t),
      Math.round(lo[1] * (1 - t) + hi[1] * t),
      Math.round(lo[2] * (1 - t) + hi[2] * t),
    ];
  }
  return [...RAMP[0][1]] as [number, number, number];
}

/**
 * How hot a body still is, from its share of its own life.
 *
 * Slower than linear at the start and faster at the end, so an ember holds its
 * colour for the part of the flight the eye is following and then goes in a
 * hurry, which is what a cooling body does.
 */
function heatAt(p: number): number {
  return (1 - p) ** 0.8;
}

/**
 * What is left of a body, which is not the same question as how hot it is. The
 * ramp already takes a cold ember down to something a dark ground swallows, so
 * this only has to clear the last of it away rather than carry the whole death.
 */
function fadeAt(p: number): number {
  const f = (1 - p) * 2.2;
  return f > 1 ? 1 : f;
}

/**
 * How hard it is burning this instant.
 *
 * A real ember sputters. It tumbles, its fuel is not even, and the light it
 * gives off jitters at a few tens of hertz, which is the difference between a
 * spark and a moving dot. Two sines at frequencies with no common period, so
 * nothing in a shower of them beats in time, offset by the body's own seed so
 * no two agree. It multiplies the light and never the colour, since what varies
 * is how hard it is burning rather than how hot it is.
 */
function sputterAt(t: number, seed: number): number {
  const a = Math.sin(t * 18.7 + seed * 41.3);
  const b = Math.sin(t * 29.3 + seed * 17.9);
  return 0.62 + 0.38 * (0.5 + 0.5 * (0.68 * a + 0.32 * b));
}

/* ---------------------------------------------------------------- spawning */

/**
 * How many embers a strike throws. The floor is one press on its own and the
 * ceiling is the end of a flurry: pressing again while the last burst is still
 * warm feeds it, the way a struck match catches harder the second time.
 */
export const COUNT = { min: 18, max: 34 };

/** a snuff is the same puff whatever the streak, since blowing it out is one act */
export const SMOKE_COUNT = 7;

/**
 * How far off centre a press pushes the burst, in pixels a second. Pressing the
 * left of the button scatters the embers right, because that is where the hand
 * pushed them, and the disc takes its knock the same way.
 */
const BIAS = 210;

export interface Spawn {
  kind: Kind;
  /** the wick's centre, in canvas pixels */
  cx: number;
  cy: number;
  count: number;
  /**
   * The wick's own velocity, in pixels a second. Sparks leave a moving flame
   * carrying it, which is why a waved sparkler streaks behind the hand rather
   * than throwing a ring at every point along the way. Nothing about the launch
   * changes, this is added to it.
   */
  vx: number;
  vy: number;
  /**
   * Half the angle of the cone the sparks leave in, or `undefined` for the full
   * circle a strike throws. A blaze is the flame feeding, and a flame throws
   * upward, so holding the wick emits into a wide cone around north instead of
   * a ring. It is a cone rather than a ring for the same reason smoke takes a
   * free angle: what is emitted continuously has no ring to be part of.
   */
  cone?: number;
  /** a unit vector away from the press point, or zero for a keyboard press */
  bx: number;
  by: number;
  now: number;
  /**
   * The stage's share of the width these numbers were tuned against. Every
   * length and every speed is multiplied by it, so a burst reaches the same
   * fraction of the frame on a phone as on a column. Without it the reach is
   * an absolute number of pixels and a 352px stage gets a burst that is out
   * through the top and the sides before it has cooled at all.
   */
  scale: number;
  still: boolean;
  tuning: Tuning;
}

/** straight up, which is where a flame throws */
const CONE_AT = -Math.PI / 2;

export function spawn(into: Body[], s: Spawn): void {
  const ember = s.kind === "ember";
  const speed = ember ? SPEED : SMOKE_SPEED;
  const life = ember ? LIFE : SMOKE_LIFE;
  const size = ember ? SIZE : SMOKE_SIZE;
  const k = s.scale;

  /*
   * The angles are an even ring with a jitter of most of one gap, so the burst
   * is a ring for about the first two hundred milliseconds and never a wheel of
   * spokes after that. A straight roll instead leaves holes and clumps on the
   * frame everyone actually looks at, which is the first one.
   */
  const gap = TAU / s.count;
  const turn = Math.random() * TAU;

  for (let i = 0; i < s.count; i++) {
    /*
     * Smoke takes a free angle instead. Even spacing is what makes the ember
     * burst read as a burst, and it is what made the first snuff read as one
     * drawn in grey: eleven puffs on one circle stayed eleven puffs. A cloud is
     * the same eleven overlapping, which is what a free angle and a free start
     * radius give.
     */
    const angle =
      s.cone !== undefined
        ? CONE_AT + (Math.random() * 2 - 1) * s.cone
        : ember
          ? turn + i * gap + (Math.random() - 0.5) * gap * 0.7
          : Math.random() * TAU;
    const ax = Math.cos(angle);
    const ay = Math.sin(angle);

    /*
     * Squared, so most of a burst is slow and a few carry. An even roll throws
     * a wheel of equals, which is the thing a ring of tweened copies already
     * does and the thing this exists not to be.
     */
    const roll = Math.random() ** 1.45;
    const v = (speed.min + (speed.max - speed.min) * roll) * k;

    /*
     * Size mostly follows the speed, since the piece with the momentum to carry
     * is the big one, and partly does not, so a shower is not one straight line
     * from small and slow to large and fast. Life and drag both come off it.
     */
    const mass = ember ? roll * 0.6 + Math.random() * 0.4 : Math.random();

    if (s.still) {
      const reach = STILL_REACH * k * (0.72 + roll * 0.5);
      into.push({
        kind: s.kind,
        x: s.cx + ax * reach,
        y: s.cy + ay * reach,
        vx: 0,
        vy: 0,
        born: s.now,
        life: STILL_LIFE,
        size: (size.min + (size.max - size.min) * mass) * k,
        ax: -ax,
        ay: -ay,
        seed: Math.random(),
        k,
        dragScale: 1,
        pop: 0,
        trail: [],
      });
      continue;
    }

    into.push({
      kind: s.kind,
      x: s.cx + ax * (ember ? RIM : Math.random() * 12) * k,
      y: s.cy + ay * (ember ? RIM : Math.random() * 12) * k,
      vx: ax * v + s.bx * BIAS * k + s.vx,
      vy: ay * v + s.by * BIAS * k - (ember ? 0 : SMOKE_LOFT * k) + s.vy,
      /* the fast ones lead and the shower fills in behind them */
      born: s.now + (ember ? (1 - roll) * s.tuning.spray * Math.random() : 0),
      life: life.min + (life.max - life.min) * (ember ? mass : Math.random()),
      size: (size.min + (size.max - size.min) * mass) * k,
      ax: -ax,
      ay: -ay,
      seed: Math.random(),
      k,
      dragScale: ember ? 1 + (1 - mass) * DRAG.small : SMOKE_DRAG / DRAG.base,
      pop:
        ember && Math.random() < s.tuning.pops
          ? POP_AT.min + (POP_AT.max - POP_AT.min) * Math.random()
          : 0,
      trail: [],
    });
  }
}

/**
 * One ember breaking up. The pieces leave along the parent's own travel plus a
 * kick of their own, and they start at full heat rather than inheriting the
 * parent's, since what a break exposes is fresh burning surface. They carry no
 * `pop` of their own, or one ember could fill the stage.
 */
function fragment(into: Body[], b: Body, now: number): void {
  const pieces =
    POP_PIECES.min +
    Math.floor(Math.random() * (POP_PIECES.max - POP_PIECES.min + 1));
  const turn = Math.random() * TAU;

  for (let i = 0; i < pieces; i++) {
    const angle = turn + (i / pieces) * TAU + (Math.random() - 0.5) * 0.8;
    const kick = (70 + Math.random() * 160) * b.k;
    const mass = 0.4 + Math.random() * 0.3;
    into.push({
      kind: "ember",
      x: b.x,
      y: b.y,
      vx: b.vx * 0.55 + Math.cos(angle) * kick,
      vy: b.vy * 0.55 + Math.sin(angle) * kick,
      born: now,
      life: (220 + Math.random() * 320) * (0.7 + mass),
      size: b.size * mass,
      ax: -Math.cos(angle),
      ay: -Math.sin(angle),
      seed: Math.random(),
      k: b.k,
      dragScale: 1 + (1 - mass) * DRAG.small,
      pop: 0,
      trail: [],
    });
  }
}

/* -------------------------------------------------------------- the frame */

/** what one frame of integration leaves behind for the caller to light with */
export interface Frame {
  /** the heat left in the air, which is what the room's brightness reads */
  heat: number;
  /**
   * Where that heat is, weighted by it, in canvas pixels.
   *
   * The room light is cast from here rather than from the wick, because a
   * shower that went right should light the right of the wall. Lighting the
   * middle whatever the sparks did is the one thing left in the picture that
   * a reader can catch being false.
   */
  x: number;
  y: number;
  /** how many embers broke up on this frame, which is what crackles */
  pops: number;
}

/**
 * Integrate one frame and drop whatever has finished.
 *
 * `dt` is in seconds and is expected to be clamped by the caller. `still` is
 * the reduced motion path, where the bodies age and cool where they were put
 * and nothing integrates.
 */
export function step(
  bodies: Body[],
  dt: number,
  now: number,
  still: boolean,
  tuning: Tuning,
): Frame {
  let heat = 0;
  let sx = 0;
  let sy = 0;
  let pops = 0;

  for (let i = bodies.length - 1; i >= 0; i--) {
    const b = bodies[i];
    /* thrown, but not yet: a strike sprays rather than emitting at once */
    if (now < b.born) continue;

    const p = (now - b.born) / b.life;
    if (p >= 1) {
      bodies.splice(i, 1);
      continue;
    }

    if (b.kind === "ember") {
      const lit = heatAt(p) * b.size;
      heat += lit;
      sx += b.x * lit;
      sy += b.y * lit;
    }

    /* under the setting a body still ages and still cools, it just stays put */
    if (still) continue;

    if (b.kind === "ember") {
      if (b.pop > 0 && p >= b.pop) {
        /*
         * The pieces are appended, and this loop runs backwards from the end,
         * so they are not visited until the next frame. That is what they want:
         * they were born on this one.
         */
        fragment(bodies, b, now);
        bodies.splice(i, 1);
        pops++;
        continue;
      }

      const h = heatAt(p);

      /*
       * Buoyancy is the heat's, so the arc is the cooling rather than a curve.
       * Both accelerations are lengths, so they take the stage's scale the same
       * way the launch does, or a small stage would get a burst that climbs in
       * full-size pixels out of a frame it was shrunk to fit.
       */
      b.vy += (FALL - tuning.lift * h) * b.k * dt;

      /*
       * A cheap curl off the body's own position, which is what makes a plume
       * wander instead of every ember climbing the same line. Sampling position
       * rather than rolling per frame is what keeps neighbours moving together.
       */
      const phase = b.seed * TAU;
      b.vx += Math.sin(b.y * 0.021 + now * 0.0013 + phase) * SWIRL * b.k * dt;
      b.vy +=
        Math.cos(b.x * 0.019 + now * 0.0011 + phase) * SWIRL * 0.5 * b.k * dt;
    } else {
      b.vy -= SMOKE_RISE * b.k * dt;
      /* slower and wider than the embers', since a puff is a bigger thing being
         pushed by the same air */
      const phase = b.seed * TAU;
      b.vx +=
        Math.sin(b.y * 0.012 + now * 0.0006 + phase) * SMOKE_SWIRL * b.k * dt;
      b.vy +=
        Math.cos(b.x * 0.01 + now * 0.0005 + phase) *
        SMOKE_SWIRL *
        0.4 *
        b.k *
        dt;
    }

    const keep = Math.exp(-tuning.drag * b.dragScale * dt);
    b.vx *= keep;
    b.vy *= keep;

    b.x += b.vx * dt;
    b.y += b.vy * dt;

    /* the tail points back along the travel, and only while there is travel */
    const v = Math.hypot(b.vx, b.vy);
    if (v > 12) {
      b.ax = -b.vx / v;
      b.ay = -b.vy / v;
    }

    if (b.kind === "ember") {
      b.trail.push(b.x, b.y, now);
      /* pruned by age rather than by count, so a streak is the same length in
         pixels whatever the display is doing. The count is a ceiling only, for
         a refresh rate nothing has yet. */
      while (
        b.trail.length > 3 &&
        (now - b.trail[2] > tuning.trail || b.trail.length > TRAIL_MAX * 3)
      ) {
        b.trail.splice(0, 3);
      }
    }
  }

  /* with nothing in the air the light has nowhere to be, so it goes back to the
     wick, which the caller reads as "do not move the room" */
  return {
    heat,
    x: heat > 0 ? sx / heat : 0,
    y: heat > 0 ? sy / heat : 0,
    pops,
  };
}

/* --------------------------------------------------------------- the flame */

/**
 * One flame, drawn once in a unit box with its tip at the origin's north and
 * its body hanging below. Two cubics into a half circle, which is a teardrop
 * and is as much shape as a glyph six pixels tall can carry.
 *
 * The path is built at module load and reused by every ember on every frame,
 * since a `Path2D` rebuilt per body is the one thing in here that would show up
 * in a profile.
 */
const FLAME = new Path2D();
FLAME.moveTo(0, -1);
FLAME.bezierCurveTo(0.34, -0.55, 0.58, -0.18, 0.58, 0.14);
FLAME.arc(0, 0.14, 0.58, 0, Math.PI, false);
FLAME.bezierCurveTo(-0.58, -0.18, -0.34, -0.55, 0, -1);
FLAME.closePath();

/** how fast a flame wavers, in radians of lean a second */
const FLICKER = 7.4;

/** the glow's radius as a multiple of the flame's height */
const GLOW_SCALE = 2.5;

/** a streak's glow radius at its head, as a multiple of the flame's height */
const TRAIL_GLOW = 1.3;
/** how much light one point of a streak carries at the head */
const TRAIL_ALPHA = 0.24;

/**
 * Above this heat an ember blows its own colour out to white, which is what
 * this much light does to an eye and to a camera. It sits at the top of the
 * ramp, so only the freshest sparks and the pieces off a break carry it.
 */
const BLOWOUT = 0.82;

/**
 * How many tinted glow sprites the caller builds. A radial gradient made per
 * body per frame is a few hundred gradients a second for a picture that only
 * has ten distinguishable steps in it, so the steps are pre-rendered and a draw
 * is one `drawImage`.
 */
export const GLOW_STEPS = 10;

export interface Sprites {
  /** one glow per temperature step, coldest first */
  ember: HTMLCanvasElement[];
  smoke: HTMLCanvasElement;
  /**
   * The same puff in the embers' own warm tone, added over the grey one when
   * there is fire in the air. Smoke is the one thing on this stage big enough
   * to catch a light and show it, so a strike through a plume left by the last
   * snuff lights that plume.
   */
  smokeLit: HTMLCanvasElement;
}

/** where the light in the air is, and how much of it there is */
export interface Light {
  x: number;
  y: number;
  /** 0 to 1, already eased by the caller so it does not cut out */
  level: number;
}

export interface Scene {
  ctx: CanvasRenderingContext2D;
  /** the context's own canvas, which the bloom pass reads back */
  canvas: HTMLCanvasElement;
  /** the canvas's CSS size */
  w: number;
  h: number;
  sprites: Sprites;
  /**
   * A scratch canvas an eighth the size, or null on a context that cannot make
   * one. The bloom is a downsample and an upsample and nothing else: scaling a
   * bitmap down and back up through the browser's own bilinear filter is a box
   * blur it does on the GPU, so this costs two `drawImage` calls a frame where
   * a real gaussian would cost a filter pass over the whole canvas.
   */
  bloom: HTMLCanvasElement | null;
}

/**
 * How much of the blurred copy goes back over the sharp one.
 *
 * It was 0.62, which is fine for a single strike and is fog at a blaze: a
 * hundred overlapping glows already clip to white under `lighter`, and a bloom
 * that strong takes that clipped patch and smears it over a third of the stage.
 * What a bloom is for is the edge of a bright thing, not a second light source.
 */
const BLOOM = 0.34;

/**
 * Paint one frame over whatever the canvas already holds, which is nothing:
 * this clears first, because a burst is what is in the air now and not a mark
 * that accumulates. `rain-splatter` keeps a second canvas for exactly the paint
 * this one deliberately does not have.
 *
 * Everything here is in CSS pixels, since the context carries the device pixel
 * ratio as its transform.
 */
export function paint(
  scene: Scene,
  bodies: Body[],
  now: number,
  light: Light,
): void {
  const { ctx, w, h, sprites } = scene;
  ctx.clearRect(0, 0, w, h);
  if (bodies.length === 0 && light.level < 0.002) return;

  const clock = now / 1000;

  /*
   * Embers are light, so they add: two crossing near each other are brighter
   * than either, which is what a spark shower does and what a straight paint
   * over cannot say. It is also the whole of the streak: a smear of light is
   * what a chain of overlapping glows composites to, so the trail needs no
   * shape of its own and comes out soft at the edges, where the ribbon this
   * replaced was a flat polygon and read as a drawn spoke. Smoke is the
   * opposite and gets its own pass below.
   */
  ctx.globalCompositeOperation = "lighter";

  for (const b of bodies) {
    if (b.kind !== "ember" || now < b.born || b.trail.length < 9) continue;
    const p = (now - b.born) / b.life;
    const heat = heatAt(p);
    const fade = fadeAt(p);
    const burn = sputterAt(clock, b.seed);
    const n = b.trail.length / 3;

    for (let i = 0; i < n - 1; i++) {
      const t = i / (n - 1);
      /* the tail is older light, so it is drawn a step cooler as well as a
         step smaller, which is the smear cooling along its own length */
      const tone =
        sprites.ember[Math.round(heat * (0.4 + 0.6 * t) * (GLOW_STEPS - 1))];
      const s = b.size * TRAIL_GLOW * (0.22 + 0.78 * t);
      ctx.globalAlpha = fade * heat * TRAIL_ALPHA * t * burn;
      ctx.drawImage(
        tone,
        b.trail[i * 3] - s,
        b.trail[i * 3 + 1] - s,
        s * 2,
        s * 2,
      );
    }
  }

  for (const b of bodies) {
    if (b.kind !== "ember" || now < b.born) continue;
    const p = (now - b.born) / b.life;
    const heat = heatAt(p);

    const s = b.size * GLOW_SCALE * (0.55 + 0.45 * heat);
    const tone = sprites.ember[Math.round(heat * (GLOW_STEPS - 1))];
    ctx.globalAlpha = fadeAt(p) * heat * 0.6 * sputterAt(clock, b.seed);
    ctx.drawImage(tone, b.x - s, b.y - s, s * 2, s * 2);
  }

  for (const b of bodies) {
    if (b.kind !== "ember" || now < b.born) continue;
    const p = (now - b.born) / b.life;
    const heat = heatAt(p);
    const [r, g, bl] = tempAt(heat);
    const burn = sputterAt(clock, b.seed);

    /*
     * A fast ember is drawn long and a slow one round, which is the same body
     * seen at two speeds rather than two kinds of particle. The lean wavers on
     * the body's own phase, so a plume of them never beats in time.
     */
    const v = Math.hypot(b.vx, b.vy);
    const stretch = 0.55 + Math.min(v / (620 * b.k), 1.15);
    const wobble = Math.sin(clock * FLICKER + b.seed * TAU) * 0.14;

    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.rotate(Math.atan2(b.ay, b.ax) + Math.PI / 2 + wobble);
    ctx.scale(b.size * 0.42, b.size * stretch * 0.62);
    ctx.globalAlpha = fadeAt(p) * (0.35 + 0.65 * heat) * burn;
    ctx.fillStyle = `rgb(${r} ${g} ${bl})`;
    ctx.fill(FLAME);
    ctx.restore();

    if (heat > BLOWOUT) {
      const over = (heat - BLOWOUT) / (1 - BLOWOUT);
      ctx.globalAlpha = over * over * 0.85 * burn;
      ctx.fillStyle = "rgb(255 253 246)";
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.size * 0.24, 0, TAU);
      ctx.fill();
    }
  }

  ctx.globalCompositeOperation = "source-over";

  for (const b of bodies) {
    if (b.kind !== "smoke" || now < b.born) continue;
    const p = (now - b.born) / b.life;
    /* a puff billows early and only thins at the end */
    const s = b.size * (0.5 + 1.9 * p ** 0.7);
    ctx.globalAlpha = 0.5 * (1 - p) ** 1.3 * Math.min(1, p * 5);
    ctx.drawImage(sprites.smoke, b.x - s, b.y - s, s * 2, s * 2);
  }

  /* and smoke catching what the embers are throwing at it */
  if (light.level > 0.004) {
    ctx.globalCompositeOperation = "lighter";
    for (const b of bodies) {
      if (b.kind !== "smoke" || now < b.born) continue;
      const p = (now - b.born) / b.life;
      const s = b.size * (0.5 + 1.9 * p ** 0.7);
      const d = Math.hypot(b.x - light.x, b.y - light.y);
      ctx.globalAlpha =
        0.26 * light.level * (1 / (1 + d / 150)) * (1 - p) ** 1.3;
      ctx.drawImage(sprites.smokeLit, b.x - s, b.y - s, s * 2, s * 2);
    }
  }

  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "source-over";

  /*
   * Bloom, last, so it reads everything else. Bright light bleeds in a lens and
   * in an eye, and without it the white-hot end of the ramp is paint rather
   * than light: the sparks are the brightest thing on the stage and they were
   * the only thing on it with a hard edge.
   */
  const { bloom } = scene;
  if (bloom && bloom.width > 0) {
    const small = bloom.getContext("2d");
    if (small) {
      small.clearRect(0, 0, bloom.width, bloom.height);
      small.drawImage(scene.canvas, 0, 0, bloom.width, bloom.height);
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = BLOOM;
      ctx.drawImage(bloom, 0, 0, w, h);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";
    }
  }
}

/**
 * Build the sprite sheet at one device pixel ratio. Called again on a change,
 * since a sprite drawn at the old ratio is the one soft thing on the stage that
 * would show it.
 */
export function buildSprites(dpr: number): Sprites {
  const ember: HTMLCanvasElement[] = [];
  for (let i = 0; i < GLOW_STEPS; i++) {
    const [r, g, b] = tempAt(i / (GLOW_STEPS - 1));
    /*
     * Tight and bright at the middle with a long dim skirt, which is what a
     * point of light looks like. The first build held most of its brightness
     * out to a third of the radius, so every ember read as a glowing ball
     * rather than as a spark with a bloom around it.
     */
    ember.push(
      radial(dpr, [
        [0, `rgb(${r} ${g} ${b} / 0.95)`],
        [0.16, `rgb(${r} ${g} ${b} / 0.52)`],
        [0.42, `rgb(${r} ${g} ${b} / 0.13)`],
        [1, `rgb(${r} ${g} ${b} / 0)`],
      ]),
    );
  }

  return {
    ember,
    smoke: radial(dpr, [
      [0, "rgb(186 179 172 / 0.52)"],
      [0.42, "rgb(168 161 155 / 0.26)"],
      [1, "rgb(150 144 139 / 0)"],
    ]),
    smokeLit: radial(dpr, [
      [0, "rgb(255 154 62 / 0.44)"],
      [0.42, "rgb(238 120 44 / 0.2)"],
      [1, "rgb(220 100 36 / 0)"],
    ]),
  };
}

/** the sprite's radius in CSS pixels, before a body scales it */
const SPRITE = 32;

function radial(
  dpr: number,
  stops: Array<[number, string]>,
): HTMLCanvasElement {
  const size = Math.max(2, Math.round(SPRITE * 2 * dpr));
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const ctx = c.getContext("2d");
  if (!ctx) return c;

  const r = size / 2;
  const gradient = ctx.createRadialGradient(r, r, 0, r, r, r);
  for (const [at, colour] of stops) gradient.addColorStop(at, colour);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  return c;
}
