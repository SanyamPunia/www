import type { SVGProps } from "react";

export function PencilSolid(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width="1em"
      height="1em"
      {...props}
      role="img"
      aria-label="Pencil"
    >
      <path
        fill="currentColor"
        d="M21.731 2.269a2.625 2.625 0 0 0-3.712 0l-1.157 1.157l3.712 3.712l1.157-1.157a2.625 2.625 0 0 0 0-3.712m-2.218 5.93l-3.712-3.712l-12.15 12.15a5.25 5.25 0 0 0-1.32 2.214l-.8 2.685a.75.75 0 0 0 .933.933l2.685-.8a5.25 5.25 0 0 0 2.214-1.32z"
      ></path>
    </svg>
  );
}
