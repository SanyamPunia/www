import Link from "next/link";
import { formatLabDate, isImplemented, labsRegistry } from "@/lib/labs";

/**
 * Links out of an experiment to the others, for the same reason `MorePosts`
 * exists: every lab page was a leaf reachable only from its index.
 *
 * Filtered on `isImplemented`, so this can never link to a registry entry whose
 * component has not landed. Those routes 404, and linking one would be pointing
 * a crawler at a dead end from every other lab page.
 */
const LIMIT = 3;

export function MoreLabs({ currentSlug }: { currentSlug: string }) {
  const labs = labsRegistry
    .filter((lab) => lab.slug !== currentSlug && isImplemented(lab.slug))
    .reverse()
    .slice(0, LIMIT);

  if (labs.length === 0) return null;

  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-meta text-text-muted">More experiments</h2>

      <ul className="-mx-3 flex flex-col">
        {labs.map((lab) => (
          <li key={lab.slug}>
            <Link
              href={`/lab/${lab.slug}`}
              className="group flex flex-col gap-0.5 rounded-md px-3 py-2 transition-colors duration-200 hover:bg-fill focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-primary/15"
            >
              <span className="text-body text-text-secondary transition-colors duration-200 group-hover:text-text-primary">
                {lab.title}
              </span>
              <time
                className="text-meta text-text-muted"
                dateTime={lab.createdAt}
              >
                {formatLabDate(lab.createdAt)}
              </time>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
