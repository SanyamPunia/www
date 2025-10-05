import Image, { type ImageProps } from "next/image";
import Link from "next/link";
import type { ComponentPropsWithoutRef, ComponentType } from "react";
import { highlight } from "sugar-high";
import CodeBlock from "@/components/ui/code-block";

type HeadingProps = ComponentPropsWithoutRef<"h1">;
type ParagraphProps = ComponentPropsWithoutRef<"p">;
type AnchorProps = ComponentPropsWithoutRef<"a">;
type BlockquoteProps = ComponentPropsWithoutRef<"blockquote">;

type MDXComponents = Record<string, ComponentType<Record<string, unknown>>>;

const components: MDXComponents = {
  h1: (props: HeadingProps) => (
    <h1
      className="text-xl font-medium text-text-primary mb-6 mt-8 first:mt-0"
      {...props}
    />
  ),
  h2: (props: HeadingProps) => (
    <h2
      className="text-lg font-medium text-text-primary mb-4 mt-6"
      {...props}
    />
  ),
  h3: (props: HeadingProps) => (
    <h3
      className="text-base font-medium text-text-primary mb-3 mt-5"
      {...props}
    />
  ),
  p: (props: ParagraphProps) => (
    <p
      className="text-sm text-text-secondary leading-relaxed mb-4"
      {...props}
    />
  ),
  ol: (props: ComponentPropsWithoutRef<"ol">) => (
    <ol
      className="text-sm text-text-secondary pl-6 space-y-2 my-4 list-decimal"
      {...props}
    />
  ),
  ul: (props: ComponentPropsWithoutRef<"ul">) => (
    <ul
      className="text-sm text-text-secondary pl-6 space-y-2 my-4 list-disc"
      {...props}
    />
  ),
  li: (props: ComponentPropsWithoutRef<"li">) => (
    <li className="text-sm text-text-secondary leading-relaxed" {...props} />
  ),
  em: (props: ComponentPropsWithoutRef<"em">) => (
    <code
      className="px-1.5 py-0.5 rounded-sm text-xs bg-neutral-900 text-neutral-200"
      {...props}
    />
  ),
  strong: (props: ComponentPropsWithoutRef<"strong">) => (
    <strong className="font-medium text-text-primary" {...props} />
  ),
  a: ({ href, children, ...props }: AnchorProps) => {
    const baseClassName =
      "text-sm text-text-primary hover:text-text-secondary transition-colors duration-200 underline decoration-neutral-600 hover:decoration-neutral-400";

    if (href?.startsWith("/")) {
      return (
        <Link
          href={href}
          className={`${baseClassName} inline-flex items-center gap-1`}
          {...(props as Record<string, unknown>)}
        >
          {children}
        </Link>
      );
    }
    if (href?.startsWith("#")) {
      return (
        <a href={href} className={baseClassName} {...props}>
          {children}
        </a>
      );
    }
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={`${baseClassName} inline-flex items-center gap-1`}
        {...props}
      >
        {children}
        <svg
          className="w-3 h-3 transition-transform duration-200 hover:translate-x-0.5 hover:-translate-y-0.5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-label="External link"
          role="img"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
          />
        </svg>
      </a>
    );
  },
  code: ({ children, ...props }: ComponentPropsWithoutRef<"code">) => {
    const codeHTML = highlight(String(children ?? ""));
    return (
      <code
        dangerouslySetInnerHTML={{ __html: codeHTML }}
        className="text-xs px-1.5 py-0.5 rounded-sm bg-neutral-900 text-neutral-200"
        {...props}
      />
    );
  },
  pre: ({ children }: ComponentPropsWithoutRef<"pre">) => {
    const codeElement = children as React.ReactElement;
    const codeContent =
      (codeElement?.props as Record<string, unknown>)?.children || "";
    return <CodeBlock>{String(codeContent)}</CodeBlock>;
  },
  img: (props) => (
    <Image
      sizes="100vw"
      style={{
        width: "100%",
        height: "auto",
        marginTop: "1.5rem",
        marginBottom: "1.5rem",
        borderRadius: "0.375rem",
      }}
      {...(props as ImageProps)}
      width={1200}
      height={800}
      draggable="false"
      className="select-none border border-neutral-800"
    />
  ),
  blockquote: (props: BlockquoteProps) => (
    <blockquote
      className="border-l-4 border-neutral-700 pl-4 py-2 my-6 bg-neutral-900/30 rounded-r-sm"
      {...props}
    />
  ),
  hr: (props: ComponentPropsWithoutRef<"hr">) => (
    <hr className="my-8 border-neutral-800" {...props} />
  ),
};

export function useMDXComponents(
  otherComponents: MDXComponents
): MDXComponents {
  return {
    ...otherComponents,
    ...components,
  };
}
