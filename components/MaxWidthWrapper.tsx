import React, { CSSProperties } from "react";
import { cn } from "@/lib/utils";

const MaxWidthWrapper = ({
  children,
  className,
  style,
  ...props
}: {
  children?: React.ReactNode;
  className?: string;
  style?: CSSProperties;
  [key: string]: any;
}) => {
  return (
    <div
      className={cn("px-3 max-w-md mx-auto overflow-x-hidden", className)}
      {...props}
    >
      {children}
    </div>
  );
};

export default MaxWidthWrapper;
