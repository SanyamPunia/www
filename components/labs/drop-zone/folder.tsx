"use client";

import { animate, type MotionValue, motion, useTransform } from "motion/react";
import { useEffect, useRef } from "react";
import { HUE, type Kind } from "./files";

/*
 * The card's picture: a folder, and the sheets that go into it. Every state
 * the drop zone has is a pose of this one drawing, so the card says what is
 * happening without a line of text: a sheet peeks out under the pointer, the
 * flap falls open for a drag, refused sheets hang grey above a folder that
 * shakes, accepted ones fall in, rise out one by one as they upload, and a
 * check draws itself when they are gone.
 *
 * Everything moves by transform and opacity. Nothing in the drawing changes
 * size, and nothing outside it moves because it did.
 */

export type Pose =
  | "idle"
  | "hover"
  | "armed"
  | "over"
  | "reject"
  | "dropping"
  | "uploading"
  | "done"
  | "failed";

/** the folder's own blues, scoped to this experiment and not tokens */
const BLUE = { back: "#3f6fd6", front: "#5f8ef0", edge: "#8db0f7" } as const;

const SPRING = { type: "spring", visualDuration: 0.4, bounce: 0.25 } as const;
const SNAP = { type: "spring", visualDuration: 0.32, bounce: 0.45 } as const;

/** where sheet i of n sits in a pose, relative to its resting place */
function place(
  pose: Pose,
  i: number,
  n: number,
): { x: number; y: number; rotate: number; opacity: number } {
  const side = n === 1 ? 0 : i - (n - 1) / 2;
  const shown = i < n ? 1 : 0;
  switch (pose) {
    case "idle":
      return { x: 0, y: 0, rotate: 0, opacity: i === 0 ? 1 : 0 };
    case "hover":
      return { x: 0, y: -10, rotate: -2, opacity: i === 0 ? 1 : 0 };
    case "armed":
      // the resting sheet ducks into the folder to make room
      return { x: 0, y: 14, rotate: 0, opacity: i === 0 ? 1 : 0 };
    case "over":
      return { x: side * 18, y: -44, rotate: side * 9, opacity: shown };
    case "reject":
      return { x: side * 22, y: -52, rotate: side * 12, opacity: shown };
    case "dropping":
    case "uploading":
    case "failed":
      return { x: side * 5, y: 6 - i * 3, rotate: side * 2.5, opacity: shown };
    case "done":
      return { x: side * 5, y: 6 - i * 3, rotate: 0, opacity: 0 };
  }
}

/** one sheet: white paper, three lines of type and a chip in its kind's hue */
function Sheet({ kind, grey }: { kind: Kind | null; grey: boolean }) {
  const chip = grey || !kind ? "#a1a1aa" : HUE[kind];
  return (
    <>
      <rect
        width="92"
        height="66"
        rx="5"
        fill="#ffffff"
        stroke="#e4e4e7"
        strokeWidth="1"
      />
      <rect x="12" y="12" width="12" height="12" rx="3" fill={chip} />
      <rect x="30" y="14" width="44" height="3" rx="1.5" fill="#e4e4e7" />
      <rect x="30" y="20" width="30" height="3" rx="1.5" fill="#efeff1" />
      <rect x="12" y="34" width="68" height="3" rx="1.5" fill="#efeff1" />
      <rect x="12" y="42" width="56" height="3" rx="1.5" fill="#efeff1" />
    </>
  );
}

function Rising({
  lift,
  children,
}: {
  lift: MotionValue<number>;
  children: React.ReactNode;
}) {
  // a sheet rises out as its share of the upload goes, and is gone at the top
  const y = useTransform(lift, (v) => -v * 58);
  const opacity = useTransform(lift, [0, 0.75, 1], [1, 1, 0]);
  return <motion.g style={{ y, opacity }}>{children}</motion.g>;
}

