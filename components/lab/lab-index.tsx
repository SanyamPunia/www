import Link from "next/link";
import { formatLabDate, type LabMetadata } from "@/lib/labs";

/**
 * A list of experiments as rows, newest first.
 *
 * The lab index itself is `LabGrid` now. This is the short list `MoreLabs`
 * renders at the foot of every lab page, where three rows of text sit under
 * the prose better than three playing clips would.
 */
export function LabIndex({ labs }: { labs: LabMetadata[] }) {
  return (
    <ul className="-mx-4 flex flex-col gap-1">
      {labs.map((lab) => (
        <li key={lab.slug}>
          <Link
            href={`/lab/${lab.slug}`}
            className="group relative flex items-center gap-3 rounded-full px-4 py-2 transition-colors duration-200 hover:bg-fill active:bg-fill-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-primary/15"
          >
            <span className="min-w-0 shrink truncate text-body leading-tight text-text-primary">
              {lab.title}
            </span>

            <span
              aria-hidden="true"
              className="h-px min-w-4 flex-1 bg-stroke-soft transition-colors duration-200 group-hover:bg-stroke"
            />

            <time
              dateTime={lab.createdAt}
              className="shrink-0 text-meta text-text-muted"
            >
              {formatLabDate(lab.createdAt)}
            </time>
          </Link>
        </li>
      ))}
    </ul>
  );
}
