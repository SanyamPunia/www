import Link from "next/link";
import { playTapSound } from "@/lib/utils";

export function renderTextWithCode(text: string) {
  const parts = text
    .split(/(\[[^\]]+\]\([^)]+\)|`[^`]+`)/g)
    .filter((part) => part && part.length > 0);
  return parts.map((part, idx) => {
    const linkMatch = part.match(/\[([^\]]+)\]\(([^)]+)\)/);
    if (linkMatch) {
      return (
        <Link
          key={`link-${linkMatch[2]}-${idx}-${part.slice(0, 10)}`}
          href={linkMatch[2]}
          target="_blank"
          className="text-text-primary hover:underline"
          onClick={playTapSound}
        >
          {linkMatch[1]}
        </Link>
      );
    }

    if (part.startsWith("`") && part.endsWith("`")) {
      const code = part.slice(1, -1);
      return (
        <code
          key={`code-${code}-${idx}-${part}`}
          className="text-xs px-1.5 py-0.5 rounded-sm bg-neutral-900 text-neutral-200"
        >
          {code}
        </code>
      );
    }

    return (
      <span key={`text-${idx}-${part.slice(0, 20)}-${part.length}`}>
        {part}
      </span>
    );
  });
}
