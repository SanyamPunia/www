"use client";

import {
  ArrowUpRightIcon,
  CheckCircleIcon,
  InfoIcon,
  WarningIcon,
  XCircleIcon,
} from "@phosphor-icons/react";
import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { type Action, type ExternalToast, toast as sonnerToast } from "sonner";

type PromiseState = "loading" | "pending" | "success" | "error";

interface ExtendedToastOptions extends ExternalToast {
  description?: string | ReactNode;
  footer?: string | ReactNode;
  showArrow?: boolean;
}

// the scatter fill, lightest at the back. Stroke tokens rather than the zinc
// greys the dark build used, which read cool against this page's neutrals.
const colors = [
  "var(--color-stroke-soft)",
  "var(--color-stroke)",
  "var(--color-stroke-strong)",
];
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
    let fill = "var(--color-stroke)";

    if (isFilled) {
      fill =
        circleColors.get(i) ||
        colors[Math.floor(Math.random() * colors.length)];
    }

    // `style` rather than the `fill` attribute: a presentation attribute is
    // not a CSS declaration, so `var()` does not resolve inside one.
    circles.push(<circle key={i} cx={cx} cy="2" r="2" style={{ fill }} />);
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

      /*
       * The dark build signalled state with hue (green, red, amber). This page
       * has no status tokens and carries hierarchy on tone alone, so the four
       * states are four tonal steps instead. The pattern still darkens
       * decisively as the promise settles, which is what the fill is for, and
       * nothing here needs a saturated colour to read.
       */
      let mainColor = "var(--color-text-primary)"; // success, the darkest step
      if (promiseState === "error" || isError) {
        mainColor = "var(--color-text-secondary)";
      } else if (promiseState === "pending") {
        mainColor = "var(--color-text-muted)";
      } else if (promiseState === "loading") {
        mainColor = "var(--color-stroke-strong)";
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
              "linear-gradient(180deg, var(--color-bg) 0%, var(--color-bg) 60%, transparent 170%)",
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
                {/*
                 * The inline colour stays because Sonner's own stylesheet
                 * targets [data-title] and [data-description] directly and
                 * would otherwise outrank a utility class. It reads the token
                 * rather than restating its hex.
                 */}
                <div
                  data-title
                  className="text-body leading-snug"
                  style={{ color: "var(--color-text-primary)" }}
                >
                  {title}
                </div>

                {description && (
                  <div
                    data-description
                    className="text-meta leading-snug"
                    style={{ color: "var(--color-text-secondary)" }}
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
                  className="flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full px-4 py-1.5 text-action font-medium transition-colors"
                  style={{
                    backgroundColor: "var(--color-fill)",
                    border: "1px solid var(--color-stroke)",
                    color: "var(--color-text-primary)",
                    ...(action.actionButtonStyle ?? {}),
                  }}
                >
                  {action.label}
                  {showArrow && <ArrowUpRightIcon className="size-3" />}
                </button>
              )}
            </div>

            {footer && (
              <div
                data-footer
                className="mt-1.5 pt-1.5 text-meta leading-snug"
                style={{
                  color: "var(--color-text-secondary)",
                  borderTop: "1px solid var(--color-stroke)",
                }}
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
        // `border` and `ring` need their width spelled out. The dark build
        // only set `border-[#1e1e1e]`, which tinted the width Sonner's own
        // stylesheet supplied. Overriding the background here means that
        // stylesheet no longer wins, so the edge has to be declared.
        toast:
          "relative w-96 overflow-hidden rounded-lg bg-bg shadow-sm ring-1 ring-stroke ring-inset",
        title: "text-text-primary",
        description: "text-text-secondary",
        actionButton:
          "rounded-full bg-fill text-text-primary ring-1 ring-stroke ring-inset",
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
        <CheckCircleIcon className="size-4" />,
        "success",
      ),

    error: (title: string, options?: ExtendedToastOptions) =>
      renderCustomToast(
        title,
        options,
        "error",
        <XCircleIcon className="size-4" />,
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
        <WarningIcon className="size-4" />,
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

/*
 * A footer pairs two facts, and the shared rules ban a text separator between
 * them, so the footers are nodes rather than strings and this is the divider.
 */
function MetaDot() {
  return (
    <span
      aria-hidden="true"
      className="inline-block size-1.25 shrink-0 rounded-full bg-stroke-strong"
    />
  );
}

function FooterPair({ left, right }: { left: string; right: string }) {
  return (
    <span className="flex items-center gap-1.5">
      {left}
      <MetaDot />
      {right}
    </span>
  );
}

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
  loadingFooter?: ReactNode;
  successTitle: string;
  successDescription: string;
  successFooter?: ReactNode;
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
      loadingFooter: <FooterPair left="build pipeline" right="ETA ~6s" />,
      successTitle: "Deployment completed",
      successDescription: "finished without errors",
      successFooter: (
        <FooterPair left="all steps passed" right="promoted to production" />
      ),
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
      loadingFooter: <FooterPair left="build pipeline" right="ETA ~6s" />,
      successTitle: "Deployment completed",
      successDescription: "finished without errors",
      successFooter: (
        <FooterPair left="all steps passed" right="promoted to production" />
      ),
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
    <div className="flex w-full flex-col items-center gap-5 py-4">
      <TriggerGroup label="Shared id">
        <TriggerButton onClick={handleSharedWithFooter}>
          With footer
        </TriggerButton>
        <TriggerButton onClick={handleSharedNoFooter}>No footer</TriggerButton>
      </TriggerGroup>

      <TriggerGroup label="Unique id">
        <TriggerButton onClick={handleUniqueWithFooter}>
          With footer
        </TriggerButton>
        <TriggerButton onClick={handleUniqueNoFooter}>No footer</TriggerButton>
      </TriggerGroup>
    </div>
  );
}

/*
 * The id is the axis the demo varies, so it is a section label rather than a
 * prefix repeated inside all four button labels. That also lets the buttons
 * sit at one width.
 */
function TriggerGroup({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-2">
      <span className="text-meta text-text-muted">{label}</span>
      <div className="flex flex-wrap items-center justify-center gap-2">
        {children}
      </div>
    </div>
  );
}

function TriggerButton({
  onClick,
  children,
}: {
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-9 cursor-pointer items-center justify-center rounded-lg bg-bg px-3 text-action font-medium text-text-secondary ring-1 ring-stroke ring-inset transition-colors duration-150 hover:bg-fill hover:text-text-primary active:bg-fill-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-primary/15"
    >
      {children}
    </button>
  );
}
