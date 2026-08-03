import type React from "react";

const TOKEN = /(\[[^\]]+\]\([^)]+\)|`[^`]+`)/g;
const LINK = /^\[([^\]]+)\]\(([^)]+)\)$/;

const LINK_CLASS =
  "text-text-primary underline decoration-stroke-strong underline-offset-[0.13em] transition-colors duration-200 hover:decoration-text-primary";

/**
 * Renders the inline markup carried in `lib/labs.ts` descriptions: `backticks` for
 * code spans and [text](url) for links. Deliberately not a markdown parser,
 * the source only ever uses these two forms.
 *
 * Keyed by character offset rather than array position, which is a real
 * identity inside the string and survives the token list changing shape.
 *
 * Shared, so a lab description and a blog paragraph render code and links
 * identically.
 */
export function RichText({ text }: { text: string }): React.ReactNode {
  let offset = 0;
  const tokens = text
    .split(TOKEN)
    .filter(Boolean)
    .map((part) => {
      const key = `${offset}:${part}`;
      offset += part.length;
      return { key, part };
    });

  return tokens.map(({ key, part }) => {
    const link = LINK.exec(part);
    if (link) {
      return (
        <a
          key={key}
          href={link[2]}
          target="_blank"
          rel="noopener noreferrer"
          className={LINK_CLASS}
        >
          {link[1]}
        </a>
      );
    }

    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code
          key={key}
          className="rounded-xs bg-fill px-1 py-0.5 font-mono text-[0.9em] text-text-primary"
        >
          {part.slice(1, -1)}
        </code>
      );
    }

    return <span key={key}>{part}</span>;
  });
}
