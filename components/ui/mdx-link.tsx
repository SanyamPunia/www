"use client";

import Link from "next/link";
import type { ComponentPropsWithoutRef } from "react";
import { playTapSound } from "@/lib/utils";

interface MDXLinkProps extends ComponentPropsWithoutRef<"a"> {
  href?: string;
}

export function MDXLink({ href, children, ...props }: MDXLinkProps) {
  const baseClassName =
    "text-sm text-text-primary hover:text-text-secondary transition-colors duration-200 underline decoration-neutral-600 hover:decoration-neutral-400";

  if (href?.startsWith("/")) {
    return (
      <Link
        href={href}
        className={`${baseClassName} inline-flex items-center gap-1`}
        onClick={playTapSound}
        {...(props as Record<string, unknown>)}
      >
        {children}
      </Link>
    );
  }

  if (href?.startsWith("#")) {
    return (
      <a
        href={href}
        className={baseClassName}
        onClick={playTapSound}
        {...props}
      >
        {children}
      </a>
    );
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={`${baseClassName} inline-flex items-center gap-1`}
      onClick={playTapSound}
      {...props}
    >
      {children}
      <svg
        className="w-3 h-3 transition-transform duration-200 hover:translate-x-0.5 hover:-translate-y-0.5"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        aria-label="External link"
        role="img"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
        />
      </svg>
    </a>
  );
}
