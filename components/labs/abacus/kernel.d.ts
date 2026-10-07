/**
 * Types for the vendored Hairline kernel, covering only what `figure.ts` and
 * `index.tsx` call. The kernel itself is plain JavaScript and stays byte for
 * byte the skill's, apart from its last line.
 */

export type Pt = [number, number];
export type Point3 = readonly [number, number, number];

/** One sample of a ring: a position and its outward normal, on the ground. */
export interface Sample {
  u: number;
  v: number;
  nu: number;
  nv: number;
}

export interface Camera {
  az: number;
  k: number;
  S: number;
  ox: number;
  oy: number;
}

export interface Tween {
  from: number;
  to: number;
  t0: number;
  dur: number;
}

export interface Solid {
  g: SVGGElement;
  sil: SVGPathElement;
  cr: SVGPathElement;
}

export interface Paths {
  sil: string;
  crease: string;
}

export interface Board {
  wake(): void;
  unregister(): void;
}

export interface Disposer {
  add(fn: () => void): void;
  dispose(): void;
}

type Project = (x: number, y: number, z: number) => Pt;

export declare const HL: {
  Cam(azDeg: number, k: number, S: number): Camera;
  fit(C: Camera, points: readonly Point3[], cx: number, cy: number): void;
  proj(C: Camera): Project;
  facing(C: Camera): (q: Sample) => boolean;
  rings(
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    r: number,
    b: number,
  ): [Sample[], Sample[]];
  prism(
    P: Project,
    front: (q: Sample) => boolean,
    ring: Sample[],
    inner: Sample[] | null,
    z0: number,
    z1: number,
  ): Paths;
  hull(points: Pt[]): Pt[];
  poly(points: Pt[]): string;
  open(points: Pt[]): string;
  clamp(v: number, a: number, b: number): number;
  tween(v: number, dur?: number): Tween;
  tset(tw: Tween, to: number, now: number, delay: number): void;
  tval(tw: Tween, now: number): number;
  tdone(tw: Tween, now: number): boolean;
  mk<K extends keyof SVGElementTagNameMap>(
    tag: K,
    attrs: Record<string, string | number>,
    parent?: Element,
  ): SVGElementTagNameMap[K];
  solid(parent: Element): Solid;
  put(el: Solid, paths: Paths): void;
  register(stage: Element, tick: (dt: number, now: number) => boolean): Board;
  pointer(stage: Element, on: { move(p: Pt): void; leave(): void }): () => void;
  disposer(): Disposer;
  inject(root: Document): void;
};
