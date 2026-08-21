import Link from "next/link";
import { NewBadge } from "@/components/ui/new-badge";
import { formatLabDate, type LabMetadata } from "@/lib/labs";

/**
 * The experiment list, newest first.
 *
 * Rows, not preview cards. The old index showed a screenshot per entry, but
 * every one of those was a still of the dark build, so they were both wrong on
 * a white page and wrong about what the components now look like. The detail
 * page renders the live thing, which is a better preview than any image.
 */
export function LabIndex({ labs }: { labs: LabMetadata[] }) {
  return (
    <ul className="-mx-4 flex flex-col gap-1">
      {labs.map((lab, index) => (
        <li key={lab.slug}>
          <Link
            href={`/lab/${lab.slug}`}
            className="group relative flex items-center gap-3 rounded-full px-4 py-2 transition-colors duration-200 hover:bg-fill active:bg-fill-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-primary/15"
          >
            {/* first child, so the badge joins the link's accessible name and a
                screen reader hears "new" before the title rather than after the
                date. The list is sorted newest first, so index 0 is the entry. */}
            {index === 0 && <NewBadge />}

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
