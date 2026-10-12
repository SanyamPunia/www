import type React from "react";

/**
 * The frame every icon in the set is drawn in.
 *
 * - **A 24 unit grid with 2 units of padding**, so the ink of the widest shape
 *   stays inside 2 to 22. A circle is 20 across, a square 18, a portrait
 *   16 by 20 and a landscape 20 by 16. Small marks such as a check or a caret
 *   sit inside those.
 * - **A solid part is filled and stroked at 2 in the same colour.** The stroke
 *   reaches 1 past the shape and the round join turns every corner into an
 *   arc, so the geometry is drawn 1 inside its keyline and comes out soft.
 * - **A line part is a stroke alone at 2.25**, round caps and joins, for a
 *   glyph a fill would turn into a blob.
 * - **A knockout is a hole cut by `evenodd`**, drawn 1 larger than what shows,
 *   since the solid's stroke closes it by 1 on every side.
 * - **The ink box is centred on 12, 12**, except where the eye needs an offset:
 *   the play triangle sits 0.6 right of centre.
 *
 * Nothing here uses context or a hook, so an icon renders on the server and
 * the client from the one import path.
 */
export type IconProps = Omit<React.SVGProps<SVGSVGElement>, "children">;

export type IconComponent = (props: IconProps) => React.JSX.Element;

export function Svg({
  children,
  ...props
}: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      // 1em by default, as Phosphor was, so an icon with no size class
      // follows the text it sits in
      width="1em"
      height="1em"
      fill="none"
      stroke="currentColor"
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

export function Solid({ d }: { d: string }) {
  return <path d={d} fill="currentColor" fillRule="evenodd" strokeWidth={2} />;
}

export function Line({ d }: { d: string }) {
  return <path d={d} strokeWidth={2.25} />;
}
