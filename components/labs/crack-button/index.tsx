"use client";

import { ArrowCounterClockwiseIcon } from "@phosphor-icons/react";
import {
  AnimatePresence,
  animate,
  motion,
  useMotionValue,
  useReducedMotion,
} from "motion/react";
import { useCallback, useRef, useState } from "react";
import { Tooltip, TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  crackAt,
  FACE,
  LIMIT,
  type Point,
  type Shard,
  shardsFrom,
} from "./crack";

/*
 * A button made of glass. Press it and it cracks, press it enough and it goes.
 *
 * **A crack is two strokes, not one, and that is what makes it read as glass
 * rather than as a line drawn on a button.** A fracture is a gap in a solid, so
 * one face of it catches the light and the other is in shadow: white at low
 * alpha alongside black at low alpha, half a pixel apart. One stroke of either
 * is a scratch. This is the rule this repo already sets for shading a surface,
 * arriving at a case where the surface is broken rather than curved.
 *
 * **Each crack draws itself on from the point that was pressed.** A crack
 * propagates faster than anything else in this demo, so it is the one motion
 * here that is nearly instant: 140ms, linear, since a fracture front does not
 * ease. `pathLength="1"` makes the dash a plain number rather than something
 * `getTotalLength` has to measure, which is the trick the signature player
 * documents.
 *
 * **The break is a partition of the face, not a pile of shapes.** Every shard is
 * a wedge between two walks out of the last impact, so each edge is one walk
 * shared by the two shards either side of it: nothing is drawn twice and no gap
 * opens between neighbours. See `crack.ts`.
 */

/** the stage, and where the button sits in it */
const STAGE = 360;

/**
 * The slab, drawn entirely in light.
 *
 * Nothing here is a colour. Every layer is white or black at low alpha over the
 * button's own token, which is the rule this repo sets for shading a surface,
 * and it is also what glass is: a material with no colour of its own that reads
 * only by what it does to the light crossing it.
 *
 * Read outward from the middle. The body gathers light under its top face and
 * pools shadow at its foot, which is what gives a flat fill a belly. The rim is
 * three hairlines, a lit top edge, a shadowed bottom one and a faint ring all
 * round, which is the slab's own thickness seen edge on. Then three shadows
 * under it, a contact line, a short cast and a wide ambient, since one shadow
 * dark enough to read at this size looks like a drop shadow rather than like
 * light. `document-pocket` sets that recipe and `flip-clock` uses it too.
 */
const SLAB = [
  "inset 0 14px 22px -14px rgb(255 255 255 / 0.20)",
  "inset 0 -16px 24px -13px rgb(0 0 0 / 0.62)",
  "inset 0 1.5px 0 rgb(255 255 255 / 0.28)",
  "inset 0 -1.5px 0 rgb(0 0 0 / 0.55)",
  "inset 0 0 0 1px rgb(255 255 255 / 0.09)",
  "0 1px 1px rgb(0 0 0 / 0.16)",
  "0 6px 12px -4px rgb(0 0 0 / 0.22)",
  "0 18px 32px -12px rgb(0 0 0 / 0.26)",
].join(", ");

/**
 * A pressed slab sits into what it is standing on.
 *
 * The site scales nothing on press, so the knock is travel and the shadow
 * closing up under it. Keeping the lift while the button moves down is what
 * makes a press read as a sticker sliding rather than as a slab being struck.
 */
const SLAB_PRESSED = [
  "inset 0 14px 22px -14px rgb(255 255 255 / 0.14)",
  "inset 0 -16px 24px -13px rgb(0 0 0 / 0.62)",
  "inset 0 1.5px 0 rgb(255 255 255 / 0.20)",
  "inset 0 -1.5px 0 rgb(0 0 0 / 0.55)",
  "inset 0 0 0 1px rgb(255 255 255 / 0.09)",
  "0 1px 1px rgb(0 0 0 / 0.16)",
  "0 3px 7px -3px rgb(0 0 0 / 0.22)",
  "0 9px 18px -8px rgb(0 0 0 / 0.26)",
].join(", ");

/** how long a fracture front takes to cross the face, and how long a piece takes to fall */
const PROPAGATE = 0.14;
const FLY = 0.66;

/**
 * Far enough below the stage that every piece is gone.
 *
 * The pieces fall out of frame rather than fading where they are. A fade is the
 * pane being deleted, and what happened is that it fell: the stage clips, so
 * leaving is something the geometry can do on its own.
 */
