export interface LinePoint {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface IconDefinition {
  lines: LinePoint[];
}

// 3 lines per icon
// 50, 50 is the center point used for collapsed/unused lines
export const ICON_DEFINITIONS: Record<string, IconDefinition> = {
  menu: {
    lines: [
      { x1: 20, y1: 30, x2: 80, y2: 30 },
      { x1: 20, y1: 50, x2: 80, y2: 50 },
      { x1: 20, y1: 70, x2: 80, y2: 70 },
    ],
  },
  cross: {
    lines: [
      { x1: 30, y1: 30, x2: 70, y2: 70 },
      { x1: 70, y1: 30, x2: 30, y2: 70 },
      { x1: 50, y1: 50, x2: 50, y2: 50 },
    ],
  },
  plus: {
    lines: [
      { x1: 50, y1: 25, x2: 50, y2: 75 },
      { x1: 25, y1: 50, x2: 75, y2: 50 },
      { x1: 50, y1: 50, x2: 50, y2: 50 },
    ],
  },
  minus: {
    lines: [
      { x1: 25, y1: 50, x2: 75, y2: 50 },
      { x1: 50, y1: 50, x2: 50, y2: 50 },
      { x1: 50, y1: 50, x2: 50, y2: 50 },
    ],
  },
  equals: {
    lines: [
      { x1: 25, y1: 40, x2: 75, y2: 40 },
      { x1: 25, y1: 60, x2: 75, y2: 60 },
      { x1: 50, y1: 50, x2: 50, y2: 50 },
    ],
  },
  asterisk: {
    lines: [
      { x1: 50, y1: 25, x2: 50, y2: 75 },
      { x1: 28, y1: 37, x2: 72, y2: 63 },
      { x1: 72, y1: 37, x2: 28, y2: 63 },
    ],
  },
  more: {
    lines: [
      { x1: 25, y1: 50, x2: 30, y2: 50 },
      { x1: 48, y1: 50, x2: 52, y2: 50 },
      { x1: 70, y1: 50, x2: 75, y2: 50 },
    ],
  },
  check: {
    lines: [
      { x1: 25, y1: 50, x2: 42, y2: 65 },
      { x1: 42, y1: 65, x2: 75, y2: 30 },
      { x1: 50, y1: 50, x2: 50, y2: 50 },
    ],
  },
  play: {
    lines: [
      { x1: 35, y1: 25, x2: 35, y2: 75 },
      { x1: 35, y1: 25, x2: 70, y2: 50 },
      { x1: 70, y1: 50, x2: 35, y2: 75 },
    ],
  },
  pause: {
    lines: [
      { x1: 35, y1: 25, x2: 35, y2: 75 },
      { x1: 65, y1: 25, x2: 65, y2: 75 },
      { x1: 50, y1: 50, x2: 50, y2: 50 },
    ],
  },
  download: {
    lines: [
      { x1: 50, y1: 20, x2: 50, y2: 60 },
      { x1: 35, y1: 50, x2: 50, y2: 65 },
      { x1: 65, y1: 50, x2: 50, y2: 65 },
    ],
  },
  upload: {
    lines: [
      { x1: 50, y1: 65, x2: 50, y2: 25 },
      { x1: 35, y1: 35, x2: 50, y2: 20 },
      { x1: 65, y1: 35, x2: 50, y2: 20 },
    ],
  },
  external: {
    lines: [
      { x1: 30, y1: 70, x2: 70, y2: 30 },
      { x1: 70, y1: 30, x2: 45, y2: 30 },
      { x1: 70, y1: 30, x2: 70, y2: 55 },
    ],
  },
  "arrow-right": {
    lines: [
      { x1: 25, y1: 50, x2: 75, y2: 50 },
      { x1: 55, y1: 30, x2: 75, y2: 50 },
      { x1: 55, y1: 70, x2: 75, y2: 50 },
    ],
  },
  "arrow-down": {
    lines: [
      { x1: 50, y1: 25, x2: 50, y2: 75 },
      { x1: 30, y1: 55, x2: 50, y2: 75 },
      { x1: 70, y1: 55, x2: 50, y2: 75 },
    ],
  },
  "arrow-left": {
    lines: [
      { x1: 75, y1: 50, x2: 25, y2: 50 },
      { x1: 45, y1: 30, x2: 25, y2: 50 },
      { x1: 45, y1: 70, x2: 25, y2: 50 },
    ],
  },
  "arrow-up": {
    lines: [
      { x1: 50, y1: 75, x2: 50, y2: 25 },
      { x1: 30, y1: 45, x2: 50, y2: 25 },
      { x1: 70, y1: 45, x2: 50, y2: 25 },
    ],
  },
  "chev-right": {
    lines: [
      { x1: 35, y1: 25, x2: 65, y2: 50 },
      { x1: 65, y1: 50, x2: 35, y2: 75 },
      { x1: 50, y1: 50, x2: 50, y2: 50 },
    ],
  },
  "chev-down": {
    lines: [
      { x1: 25, y1: 35, x2: 50, y2: 65 },
      { x1: 50, y1: 65, x2: 75, y2: 35 },
      { x1: 50, y1: 50, x2: 50, y2: 50 },
    ],
  },
  "chev-left": {
    lines: [
      { x1: 65, y1: 25, x2: 35, y2: 50 },
      { x1: 35, y1: 50, x2: 65, y2: 75 },
      { x1: 50, y1: 50, x2: 50, y2: 50 },
    ],
  },
  "chev-up": {
    lines: [
      { x1: 25, y1: 65, x2: 50, y2: 35 },
      { x1: 50, y1: 35, x2: 75, y2: 65 },
      { x1: 50, y1: 50, x2: 50, y2: 50 },
    ],
  },
};
