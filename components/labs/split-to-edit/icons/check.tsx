import type { SVGProps } from "react";

export function CheckSm(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 12 12"
      width="1em"
      height="1em"
      {...props}
      role="img"
      aria-label="Check"
    >
      <path
        fill="currentColor"
        fillRule="evenodd"
        d="M10.78 2.62a.75.75 0 0 1 0 1.06L4.683 9.777a.75.75 0 0 1-1.069-.009L1.211 7.284a.75.75 0 0 1 1.078-1.043l1.873 1.936L9.72 2.62a.75.75 0 0 1 1.06 0"
        clipRule="evenodd"
      ></path>
    </svg>
  );
}
