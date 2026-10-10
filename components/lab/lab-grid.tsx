import Link from "next/link";
import { ViewTransition } from "react";
import { LabClip } from "@/components/lab/lab-clip";
import { NewBadge } from "@/components/ui/new-badge";
import { formatLabDate, type LabMetadata, labMorphName } from "@/lib/labs";

/**
 * The lab index, newest first, as a grid of cards that each play their own
 * preview clip.
 *
 * A plain CSS grid and not a masonry. Every clip is 640 by 400, so every card
 * is the same 8:5 and the rows line up with no measuring.
 *
 * The caption sits under the card rather than over the clip. The clips mix
 * white stages and dark ones, so a caption laid over them would need its tone
 * flipped per lab. Under the card it is ordinary text on the page.
 */
export function LabGrid({
  labs,
  previews,
}: {
  /** newest first, so card 0 is the newest experiment there is */
  labs: LabMetadata[];
  /** the slugs with a recorded clip, from `labPreviewSlugs()` */
  previews: string[];
}) {
  const clips = new Set(previews);

  return (
    <ul className="grid grid-cols-1 gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
      {labs.map((lab, index) => (
        <li key={lab.slug}>
          <Link
            href={`/lab/${lab.slug}`}
            /*
              The card's hover is a surface behind the clip and the caption,
              the way a row's is, kept to the two lightest steps so a grid of
              moving clips does not flash under the pointer. `-m-2 p-2` grows
              the surface past the clip without moving it. The corner is the
              clip's 0.4rem plus that 0.4rem of padding, so the two corners are
              concentric, and no radius token is 0.8rem.
            */
            className="group -m-2 flex flex-col gap-3 rounded-[0.8rem] p-2 transition-colors duration-200 hover:bg-surface active:bg-fill focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-primary/15 focus-visible:ring-offset-2"
          >
            {/*
              The same name as the demo frame on the lab's own page, so a
              click morphs this box into that frame and the back link morphs
              it home. `default="none"` stops the 58 named cards each running
              their own crossfade on every unrelated transition, and with it
              the explicit `share` is what keeps the pair morphing.
            */}
            <ViewTransition
              name={labMorphName(lab.slug)}
              share="lab-morph"
              default="none"
            >
              <div className="relative aspect-8/5 overflow-hidden rounded-lg bg-fill">
                {clips.has(lab.slug) && <LabClip slug={lab.slug} />}
                {/*
                The edge is a layer over the clip, since an inset ring on the
                box itself paints under a `size-full` video and the card is left
                with no edge, which is the trap `now-playing` documents. Half
                the clips are a white stage on a white page, so the edge is the
                only thing saying where the card stops. It steps one tone on
                hover, beside the surface the link paints.
              */}
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 rounded-lg ring-1 ring-stroke ring-inset transition-shadow duration-200 group-hover:ring-stroke-strong"
                />
              </div>
            </ViewTransition>

            <div className="flex items-baseline justify-between gap-3">
              {/*
                The badge is first in the markup, so a screen reader hears
                "new" before the title, and `order-last` paints it after. Its
                20px Caveat line is taller than the caption's, so `h-0` takes
                it out of the row's height, or the newest caption sits lower
                than the two beside it.
              */}
              <span className="flex min-w-0 items-baseline">
                {index === 0 && (
                  <span className="order-last flex h-0 shrink-0 self-center items-center">
                    <NewBadge placement="inline" />
                  </span>
                )}
                <span className="truncate text-body text-text-primary leading-tight">
                  {lab.title}
                </span>
              </span>

              <time
                dateTime={lab.createdAt}
                className="shrink-0 text-meta text-text-muted transition-colors duration-200 group-hover:text-text-secondary"
              >
                {formatLabDate(lab.createdAt)}
              </time>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