export function Folder({
  pose,
  kinds,
  count,
  lifts,
}: {
  pose: Pose;
  /** the kinds of the first three files, for the sheets' chips */
  kinds: readonly (Kind | null)[];
  /** how many files the sheets stand for */
  count: number;
  lifts: readonly MotionValue<number>[];
}) {
  const shake = useRef<SVGGElement>(null);
  const n = Math.min(3, Math.max(1, count));
  const open = pose === "over" || pose === "reject" || pose === "armed";

  // a refused drag shakes the folder once, the way a head says no
  useEffect(() => {
    if (pose !== "reject" || !shake.current) return;
    animate(
      shake.current,
      { x: [0, -7, 7, -5, 4, -2, 0] },
      { duration: 0.5, ease: "easeOut" },
    );
  }, [pose]);

  return (
    <svg
      viewBox="0 0 200 150"
      aria-hidden="true"
      className="h-36 w-48 overflow-visible"
    >
      <motion.ellipse
        cx="100"
        cy="137"
        rx="66"
        ry="4.5"
        fill="#000000"
        initial={false}
        animate={{ opacity: open ? 0.1 : 0.06, scaleX: open ? 1.08 : 1 }}
        transition={SPRING}
        style={{ transformBox: "fill-box", transformOrigin: "50% 50%" }}
      />
      <g ref={shake}>
        {/* the back of the folder, with its tab */}
        <path
          d="M30 42 Q30 34 38 34 H76 Q81 34 84 38 L89 44 H162 Q170 44 170 52 V122 Q170 130 162 130 H38 Q30 130 30 122 Z"
          fill={BLUE.back}
        />

        {/* the sheets, between the back and the front */}
        {lifts.map((lift, i) => {
          // at rest there is one sheet, and a drag shows what it carries
          const rest = pose === "idle" || pose === "hover" || pose === "armed";
          const p = place(pose, i, rest ? 1 : n);
          const grey = pose === "reject";
          return (
            <motion.g
              // biome-ignore lint/suspicious/noArrayIndexKey: three fixed sheets, one per slot
              key={i}
              initial={false}
              animate={p}
              transition={{
                ...(pose === "dropping" ? SNAP : SPRING),
                delay: pose === "dropping" ? i * 0.06 : 0,
                opacity: { duration: 0.18 },
              }}
              style={{ transformBox: "fill-box", transformOrigin: "50% 100%" }}
            >
              <g transform="translate(54 46)">
                <Rising lift={lift}>
                  <Sheet kind={kinds[i] ?? kinds[0] ?? null} grey={grey} />
                </Rising>
              </g>
            </motion.g>
          );
        })}

        {/* the front, which falls open toward the reader from its foot */}
        <motion.g
          initial={false}
          animate={{
            scaleY: open ? (pose === "armed" ? 0.9 : 0.72) : 1,
            scaleX: open ? 1.04 : 1,
          }}
          transition={pose === "dropping" ? SNAP : SPRING}
          style={{ transformBox: "fill-box", transformOrigin: "50% 100%" }}
        >
          <path
            d="M26 64 Q26 58 32 58 H168 Q174 58 174 64 L170 124 Q169.5 130 163 130 H37 Q30.5 130 30 124 Z"
            fill={BLUE.front}
          />
          <path
            d="M32 58.75 H168"
            stroke={BLUE.edge}
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </motion.g>

        {/* the answer: a check when it is done, a mark when it stopped */}
        <motion.g
          initial={false}
          animate={{
            scale: pose === "done" || pose === "failed" ? 1 : 0,
            opacity: pose === "done" || pose === "failed" ? 1 : 0,
          }}
          transition={SNAP}
          style={{ transformBox: "fill-box", transformOrigin: "50% 50%" }}
        >
          <circle
            cx="100"
            cy="94"
            r="19"
            fill={
              pose === "failed" ? "var(--color-danger)" : "var(--color-success)"
            }
            stroke="#ffffff"
            strokeWidth="3"
          />
          {pose === "failed" ? (
            <g stroke="#ffffff" strokeWidth="3.4" strokeLinecap="round">
              <path d="M100 85 V96" />
              <path d="M100 102.5 V102.6" />
            </g>
          ) : (
            <motion.path
              d="M91.5 94.5 L97.5 100.5 L109 88.5"
              fill="none"
              stroke="#ffffff"
              strokeWidth="3.4"
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={false}
              animate={{ pathLength: pose === "done" ? 1 : 0 }}
              transition={{ duration: 0.32, delay: 0.12, ease: "easeOut" }}
            />
          )}
        </motion.g>
      </g>
    </svg>
  );
}
