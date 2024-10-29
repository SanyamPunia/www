import React, { ComponentPropsWithoutRef } from "react";
import { Link } from "next-view-transitions";
import type { MDXComponents } from "mdx/types";
import { highlight } from "sugar-high";
import Image, { ImageProps } from "next/image";
import { ChevronLeftIcon } from "@radix-ui/react-icons";

type HeadingProps = ComponentPropsWithoutRef<"h1">;
type ParagraphProps = ComponentPropsWithoutRef<"p">;
type ListProps = ComponentPropsWithoutRef<"ul">;
type ListItemProps = ComponentPropsWithoutRef<"li">;
type AnchorProps = ComponentPropsWithoutRef<"a">;
type BlockquoteProps = ComponentPropsWithoutRef<"blockquote">;

const components: MDXComponents = {
  h1: (props: HeadingProps) => (
    <h1
      style={{
        margin: "2rem 0",
      }}
      {...props}
    />
  ),
  h2: (props: HeadingProps) => (
    <h2
      style={{
        marginTop: "1.3rem",
        marginBottom: "1.3rem",
      }}
      className="font-medium text-sm"
      {...props}
    />
  ),
  p: (props: ParagraphProps) => (
    <p
      style={{
        marginTop: "1.3rem",
        marginBottom: "1.3rem",
      }}
      className="text-sm text-muted-foreground"
      {...props}
    />
  ),
  ol: (props: ListProps) => (
    <ol
      className="text-gray-800 list-decimal pl-5 space-y-2 text-sm"
      {...props}
    />
  ),
  ul: (props: ListProps) => (
    <ul className="text-gray-800 list-disc pl-5 space-y-1 text-sm" {...props} />
  ),
  li: (props: ListItemProps) => <li className="pl-1 text-sm" {...props} />,
  em: (props: ComponentPropsWithoutRef<"em">) => (
    <code
      className="font-medium"
      style={{
        borderStyle: "solid",
        border: "1px solid rgb(156 163 175 / 0.15)",
        background: "hsl(var(--border))",
        padding: "1px 3px",
        borderRadius: "calc(var(--radius) - 2px)",
        textWrap: "nowrap",
      }}
      {...props}
    />
  ),
  strong: (props: ComponentPropsWithoutRef<"strong">) => (
    <strong className="font-medium" {...props} />
  ),
  a: ({ href, children, ...props }: AnchorProps) => {
    const className = "text-xs text-white";
    if (href?.startsWith("/")) {
      return (
        <Link
          href={href}
          className={`${className} flex items-center -ml-1`}
          {...props}
        >
          <ChevronLeftIcon width={13} height={13} />
          {children}
        </Link>
      );
    }
    if (href?.startsWith("#")) {
      return (
        <a href={href} className={className} {...props}>
          {children}
        </a>
      );
    }

    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={className}
        {...props}
      >
        {children}
      </a>
    );
  },
  code: ({ children, ...props }: ComponentPropsWithoutRef<"code">) => {
    const codeHTML = highlight(children as string);
    return <code dangerouslySetInnerHTML={{ __html: codeHTML }} {...props} />;
  },
  Table: ({ data }: { data: { headers: string[]; rows: string[][] } }) => (
    <table>
      <thead>
        <tr>
          {data.headers.map((header, index) => (
            <th key={index}>{header}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {data.rows.map((row, index) => (
          <tr key={index}>
            {row.map((cell, cellIndex) => (
              <td key={cellIndex}>{cell}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  ),
  blockquote: (props: BlockquoteProps) => (
    <blockquote
      className="ml-[0.075em] border-l-3 border-gray-300 pl-4 text-gray-700"
      {...props}
    />
  ),
  img: (props) => (
    <Image
      sizes="100vw"
      style={{
        width: "100%",
        height: "auto",
        marginTop: "1rem",
        marginBottom: "1rem",
        borderRadius: "0.3rem",
      }}
      {...(props as ImageProps)}
      width={1000}
      height={1000}
      draggable="false"
      className="select-none"
    />
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
