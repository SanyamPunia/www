"use client";

import { Button } from "@/components/ui/button";
import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error(error);
  }, [error]);

  return (
    <div className="min-h-screen flex flex-col justify-center items-center">
        <p>something went wrong</p>
        <Button
          className="rounded-full p-4 text-xs tracking-wide mt-4"
          onClick={() => reset()}
          variant={"destructive"}
          size={"sm"}
        >
          try again
        </Button>
      </div>
  );
}
