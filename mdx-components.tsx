import type { MDXComponents } from "mdx/types";
import type { ComponentPropsWithoutRef } from "react";
import { FootnoteBackref, FootnoteRef } from "@/components/blogs/footnote";
import { HeadingAnchor } from "@/components/blogs/heading-anchor";
import { CodeBlock } from "@/components/ui/code-block";
import { CodeSpan } from "@/components/ui/code-span";
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
  /*
   * The footnotes block writes its own heading, and `remark-gfm` marks it
   * `sr-only`. It is the one heading in a post that is not a section of the
   * argument, so it takes the quiet section label the rest of the site uses
   * rather than the leader rule, and it is visible: a reader who has just
   * followed a marker down here should be able to see what they landed in.
   */
  if (props.id === "footnote-label") {
    return (
      <h2 {...props} className="mb-3 text-meta text-text-muted">
        {children}
      </h2>
    );
  }

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

/**
 * The notes at the foot of a post.
 *
 * A note is how a measurement, a citation or a piece of trivia leaves the
 * running line without being thrown away. The alternative is a parenthesis,
 * and a paragraph carrying two of those stops being a paragraph.
 *
 * **It restyles its own list rather than the map doing it.** The shared `ol`
 * is a flex column, which blockifies its children and kills the marker
 * outright, and that is correct everywhere except here: a footnote is answering
 * a numbered marker further up the page, so the number is the whole point of
 * the row. One `block` on the list gives it back.
 *
 * **The rule above it is dashed**, where `hr` between sections is solid. A solid
 * rule divides two pieces of content and these notes are not a piece of content:
 * they are the apparatus under one. `stroke-strong` rather than `stroke`, since
 * a dashed line at `stroke`'s lightness is close to not being there, and it is
 * the tone every other dashed line on the site uses.
 */
