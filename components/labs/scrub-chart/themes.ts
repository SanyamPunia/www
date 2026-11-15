/*
 * The chart's themes: a line and a dither in one hue, picked together. The
 * dither is a bright tint at alpha, decoration under the line. The line is a
 * dark matte shade of the same hue, so it still reads as the data over the
 * screen. Every line clears 7:1 on white. Scoped here and not tokens.
 */
export interface Theme {
  slug: string;
  name: string;
  line: string;
  dither: string;
}

export const THEMES: readonly Theme[] = [
  { slug: "pine", name: "Pine", line: "#2d6150", dither: "#10b981" },
  { slug: "harbour", name: "Harbour", line: "#2a4e74", dither: "#38a8f0" },
  { slug: "iris", name: "Iris", line: "#4c3f78", dither: "#a78bfa" },
  { slug: "ember", name: "Ember", line: "#7a3c25", dither: "#f97316" },
  { slug: "graphite", name: "Graphite", line: "#1a1a1a", dither: "#9b9b9b" },
];
