import Image, { type ImageProps } from "next/image";
import type { ComponentPropsWithoutRef, ComponentType } from "react";
import { highlight } from "sugar-high";
import CodeBlock from "@/components/ui/code-block";
import { MDXLink } from "@/components/ui/mdx-link";
import BackButton from "@/components/ui/back-button";
import type { BackButtonProps } from "@/components/ui/back-button";
import { BlogLikeButton } from "@/components/blogs/blog-like-button";

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
  a: (props: AnchorProps) => <MDXLink {...props} />,
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
      className="border-l-4 border-neutral-700 pl-4 py-2 my-6 bg-neutral-900/30 rounded-r-sm *:mb-0"
      {...props}
    />
  ),
  hr: (props: ComponentPropsWithoutRef<"hr">) => (
    <hr className="my-8 border-neutral-800" {...props} />
  ),
  BlogLikeButton: () => <BlogLikeButton />,
  BackButton: (props: Record<string, unknown>) => {
    const backButtonProps = props as unknown as BackButtonProps;
    return <BackButton {...backButtonProps} />;
  },
};

export function useMDXComponents(
  otherComponents: MDXComponents
): MDXComponents {
  return {
    ...otherComponents,
    ...components,
  };
}
