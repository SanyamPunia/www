import type { Ref } from "react";
import { cn } from "@/lib/utils";

/*
 * The set's own `TrashIcon`, redrawn with the lid as a group of its own so it
 * can turn on a hinge. The path data is the glyph's, copied rather than
 * imported, since the set's icons are one drawing and this needs two.
 *
 * The hinge is the lid's right end, (20, 6.25), so a negative turn lifts the
 * left end the way a pedal bin opens. The turn is written as an attribute by
 * the caller, never rendered, so a hold renders nothing.
 */

const BODY =
  "M6.29 9.75L17.71 9.75A0.5 0.5 0 0 1 18.21 10.29L17.56 18.43A2.25 2.25 0 0 1 15.32 20.5L8.68 20.5A2.25 2.25 0 0 1 6.44 18.43L5.79 10.29A0.5 0.5 0 0 1 6.29 9.75ZM11.85 13L11.85 17.25A1.85 1.85 0 0 1 8.15 17.25L8.15 13A1.85 1.85 0 0 1 11.85 13ZM15.85 13L15.85 17.25A1.85 1.85 0 0 1 12.15 17.25L12.15 13A1.85 1.85 0 0 1 15.85 13Z";
const LID =
  "M4 6.25L20 6.25M9.25 6.25V5.25A1.75 1.75 0 0 1 11 3.5H13A1.75 1.75 0 0 1 14.75 5.25V6.25";

export const HINGE = "20 6.25";

export function Trash({
  lidRef,
  className,
}: {
  lidRef: Ref<SVGGElement>;
  className?: string;
}) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      // the lid swings past the box's top edge, and must not be clipped
      overflow="visible"
      className={cn("shrink-0", className)}
    >
      <path d={BODY} fill="currentColor" fillRule="evenodd" strokeWidth={2} />
      <g ref={lidRef}>
        <path d={LID} strokeWidth={2.25} />
      </g>
    </svg>
  );
}
