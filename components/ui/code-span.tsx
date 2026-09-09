import type { ComponentPropsWithoutRef } from "react";

/**
 * Inline code in body copy, and the one treatment for it.
 *
 * Four callers: a post's prose and its `_emphasis_` through
 * `mdx-components.tsx`, a lab description through `RichText`, a static page's
 * paragraph through its `{ code }` segment, and the 404's note about the `.md`
 * convention. The class string was typed out at the first two before there was
 * a third, which is what a shared primitive is for.
 *
 * `text-[0.9em]` rather than a scale token, so it tracks whatever type it sits
 * in. `code` is exempt from the lowercase transform in `globals.css`, so it also
 * keeps its own casing, which is why `em` maps here.
 */
export function CodeSpan(props: ComponentPropsWithoutRef<"code">) {
  return (
    <code
      className="rounded-xs bg-fill px-1 py-0.5 font-mono text-[0.9em] text-text-primary"
      {...props}
    />
  );
}
