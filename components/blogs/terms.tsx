import type React from "react";

/**
 * A named thing and what it is, which is the shape an argument takes when it is
 * weighing three approaches rather than making one.
 *
 * **It is a component and not an element in the map**, unlike every other piece
 * of prose chrome. MDX routes markdown-generated elements through
 * `mdx-components.tsx` and leaves literal JSX alone, and markdown has no
 * definition list to generate, so a `<dl>` written in a post comes out with no
 * styling at all. Measured: a bare `<dl>` with bare `<dt>` rows.
 *
 * Markdown inside the children still parses, so a description can carry a code
 * span, a link or a footnote marker the way a paragraph can.
 *
 * The pairs are separated by space and nothing else. Hairlines between them
 * would read as a table, which is the call `/work` already makes about its own
 * rows, and the term carries the primary tone so the eye can run down the names
 * without reading the descriptions.
 *
 * **A term carries no marker and no indent**, so every line in the block starts
 * on the prose's own left edge. A bullet was tried and taken back out: it says
 * "list" where the space above each pair already says it, and it is a second
 * kind of dot on a page whose real lists have one. What separates a term from
 * the section heading above it is the heading's own medium weight and leader
 * rule, which nothing here has.
 */
export function Terms({
  children,
}: {
  children: React.ReactNode;
}): React.ReactNode {
  return <dl className="mb-5">{children}</dl>;
}

export function Term({
  name,
  children,
}: {
  name: string;
  children: React.ReactNode;
}): React.ReactNode {
  return (
    <>
      {/* a fragment rather than a wrapper, so the rows stay direct children of
          the list and `first:` still sees the first term */}
      <dt className="mt-5 text-body text-text-primary first:mt-0">{name}</dt>
      <dd className="mt-1 text-body text-text-secondary text-pretty">
        {children}
      </dd>
    </>
  );
}
