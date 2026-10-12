import type React from "react";

/**
 * Medium's mark, drawn here since svgl has none. It is three ellipses, so it is
 * drawn rather than copied. Unlike the other brand marks it fills in
 * `currentColor`, so the footer can tint it on hover.
 */
export function Medium(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      // decorative by default, call sites label the link that wraps it
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      <path
        fill="currentColor"
        d="M1.5 12A5.4 5.55 0 1 1 12.3 12A5.4 5.55 0 1 1 1.5 12ZM12.75 12A2.7 5.2 0 1 1 18.15 12A2.7 5.2 0 1 1 12.75 12ZM19.25 12A0.95 4.65 0 1 1 21.15 12A0.95 4.65 0 1 1 19.25 12Z"
      />
    </svg>
  );
}
