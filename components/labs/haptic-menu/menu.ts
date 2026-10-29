/**
 * The numbers behind the menu, pure and DOM-free: how long a press has to
 * last, and where the preview and the menu land for a given stage.
 */

/** seconds a press has to last before the photo lifts, iOS's own half second */
export const HOLD = 0.45;
/** px a finger may drift before the press is a scroll instead */
export const SLOP = 10;
/** how far a held tile shrinks before it lifts, as a share of its size */
export const SHRINK = 0.05;

/** the menu's rows, in px, so its height is arithmetic and not a measurement */
export const ROW = 40;
export const HEAD = 34;
export const SEP = 8;
export const NOTE = 46;
export const MENU_W = 200;
/** a header, three rows, the thick separator and the destructive row */
export const MENU_H = HEAD + ROW * 3 + SEP + ROW;
/** the delete confirmation: a header, a line saying what happens, two rows */
export const CONFIRM_H = HEAD + NOTE + ROW * 2;

const GAP = 12;
const PAD = 16;

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Pose {
  preview: Rect;
  menu: { x: number; y: number };
  /** the menu's transform origin, on the edge nearest the preview */
  origin: string;
}

/**
 * Where the preview and the menu go. Side by side when the stage is wide
 * enough, stacked otherwise. The menu goes on the side of the preview away
 * from the edge the tile is nearer to, the way iOS keeps a menu on screen.
 */
export function pose(stage: { w: number; h: number }, tile: Rect): Pose {
  const left = tile.x + tile.w / 2 < stage.w / 2;
  if (stage.w >= 2 * PAD + 150 + GAP + MENU_W) {
    const p = Math.min(stage.h - 2 * PAD, stage.w * 0.4, 210);
    const gw = p + GAP + MENU_W;
    const gx = (stage.w - gw) / 2;
    const gh = Math.max(p, MENU_H);
    const gy = (stage.h - gh) / 2;
    const px = left ? gx : gx + MENU_W + GAP;
    return {
      preview: { x: px, y: gy + (gh - p) / 2, w: p, h: p },
      menu: {
        x: left ? px + p + GAP : gx,
        y: gy + (gh - MENU_H) / 2,
      },
      origin: left ? "0% 50%" : "100% 50%",
    };
  }
  const p = Math.max(
    96,
    Math.min(stage.w - 2 * PAD, stage.h - 2 * PAD - GAP - MENU_H, 200),
  );
  const top = Math.max(PAD, (stage.h - (p + GAP + MENU_H)) / 2);
  const px = (stage.w - p) / 2;
  const mx = left ? px : px + p - MENU_W;
  return {
    preview: { x: px, y: top, w: p, h: p },
    menu: {
      x: Math.min(Math.max(mx, PAD), stage.w - PAD - MENU_W),
      y: top + p + GAP,
    },
    origin: left ? "0% 0%" : "100% 0%",
  };
}

/** a press shrinks quickly and then holds, so the lift reads as a release */
export function shrinkAt(p: number): number {
  return 1 - SHRINK * (1 - (1 - Math.min(1, p)) ** 2);
}
