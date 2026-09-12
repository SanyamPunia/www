/**
 * The fracture geometry, in the button's own pixels. Pure, no React and no DOM,
 * the split `peel.ts`, `stack.ts` and `window.ts` already make.
 *
 * A crack in glass is not a line from A to B. It leaves the impact in a
 * direction, wanders a little either side of it as it follows whatever flaw is
 * in front of it, and throws off branches that do the same. So a branch here is
 * a walk rather than a curve: a step, a small turn, a step, and a chance at each
 * joint of spawning a child that leaves at an angle and dies sooner.
 */

export type Point = [number, number];

/** the button's face, which every path here is generated inside and clipped to */
export const FACE = { w: 168, h: 56, r: 28 } as const;

/** how many presses the glass takes before it lets go */
export const LIMIT = 5;

/** how far a walk turns at each joint, and how far it steps */
const WANDER = 0.42;
const STEP = 7;

/** a branch off a branch leaves at roughly this angle and gets this much of its parent's life */
const FORK = 0.7;
const FORK_LIFE = 0.55;

function walk(from: Point, angle: number, length: number): Point[] {
  const points: Point[] = [from];
  let [x, y] = from;
  let heading = angle;
  let travelled = 0;
  while (travelled < length) {
    const step = Math.min(STEP, length - travelled);
    heading += (Math.random() - 0.5) * WANDER;
    x += Math.cos(heading) * step;
    y += Math.sin(heading) * step;
    points.push([x, y]);
    travelled += step;
  }
  return points;
}

function toPath(points: Point[]): string {
  return points
    .map(
      ([x, y], index) =>
        `${index === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`,
    )
    .join("");
}

/**
 * One impact: a few branches leaving it, and the odd child off those.
 *
 * The lengths are generous against a 168 by 56 face on purpose, since the
 * drawing is clipped to the pill and a branch that stops short of the edge reads
 * as a scratch. What the clip cuts is the part a reader was never going to
 * believe anyway.
 */
export function crackAt([cx, cy]: Point): string[] {
  const paths: string[] = [];
  const arms = 3 + Math.floor(Math.random() * 3);
  const offset = Math.random() * Math.PI * 2;

  for (let i = 0; i < arms; i++) {
    /* spread them round the impact, jittered, or the star is a snowflake */
    const angle =
      offset + (i / arms) * Math.PI * 2 + (Math.random() - 0.5) * 0.9;
    const length = 26 + Math.random() * 62;
    const points = walk([cx, cy], angle, length);
    paths.push(toPath(points));

    if (Math.random() < 0.6 && points.length > 3) {
      const at = points[1 + Math.floor(Math.random() * (points.length - 2))];
      const side = Math.random() < 0.5 ? -1 : 1;
      paths.push(toPath(walk(at, angle + side * FORK, length * FORK_LIFE)));
    }
  }
  return paths;
}

export interface Shard {
  /** the polygon, in face pixels */
  d: string;
  /** the direction its own mass leaves in, which is its mid-angle */
  toward: Point;
  /** how far it parts, how far it turns, and when it lets go, rolled once when the glass goes */
  throwBy: number;
  spin: number;
  delay: number;
}

/**
 * The break: the face cut into wedges around the last impact.
 *
 * Every wedge is bounded by one walk out of the impact, one walk out of the next
 * angle round, and a chord between their far ends, so together they tile the
 * plane around that point and the clip takes the pill out of the middle. That is
 * what makes this a partition rather than a pile of shapes that happen to
 * overlap the button: nothing is drawn twice and no gap opens between two
 * neighbours, because each edge is one walk shared by the two wedges either side
 * of it.
 *
 * The walk is jagged for the first 90px and straight after that, since only the
 * first 90 is ever on screen and a jag out at the closing chord would cost a
 * seam for nothing.
 */
export function shardsFrom([cx, cy]: Point): Shard[] {
  const count = 7 + Math.floor(Math.random() * 3);
  const offset = Math.random() * Math.PI * 2;
  const far = 260;

  const angles: number[] = [];
  for (let i = 0; i < count; i++) {
    angles.push(
      offset + (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.5,
    );
  }
  angles.sort((a, b) => a - b);

  const rays = angles.map((angle) => {
    const points = walk([cx, cy], angle, 90);
    const [lx, ly] = points[points.length - 1];
    points.push([lx + Math.cos(angle) * far, ly + Math.sin(angle) * far]);
    return points;
  });

  return rays.map((ray, i) => {
    const next = rays[(i + 1) % rays.length];
    const polygon = [...ray, ...[...next].reverse()];
    const mid = (angles[i] + angles[(i + 1) % count]) / 2;
    return {
      d: `${toPath(polygon)}Z`,
      toward: [Math.cos(mid), Math.sin(mid)],
      /*
       * A pane comes apart, it does not blow up. What separates two pieces is
       * the width of the crack between them and nothing else, so the sideways
       * travel is a few pixels and gravity does the rest. At 44 to 102 with up
       * to 55 degrees of spin the pieces left like shrapnel, which is a cartoon
       * of breaking rather than breaking.
       */
      throwBy: 5 + Math.random() * 16,
      spin: (Math.random() - 0.5) * 13,
      /*
       * And they do not all let go together. A crack runs through the pane and
       * one piece drops before the one beside it, which is most of what
       * separates a pane failing from a sheet being deleted.
       */
      delay: Math.random() * 0.11,
    };
  });
}
