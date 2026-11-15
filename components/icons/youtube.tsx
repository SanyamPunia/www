import type React from "react";

/** Mark from svgl.app (svgl.app/library/youtube.svg), brand colour intact. */
export function YouTube(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 256 180"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      // decorative by default, call sites label the thing that wraps it
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      <path
        fill="#FF0000"
        d="M250.346 28.075A32.18 32.18 0 0 0 227.69 5.418C207.824 0 127.87 0 127.87 0S47.912.164 28.046 5.582A32.18 32.18 0 0 0 5.39 28.24c-6.009 35.298-8.34 89.084.165 122.97a32.18 32.18 0 0 0 22.656 22.657c19.866 5.418 99.822 5.418 99.822 5.418s79.955 0 99.82-5.418a32.18 32.18 0 0 0 22.657-22.657c6.338-35.348 8.291-89.1-.164-123.134Z"
      />
      <path fill="#FFFFFF" d="m102.421 128.06 66.328-38.418-66.328-38.418z" />
    </svg>
  );
}
