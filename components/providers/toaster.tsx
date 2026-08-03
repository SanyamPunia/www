"use client";

import { Toaster as Sonner } from "sonner";

/**
 * Mounted once in the root layout, never by a feature.
 *
 * A component that raises a toast should only call `toast(...)`. The lab's
 * toast experiment used to render its own `<Toaster />`, which put the toasts
 * inside the demo frame where they stacked over its own controls.
 *
 * Sonner ships a dark-leaning default, so its surfaces are mapped onto this
 * project's tokens here rather than being restyled per call site.
 */
export function Toaster() {
  return (
    <Sonner
      position="bottom-right"
      expand
      richColors={false}
      toastOptions={{
        classNames: {
          toast:
            "!bg-bg !text-text-primary !ring-1 !ring-stroke !ring-inset !rounded-lg !shadow-sm",
          title: "!text-body !text-text-primary",
          description: "!text-meta !text-text-secondary",
          actionButton:
            "!bg-fill !text-text-primary !rounded-full !ring-1 !ring-stroke !ring-inset",
          cancelButton: "!bg-fill !text-text-secondary !rounded-full",
        },
      }}
    />
  );
}
