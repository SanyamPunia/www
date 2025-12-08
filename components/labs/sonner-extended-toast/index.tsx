"use client";

import {
  ArrowUpRight,
  CircleCheckIcon,
  InfoIcon,
  OctagonXIcon,
  TriangleAlertIcon,
} from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import {
  type Action,
  type ExternalToast,
  toast as sonnerToast,
  Toaster,
} from "sonner";

type PromiseState = "loading" | "pending" | "success" | "error";

interface ExtendedToastOptions extends ExternalToast {
  description?: string | ReactNode;
  footer?: string | ReactNode;
  showArrow?: boolean;
}

const colors = ["#525252", "#404040", "#262626"];
const ROW_KEYS = ["row-a", "row-b", "row-c", "row-d", "row-e"] as const;

const isAction = (action: Action | ReactNode): action is Action =>
  typeof action === "object" &&
  action !== null &&
  "onClick" in action &&
  "label" in action;

interface ProgressCirclesProps {
  filledCircles: Set<number>;
  circleColors: Map<number, string>;
}

function ProgressCircles({
  filledCircles,
  circleColors,
}: ProgressCirclesProps) {
  const totalCircles = 48;
  const circles = [];

  for (let i = 0; i < totalCircles; i++) {
    const cx = 2 + i * 8;
    const isFilled = filledCircles.has(i);
    let fill = "#404040";

    if (isFilled) {
      fill =
        circleColors.get(i) ||
        colors[Math.floor(Math.random() * colors.length)];
    }

    circles.push(<circle key={i} cx={cx} cy="2" fill={fill} r="2" />);
  }

  return (
    <div className="h-1 relative shrink-0 w-full">
      <svg
        className="block size-full"
        fill="none"
        preserveAspectRatio="none"
        viewBox="0 0 380 4"
        aria-label="Animated pattern"
        role="img"
      >
        <g>{circles}</g>
      </svg>
    </div>
  );
}

function AnimatedPattern({ promiseState }: { promiseState?: PromiseState }) {
  const [filledRows, setFilledRows] = useState<Set<number>[]>([
    new Set(),
    new Set(),
    new Set(),
    new Set(),
    new Set(),
  ]);
  const [circleColors, setCircleColors] = useState<Map<number, string>[]>(
    Array(5)
      .fill(null)
      .map(() => new Map()),
  );
  const [isComplete, setIsComplete] = useState(false);
  const [isError, setIsError] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const fillMainColorRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const totalCirclesPerRow = 48;
    const totalRows = 5;

    const randomIndices: number[][] = [];
    for (let row = 0; row < totalRows; row++) {
      const indices = Array.from({ length: totalCirclesPerRow }, (_, i) => i);
      for (let i = indices.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [indices[i], indices[j]] = [indices[j], indices[i]];
      }
      randomIndices.push(indices);
    }

    let currentIndex = 0;
    const totalCircles = totalCirclesPerRow * totalRows;

    intervalRef.current = setInterval(() => {
      if (currentIndex >= totalCircles) {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
        }
        setIsComplete(true);
        return;
      }

      const rowIndex = currentIndex % totalRows;
      const circleIndexInRow = Math.floor(currentIndex / totalRows);

      if (circleIndexInRow < totalCirclesPerRow) {
        const circleToFill = randomIndices[rowIndex][circleIndexInRow];

        const randomColor = colors[Math.floor(Math.random() * colors.length)];

        setFilledRows((prev) => {
          const newRows = [...prev];
          const newSet = new Set(newRows[rowIndex]);
          newSet.add(circleToFill);
          newRows[rowIndex] = newSet;
          return newRows;
        });

        setCircleColors((prev) => {
          const newColors = [...prev];
          const newMap = new Map(newColors[rowIndex]);
          newMap.set(circleToFill, randomColor);
          newColors[rowIndex] = newMap;
          return newColors;
        });
      }

      currentIndex++;
    }, 3);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (isComplete) {
      const totalCirclesPerRow = 48;
      const totalRows = 5;
      const totalCircles = totalCirclesPerRow * totalRows;

      let mainColor = "#049669"; // success
      if (promiseState === "error" || isError) {
        mainColor = "#A92E2E";
      } else if (promiseState === "pending") {
        mainColor = "#F59E0C";
      } else if (promiseState === "loading") {
        mainColor = "#404040";
      }

      let fillIndex = 0;
      const allCircleIndices: number[][] = [];

      for (let row = 0; row < totalRows; row++) {
        const indices = Array.from(filledRows[row]);
        for (let i = indices.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [indices[i], indices[j]] = [indices[j], indices[i]];
        }
        allCircleIndices.push(indices);
      }

      fillMainColorRef.current = setInterval(() => {
        if (fillIndex >= totalCircles) {
          if (fillMainColorRef.current) {
            clearInterval(fillMainColorRef.current);
          }
          return;
        }

        const rowIndex = fillIndex % totalRows;
        const circleIndexInRow = Math.floor(fillIndex / totalRows);

        if (circleIndexInRow < allCircleIndices[rowIndex].length) {
          const circleToFill = allCircleIndices[rowIndex][circleIndexInRow];

          setCircleColors((prev) => {
            const newColors = [...prev];
            const newMap = new Map(newColors[rowIndex]);
            newMap.set(circleToFill, mainColor);
            newColors[rowIndex] = newMap;
            return newColors;
          });
        }

        fillIndex++;
      }, 5);

      return () => {
        if (fillMainColorRef.current) {
          clearInterval(fillMainColorRef.current);
        }
      };
    }
  }, [isComplete, promiseState, isError, filledRows]);

  useEffect(() => {
    if (promiseState === "error") {
      setIsError(true);
    } else if (promiseState === "success") {
      setIsComplete(true);
    }
  }, [promiseState]);

  return (
    <div className="absolute bottom-0 left-0 right-0 flex flex-col gap-1 items-start overflow-hidden rounded-b-md z-0">
      {filledRows.map((filledCircles, i) => (
        <ProgressCircles
          key={ROW_KEYS[i] ?? `row-${i}`}
          filledCircles={filledCircles}
          circleColors={circleColors[i]}
        />
      ))}
    </div>
  );
}

