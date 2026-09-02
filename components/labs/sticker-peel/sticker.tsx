"use client";

import { type RefObject, useCallback, useLayoutEffect, useRef } from "react";
import { FACE_INSET, LINER, LINER_EDGE, type StickerDef } from "./motifs";
import {
  CAST,
  creaseMatrix,
  type Fold,
  frontPolygon,
  SHEEN,
  UNCUT,
  type Vec,
} from "./peel";

/*
 * One sticker: the face, the flap that is folded back off it, and the mark it
 * leaves on the board while it is up.
 *
 * The three layers are the same silhouette three times. The face is the sticker
 * still lying flat, the flap is that same sticker reflected across the crease so
 * what shows is its back, and the mark is the outline it was peeled away from.
 * Adding a sticker is one path, not four that have to agree.
 */

/** what one frame of the loop has to say about a sticker */
export interface Frame {
  /** its middle, in board pixels */
  pos: Vec;
  /** how wide it paints, in board pixels */
  size: number;
  /** the fold, in the sticker's own units, or null while it lies flat */
  fold: Fold | null;
  /** where it was peeled from, or null once it is stuck down again */
  from: Vec | null;
  /** whether it is off the board and carrying its own shadow */
  lifted: boolean;
}

export type Paint = (frame: Frame) => void;

interface Props {
  def: StickerDef;
  index: number;
  size: number;
  z: number;
  /** the loop's slot for this sticker's writer, filled on mount */
  paints: RefObject<Paint[]>;
  onGrab: (index: number, event: React.PointerEvent<HTMLButtonElement>) => void;
  onKey: (index: number, event: React.KeyboardEvent<HTMLButtonElement>) => void;
}