const FALL = 240;

export default function CrackButton() {
  const reduce = useReducedMotion();
  const [cracks, setCracks] = useState<string[][]>([]);
  const [shards, setShards] = useState<Shard[] | null>(null);
  /* a pressed slab sits into the table, which is the shadow closing up under it */
  const [down, setDown] = useState(false);
  const face = useRef<HTMLButtonElement>(null);
  /**
   * The knock, driven from the press rather than declared.
   *
   * An `animate` prop holding `[0, 1.5, 0]` is the same array on every render,
   * so Motion sees no change and the recoil plays once and never again. A motion
   * value animated from the handler replays on every press and renders nothing.
   */
  const knock = useMotionValue(0);

  const hits = cracks.length;
  const broken = shards !== null;

  const press = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      const node = face.current;
      if (!node || broken) return;

      /*
       * Where it was hit, in the face's own pixels. A keyboard activation
       * reports no coordinates at all, which arrives as a `detail` of 0, the
       * call `book-opening` and `halftone-ripple` both make, and a press with no
       * point lands in the middle.
       */
      if (!reduce)
        animate(knock, [0, 1.5, 0], { duration: 0.16, ease: "easeOut" });

      const box = node.getBoundingClientRect();
      const at: Point =
        event.detail === 0
          ? [FACE.w / 2, FACE.h / 2]
          : [
              ((event.clientX - box.left) / box.width) * FACE.w,
              ((event.clientY - box.top) / box.height) * FACE.h,
            ];

      if (hits + 1 >= LIMIT) {
        setCracks((current) => [...current, crackAt(at)]);
        setShards(shardsFrom(at));
        return;
      }
      setCracks((current) => [...current, crackAt(at)]);
    },
    [broken, hits, knock, reduce],
  );

  const reset = useCallback(() => {
    setShards(null);
    setCracks([]);
  }, []);

  return (
    <TooltipProvider delayDuration={200}>
      <div
        className="relative flex w-full items-center justify-center overflow-hidden rounded-lg bg-bg ring-1 ring-stroke ring-inset"
        style={{ height: STAGE }}
      >
        <div className="relative" style={{ width: FACE.w, height: FACE.h }}>
          <AnimatePresence>
            {!broken && (
              <motion.button
                key="face"
                ref={face}
                type="button"
                onClick={press}
                aria-label={
                  hits === 0
                    ? "Save. This button is made of glass"
                    : `Save. Cracked, ${hits} of ${LIMIT}`
                }
                className="group absolute inset-0 cursor-pointer rounded-full bg-text-primary text-bg transition-shadow duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-primary/15 focus-visible:ring-offset-2"
                style={{ boxShadow: down ? SLAB_PRESSED : SLAB, y: knock }}
                initial={false}
                exit={{ opacity: 0 }}
                transition={{ duration: 0 }}
                onPointerDown={() => setDown(true)}
                onPointerUp={() => setDown(false)}
                onPointerLeave={() => setDown(false)}
                onPointerCancel={() => setDown(false)}
              >
                <Glass hits={hits} cracks={cracks} reduce={reduce ?? false} />
              </motion.button>
            )}
          </AnimatePresence>

          {broken && <Break shards={shards} reduce={reduce ?? false} />}
        </div>

        {/*
         * The way back. It arrives with the first crack rather than with the
         * break, since a reader who has cracked the glass and stopped is exactly
         * the reader who wants it, and it sits under the button where a press
         * cannot land on it by accident.
         */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center p-4">
          <AnimatePresence>
            {hits > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: reduce ? 0 : 0.22, ease: "easeOut" }}
              >
                <Tooltip
                  label={broken ? "Put it back together" : "Repair the glass"}
                >
                  <button
                    type="button"
                    onClick={reset}
                    className="pointer-events-auto flex size-9 cursor-pointer items-center justify-center rounded-full bg-fill text-text-secondary transition-colors hover:bg-fill-hover hover:text-text-primary active:bg-fill-active focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-primary/15 focus-visible:ring-offset-2"
                    aria-label={
                      broken ? "Put it back together" : "Repair the glass"
                    }
                  >
                    <ArrowCounterClockwiseIcon className="size-4" />
                  </button>
                </Tooltip>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </TooltipProvider>
  );
}

