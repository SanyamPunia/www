import { LabIndex } from "@/components/lab/lab-index";
import { isImplemented, labsRegistry } from "@/lib/labs";

/**
 * Links out of an experiment to the others, for the same reason `MorePosts`
 * exists: every lab page was a leaf reachable only from its index.
 *
 * Renders through `LabIndex`, the same component the index page uses, so an
 * experiment row looks identical wherever it appears.
 *
 * Filtered on `isImplemented`, so this can never link to a registry entry whose
 * component has not landed. Those routes 404, and linking one would point a
 * crawler at a dead end from every other lab page.
 */
const LIMIT = 3;

export function MoreLabs({ currentSlug }: { currentSlug: string }) {
  const labs = labsRegistry
    .filter((lab) => lab.slug !== currentSlug && isImplemented(lab.slug))
    // the registry reads oldest first, the lists show newest
    .reverse()
    .slice(0, LIMIT);

  if (labs.length === 0) return null;

  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-meta text-text-muted">More experiments</h2>
      <LabIndex labs={labs} />
    </section>
  );
}
