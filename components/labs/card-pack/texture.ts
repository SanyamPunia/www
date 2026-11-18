/*
 * The surfaces' grain, as SVG turbulence in a data URI, so nothing is fetched
 * and nothing is drawn per frame. Each is a grey field laid over a surface
 * with a blend mode, so it adds relief without adding a colour. The noise's
 * red channel becomes the grey, so mid grey is no change under `overlay` and
 * `soft-light`, and only the deviation from it shows.
 */

const noise = (frequency: string, octaves: number, alpha: number, size = 240) =>
  `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='${size}' height='${size}'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='${frequency}' numOctaves='${octaves}' stitchTiles='stitch'/%3E%3CfeColorMatrix values='1 0 0 0 0 1 0 0 0 0 1 0 0 0 0 0 0 0 0 ${alpha}'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`;

/**
 * Foil that has been handled: long soft creases, stretched along the pack's
 * height the way a wrapper wrinkles when it is filled.
 */
export const CRINKLE = noise("0.011 0.035", 3, 1, 320);

/** the fine grain of the metallised film and of printed card stock */
export const GRAIN = noise("0.85", 2, 0.9);

/** the same grain at a third of the strength, for the film inside the pack */
export const GRAIN_SOFT = noise("0.85", 2, 0.3);

/** the holo foil's sparkle, coarser than the grain so it reads as flecks */
export const FLECK = noise("0.45", 1, 1, 160);