export function Sticker({ def, index, size, z, paints, onGrab, onKey }: Props) {
  const root = useRef<HTMLButtonElement>(null);
  const mark = useRef<SVGSVGElement>(null);
  const flap = useRef<SVGGElement>(null);
  const edge = useRef<SVGPolygonElement>(null);
  const mirror = useRef<SVGGElement>(null);
  const sheen = useRef<SVGLinearGradientElement>(null);
  const cast = useRef<SVGFEDropShadowElement>(null);

  /*
   * The whole of this sticker's per-frame work, written straight to the DOM.
   *
   * A pointer crossing the board renders nothing, which is the bar
   * `book-opening` and the signature player both set. Ten attributes for the one
   * sticker being moved and a single `display` for the four that are not.
   */
  const paint = useCallback<Paint>(
    (frame) => {
      const node = root.current;
      const layer = flap.current;
      const ghost = mark.current;
      if (!node || !layer || !ghost) return;

      const half = frame.size / 2;
      const place = (at: Vec) =>
        `translate(${(at.x - half).toFixed(2)}px, ${(at.y - half).toFixed(
          2,
        )}px) rotate(${def.angle}deg)`;

      node.style.transform = place(frame.pos);
      node.dataset.lifted = String(frame.lifted);

      // the mark keeps the last place it was shown at, so a sticker put back
      // down fades it out where it stood rather than dragging it home first
      ghost.dataset.show = String(frame.from !== null);
      if (frame.from) ghost.style.transform = place(frame.from);

      const fold = frame.fold;
      if (!fold) {
        layer.style.display = "none";
        // the face reads this clip too, so a flat sticker has to be given back
        // the whole of itself rather than left cut where the peel finished
        edge.current?.setAttribute("points", UNCUT);
        return;
      }
      layer.style.display = "";

      edge.current?.setAttribute("points", frontPolygon(fold));
      mirror.current?.setAttribute("transform", creaseMatrix(fold));

      /*
       * The crease's light, set against the normal on purpose.
       *
       * These coordinates sit inside the reflected group, so they are the
       * pre-image of what paints: a gradient laid from the crease into the half
       * the flap was folded out of lands, after the reflection, running from
       * the crease into the flap the reader is looking at.
       */
      sheen.current?.setAttribute("x1", fold.mid.x.toFixed(2));
      sheen.current?.setAttribute("y1", fold.mid.y.toFixed(2));
      sheen.current?.setAttribute(
        "x2",
        (fold.mid.x - fold.n.x * SHEEN).toFixed(2),
      );
      sheen.current?.setAttribute(
        "y2",
        (fold.mid.y - fold.n.y * SHEEN).toFixed(2),
      );

      // the flap's shadow falls away from the crease, so it turns as the fold
      // does rather than sitting under one fixed corner
      cast.current?.setAttribute("dx", (fold.n.x * CAST).toFixed(2));
      cast.current?.setAttribute("dy", (fold.n.y * CAST).toFixed(2));
    },
    [def.angle],
  );

  useLayoutEffect(() => {
    paints.current[index] = paint;
  }, [paints, index, paint]);

  const box = { width: size, height: size };

  return (
    <>
      {/*
       * Where the sticker was peeled from. It sits under every sticker, so at
       * rest it is hidden by the one that made it and the peel is what uncovers
       * it, which is the whole reason it is a clean patch rather than a label.
       */}
      <svg
        ref={mark}
        {...box}
        viewBox="-50 -50 100 100"
        aria-hidden="true"
        focusable="false"
        data-show="false"
        className="pointer-events-none absolute top-0 left-0 z-0 opacity-0 data-[show=true]:opacity-100 motion-safe:transition-opacity motion-safe:duration-200"
      >
        <path
          d={def.cut}
          fill="rgb(0 0 0 / 0.024)"
          stroke="var(--color-stroke-strong)"
          strokeWidth="1"
          strokeDasharray="4 3"
        />
      </svg>

      <button
        ref={root}
        type="button"
        aria-label={def.label}
        style={{ ...box, zIndex: z }}
        onPointerDown={(event) => onGrab(index, event)}
        onKeyDown={(event) => onKey(index, event)}
        /*
         * `pointer-events-none` with the die cut turned back on is what makes
         * the drawing the hit region rather than the box round it, the call
         * `folder-stack` documents. A hexagon's box claims a quarter of its own
         * area in corners the shape does not have, and with five stickers loose
         * on one board those corners are what decides which one a press
         * reaches. Events still bubble here, since `pointer-events` only says
         * what may be hit.
         *
         * The press still focuses this button on its own, since a browser
         * focuses the nearest focusable ancestor of whatever was hit and the
         * die cut has none of its own. Calling `focus()` from the handler
         * instead is what a first build does and it paints the focus ring on
         * every click: script focus is judged by the engine's own
         * focus-visible heuristic rather than by the press that led to it.
         *
         * `touch-none` so a drag on a sticker is the sticker's. The board keeps
         * `pan-y`, so a thumb anywhere else still scrolls the page.
         */
        className="pointer-events-none absolute top-0 left-0 touch-none rounded-xl focus-visible:outline-2 focus-visible:outline-text-primary/45 focus-visible:outline-offset-2 data-[lifted=true]:[filter:drop-shadow(0_6px_9px_rgb(0_0_0_/_0.15))_drop-shadow(0_1px_2px_rgb(0_0_0_/_0.1))] motion-safe:transition-[filter] motion-safe:duration-200"
      >
        <svg
          {...box}
          viewBox="-50 -50 100 100"
          aria-hidden="true"
          focusable="false"
          className="block overflow-visible"
        >
          <defs>
            {/*
             * The half of the board the sticker still lies on. One polygon
             * clips both layers: the face stops painting where it has been
             * peeled up, and the reflected sticker survives only where it has
             * landed, which is the same half.
             */}
            <clipPath id={`flat-${def.id}`}>
              <polygon ref={edge} points={UNCUT} />
            </clipPath>

            {/* vinyl is glossy, which is most of what separates it from the
                matte paper the rest of this site's objects are made of */}
            <linearGradient
              id={`gloss-${def.id}`}
              x1="0"
              y1="0"
              x2="0.7"
              y2="1"
            >
              <stop offset="0" stopColor={def.ink.glow} />
              <stop offset="0.62" stopColor={def.ink.face} />
            </linearGradient>

            <linearGradient
              ref={sheen}
              id={`crease-${def.id}`}
              gradientUnits="userSpaceOnUse"
            >
              <stop offset="0" stopColor="rgb(255 255 255 / 0.26)" />
              <stop offset="1" stopColor="rgb(255 255 255 / 0)" />
            </linearGradient>

            {/* tight and faint, since the lifted sticker's own shadow already
                covers this silhouette and a second full one reads as a smudge
                along the crease rather than as a fold */}
            <filter
              id={`peel-${def.id}`}
              x="-40%"
              y="-40%"
              width="180%"
              height="180%"
            >
              <feDropShadow
                ref={cast}
                dx="0"
                dy="0"
                stdDeviation="1.5"
                floodColor="#000000"
                floodOpacity="0.15"
              />
            </filter>
          </defs>

          {/* the sticker, minus whatever has been lifted off the board */}
          <g clipPath={`url(#flat-${def.id})`}>
            <path
              d={def.cut}
              fill="#ffffff"
              stroke={def.ink.edge}
              strokeWidth="1.1"
              className="pointer-events-auto cursor-grab"
            />
            <path
              d={def.cut}
              transform={`scale(${FACE_INSET})`}
              fill={`url(#gloss-${def.id})`}
            />
            {def.art}
          </g>

          {/*
           * The flap. Three groups and each does one job: the clip keeps it on
           * the half it landed on, the filter shadows it off the face it is
           * lying over, and the matrix is the fold itself. Nesting them rather
           * than stacking clip and filter on one element is what fixes the
           * order, since a filter and a clip on the same element are applied in
           * whichever order the engine reads the spec in.
           */}
          <g
            ref={flap}
            clipPath={`url(#flat-${def.id})`}
            style={{ display: "none" }}
          >
            <g filter={`url(#peel-${def.id})`}>
              <g ref={mirror}>
                <path
                  d={def.cut}
                  fill={LINER}
                  stroke={LINER_EDGE}
                  strokeWidth="1.1"
                />
                {/* the print showing through the back of the vinyl, which is
                    the one thing on a backing that says which sticker it is */}
                <path
                  d={def.cut}
                  transform={`scale(${FACE_INSET})`}
                  fill={def.ink.face}
                  opacity="0.14"
                />
                <path d={def.cut} fill={`url(#crease-${def.id})`} />
              </g>
            </g>
          </g>
        </svg>
      </button>
    </>
  );
}
