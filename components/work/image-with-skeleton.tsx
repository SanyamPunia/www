"use client";

import Image from "next/image";
import { useState } from "react";

interface ImageWithSkeletonProps {
  src: string;
  alt: string;
  width: number;
  height: number;
  className?: string;
  draggable?: boolean;
}

export function ImageWithSkeleton({
  src,
  alt,
  width,
  height,
  className = "",
  draggable = false,
}: ImageWithSkeletonProps) {
  const [isLoading, setIsLoading] = useState(true);

  return (
    <div className="relative" style={{ width, height }}>
      {isLoading && (
        <div
          className="absolute inset-0 rounded-full bg-neutral-800 animate-pulse"
          style={{ width, height }}
        />
      )}
      <Image
        src={src}
        alt={alt}
        width={width}
        height={height}
        className={`${className} ${isLoading ? "opacity-0" : "opacity-100"} transition-opacity duration-200`}
        draggable={draggable}
        onLoad={() => setIsLoading(false)}
        onError={() => setIsLoading(false)}
      />
    </div>
  );
}
