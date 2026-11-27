/*
 * The five shapes, taken from the site's own solid glyphs in
 * `components/icons/glyphs/nature.tsx`. They are paths here rather than the
 * icon components because the morph samples them.
 *
 * Each is one closed path, since the morph pairs one outline with another.
 * That is why the crown is its body without the base line, and why the clover,
 * four separate leaves, is not in the set.
 *
 * `light` and `deep` are each fill's own colour, the top and the bottom of its
 * gloss. They are scoped to this lab rather than tokens, since a hue per icon
 * is the point of it, and each `deep` is dark enough to hold the shape's edge
 * on `surface`.
 */
export interface Glyph {
  name: string;
  d: string;
  light: string;
  deep: string;
}

export const ICONS: Glyph[] = [
  {
    name: "Heart",
    light: "#fb7185",
    deep: "#e11d48",
    d: "M12 18.9C7.2 16.1 4.4 13.3 4.4 9.7A3.87 3.87 0 0 1 12 8.1A3.87 3.87 0 0 1 19.6 9.7C19.6 13.3 16.8 16.1 12 18.9Z",
  },
  {
    name: "Star",
    light: "#fde047",
    deep: "#eab308",
    d: "M13.28 6.09L14.41 8.64A0.75 0.75 0 0 0 15.02 9.08L17.8 9.37A1.4 1.4 0 0 1 18.59 11.81L16.51 13.67A0.75 0.75 0 0 0 16.28 14.39L16.86 17.11A1.4 1.4 0 0 1 14.79 18.62L12.38 17.22A0.75 0.75 0 0 0 11.62 17.22L9.21 18.62A1.4 1.4 0 0 1 7.14 17.11L7.72 14.39A0.75 0.75 0 0 0 7.49 13.67L5.41 11.81A1.4 1.4 0 0 1 6.2 9.37L8.98 9.08A0.75 0.75 0 0 0 9.59 8.64L10.72 6.09A1.4 1.4 0 0 1 13.28 6.09Z",
  },
  {
    name: "Flame",
    light: "#fdba74",
    deep: "#ea580c",
    d: "M11.6 19.77C8.4 19.77 5.73 17.63 5.73 14.17C5.73 11.9 6.67 10.17 7.73 8.83C8.13 10.7 8.93 12.03 10.27 12.7C10 9.23 11.07 6.17 13.33 4.17C14 7.37 15.87 8.97 17.07 10.7C17.87 11.9 18.27 13.23 18.27 14.57C18.27 17.9 15.47 19.77 11.6 19.77Z",
  },
  {
    name: "Diamond",
    light: "#7dd3fc",
    deep: "#0284c7",
    d: "M13.89 4.94L18.59 10.36A2.5 2.5 0 0 1 18.59 13.64L13.89 19.06A2.5 2.5 0 0 1 10.11 19.06L5.41 13.64A2.5 2.5 0 0 1 5.41 10.36L10.11 4.94A2.5 2.5 0 0 1 13.89 4.94Z",
  },
  {
    name: "Crown",
    light: "#c4b5fd",
    deep: "#7c3aed",
    d: "M5.62 9.69L7.23 10.94A1.25 1.25 0 0 0 9.1 10.54L10.9 7.17A1.25 1.25 0 0 1 13.1 7.17L14.9 10.54A1.25 1.25 0 0 0 16.77 10.94L18.38 9.69A1.1 1.1 0 0 1 20.13 10.79L18.96 16.36A1.25 1.25 0 0 1 17.74 17.35L6.26 17.35A1.25 1.25 0 0 1 5.04 16.36L3.87 10.79A1.1 1.1 0 0 1 5.62 9.69Z",
  },
];
