/*
 * What a magnifying glass does, as a function of one number: how high it is
 * held above the paper, as a share of its focal length.
 *
 * A simple magnifier held at height `u` of its focal length shows a virtual
 * image `1 / (1 - u)` times the size of the print. On the paper it does nothing
 * (1x), and as it rises toward the focal length the image grows without limit
 * and the aberrations grow with it. So the glass is never set to a
 * magnification. It is held at a height, and everything else is read off that.
 *
 * The same height decides what the glass does to the light, which is the other
 * half of the drawing. Light from a lamp above passes through the lens and
 * converges, so on the paper under it there is a shadow of the frame, a dim
 * disc where the lens took light away, and a bright caustic in the middle where
 * it put that light. The caustic's radius is the lens's own radius times
 * `1 - u`, the same factor from the other side of the lens, so the spot shrinks
 * and brightens exactly as the image grows. Both are offset along the light by
 * the height, which is what puts the shadow beside the glass and not under it.
 */

/** how high the glass is held, as a share of its focal length */
export const HEIGHT = {
  /** 1.25x, about as low as a hand holds one */
  min: 0.2,
  /** 4x, where a hand lens starts to come apart at its rim */
  max: 0.75,
  /** 2.5x, enough to read the street names */
  rest: 0.6,
} as const;

/** how far a hand lifts the glass while carrying it */
export const LIFT = 0.035;

/** one press of the buttons or the keys, in magnification */
export const STEP = 0.25;

export function magnification(u: number): number {
  return 1 / (1 - u);
}

export function heightFor(mag: number): number {
  return 1 - 1 / mag;
}

export function clampHeight(u: number): number {
  return Math.min(HEIGHT.max, Math.max(HEIGHT.min, u));
}

/** the lamp is above and to the upper left, so shadows fall down and right */
export const LIGHT = { x: 0.55, y: 0.83 } as const;

/** the glass, sized off the stage */
export interface Geometry {
  /** the glass's radius, in css px */
  r: number;
  /** the frame's width */
  rim: number;
  /** the handle's length past the frame, and half its width */
  handle: number;
  grip: number;
}

export function geometry(w: number, h: number): Geometry {
  const r = Math.min(w * 0.15, h * 0.25);
  return { r, rim: r * 0.13, handle: r * 1.15, grip: r * 0.15 };
}

/** what the glass does at height `u`, in css px where it is a length */
export interface Optics {
  mag: number;
  /** pincushion: the share by which the rim magnifies more than the middle */
  distortion: number;
  /** how far apart red and blue land at the rim, as a share of the mag */
  chroma: number;
  /** where the shadow and the caustic land, relative to the glass */
  shadowX: number;
  shadowY: number;
  /** how soft the shadow's edge is */
  blur: number;
  /** the caustic's radius and how much brighter it is than open paper */
  caustic: number;
  gain: number;
}

export function optics(u: number, g: Geometry): Optics {
  const lift = u * g.r * 0.95;
  return {
    mag: magnification(u),
    distortion: 0.06 + 0.16 * u,
    chroma: 0.006 + 0.03 * u * u,
    shadowX: LIGHT.x * lift,
    shadowY: LIGHT.y * lift,
    blur: 1.2 + u * g.r * 0.13,
    caustic: g.r * (1 - u),
    gain: 1 + 0.75 * Math.min(1, Math.max(0, (u - 0.15) / 0.6)),
  };
}
