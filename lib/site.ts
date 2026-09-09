/**
 * Everything the home page says about Sanyam, in one place. Copy lives here
 * rather than inline in the page so the page file stays layout only.
 */

export const EMAIL = "lewarends@gmail.com";

/**
 * The site's own one-line summary.
 *
 * Read by the root `metadata`, by its `openGraph` block, which does not inherit
 * it, and by the home page's markdown. It sat inline in `app/layout.tsx` and was
 * already written out twice there before anything else needed it.
 */
export const DESCRIPTION =
  "Full-stack developer from India, currently a frontend engineer at Oliv AI. Writes about frontend, ships small dev tools and keeps a lab of UI experiments.";

export const socials = {
  github: "https://github.com/SanyamPunia",
  x: "https://x.com/sanyampunia",
  linkedin: "https://www.linkedin.com/in/sanyampunia/",
  medium: "https://medium.com/@sanyamm",
  soundcloud: "https://soundcloud.com/prodmxle",
  pageo: "https://www.pageo.me/sanyam",
} as const;

export const links = {
  oliv: "https://oliv.ai/",
  enclave: "https://www.enclave.money/",
  bitscale: "https://bitscale.ai/",
  uniqueForge: "https://www.npmjs.com/package/unique-forge",
  envt: "https://www.npmjs.com/package/envt",
  easeful: "https://easeful.sanyam.sh",
  morphrig: "https://morphrig.dev",
} as const;

/**
 * One run of the home page's copy: plain text, a link, or the name.
 *
 * A plain string is text as written, spaces included, because the page renders
 * the segments back to back with nothing between them. JSX collapses whitespace
 * and a string does not, so a segment carries its own.
 */
export type Segment =
  | string
  | {
      text: string;
      href: string;
      /**
       * A same-origin path that is a file rather than a page: `/llms.txt`,
       * `/robots.txt`, `/cv`. It gets a plain anchor rather than `next/link`,
       * since the router would try to navigate to one as a route and fall back
       * to a hard load. Nothing on the home page needs it, and `lib/pages.ts`
       * does.
       */
      resource?: boolean;
    }
  /** swept by `DiaText` on the page, plain text everywhere else */
  | { name: string };

export interface Paragraph {
  /** stable id, used as the row key */
  id: string;
  tone: "primary" | "secondary";
  segments: Segment[];
}

/**
 * The home page's four paragraphs, as data rather than as prose in its JSX.
 *
 * This is what makes the file's own opening claim true: the page is layout only
 * and the copy is here. It is also what lets `/index.md` be the page rather than
 * a summary of it, since a hand-written second copy of four paragraphs is a
 * second copy that drifts.
 *
 * **Nothing presentational lives here.** The tone is the one exception and it is
 * carried because it is the only thing separating the paragraphs on screen, per
 * CLAUDE.md. Whether a link paints as a pill comes from its host having a mark,
 * and which links sweep an underline is derived in `app/page.tsx` from the order
 * they appear in below, where it used to be hand-numbered.
 */
export const paragraphs: Paragraph[] = [
  {
    id: "intro",
    tone: "primary",
    segments: [
      "I\u2019m ",
      { name: "Sanyam" },
      ", a full-stack developer based in India. I believe simplicity is what makes a great user experience, and that clean design paired with efficient code is what actually makes the difference.",
    ],
  },
  {
    id: "work",
    tone: "secondary",
    segments: [
      { text: "Currently", href: "/work" },
      " a frontend engineer at ",
      { text: "Oliv AI", href: links.oliv },
      ", building AI-powered sales intelligence. Before that I built a real-time trading terminal at ",
      { text: "Enclave", href: links.enclave },
      ", and led engineering as founding engineer at ",
      { text: "Bitscale", href: links.bitscale },
      ". I ",
      { text: "write", href: "/blogs" },
      " about what I learn, publish small ",
      { text: "dev tools", href: links.uniqueForge },
      ", and keep a ",
      { text: "lab", href: "/lab" },
      " of UI experiments.",
    ],
  },
  {
    id: "packages",
    tone: "secondary",
    segments: [
      "I wrote ",
      { text: "easeful", href: links.easeful },
      ", which gives a Radix or Base UI component its enter and exit animation from one attribute and ships no JavaScript. ",
      { text: "Morphrig", href: links.morphrig },
      " is a ten-part explainer on how icon morphing actually works.",
    ],
  },
  {
    id: "music",
    tone: "secondary",
    segments: [
      "I also make ",
      { text: "music", href: socials.soundcloud },
      ". reach out about startups, a cool idea, or anything at all.",
    ],
  },
];
