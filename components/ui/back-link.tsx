import { ArrowLeftIcon } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";

/**
 * The one back affordance. Chrome, so it sits at `text-meta` and muted.
 *
 * The rounded-cap rule goes on a span rather than the anchor, or it would run
 * under the arrow as well as the word.
 */
export function BackLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="group inline-flex w-fit items-center gap-1.5 text-meta text-text-muted transition-colors duration-200 hover:text-text-primary focus-visible:rounded-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-primary/15"
    >
      {/* the glyph is inset inside its own viewBox, so the icon's box lines up
          with the column while the visible stroke sits a couple of pixels
          right of the text below it. The negative margin pulls the optical
          edge flush, not the box. */}
      <ArrowLeftIcon
        aria-hidden="true"
        className="-ml-0.5 size-3.75 shrink-0 transition-transform duration-200 group-hover:-translate-x-0.5"
      />
      <span className="relative after:absolute after:inset-x-0 after:bottom-[-0.1em] after:h-[0.14em] after:rounded-full after:bg-stroke-strong after:transition-colors after:duration-200 group-hover:after:bg-text-primary">
        {children}
      </span>
    </Link>
  );
}