const renderCustomToast = (
  title: string | ReactNode,
  options: ExtendedToastOptions | undefined,
  _type: "success" | "error" | "info" | "warning" | null,
  _defaultIcon: ReactNode | null,
  promiseState?: PromiseState,
) => {
  const { description, footer, action, showArrow, ...sonnerOptions } =
    options || {};

  const isActionObject = action && isAction(action);

  const calculatedDuration =
    promiseState === "pending" || promiseState === "loading"
      ? Infinity
      : sonnerOptions?.duration !== undefined
        ? sonnerOptions.duration
        : 5000;

  return sonnerToast.custom(
    (t) => (
      <div className="relative w-full">
        <AnimatedPattern promiseState={promiseState} />

        <div
          className="group flex items-start gap-3 w-full pt-6 px-4 pb-5 relative z-10"
          style={{
            background:
              "linear-gradient(180deg, #0B0B0B 0%, #0B0B0B 60%, transparent 170%)",
            backgroundSize: "100% 100%",
            backgroundPosition: "left top",
            backdropFilter: "blur(0.3px)",
            WebkitBackdropFilter: "blur(0.3px)",
            maskImage:
              "linear-gradient(180deg, rgba(0, 0, 0, 1) 100%, black 60%, transparent 100%)",
            WebkitMaskImage:
              "linear-gradient(180deg, rgba(0, 0, 0, 1) 100%, black 60%, transparent 100%)",
          }}
        >
          <div className="flex-1 min-w-0 flex flex-col gap-1">
            <div className="flex items-center justify-between gap-4">
              <div className="flex-1 min-w-0 flex flex-col gap-1">
                <div
                  data-title
                  className="text-sm leading-snug"
                  style={{ color: "#f5f5f5" }}
                >
                  {title}
                </div>

                {description && (
                  <div
                    data-description
                    className="text-sm leading-snug"
                    style={{ color: "#a3a3a3" }}
                  >
                    {description}
                  </div>
                )}
              </div>

              {isActionObject && (
                <button
                  type="button"
                  data-button
                  onClick={(e) => {
                    action.onClick(e);
                    sonnerToast.dismiss(t);
                  }}
                  className="cursor-pointer shrink-0 px-4 py-1.5 rounded text-xs font-medium transition-colors flex items-center gap-1.5"
                  style={{
                    backgroundColor: "#262626",
                    border: "1px solid #1f1f1f",
                    color: "#f5f5f5",
                    ...(action.actionButtonStyle ?? {}),
                  }}
                >
                  {action.label}
                  {showArrow && <ArrowUpRight className="size-3" />}
                </button>
              )}
            </div>

            {footer && (
              <div
                data-footer
                className="text-xs mt-1.5 pt-1.5 leading-snug"
                style={{ color: "#a3a3a3", borderTop: "1px solid #1f1f1f" }}
              >
                {footer}
              </div>
            )}
          </div>
        </div>
      </div>
    ),
    {
      ...sonnerOptions,
      action: undefined,
      duration: calculatedDuration,
      classNames: {
        toast:
          "bg-[#0B0B0B] border-[#1e1e1e] rounded-sm w-96 relative overflow-hidden",
        title: "text-[#f5f5f5]",
        description: "text-[#a3a3a3]",
        actionButton: "bg-[#262626] border-[#1f1f1f] text-[#f5f5f5]",
        ...sonnerOptions?.classNames,
      },
    },
  );
};