/** the face: the label, the sheen on it, and every crack so far */
function Glass({
  hits,
  cracks,
  reduce,
}: {
  hits: number;
  cracks: string[][];
  reduce: boolean;
}) {
  return (
    <>
      {/*
       * The two rounded caps, where the slab is seen through its own thickness.
       *
       * At a curved edge the light crossing the glass has further to travel and
       * leaves at a shallower angle, so the ends of a pill are the brightest part
       * of it. Without them the radius reads as a shape the fill happens to stop
       * at rather than as glass turning a corner.
       */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 rounded-full"
        style={{
          background:
            "radial-gradient(42% 118% at 1% 50%, rgb(255 255 255 / 0.18) 0%, transparent 72%), radial-gradient(42% 118% at 99% 50%, rgb(255 255 255 / 0.18) 0%, transparent 72%)",
        }}
      />
      {/* the sheen across the pane, which is what says the face is glass and not paint */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 rounded-full"
        style={{
          background:
            "linear-gradient(158deg, rgb(255 255 255 / 0.20) 0%, rgb(255 255 255 / 0.05) 24%, transparent 48%, transparent 66%, rgb(255 255 255 / 0.05) 100%)",
        }}
      />
      {/*
       * What a pointer does to it: the sheen brightens and a second one comes up
       * from the foot, which is the surface catching a little more light. There
       * is nothing to move, since the site scales nothing on hover and a slab
       * that rises under a pointer is a slab that is not resting on anything.
       */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 rounded-full opacity-0 transition-opacity duration-200 group-hover:opacity-100"
        style={{
          background:
            "linear-gradient(158deg, rgb(255 255 255 / 0.10) 0%, transparent 36%), linear-gradient(0deg, rgb(255 255 255 / 0.07) 0%, transparent 42%)",
        }}
      />
      <span
        className={cn(
          "relative z-10 text-action transition-opacity duration-200",
          /* the label goes with the glass: by the last crack it is barely there */
          hits >= LIMIT - 1
            ? "opacity-55"
            : hits > 1
              ? "opacity-80"
              : "opacity-100",
        )}
      >
        Save
      </span>

      <svg
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 size-full overflow-visible"
        viewBox={`0 0 ${FACE.w} ${FACE.h}`}
      >
        <title>Cracks</title>
        <defs>
          <clipPath id="crack-face">
            <rect width={FACE.w} height={FACE.h} rx={FACE.r} ry={FACE.r} />
          </clipPath>
        </defs>
        <g clipPath="url(#crack-face)">
          {cracks.map((paths, index) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: a crack is identified by when it happened, and the list only ever grows
            <Fracture key={index} paths={paths} reduce={reduce} />
          ))}
        </g>
      </svg>
    </>
  );
}

/**
 * One impact's worth of cracking, drawn on from the point that was pressed.
 *
 * Two strokes per branch, offset by half a pixel: the lit face of the fracture
 * and the shadowed one. `pathLength="1"` is what keeps the dash a plain number.
 */
function Fracture({ paths, reduce }: { paths: string[]; reduce: boolean }) {
  return (
    <>
      {paths.map((d) => (
        <g key={d}>
          {/*
           * The fracture plane behind the line. A crack in a thick pane is a
           * surface running down into the glass, and what a reader sees of it is
           * a soft glow either side of the line where that surface catches the
           * light. Two hairlines alone read as a scratch on the top face, which
           * is a crack in a sheet of paper rather than in a slab.
           */}
          <motion.path
            d={d}
            pathLength={1}
            fill="none"
            stroke="rgb(255 255 255 / 0.09)"
            strokeWidth={4}
            strokeLinecap="round"
            initial={
              reduce ? false : { strokeDasharray: "1 1", strokeDashoffset: 1 }
            }
            animate={{ strokeDashoffset: 0 }}
            transition={{ duration: reduce ? 0 : PROPAGATE, ease: "linear" }}
          />
          <motion.path
            d={d}
            pathLength={1}
            fill="none"
            stroke="rgb(0 0 0 / 0.55)"
            strokeWidth={1.4}
            strokeLinecap="round"
            transform="translate(0.5 0.5)"
            initial={
              reduce ? false : { strokeDasharray: "1 1", strokeDashoffset: 1 }
            }
            animate={{ strokeDashoffset: 0 }}
            transition={{ duration: reduce ? 0 : PROPAGATE, ease: "linear" }}
          />
          <motion.path
            d={d}
            pathLength={1}
            fill="none"
            stroke="rgb(255 255 255 / 0.65)"
            strokeWidth={1}
            strokeLinecap="round"
            initial={
              reduce ? false : { strokeDasharray: "1 1", strokeDashoffset: 1 }
            }
            animate={{ strokeDashoffset: 0 }}
            transition={{ duration: reduce ? 0 : PROPAGATE, ease: "linear" }}
          />
        </g>
      ))}
    </>
  );
}

/**
 * The face in pieces.
 *
 * Each shard leaves along its own mid-angle and falls, and the two run on
 * different curves for the reason `shelf-drop` documents: a thrown piece keeps
 * whatever sideways speed it left with, which is linear, while gravity
 * accelerates, which is a quadratic ease-in. On one curve the whole thing reads
 * as being sucked downward rather than as breaking.
 */
function Break({ shards, reduce }: { shards: Shard[]; reduce: boolean }) {
  return (
    <svg
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 size-full overflow-visible"
      viewBox={`0 0 ${FACE.w} ${FACE.h}`}
    >
      <title>The button breaking</title>
      <defs>
        <clipPath id="shard-face">
          <rect width={FACE.w} height={FACE.h} rx={FACE.r} ry={FACE.r} />
        </clipPath>
        {/*
         * The same light the face had, in the face's own coordinates.
         *
         * `userSpaceOnUse` rather than the default, which resolves a gradient
         * against each shape's own box: on nine pieces of one pane that is nine
         * separate lights, so a small shard was lit top to bottom across four
         * pixels while its neighbour was lit across forty. They were one sheet
         * a moment ago, so there is one light and each piece carries the part
         * of it that fell where the piece was.
         */}
        <linearGradient
          id="shard-light"
          gradientUnits="userSpaceOnUse"
          x1={0}
          y1={0}
          x2={FACE.w * 0.4}
          y2={FACE.h}
        >
          <stop offset="0%" stopColor="rgb(255 255 255 / 0.22)" />
          <stop offset="46%" stopColor="rgb(255 255 255 / 0.03)" />
          <stop offset="100%" stopColor="rgb(0 0 0 / 0.35)" />
        </linearGradient>
      </defs>
      {shards.map((shard, index) => (
        <motion.g
          // biome-ignore lint/suspicious/noArrayIndexKey: shards are a fixed set generated once, in order
          key={index}
          initial={{ x: 0, y: 0, rotate: 0 }}
          animate={
            reduce
              ? { opacity: 0 }
              : {
                  x: shard.toward[0] * shard.throwBy,
                  y: shard.toward[1] * shard.throwBy + FALL,
                  rotate: shard.spin,
                }
          }
          transition={
            reduce
              ? { duration: 0.2 }
              : {
                  x: { duration: FLY, ease: "linear", delay: shard.delay },
                  rotate: { duration: FLY, ease: "linear", delay: shard.delay },
                  y: {
                    duration: FLY,
                    ease: [0.45, 0, 0.9, 0.72],
                    delay: shard.delay,
                  },
                }
          }
        >
          {/*
           * The clip is inside the thing that moves, not around it.
           *
           * A shard is the pill's own glass, so it has to be cut to the pill
           * before it goes anywhere. With the clip on the moving group the pill
           * became a window the pieces slid out of and disappeared at, which
           * reads as the button being wiped rather than broken: measured at
           * 680ms into the break, four of the nine shards were painting nothing
           * at all. Inside it, each piece is cut once where it was and carries
           * its own shape out of the frame.
           */}
          <g clipPath="url(#shard-face)">
            {/*
             * The side wall, which is the same piece offset by the glass's own
             * thickness. It is drawn first, so the face lands on top of it and
             * what is left showing is the edge nearest the reader, which is
             * exactly what a piece of a thick pane turning in the air shows.
             */}
            <path
              d={shard.d}
              transform={`translate(${shard.toward[0] * 2.4} ${shard.toward[1] * 2.4 + 1.6})`}
              fill="rgb(0 0 0 / 0.55)"
            />
            <path d={shard.d} fill="var(--color-text-primary)" />
            <path d={shard.d} fill="url(#shard-light)" />
            <path
              d={shard.d}
              fill="none"
              stroke="rgb(255 255 255 / 0.3)"
              strokeWidth={0.8}
            />
          </g>
        </motion.g>
      ))}
    </svg>
  );
}
