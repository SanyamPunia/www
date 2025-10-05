import type { SVGProps } from "react";

const NPM = (props: SVGProps<SVGSVGElement>) => (
  <svg {...props} viewBox="0 0 2500 2500" role="img" aria-label="NPM">
    <path fill="#c00" d="M0 0h2500v2500H0z" />
    <path
      fill="#fff"
      d="M1241.5 268.5h-973v1962.9h972.9V763.5h495v1467.9h495V268.5z"
    />
  </svg>
);

export { NPM };
