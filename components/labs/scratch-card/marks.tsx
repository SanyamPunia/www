import {
  CherriesIcon,
  CloverIcon,
  CrownIcon,
  DiamondIcon,
  HeartIcon,
  StarIcon,
} from "@phosphor-icons/react";
import type { ComponentType } from "react";
import type { Mark } from "./prizes";

/**
 * The six symbols printed under the coating, and the ink each one is printed
 * in. They are the ticket's artwork rather than UI icons, which is why they
 * take the filled weight: a printed lottery symbol is a solid shape.
 *
 * The inks are scoped here and are not tokens. Colour is what tells six
 * symbols apart at a glance, which is the whole game, and every ink clears 3:1
 * on `surface`, the floor for a graphic.
 */
export const ICONS: Record<
  Mark,
  ComponentType<{ className?: string; weight?: "fill" }>
> = {
  cherries: CherriesIcon,
  clover: CloverIcon,
  crown: CrownIcon,
  diamond: DiamondIcon,
  heart: HeartIcon,
  star: StarIcon,
};

export const INKS: Record<Mark, string> = {
  cherries: "#c8364b",
  clover: "#2f855a",
  crown: "#6b46c1",
  diamond: "#2b6cb0",
  heart: "#c53682",
  star: "#c25a1c",
};
