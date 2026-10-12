/**
 * The names in the site's icon set, by group, in sheet order. Each name is an
 * export of `components/icons` without its `Icon` suffix.
 *
 * Plain data, so `lib/markdown.ts` and `lib/schema.ts` can list the set
 * without importing React. `components/icons/catalog.ts` checks this list
 * against the exports, so a name here with no icon, or an icon with no name,
 * fails the build.
 */
export const ICON_GROUPS = [
  {
    id: "arrows",
    label: "Arrows",
    names: [
      "ArrowRight",
      "ArrowLeft",
      "ArrowUp",
      "ArrowDown",
      "ArrowUpRight",
      "ArrowSquareOut",
      "ArrowUUpLeft",
      "ArrowsClockwise",
      "ArrowCounterClockwise",
      "ArrowsLeftRight",
      "ArrowsHorizontal",
      "ArrowsOutLineHorizontal",
      "ArrowsOutLineVertical",
      "CaretDown",
      "CaretUp",
      "CaretLeft",
      "CaretRight",
      "CornersIn",
      "SignOut",
      "Shuffle",
      "DownloadSimple",
    ],
  },
  {
    id: "marks",
    label: "Marks",
    names: [
      "Check",
      "X",
      "Plus",
      "Minus",
      "Circle",
      "CheckCircle",
      "XCircle",
      "CircleNotch",
      "Info",
      "Warning",
      "SealCheck",
      "Hash",
      "DotsThree",
    ],
  },
  {
    id: "objects",
    label: "Objects",
    names: [
      "File",
      "FileText",
      "Note",
      "Folder",
      "FolderOpen",
      "Image",
      "MagnifyingGlass",
      "Copy",
      "Trash",
      "Eraser",
      "Link",
      "LinkBreak",
      "Gear",
      "SlidersHorizontal",
      "Palette",
      "Clock",
      "Code",
      "Terminal",
      "TerminalWindow",
      "GitBranch",
      "SquaresFour",
      "TextAa",
      "TextB",
      "User",
    ],
  },
  {
    id: "media",
    label: "Media",
    names: ["Play", "Pause", "Stop", "SpeakerHigh", "SpeakerSlash"],
  },
  {
    id: "nature",
    label: "Nature",
    names: [
      "Sun",
      "CloudRain",
      "CloudFog",
      "CloudLightning",
      "Snowflake",
      "Heart",
      "HeartOutline",
      "Flame",
      "FlameOutline",
      "Star",
      "Clover",
      "Cherries",
      "Crown",
      "Diamond",
    ],
  },
  {
    id: "hands",
    label: "Hands",
    names: ["Cursor", "CursorClick", "Hand", "HandGrabbing", "HandPointing"],
  },
] as const;

export type IconGroup = (typeof ICON_GROUPS)[number];

export const ICON_COUNT = ICON_GROUPS.reduce(
  (sum, group) => sum + group.names.length,
  0,
);

/**
 * The page's one line of copy, which only metadata and the markdown carry,
 * since the page itself shows the icons and nothing else.
 */
export const ICONS_DESCRIPTION = `The icon set this site is drawn in: ${ICON_COUNT} rounded, filled icons on a 24 unit grid. Press one to copy it as SVG.`;
