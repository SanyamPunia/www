import type React from "react";
import { Figma } from "@/components/icons/figma";
import { GitHub } from "@/components/icons/github";
import { Linear } from "@/components/icons/linear";
import { Notion } from "@/components/icons/notion";
import { Spotify } from "@/components/icons/spotify";
import { X } from "@/components/icons/x";
import { YouTube } from "@/components/icons/youtube";

export interface Visit {
  title: string;
  /** the address, shown under the title */
  host: string;
  Mark: (props: React.SVGProps<SVGSVGElement>) => React.JSX.Element;
  /**
   * A deep matte tone drawn from the brand, for the light behind the page's
   * icon and its shadow. Scoped to this lab, not tokens: it is what tells
   * seven pages built from the same parts apart. The black marks take a
   * chromatic ink instead, since a near-black wash reads as a grey smudge
   */
  hue: string;
}

/** seven visits, oldest first. The stage opens on the last */
export const HISTORY: readonly Visit[] = [
  { title: "History scrub", host: "figma.com", Mark: Figma, hue: "#4b3480" },
  {
    title: "Trackpad gestures",
    host: "linear.app",
    Mark: Linear,
    hue: "#343a86",
  },
  {
    title: "sanyampunia/www",
    host: "github.com",
    Mark: GitHub,
    hue: "#2f4560",
  },
  { title: "Lab notes", host: "notion.so", Mark: Notion, hue: "#6b4a2c" },
  {
    title: "Designing for touch",
    host: "youtube.com",
    Mark: YouTube,
    hue: "#7a1f1f",
  },
  { title: "Deep focus", host: "spotify.com", Mark: Spotify, hue: "#14583a" },
  { title: "Home", host: "x.com", Mark: X, hue: "#283a66" },
];