export const toast = Object.assign(
  (message: string | ReactNode, options?: ExtendedToastOptions) =>
    renderCustomToast(message, options, null, null),
  {
    success: (title: string, options?: ExtendedToastOptions) =>
      renderCustomToast(
        title,
        options,
        "success",
        <CircleCheckIcon className="size-4" />,
        "success",
      ),

    error: (title: string, options?: ExtendedToastOptions) =>
      renderCustomToast(
        title,
        options,
        "error",
        <OctagonXIcon className="size-4" />,
      ),

    info: (title: string, options?: ExtendedToastOptions) =>
      renderCustomToast(
        title,
        options,
        "info",
        <InfoIcon className="size-4" />,
      ),

    warning: (title: string, options?: ExtendedToastOptions) =>
      renderCustomToast(
        title,
        options,
        "warning",
        <TriangleAlertIcon className="size-4" />,
      ),

    message: sonnerToast.message,
    custom: sonnerToast.custom,
    promise: <T,>(
      promise: Promise<T>,
      data: {
        loading?: string | ReactNode;
        success?: string | ReactNode | ((data: T) => string | ReactNode);
        error?: string | ReactNode | ((error: unknown) => string | ReactNode);
      } & ExtendedToastOptions,
    ) => {
      const { loading, success, error, ...options } = data;

      const loadingToastId = renderCustomToast(
        loading || "Loading...",
        { ...options, footer: options?.footer },
        null,
        null,
        "pending",
      );

      promise
        .then((result) => {
          sonnerToast.dismiss(loadingToastId);
          const successMessage =
            typeof success === "function"
              ? success(result)
              : success || "Success";
          renderCustomToast(
            successMessage,
            { ...options, footer: options?.footer },
            "success",
            null,
            "success",
          );
          return result;
        })
        .catch((err) => {
          sonnerToast.dismiss(loadingToastId);
          const errorMessage =
            typeof error === "function" ? error(err) : error || "Error";
          renderCustomToast(
            errorMessage,
            { ...options, footer: options?.footer },
            "error",
            null,
            "error",
          );
          throw err;
        });

      return promise;
    },
    loading: (message: string | ReactNode, options?: ExtendedToastOptions) =>
      renderCustomToast(
        message,
        { ...options, footer: options?.footer },
        null,
        null,
        "pending",
      ),
    dismiss: sonnerToast.dismiss,
  },
);

