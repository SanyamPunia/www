import {
  CloudFogIcon,
  CloudLightningIcon,
  CloudRainIcon,
  type Icon,
  SnowflakeIcon,
  SunIcon,
} from "@phosphor-icons/react";

export type Kind = "sun" | "fog" | "rain" | "snow" | "storm";

/**
 * One forecast per row. The card's hues are scoped to this experiment and are
 * not tokens: the sky is the subject of each card, and the colour is what
 * tells five cards built from the same parts apart. The weather on the word
 * lives in `word.ts`.
 *
 * `ground` fills the card, the three `blobs` drift over it, and `mark` is the
 * icon on its white tile. Every `mark` clears 4.5:1 on white: 5.02, 7.58,
 * 6.70, 6.29 and 7.10.
 */
export interface Forecast {
  kind: Kind;
  name: string;
  line: string;
  icon: Icon;
  ground: string;
  blobs: readonly [string, string, string];
  mark: string;
}

export const FORECASTS: readonly Forecast[] = [
  {
    kind: "sun",
    name: "Clear skies",
    line: "Sun from first light, 24° by noon and a light breeze off the water.",
    icon: SunIcon,
    ground: "#f59e0b",
    blobs: ["#fde68a", "#fb923c", "#fcd34d"],
    mark: "#b45309",
  },
  {
    kind: "fog",
    name: "Sea fog",
    line: "Grey until eleven, then thinning. The far shore is back by lunch.",
    icon: CloudFogIcon,
    ground: "#94a3b8",
    blobs: ["#e2e8f0", "#64748b", "#cbd5e1"],
    mark: "#475569",
  },
  {
    kind: "rain",
    name: "Light rain",
    line: "Showers on and off all afternoon. Take a coat and leave the umbrella.",
    icon: CloudRainIcon,
    ground: "#2563eb",
    blobs: ["#93c5fd", "#1e3a8a", "#60a5fa"],
    mark: "#1d4ed8",
  },
  {
    kind: "snow",
    name: "First snow",
    line: "A dusting overnight and gone by ten. The first cold morning this year.",
    icon: SnowflakeIcon,
    ground: "#a5b4fc",
    blobs: ["#eef2ff", "#818cf8", "#e0e7ff"],
    mark: "#4f46e5",
  },
  {
    kind: "storm",
    name: "Thunder",
    line: "Heavy air all day and a storm after dark. Close the windows early.",
    icon: CloudLightningIcon,
    ground: "#3b0764",
    blobs: ["#7c3aed", "#1e1b4b", "#c084fc"],
    mark: "#6d28d9",
  },
];

/** what the line under the list says while no row is picked */
export const REST_LINE = "The week ahead on the coast, one day to a row.";
