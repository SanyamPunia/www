"use client";

import { useRef } from "react";

/**
 * The fill expands from wherever the cursor is, rather than from the centre.
 *
 * No local stylesheet. The original shipped one for the `::before`, but
 * Tailwind covers all of it: the pseudo-element, a `transform-origin` read
 * from custom properties the pointer handler writes, and the asymmetric
 * timing.
 *
 * That timing is the detail worth keeping. On the way in, both scale and
 * opacity run over 300ms. On the way out the scale is cut to 0s and delayed
 * until the fade finishes, so the fill disappears rather than visibly
 * shrinking back toward the cursor.
 */
export default function CursorOriginButton() {
  const ref = useRef<HTMLButtonElement>(null);

  const trackCursor = (event: React.MouseEvent<HTMLButtonElement>) => {
    const button = ref.current;
    if (!button) return;

    const rect = button.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;

    // push the origin slightly further out than the cursor, so the fill
    // still reaches the near edge when entering close to a corner
    const buffer = 0.2;
    const clamp = (v: number) => Math.max(0, Math.min(100, v));

    button.style.setProperty("--cursor-x", `${clamp(x + (x - 50) * buffer)}%`);
    button.style.setProperty("--cursor-y", `${clamp(y + (y - 50) * buffer)}%`);
  };

  return (
    <div className="flex min-h-64 w-full items-center justify-center">
      <button
        type="button"
        ref={ref}
        onMouseMove={trackCursor}
        className={[
          "group relative isolate h-11 cursor-pointer overflow-hidden rounded-md px-7",
          // no resting border. An outline boxes the fill in and you watch it
          // arrive at an edge instead of just spreading, which is most of why
          // this reads worse than the original.
          "font-mono text-action text-text-primary",
          // one transition-property declaration, or the second overrides the
          // first and whichever loses simply snaps
          "transition-[letter-spacing,box-shadow] duration-300",
          "hover:tracking-wide",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-primary/15",
          // the fill. `fill-hover` reads on white without the near-black this
          // used to invert to, which forced the label to pin `#fff`
          "before:absolute before:inset-0 before:-z-10 before:rounded-md before:bg-fill-hover",
          "before:scale-0 before:opacity-0",
          "before:origin-[var(--cursor-x,50%)_var(--cursor-y,50%)]",
          /*
           * `scale`, not `transform`. Tailwind v4's `scale-*` sets the
           * standalone `scale` property rather than `transform: scale()`, so a
           * transition on `transform` never touches it: the fill jumped to full
           * size instantly and only the opacity faded, which read as the button
           * simply turning grey with no sweep at all. The original hand-wrote
           * `transform: scale(0)` in CSS, which is why it did not hit this.
           *
           * `transform-origin` governs the standalone `scale` property too, so
           * the cursor origin still applies.
           */
          "before:transition-[scale,opacity]",
          "before:[transition-duration:0s,220ms] before:[transition-delay:220ms,0s]",
          // exactly 1, never past it. `--cursor-x/y` updates on every mousemove
          // and drives `transform-origin`, which at scale 1 is a no-op. Any
          // larger and the fill jumps around as the pointer moves.
          "hover:before:scale-100 hover:before:opacity-100",
          "hover:before:[transition-duration:300ms,300ms] hover:before:[transition-delay:0s,0s]",
        ].join(" ")}
      >
        Next.js
      </button>
    </div>
  );
}
