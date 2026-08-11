import { type ClassValue, clsx } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/**
 * The named type scale from `app/globals.css`, declared so `cn()` can tell a
 * size from a colour.
 *
 * tailwind-merge classifies `text-*` by reading the value: a t-shirt size is a
 * font size and anything else is a colour. This scale is named rather than
 * sized, so `text-meta` was landing in the colour group beside
 * `text-text-primary` and losing, and `cn("text-meta", "text-text-primary")`
 * returned the colour alone.
 *
 * No error, no warning, the element just inherited whatever size sat above it.
 * That is why it survived: it only bites when a role and a tone meet inside one
 * `cn()` call, which is rare enough to look like a design decision rather than
 * a dropped class. It had already silently unsized both dropdown menu rows.
 *
 * Declaring the group fixes every call site at once, which is the only scale at
 * which this is fixable, since the failure is invisible at each one.
 *
 * **A new role in `globals.css` needs a new entry here.**
 */
const TYPE_SCALE = ["lead", "body", "action", "meta"];

const twMerge = extendTailwindMerge({
  extend: { classGroups: { "font-size": [{ text: TYPE_SCALE }] } },
});

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