function Footnotes(props: ComponentPropsWithoutRef<"section">) {
  return (
    <section
      {...props}
      className="mt-12 border-stroke-strong border-t border-dashed pt-6 [&_li]:mb-2 [&_li]:scroll-mt-16 [&_li]:pl-1 [&_li]:text-meta [&_li]:text-text-muted [&_li]:marker:text-text-muted [&_li]:before:hidden [&_li>p]:mb-0 [&_li>p]:inline [&_li>p]:text-meta [&_li>p]:text-text-muted [&>ol]:mb-0 [&>ol]:block [&>ol]:pl-5"
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
      /*
       * `mb-5`, which is a little over two thirds of a line.
       *
       * The register these posts are written in puts one idea in a paragraph
       * and stops, so paragraphs are often a sentence long and the gap between
       * two of them is doing the work a longer block would do with indentation.
       * At `mb-4` that gap was 0.55 of a line and a run of short paragraphs read
       * as one broken column rather than as a set of beats.
       */
      <p
        className="mb-5 text-body text-text-secondary text-pretty"
        {...props}
      />
    ),
    a: ({ href = "", children, ...props }: ComponentPropsWithoutRef<"a">) => {
      /*
       * Three kinds of link arrive here and only one of them is a link in prose.
       *
       * `remark-gfm` writes a footnote's marker and its way back as plain
       * anchors carrying `data-footnote-ref` and `data-footnote-backref`, and
       * both would otherwise come out as an `InlineLink`: a superscript numeral
       * wearing a sweeping underline, and a `↩︎` character wearing one too.
       */
      const note = props as {
        "data-footnote-ref"?: unknown;
        "data-footnote-backref"?: unknown;
      };

      if (note["data-footnote-backref"] !== undefined) {
        return <FootnoteBackref href={href} {...props} />;
      }

      if (note["data-footnote-ref"] !== undefined) {
        return (
          <FootnoteRef href={href} {...props}>
            {children}
          </FootnoteRef>
        );
      }

      return (
        <InlineLink href={href} external={href.startsWith("http")}>
          {children}
        </InlineLink>
      );
    },
    /*
     * The plugin wraps its marker in a `sup`, and the browser's own rules for
     * one are `font-size: smaller` and `vertical-align: super`. Both are undone
     * here. The size goes to `FootnoteRef`, which is the element that can also
     * carry the hover and the focus ring, and the rise stays on this one.
     *
     * **The rise has to be set at body size, which is why it is not on the
     * marker.** `vertical-align: super` raised the numeral's baseline 11px above
     * the line's own on a 14.4px line, which is level with the cap height of the
     * line above, and it read as a digit that had come loose. An `em` written on
     * the marker cannot replace it either, since the marker is set at 0.7em and
     * its own `em` is that small: 0.3em there is 3px, where the same number here
     * is the 4.3px a footnote actually wants. `relative` and never a margin, so
     * the shift stays out of the line box and the prose keeps its leading.
     *
     * `text-[1em]` and never `text-[0]`. The marker's size resolves against this
     * element, so zeroing it here renders the numeral at no size at all.
     *
     * `ml-[0.12em]` is a thin space, 1.7px at body size, and it belongs here for
     * the same reason the rise does. Hard against the word the numeral reads as
     * a letter of it, and a full word space reads as a numeral that has come
     * loose. A margin rather than padding, so the focus ring still hugs the
     * digit.
     */
    sup: (props: ComponentPropsWithoutRef<"sup">) => (
      <sup
        className="-top-[0.3em] relative ml-[0.12em] align-baseline text-[1em]"
        {...props}
      />
    ),
    section: Footnotes,
    ul: (props: ComponentPropsWithoutRef<"ul">) => (
      <ul className="mb-5 flex flex-col gap-1.5" {...props} />
    ),
    ol: (props: ComponentPropsWithoutRef<"ol">) => (
      <ol className="mb-5 flex list-decimal flex-col gap-1.5 pl-4" {...props} />
    ),
    li: (props: ComponentPropsWithoutRef<"li">) => (
      // the bullet is a `before:` dot, not `list-disc`. A flex parent
      // blockifies its children, which kills the marker outright.
      <li
        className="relative pl-4 text-body text-text-secondary before:absolute before:top-[0.62em] before:left-0 before:size-1 before:rounded-full before:bg-stroke-strong"
        {...props}
      />
    ),
    /*
     * A pulled line, in the primary tone rather than the muted one.
     *
     * A post quotes itself here far more often than it quotes anyone else: the
     * one sentence the argument turns on, lifted out of the paragraph that
     * earned it. Set quieter than the prose around it, that sentence reads as
     * an aside, which is the opposite of what pulling it out was for.
     */
    blockquote: (props: ComponentPropsWithoutRef<"blockquote">) => (
      <blockquote
        className="my-6 border-stroke-strong border-l-2 pl-4 text-body text-text-primary text-pretty"
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
    em: (props: ComponentPropsWithoutRef<"em">) => <CodeSpan {...props} />,
    code: (props: ComponentPropsWithoutRef<"code">) => <CodeSpan {...props} />,
    pre: ({ children }: ComponentPropsWithoutRef<"pre">) => {
      // MDX nests the fence's <code> inside <pre>. CodeBlock renders its own
      // <pre>, so unwrap rather than nesting two.
      const child = children as {
        props?: { children?: string };
      };
      return <CodeBlock>{String(child?.props?.children ?? "")}</CodeBlock>;
    },
    /*
     * Tables, which arrived with `remark-gfm` rather than being asked for.
     *
     * Pipe syntax used to render as literal pipes, and the note in `CLAUDE.md`
     * said adding the plugin was worth doing deliberately rather than smuggling
     * in behind one table. Footnotes are what made it deliberate, and tables
     * came along in the same plugin: styling them is the cheaper half of that,
     * since the alternative is a construct that silently parses into unstyled
     * markup the first time someone writes one.
     */
    table: (props: ComponentPropsWithoutRef<"table">) => (
      <div className="-mx-4 mb-5 overflow-x-auto px-4">
        <table className="w-full border-collapse text-body" {...props} />
      </div>
    ),
    /*
     * The header is `text-body` like the rows, and the muted tone is the only
     * thing separating them. At `text-meta` it was 12px against the rows' 14.4
     * and the table read as two different type sizes stacked rather than as one
     * block of content on the page's own scale.
     */
    th: (props: ComponentPropsWithoutRef<"th">) => (
      <th
        className="border-stroke border-b py-2 pr-4 text-left font-normal text-body text-text-muted last:pr-0"
        {...props}
      />
    ),
    /*
     * No `tabular-nums`, which was here as a default for figures and had to go.
     *
     * Inter's tabular figures are wider than its proportional ones, so a column
     * of them reads as a size up from the prose around it even though it is not
     * one. Measured against the same string in a paragraph: the body text is
     * 160.77px in both to two decimals, and `1512ms` goes 49.92px to 55.27, 11%
     * wider, with `-7.14°` 13% wider. The table looked bigger and only the
     * digits were.
     *
     * A column that has to align down the page can ask for it per post. This
     * one is three short columns and never needed it.
     */
    td: (props: ComponentPropsWithoutRef<"td">) => (
      <td
        className="border-stroke-soft border-b py-2 pr-4 align-top text-text-secondary last:pr-0"
        {...props}
      />
    ),
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
