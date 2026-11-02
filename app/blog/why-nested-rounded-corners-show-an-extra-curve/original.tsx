"use client";

import { Demo } from "@/components/blogs/demo";
import { Breakout, Phase, SIZE } from "./figure";
import { CONTRAST_LABEL, Frame, Zoom } from "./panels";
import { Queue } from "./queue";

/**
 * The broken panel, rebuilt as live DOM in the before build, in three phases:
 * the deploy queue at actual size, its top-right corner at 6x as it shipped,
 * and the same corner with only the ring recoloured. The panel is `Frame`
 * from `panels.tsx` and the content is `Queue`, so this and `Cases` cannot
 * drift apart. The list scrolls, since the scrollbar beside the corner is part
 * of what was seen.
 */
export function Original() {
  return (
    <Breakout>
      <Demo className="block select-none p-0 shadow-frame ring-0">
        <figure
          role="img"
          aria-label="The original panel: a rounded grey frame around a white scrolling deploy queue. At 6x, the top-right corner shows a faint curved fragment of the frame's outer ring. A second crop recolours only that ring orange: only its curved corner piece survives the square clip."
          className="m-0 grid w-full divide-y divide-stroke sm:grid-cols-[auto_1fr_1fr] sm:divide-x sm:divide-y-0"
        >
          {/* the two crops take the panel's own height, so all three phases
              line up top and bottom */}
          <Phase n={1} title="Deploy queue">
            <Frame build="before" className={SIZE}>
              <Queue />
            </Frame>
            {/* capped at the panel's width, or the column grows to fit one
                long line and squeezes the two crops */}
            <span className="max-w-100 text-meta text-text-muted">
              The panel as it rendered. Watch the top-right corner, beside the
              scrollbar.
            </span>
          </Phase>
          <Phase n={2} title="As it shipped">
            <Zoom build="before" zoom={6} className="h-100" />
            <span className="text-meta text-text-muted">
              Top-right corner at 6x. The faint curve on the corner is the arc.
            </span>
          </Phase>
          <Phase n={3} title="Highlighted">
            <Zoom build="before" highlight mark zoom={6} className="h-100" />
            <span className="text-meta text-text-muted">
              Only the outer ring is recoloured. {CONTRAST_LABEL}
            </span>
          </Phase>
        </figure>
      </Demo>
    </Breakout>
  );
}
