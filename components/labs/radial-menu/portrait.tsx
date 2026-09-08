"use client";

import { motion, useReducedMotion } from "motion/react";
import { useId } from "react";

/** the looks the portrait can take: the vector itself, or one of the wheel's formats */
export type Look = "svg" | "png" | "jpg" | "gif" | "avif" | "pdf";

/** how much of a box the page's edge is inset, and how far the art shrinks onto it */
const PAGE = { x: 10, y: 4, w: 44, h: 56, art: 0.6, dx: 12.8, dy: 12.8 };

/**
 * The file on the wheel: a drawn portrait, a bust with no face, which is what
 * a portrait reduced to a 64px tile can carry. Artwork rather than a UI icon,
 * the standing `tether-button`'s hands have, and painted in the lab's own
 * hues so the file and the wheel read as one set: the ground is the amber
 * wash, the sweater the sky mark. Skin and hair are the drawing's own.
 *
 * The hair is two pieces. A mass behind the head that falls to the jaw, and a
 * fringe in front of the forehead. One cap path in front of the face was the
 * first draw, and with no thickness at the sides it read as a headband.
 *
 * `look` previews a format on the drawing. The art is drawn once and reused
 * through `<use>` under a filter: jpg is pixelated into 5 unit blocks and
 * softened, which is what block compression does to flat colour, gif has
 * noise added and its channels cut to six levels, which is dither and a
 * palette, avif is softened a touch, png and svg are the art as drawn, and pdf
 * sets the art small on a white page. The filtered copy fades over the art,
 * so a change of look is a crossfade and not a swap.
 */
export function Portrait({
  look = "svg",
  className,
}: {
  look?: Look;
  className?: string;
}) {
  const reduce = useReducedMotion();
  /* ids are per instance, and React's contain characters a url() must not */
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const art = `${uid}-art`;
  const filter =
    look === "jpg" || look === "gif" || look === "avif"
      ? `url(#${uid}-${look})`
      : undefined;
  const fade = reduce ? { duration: 0 } : { duration: 0.18 };

  return (
    <svg
      viewBox="0 0 64 64"
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      <defs>
        {/* jpg: a flood tiled into blocks, the art masked to the tile's dots and
            dilated back to full blocks, then softened */}
        <filter id={`${uid}-jpg`} x="0" y="0" width="1" height="1">
          <feFlood x="2" y="2" width="1" height="1" />
          <feComposite width="5" height="5" />
          <feTile result="dots" />
          <feComposite in="SourceGraphic" in2="dots" operator="in" />
          <feMorphology operator="dilate" radius="2.5" />
          <feGaussianBlur stdDeviation="0.45" />
        </filter>
        {/* gif: fine noise added to the art, then each channel cut to six levels.
            Four turned the skin pink, which is honest about a small palette and
            was the loudest tile of the five */}
        <filter id={`${uid}-gif`} x="0" y="0" width="1" height="1">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.9"
            numOctaves="1"
            seed="3"
            result="noise"
          />
          <feComposite
            in="SourceGraphic"
            in2="noise"
            operator="arithmetic"
            k2="1"
            k3="0.22"
            k4="-0.11"
          />
          <feComponentTransfer>
            <feFuncR type="discrete" tableValues="0 0.2 0.4 0.6 0.8 1" />
            <feFuncG type="discrete" tableValues="0 0.2 0.4 0.6 0.8 1" />
            <feFuncB type="discrete" tableValues="0 0.2 0.4 0.6 0.8 1" />
            <feFuncA type="discrete" tableValues="1 1" />
          </feComponentTransfer>
        </filter>
        {/* avif: a touch soft, which is the most a good codec gives away */}
        <filter id={`${uid}-avif`} x="0" y="0" width="1" height="1">
          <feGaussianBlur stdDeviation="0.35" />
        </filter>
      </defs>

      <g id={art}>
        <rect width="64" height="64" fill="#ffe2a1" />
        {/* a paler disc behind the head, so the hair has an edge on the ground */}
        <circle cx="32" cy="30" r="21" fill="#fff0cc" />
        {/* hair, the mass behind the head */}
        <ellipse cx="32" cy="23" rx="13.5" ry="15" fill="#1f1f2e" />
        {/* shoulders, with a collar notch */}
        <path d="M6 64 C6 48 17 41 32 41 C47 41 58 48 58 64 Z" fill="#2b6fe0" />
        <path d="M27 41 L32 47.5 L37 41 Z" fill="#f4d3b6" />
        {/* neck */}
        <rect x="27.5" y="30" width="9" height="13" rx="3" fill="#dfa682" />
        {/* face */}
        <ellipse cx="32" cy="26" rx="10.5" ry="12.5" fill="#f1c29e" />
        {/* the fringe, heavier on one side */}
        <path
          d="M21.5 22.5 C22 14.5 28.5 13 33 13.5 C38 14 42 16 42.5 23.5 C41 19.5 37.5 18.5 34 19 C30 19.5 27 21 21.5 22.5 Z"
          fill="#1f1f2e"
        />
      </g>

      {/* the lossy looks, the same art through a filter, faded over the original */}
      <motion.g
        initial={false}
        animate={{ opacity: filter ? 1 : 0 }}
        transition={fade}
        filter={filter}
      >
        <use href={`#${art}`} />
      </motion.g>

      {/* pdf: the art set small on a white page with a hairline edge */}
      <motion.g
        initial={false}
        animate={{ opacity: look === "pdf" ? 1 : 0 }}
        transition={fade}
      >
        <rect width="64" height="64" fill="#f4f4f5" />
        <rect
          x={PAGE.x}
          y={PAGE.y}
          width={PAGE.w}
          height={PAGE.h}
          fill="#ffffff"
          stroke="#dcdcdc"
          strokeWidth="0.75"
        />
        <use
          href={`#${art}`}
          transform={`translate(${PAGE.dx} ${PAGE.dy}) scale(${PAGE.art})`}
        />
      </motion.g>
    </svg>
  );
}
