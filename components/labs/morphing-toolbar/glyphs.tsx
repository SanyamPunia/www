import type React from "react";

/*
 * The toolbar's own line glyphs, from the reference, on a 24 unit box with a
 * 1.75 stroke in `currentColor`.
 *
 * They are the subject's artwork rather than UI icons, the standing
 * `browser-toolbar` gives its glyphs: the toolbar is what the demo is about,
 * and its icons are one drawn set at one weight. The site's set is filled and
 * has no select arrow, pen, shapes, text or rectangle, so mixing the two would
 * put two drawing styles on one bar.
 */

type Props = React.SVGProps<SVGSVGElement>;

function Glyph({
  children,
  fill = "none",
  ...props
}: Props & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill={fill}
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      {children}
    </svg>
  );
}

export const SelectGlyph = (p: Props) => (
  <Glyph {...p}>
    <path d="M5 3.5l13.5 6.3-6 1.8-2.6 6.4z" />
  </Glyph>
);

export const PenGlyph = (p: Props) => (
  <Glyph {...p}>
    <path d="M15 4.5l4.5 4.5L9 19.5H4.5V15z" />
    <path d="M12.5 7l4.5 4.5" />
  </Glyph>
);

export const ShapesGlyph = (p: Props) => (
  <Glyph {...p}>
    <rect x="3.5" y="10.5" width="9" height="9" rx="2" />
    <circle cx="15.5" cy="8.5" r="5" />
  </Glyph>
);

export const TextGlyph = (p: Props) => (
  <Glyph {...p}>
    <path d="M5 7V4.5h14V7M12 4.5v15M9 19.5h6" />
  </Glyph>
);

export const EraserGlyph = (p: Props) => (
  <Glyph {...p}>
    <path d="M9 19.5h10.5" />
    <path d="M4.4 14.1l8.4-8.4a2 2 0 012.8 0l3.7 3.7a2 2 0 010 2.8L11.6 19.5H9.4l-5-5a.3.3 0 010-.4z" />
    <path d="M8.5 10l5.5 5.5" />
  </Glyph>
);

export const UndoGlyph = (p: Props) => (
  <Glyph {...p}>
    <path d="M9 13.5L4.5 9 9 4.5" />
    <path d="M4.5 9h10a5 5 0 010 10H11" />
  </Glyph>
);

export const RedoGlyph = (p: Props) => (
  <Glyph {...p}>
    <path d="M15 13.5L19.5 9 15 4.5" />
    <path d="M19.5 9h-10a5 5 0 000 10H13" />
  </Glyph>
);

export const RectGlyph = (p: Props) => (
  <Glyph {...p}>
    <rect x="4" y="5.5" width="16" height="13" rx="2.5" />
  </Glyph>
);

export const EllipseGlyph = (p: Props) => (
  <Glyph {...p}>
    <ellipse cx="12" cy="12" rx="8.5" ry="7" />
  </Glyph>
);

export const LineGlyph = (p: Props) => (
  <Glyph {...p}>
    <path d="M5 19L19 5" />
  </Glyph>
);

export const ArrowGlyph = (p: Props) => (
  <Glyph {...p}>
    <path d="M5 19L19 5M10 5h9v9" />
  </Glyph>
);

export const OutlineGlyph = (p: Props) => (
  <Glyph {...p}>
    <rect x="5" y="5" width="14" height="14" rx="3.5" />
  </Glyph>
);

export const FilledGlyph = (p: Props) => (
  <Glyph fill="currentColor" {...p}>
    <rect x="5" y="5" width="14" height="14" rx="3.5" />
  </Glyph>
);

export const MinusGlyph = (p: Props) => (
  <Glyph {...p}>
    <path d="M7 12h10" />
  </Glyph>
);

export const PlusGlyph = (p: Props) => (
  <Glyph {...p}>
    <path d="M7 12h10M12 7v10" />
  </Glyph>
);

export const TrashGlyph = (p: Props) => (
  <Glyph {...p}>
    <path d="M4.5 7h15M10 11v6M14 11v6M6 7l1 12.5h10L18 7M9.5 7V4.5h5V7" />
  </Glyph>
);
