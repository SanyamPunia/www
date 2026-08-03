"use client";

import dynamic from "next/dynamic";
import type { ImplementedLab } from "@/lib/labs";

/*
 * The experiments are browser-only: they measure cursors, run springs and read
 * layout, none of which mean anything on the server. `ssr: false` keeps them
 * out of the prerender instead of rendering blank and hydrating.
 *
 * This has to be a client component. `next/dynamic` rejects `ssr: false` in a
 * server one, and the page itself stays a server component so it keeps its
 * metadata, static params and `notFound`.
 *
 * Typed against `ImplementedLab`, so listing a slug as implemented without
 * adding it here fails the build rather than rendering an empty frame.
 *
 * `file-tree-explorer` is the one slug whose directory is named differently,
 * carried over from the old repo.
 */
const EXPERIMENTS: Record<ImplementedLab, React.ComponentType> = {
  "cursor-origin-button": dynamic(
    () => import("@/components/labs/cursor-origin-button"),
    {
      ssr: false,
    },
  ),
  "phrase-transition": dynamic(
    () => import("@/components/labs/phrase-transition"),
    {
      ssr: false,
    },
  ),
  "split-to-edit": dynamic(() => import("@/components/labs/split-to-edit"), {
    ssr: false,
  }),
  "spring-image": dynamic(() => import("@/components/labs/spring-image"), {
    ssr: false,
  }),
  "discount-code-input": dynamic(
    () => import("@/components/labs/discount-code-input"),
    {
      ssr: false,
    },
  ),
  "file-tree-explorer": dynamic(() => import("@/components/labs/file-tree"), {
    ssr: false,
  }),
  "sonner-extended-toast": dynamic(
    () => import("@/components/labs/sonner-extended-toast"),
    {
      ssr: false,
    },
  ),
  "number-counter": dynamic(() => import("@/components/labs/number-counter"), {
    ssr: false,
  }),
  "multi-step-form": dynamic(
    () => import("@/components/labs/multi-step-form"),
    {
      ssr: false,
    },
  ),
  "morphing-icons": dynamic(() => import("@/components/labs/morphing-icons"), {
    ssr: false,
  }),
  "animated-dashed-border": dynamic(
    () => import("@/components/labs/animated-dashed-border"),
    {
      ssr: false,
    },
  ),
};

export function Experiment({ slug }: { slug: ImplementedLab }) {
  const Component = EXPERIMENTS[slug];
  return <Component />;
}
