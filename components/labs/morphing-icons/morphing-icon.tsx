"use client";

import { motion } from "framer-motion";
import { ICON_DEFINITIONS } from "./icons";

interface MorphingIconProps {
  fromIcon: string;
  toIcon: string;
  progress: number;
  size?: number;
  strokeColor?: string;
  strokeWidth?: number;
}

interface MorphingIconAnimatedProps {
  fromIcon: string;
  toIcon: string;
  size?: number;
  strokeColor?: string;
  strokeWidth?: number;
}

function interpolatePoint(from: number, to: number, progress: number): number {
  return from + (to - from) * progress;
}

export function MorphingIcon({
  fromIcon,
  toIcon,
  progress,
  size = 64,
  strokeColor = "currentColor",
  strokeWidth = 3,
}: MorphingIconProps) {
  const fromDef = ICON_DEFINITIONS[fromIcon];
  const toDef = ICON_DEFINITIONS[toIcon];

  if (!fromDef || !toDef) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 100 100"
        aria-label="Invalid icon"
      >
        <title>Invalid icon</title>
        <text
          x="50"
          y="50"
          textAnchor="middle"
          fontSize="12"
          fill="currentColor"
        >
          ?
        </text>
      </svg>
    );
  }

  const morphedLines = fromDef.lines.map((fromLine, idx) => {
    const toLine = toDef.lines[idx];
    return {
      x1: interpolatePoint(fromLine.x1, toLine.x1, progress),
      y1: interpolatePoint(fromLine.y1, toLine.y1, progress),
      x2: interpolatePoint(fromLine.x2, toLine.x2, progress),
      y2: interpolatePoint(fromLine.y2, toLine.y2, progress),
    };
  });

  const visibleLines = morphedLines.filter(
    (line) => !(line.x1 === line.x2 && line.y1 === line.y2),
  );

  const iconLabel = `${fromIcon} to ${toIcon}`;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      style={{ display: "block" }}
      aria-label={iconLabel}
    >
      <title>{iconLabel}</title>
      {visibleLines.map((line, idx) => (
        <line
          // biome-ignore lint/suspicious/noArrayIndexKey: Lines are always in fixed order (0,1,2)
          key={`${fromIcon}-${toIcon}-${idx}`}
          x1={line.x1}
          y1={line.y1}
          x2={line.x2}
          y2={line.y2}
          stroke={strokeColor}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      ))}
    </svg>
  );
}

export function MorphingIconAnimated({
  fromIcon,
  toIcon,
  size = 64,
  strokeColor = "currentColor",
  strokeWidth = 3,
}: MorphingIconAnimatedProps) {
  const fromDef = ICON_DEFINITIONS[fromIcon];
  const toDef = ICON_DEFINITIONS[toIcon];

  if (!fromDef || !toDef) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 100 100"
        aria-label="Invalid icon"
      >
        <title>Invalid icon</title>
        <text
          x="50"
          y="50"
          textAnchor="middle"
          fontSize="12"
          fill="currentColor"
        >
          ?
        </text>
      </svg>
    );
  }

  const iconLabel = `${fromIcon} to ${toIcon}`;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      style={{ display: "block" }}
      aria-label={iconLabel}
    >
      <title>{iconLabel}</title>
      {fromDef.lines.map((fromLine, idx) => {
        const toLine = toDef.lines[idx];

        const fromIsZeroLength =
          fromLine.x1 === fromLine.x2 && fromLine.y1 === fromLine.y2;
        const toIsZeroLength =
          toLine.x1 === toLine.x2 && toLine.y1 === toLine.y2;

        if (fromIsZeroLength && toIsZeroLength) {
          return (
            <motion.line
              // biome-ignore lint/suspicious/noArrayIndexKey: Lines are always in fixed order (0,1,2)
              key={`${fromIcon}-${toIcon}-${idx}`}
              initial={{
                x1: fromLine.x1,
                y1: fromLine.y1,
                x2: fromLine.x2,
                y2: fromLine.y2,
                opacity: 0,
              }}
              animate={{
                x1: toLine.x1,
                y1: toLine.y1,
                x2: toLine.x2,
                y2: toLine.y2,
                opacity: 0,
              }}
              transition={{ duration: 0.15, ease: "easeOut" }}
              stroke={strokeColor}
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
          );
        }

        return (
          <motion.line
            // biome-ignore lint/suspicious/noArrayIndexKey: Lines are always in fixed order (0,1,2)
            key={`${fromIcon}-${toIcon}-${idx}`}
            initial={{
              x1: fromLine.x1,
              y1: fromLine.y1,
              x2: fromLine.x2,
              y2: fromLine.y2,
              opacity: fromIsZeroLength ? 0 : 1,
            }}
            animate={{
              x1: toLine.x1,
              y1: toLine.y1,
              x2: toLine.x2,
              y2: toLine.y2,
              opacity: toIsZeroLength ? 0 : 1,
            }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        );
      })}
    </svg>
  );
}
