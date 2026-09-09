import Link from "next/link";

/**
 * A quiet row of links to other pages on the site. Chrome, so it sits at
 * `text-meta` and muted, the same standing `BackLink` has.
 *
 * Two callers, which is why the treatment is here rather than typed out twice:
 * the foot of a static page, where it is that page's only navigation, and the
 * home page's footer, where it carries the three pages the home copy does not
 * link to.
 *
 * The rule is a positioned `::after` on a span rather than `text-decoration`,
 * so it can carry rounded caps, and it is on the span rather than the anchor so
 * that a link's own box is what takes the focus ring. Same shape as `BackLink`.
 */
export function PageNav({
  items,
  label,
}: {
  items: { href: string; title: string }[];
  /** the nav's accessible name, since there is more than one on the site */
  label: string;
}) {
  return (
    <nav aria-label={label}>
      <ul className="flex flex-wrap items-center gap-x-4 gap-y-2 text-meta">
        {items.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              className="group cursor-pointer text-text-muted transition-colors duration-200 hover:text-text-primary focus-visible:rounded-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-primary/15 focus-visible:ring-offset-2"
            >
              <span className="relative after:absolute after:inset-x-0 after:bottom-[-0.1em] after:h-[0.14em] after:rounded-full after:bg-stroke-strong after:transition-colors after:duration-200 group-hover:after:bg-text-primary">
                {item.title}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
