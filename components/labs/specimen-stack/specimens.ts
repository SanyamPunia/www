/*
 * The seven specimens, as data. A formula is a list of parts, where a string
 * is set on the line and a one-item tuple is a subscript, so the markup is real
 * `<sub>` elements and the screen-reader text is the same list joined.
 */

export type Formula = readonly (string | readonly [string])[];

export interface Specimen {
  name: string;
  /** the file in `public/assets/specimen-stack`, without `.webp` */
  img: string;
  formula: Formula;
  /** the low and high ends of its Mohs hardness */
  mohs: readonly [number, number];
  system: string;
  luster: string;
  /** specific gravity, in g/cm³ */
  sg: string;
  locality: string;
  /**
   * The mineral's own colour, for the swatch on the back of its card. The
   * seven are scoped here: a specimen's colour is the specimen, which is the
   * claim the lab's other scoped sets make. They are not tokens.
   */
  hue: string;
  note: string;
}

export const SPECIMENS: readonly Specimen[] = [
  {
    name: "Amethyst",
    img: "amethyst",
    formula: ["SiO", ["2"]],
    mohs: [7, 7],
    system: "Trigonal",
    luster: "Vitreous",
    sg: "2.65",
    locality: "Minas Gerais, BR",
    hue: "#7b5ea7",
    note: "Violet quartz. The colour comes from trace iron and natural irradiation, and fades in strong sunlight.",
  },
  {
    name: "Malachite",
    img: "malachite",
    formula: ["Cu", ["2"], "CO", ["3"], "(OH)", ["2"]],
    mohs: [3.5, 4],
    system: "Monoclinic",
    luster: "Silky",
    sg: "4.0",
    locality: "Katanga, CD",
    hue: "#2f8a5c",
    note: "A banded copper carbonate. Cutting across the layers shows its growth rings.",
  },
  {
    name: "Pyrite",
    img: "pyrite",
    formula: ["FeS", ["2"]],
    mohs: [6, 6.5],
    system: "Cubic",
    luster: "Metallic",
    sg: "5.0",
    locality: "Navajún, ES",
    hue: "#b8973f",
    note: "Also called fool's gold. It grows in cubes so sharp that they look machined.",
  },
  {
    name: "Bismuth",
    img: "bismuth",
    formula: ["Bi"],
    mohs: [2, 2.5],
    system: "Trigonal",
    luster: "Iridescent",
    sg: "9.8",
    locality: "Lab-grown",
    hue: "#4c7fb0",
    note: "Hopper crystals grow faster at the edges than at the centre. The rainbow is a thin oxide film.",
  },
  {
    name: "Rose Quartz",
    img: "rose-quartz",
    formula: ["SiO", ["2"]],
    mohs: [7, 7],
    system: "Trigonal",
    luster: "Vitreous",
    sg: "2.65",
    locality: "Madagascar",
    hue: "#d9a3a8",
    note: "Its pink colour and haze come from microscopic fibres inside the crystal.",
  },
  {
    name: "Obsidian",
    img: "obsidian",
    formula: ["~70% SiO", ["2"], " glass"],
    mohs: [5, 5.5],
    system: "Amorphous",
    luster: "Vitreous",
    sg: "2.4",
    locality: "Jalisco, MX",
    hue: "#2a2a2e",
    note: "Lava that cooled too quickly to crystallise. Its fractures make edges sharper than surgical steel.",
  },
  {
    name: "Azurite",
    img: "azurite",
    formula: ["Cu", ["3"], "(CO", ["3"], ")", ["2"], "(OH)", ["2"]],
    mohs: [3.5, 4],
    system: "Monoclinic",
    luster: "Vitreous",
    sg: "3.8",
    locality: "Bisbee, US",
    hue: "#2b4c9b",
    note: "A deep blue copper carbonate that slowly weathers into green malachite.",
  },
];

/** the formula as plain text, for an accessible name or a live region */
export const formulaText = (f: Formula) =>
  f.map((p) => (typeof p === "string" ? p : p[0])).join("");

export const pad = (n: number) => String(n).padStart(2, "0");