function runPromiseDemo({
  id,
  loadingTitle,
  loadingDescription,
  loadingFooter,
  successTitle,
  successDescription,
  successFooter,
}: {
  id: string;
  loadingTitle: string;
  loadingDescription?: string;
  loadingFooter?: string;
  successTitle: string;
  successDescription: string;
  successFooter?: string;
}) {
  const p = new Promise<string>((resolve, reject) => {
    setTimeout(() => {
      const ok = Math.random() > 0.35;
      if (ok) resolve(successDescription);
      else reject(new Error("completed with warnings"));
    }, 1400);
  });

  toast.loading(loadingTitle, {
    id,
    description: loadingDescription,
    footer: loadingFooter,
  });

  p.then((msg) => {
    setTimeout(() => {
      toast.success(successTitle, {
        id,
        description: msg,
        footer: successFooter,
      });
    }, 800);
  }).catch((err) => {
    setTimeout(() => {
      toast.success(successTitle, {
        id,
        description:
          err instanceof Error ? err.message : "completed with warnings",
        footer: successFooter,
      });
    }, 800);
  });
}

export default function SonnerExtendedToastLab() {
  const handleSharedWithFooter = () =>
    runPromiseDemo({
      id: "sonner-promise-shared",
      loadingTitle: "Deploy in progress…",
      loadingDescription:
        "running checks, bundling assets, uploading artifacts",
      loadingFooter: "build pipeline • ETA ~6s",
      successTitle: "Deployment completed",
      successDescription: "finished without errors",
      successFooter: "all steps passed • promoted to production",
    });

  const handleSharedNoFooter = () =>
    runPromiseDemo({
      id: "sonner-promise-shared",
      loadingTitle: "Generating report…",
      loadingDescription: "pulling metrics, stitching charts, exporting pdf",
      successTitle: "Report delivered",
      successDescription: "report completed",
    });

  const uniqueId = () =>
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `toast-${Date.now()}-${Math.random().toString(16).slice(2)}`;

  const handleUniqueWithFooter = () =>
    runPromiseDemo({
      id: uniqueId(),
      loadingTitle: "Deploy in progress…",
      loadingDescription:
        "running checks, bundling assets, uploading artifacts",
      loadingFooter: "build pipeline • ETA ~6s",
      successTitle: "Deployment completed",
      successDescription: "finished without errors",
      successFooter: "all steps passed • promoted to production",
    });

  const handleUniqueNoFooter = () =>
    runPromiseDemo({
      id: uniqueId(),
      loadingTitle: "Generating report…",
      loadingDescription: "pulling metrics, stitching charts, exporting pdf",
      successTitle: "Report delivered",
      successDescription: "report completed",
    });

  return (
    <div className="space-y-4">
      <div className="flex min-h-48 sm:h-64 w-full items-center justify-center border border-[#131313] rounded-sm bg-[#0b0b0b] p-4">
        <div className="flex flex-col sm:flex-row flex-wrap gap-3 justify-center items-center w-full sm:w-auto">
          <button
            type="button"
            className="cursor-pointer px-4 py-2 rounded border border-[#1f1f1f] bg-[#0f0f0f] text-[#f5f5f5] text-xs hover:bg-[#141414] transition-colors"
            onClick={handleSharedWithFooter}
          >
            shared id (with footer)
          </button>

          <button
            type="button"
            className="cursor-pointer px-4 py-2 rounded border border-[#1f1f1f] bg-[#0f0f0f] text-[#f5f5f5] text-xs hover:bg-[#141414] transition-colors"
            onClick={handleSharedNoFooter}
          >
            shared id (no footer)
          </button>
        </div>
      </div>

      <div className="flex min-h-48 sm:h-64 w-full items-center justify-center border border-[#131313] rounded-sm bg-[#0b0b0b] p-4">
        <div className="flex flex-col sm:flex-row flex-wrap gap-3 justify-center items-center w-full sm:w-auto">
          <button
            type="button"
            className="cursor-pointer px-4 py-2 rounded border border-[#1f1f1f] bg-[#0f0f0f] text-[#f5f5f5] text-xs hover:bg-[#141414] transition-colors"
            onClick={handleUniqueWithFooter}
          >
            unique id (with footer)
          </button>

          <button
            type="button"
            className="cursor-pointer px-4 py-2 rounded border border-[#1f1f1f] bg-[#0f0f0f] text-[#f5f5f5] text-xs hover:bg-[#141414] transition-colors"
            onClick={handleUniqueNoFooter}
          >
            unique id (no footer)
          </button>
        </div>
      </div>

      <Toaster position="bottom-right" expand richColors={false} />
    </div>
  );
}
