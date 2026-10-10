/**
 * Every page reads its column width from here. Changing this reshapes the
 * whole site at once, which is the point. Tuned so the home page lead
 * paragraph breaks at roughly 72 characters.
 */
export const CONTENT_WIDTH = "max-w-[33.6rem]";

/**
 * The lab index, which is a grid of clips rather than a column of prose.
 *
 * Three columns at this width are about 324px each, and the preview clips are
 * 640px wide, so a card shows its clip at 2x on a retina screen. A wider grid
 * upscales the clips and they go soft.
 */
export const WIDE_WIDTH = "max-w-[64rem]";

/**
 * Half of `CONTENT_WIDTH`, as a number, for anything positioned in the margin
 * beside the column rather than inside it. Currently just `TocRail`.
 *
 * Restated rather than derived because Tailwind only sees class names it can
 * read literally in the source, so `CONTENT_WIDTH` cannot be built from this.
 * The two move together.
 */
export const CONTENT_HALF_REM = 16.8;

export const SITE_URL = "https://sanyam.sh";
