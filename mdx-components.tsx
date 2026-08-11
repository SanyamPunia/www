import type { MDXComponents } from "mdx/types";
import type { ComponentPropsWithoutRef } from "react";
import { HeadingAnchor } from "@/components/blogs/heading-anchor";
import { CodeBlock } from "@/components/ui/code-block";
import { InlineLink } from "@/components/ui/inline-link";

/**
 * The MDX element map. Every post's prose renders through this, so a heading
 * or a paragraph looks the same in all of them.
 *
 * Everything sits on the project's own type scale and tone tokens. There are
 * no Tailwind default sizes here, they are off the 0.8 scale and render out of
 * proportion with the rest of the page.
 */
/**
 * A section heading, anchored by a leader rule running out to the margin.
 *
 * The type scale has nothing between the page title and body copy, and nothing
 * on this site is bold, so a heading cannot separate itself from prose by size
 * or weight. It separates by space and rule instead. The rule is the same
 * device the `/work` and `/blogs` rows use, so structure reads consistently
 * across the site rather than being invented for prose.
 */
function Section({ children, ...props }: ComponentPropsWithoutRef<"h2">) {
  return (
    // the spread carries `rehype-slug`'s id through, which is the whole anchor
    // target. `scroll-mt` keeps a heading off the very top edge when one is
    // jumped to, and sits under the rail's own reading line so the section the
    // reader just clicked marks itself active on arrival.
    <h2
      {...props}
      className="group mt-12 mb-4 flex scroll-mt-16 items-center gap-3 text-body font-medium text-text-primary first:mt-0"
    >
      <span className="min-w-0">{children}</span>
      {/* before the rule, not after it: the rule runs to the margin and a
          control past its end reads as belonging to the next thing down. The
          anchor holds its box whether or not it is visible, so the rule starts
          at the same place either way. */}
      {props.id ? <HeadingAnchor id={props.id} /> : null}
      <span aria-hidden="true" className="h-px min-w-4 flex-1 bg-stroke-soft" />
    </h2>
  );
}

/** A subsection. Subordinate by the absence of the section's rule, not by size. */
function Subsection({ children, ...props }: ComponentPropsWithoutRef<"h3">) {
  return (
    <h3
      {...props}
      className="group mt-8 mb-2 flex scroll-mt-16 items-center gap-3 text-body font-medium text-text-primary"
    >
      <span className="min-w-0">{children}</span>
      {props.id ? <HeadingAnchor id={props.id} /> : null}
    </h3>
  );
}

/** Inline code. Shared by `code` and by `em`, see the note at its call site. */
function Code(props: ComponentPropsWithoutRef<"code">) {
  return (
    <code
      className="rounded-xs bg-fill px-1 py-0.5 font-mono text-[0.9em] text-text-primary"
      {...props}
    />
  );
}

export function useMDXComponents(components: MDXComponents): MDXComponents {
  return {
    // the shell renders the post title, so an h1 in the body would be a
    // second one. Content headings start at h2 and h1 is folded into it.
    h1: Section,
    h2: Section,
    h3: Subsection,
    p: (props: ComponentPropsWithoutRef<"p">) => (
      <p
        className="mb-4 text-body text-text-secondary text-pretty"
        {...props}
      />
    ),
    a: ({ href = "", children }: ComponentPropsWithoutRef<"a">) => (
      <InlineLink href={href} external={href.startsWith("http")}>
        {children}
      </InlineLink>
    ),
    ul: (props: ComponentPropsWithoutRef<"ul">) => (
      <ul className="mb-4 flex flex-col gap-1.5" {...props} />
    ),
    ol: (props: ComponentPropsWithoutRef<"ol">) => (
      <ol className="mb-4 flex list-decimal flex-col gap-1.5 pl-4" {...props} />
    ),
    li: (props: ComponentPropsWithoutRef<"li">) => (
      // the bullet is a `before:` dot, not `list-disc`. A flex parent
      // blockifies its children, which kills the marker outright.
      <li
        className="relative pl-4 text-body text-text-secondary before:absolute before:top-[0.62em] before:left-0 before:size-1 before:rounded-full before:bg-stroke-strong"
        {...props}
      />
    ),
    blockquote: (props: ComponentPropsWithoutRef<"blockquote">) => (
      <blockquote
        className="my-6 border-stroke border-l-2 pl-4 text-body text-text-muted"
        {...props}
      />
    ),
    hr: () => <hr className="my-10 border-stroke" />,
    strong: (props: ComponentPropsWithoutRef<"strong">) => (
      // no bold anywhere on this site, emphasis is a tone step
      <span className="text-text-primary" {...props} />
    ),
    /*
     * `_like this_` renders as inline code, not italics. That is the
     * convention every post is written in, all 33 uses are identifiers,
     * filenames or API names, and the dark build mapped `em` the same way.
     *
     * It also fixes casing. `code` is exempt from the lowercase transform, so
     * as emphasis `_useAnimatedText_` rendered "useanimatedtext".
     */
    em: (props: ComponentPropsWithoutRef<"em">) => <Code {...props} />,
    code: (props: ComponentPropsWithoutRef<"code">) => <Code {...props} />,
    pre: ({ children }: ComponentPropsWithoutRef<"pre">) => {
      // MDX nests the fence's <code> inside <pre>. CodeBlock renders its own
      // <pre>, so unwrap rather than nesting two.
      const child = children as {
        props?: { children?: string };
      };
      return <CodeBlock>{String(child?.props?.children ?? "")}</CodeBlock>;
    },
    img: (props: ComponentPropsWithoutRef<"img">) => (
      // biome-ignore lint/performance/noImgElement: MDX hands over a bare src string with no intrinsic dimensions, which next/image requires
      <img
        {...props}
        alt={props.alt ?? ""}
        draggable={false}
        className="my-6 w-full select-none rounded-lg ring-1 ring-stroke ring-inset"
      />
    ),
    ...components,
  };
}
