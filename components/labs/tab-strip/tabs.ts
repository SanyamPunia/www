import {
  EnvelopeIcon,
  FolderIcon,
  InfoIcon,
  MagnifyingGlassIcon,
  NoteIcon,
  PaletteIcon,
  SealCheckIcon,
  SquaresFourIcon,
  UserIcon,
} from "@/components/icons";
import type { IconComponent } from "@/components/icons/icon";

export const SITE = "sanyam.sh";

export interface Page {
  title: string;
  /** null for a new tab, which has no address yet */
  path: string | null;
  Icon: IconComponent;
}

/** this site's own pages, so every address in the bar resolves */
export const PAGES: readonly Page[] = [
  { title: "Sanyam Punia", path: "", Icon: UserIcon },
  { title: "Work", path: "/work", Icon: FolderIcon },
  { title: "Blogs", path: "/blogs", Icon: NoteIcon },
  { title: "Lab", path: "/lab", Icon: SquaresFourIcon },
  { title: "Icons", path: "/icons", Icon: PaletteIcon },
  { title: "About", path: "/about", Icon: InfoIcon },
  { title: "Contact", path: "/contact", Icon: EnvelopeIcon },
  { title: "Privacy", path: "/privacy", Icon: SealCheckIcon },
];

export const NEW_TAB: Page = {
  title: "New tab",
  path: null,
  Icon: MagnifyingGlassIcon,
};

/**
 * The five tabs the strip opens with, and which of them is in front. Five is
 * few enough to read every title and enough that the tabs are already
 * squeezed, which is the only case where holding the width matters.
 */
export const START = [0, 1, 2, 3, 5];
export const START_ACTIVE = 2;

/**
 * Tab widths in CSS px. A tab is as wide as the strip shares out, between the
 * two. At `min` a tab is its favicon and nothing else.
 */
export const TAB = { min: 44, max: 176 } as const;

/** Under this a tab shows its favicon or its close button, never both */
export const NARROW = 72;

/** Above this every tab shows its close button, not only on hover */
export const ROOMY = 120;

export function tabWidth(room: number, count: number): number {
  if (count === 0) return TAB.max;
  return Math.max(TAB.min, Math.min(TAB.max, room / count));
}

/** Whether one more tab still fits at the minimum width */
export function canOpen(room: number, count: number): boolean {
  return (count + 1) * TAB.min <= room;
}
