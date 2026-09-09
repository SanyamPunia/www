import { EMAIL, links, type Segment, socials } from "./site";

/**
 * The three pages that are prose and nothing else: `/about`, `/contact` and
 * `/privacy`.
 *
 * They are data for the same reason the home page's paragraphs are. A page of
 * plain copy is also the one thing its markdown variant needs, so the copy lives
 * where both can read it and `lib/markdown.ts` keeps its own rule: nothing there
 * restates a page's copy. `components/ui/static-page.tsx` renders the HTML and
 * `staticPage` in `lib/markdown.ts` renders the markdown, off this array.
 *
 * **Nothing presentational lives here.** A section is a label and its
 * paragraphs, which is the only structure these pages have. The `Segment` type
 * is the home page's, so a link inside a sentence is written once and reads as a
 * pill, a plain underlined link or a markdown link depending on who renders it.
 *
 * **No internal link in this copy points at `/work`, `/blogs` or `/lab`.**
 * `InlineLink` derives a hue for those three from the href, and CLAUDE.md scopes
 * that exception to the home page's own paragraph. Navigation to them belongs in
 * the footer, which is where it is.
 */

/**
 * One run of a static page's prose.
 *
 * The home page's own segments, plus a code span. `/privacy` names a route
 * prefix and `.md`, and a path set in body copy reads as prose rather than as a
 * path. The home page has nothing to mark up that way, which is why this widens
 * `Segment` here rather than there.
 */
export type ProseSegment = Segment | { code: string };

export interface StaticParagraph {
  /** stable id, used as the row key */
  id: string;
  segments: ProseSegment[];
}

export interface StaticSection {
  /** the `h2`, at `text-meta` like every other section label on the site */
  label: string;
  paragraphs: StaticParagraph[];
}

export interface StaticPage {
  slug: string;
  /** the `h1`, and the `#` heading in the markdown */
  title: string;
  /** the `text-body` line under the title. One sentence, on the page itself */
  lead: string;
  /** `metadata.description`, the JSON-LD's, and the markdown frontmatter's */
  description: string;
  /**
   * The one-line note beside this page in `llms.txt`, in the same register as
   * the four routes above it there. The `description` is a meta description and
   * reads as one, which is why this is not that.
   */
  note: string;
  sections: StaticSection[];
}

const about: StaticPage = {
  slug: "about",
  title: "About",
  lead: "Who I am, what I have built, and how this site is put together.",
  description:
    "Sanyam Punia is a full-stack developer in Bangalore, India, and a frontend engineer at Oliv AI. Previously Enclave, Bitscale, Flib and Xurrent. What he builds, how he works, and what he publishes.",
  note: "who this is, where he has worked, and how he works",
  sections: [
    {
      label: "Who",
      paragraphs: [
        {
          id: "who",
          segments: [
            "I’m Sanyam Punia, a full-stack developer based in Bangalore, India. Most of my work is on the frontend, and most of that is React, Next.js and TypeScript. I’m currently a frontend engineer at ",
            { text: "Oliv AI", href: links.oliv },
            ", where I build AI-powered sales intelligence: interactive dashboards, agent configuration screens, meeting analysis surfaces and CRM integration views.",
          ],
        },
        {
          id: "before",
          segments: [
            "Before that I built the trading terminal at ",
            { text: "Enclave", href: links.enclave },
            ", which meant wallet tracking, leaderboards, a deposit flow and prediction markets running over high-frequency WebSocket connections. Ahead of that I was founding engineer at ",
            { text: "Bitscale", href: links.bitscale },
            ", leading frontend architecture: the design primitives, the workbook and grid systems, data sources, and a programmatic SEO system that generated over ten thousand pages. I also founded Flib, a custom merchandise company that delivered to Google, Salesforce India, colleges and startups, and I started out at Xurrent, since acquired by Zenduty.",
          ],
        },
      ],
    },
    {
      label: "How I work",
      paragraphs: [
        {
          id: "simplicity",
          segments: [
            "I believe simplicity is what makes a good interface, and that clean design paired with efficient code is what actually makes the difference. In practice that means one treatment per meaning, colour and spacing from tokens rather than from taste, and a reason written down for anything that looks arbitrary.",
          ],
        },
        {
          id: "measure",
          segments: [
            "The work I like best is the kind that can be measured: a render count, a settle time, a contrast ratio, a frame that took too long. Real-time frontends, large datasets and interaction detail are the three places that pays off most, so they are where I have spent the most time.",
          ],
        },
      ],
    },
    {
      label: "What I publish",
      paragraphs: [
        {
          id: "packages",
          segments: [
            "I write and maintain small packages. ",
            { text: "easeful", href: links.easeful },
            " gives a Radix or Base UI component its enter and exit animation from one attribute and ships no JavaScript to the browser. ",
            { text: "Morphrig", href: links.morphrig },
            " is a ten-part explainer on how icon morphing actually works. ",
            { text: "envt", href: links.envt },
            " validates client-side environment variables at runtime, and ",
            { text: "unique-forge", href: links.uniqueForge },
            " is a typed alternative to nanoid.",
          ],
        },
        {
          id: "writing",
          segments: [
            "The rest is on this site: write-ups on frontend engineering, and a lab of UI experiments where each one carries a note on how it is built and what went wrong first. Both are listed at the foot of this page, and both are served as markdown for anything reading rather than looking.",
          ],
        },
      ],
    },
    {
      label: "This site",
      paragraphs: [
        {
          id: "stack",
          segments: [
            "Built with the Next.js App Router on one light theme. It sets no cookies, stores nothing in your browser and asks you for nothing. Every page is also available as markdown, and there is an index for agents at ",
            { text: "llms.txt", href: "/llms.txt", resource: true },
            ". The ",
            { text: "privacy", href: "/privacy" },
            " page says exactly what is collected, which is close to nothing.",
          ],
        },
      ],
    },
  ],
};

const contact: StaticPage = {
  slug: "contact",
  title: "Contact",
  lead: "How to reach me, and what to expect when you do.",
  description:
    "How to reach Sanyam Punia: email, GitHub, X and LinkedIn. What he would like to hear about, what he cannot help with, and how long a reply takes.",
  note: "how to reach him, and what is worth writing about",
  sections: [
    {
      label: "Email",
      paragraphs: [
        {
          id: "email",
          segments: [
            "The most reliable way to reach me is email, at ",
            { text: EMAIL, href: `mailto:${EMAIL}` },
            ". I read everything and reply to most things inside a few days. There is no contact form on this site on purpose: a form means a database, and a personal site has no business holding one.",
          ],
        },
      ],
    },
    {
      label: "Elsewhere",
      paragraphs: [
        {
          id: "socials",
          segments: [
            "I’m on ",
            { text: "GitHub", href: socials.github },
            " as SanyamPunia, which is the right place for a bug or a pull request on anything I maintain. I’m also on ",
            { text: "X", href: socials.x },
            " and ",
            { text: "LinkedIn", href: socials.linkedin },
            ", and I put music out on ",
            { text: "SoundCloud", href: socials.soundcloud },
            " as prodmxle. Every one of those is the same person, and they are all listed in this site’s structured data.",
          ],
        },
      ],
    },
    {
      label: "Worth writing about",
      paragraphs: [
        {
          id: "yes",
          segments: [
            "Frontend or full-stack work, especially anything real-time or performance-critical. Startups, and early teams that need a first frontend engineer. Dev tooling and packages. A bug on this site or in one of mine. An idea you want a second opinion on. If you want to know what I have shipped before writing, the work page is listed at the foot of this one and my CV is at ",
            { text: "sanyam.sh/cv", href: "/cv", resource: true },
            ".",
          ],
        },
        {
          id: "no",
          segments: [
            "Please skip bulk outreach, link exchanges, guest post offers and SEO services. I do not take paid placements or sponsored links anywhere on this site.",
          ],
        },
      ],
    },
  ],
};

const privacy: StaticPage = {
  slug: "privacy",
  title: "Privacy",
  lead: "What this site collects, which is close to nothing.",
  description:
    "This site sets no cookies, stores nothing in your browser and has no accounts or forms. What it counts, which third parties a page load touches, and how to ask about any of it.",
  note: "what the site collects, which is close to nothing",
  sections: [
    {
      label: "What is collected",
      paragraphs: [
        {
          id: "none",
          segments: [
            "There are no accounts, no forms and no comments on this site, so there is nothing for you to submit and nothing of yours to store. It sets no cookies of its own, and it writes nothing to local storage, session storage or IndexedDB. Nothing you do here is tied to an identifier that follows you.",
          ],
        },
        {
          id: "analytics",
          segments: [
            "Page views are counted by ",
            {
              text: "OneDollarStats",
              href: "https://onedollarstats.com/privacy",
            },
            ", a cookieless analytics service. It records the page, the referrer and coarse aggregates. It does not set a cookie, does not build a cross-site profile and does not receive anything I could use to identify you. It is the only script on the site that is not mine.",
          ],
        },
      ],
    },
    {
      label: "What a page load touches",
      paragraphs: [
        {
          id: "third-party",
          segments: [
            "Fonts are self-hosted, so no request goes to Google. The small site marks beside links are local copies rather than hotlinked favicons, so no request goes to the sites they stand for. The one third-party request every page makes is the analytics script.",
          ],
        },
        {
          id: "spotify",
          segments: [
            "The home page shows what I am listening to. My Spotify credentials stay on the server and your browser only ever talks to this site’s own endpoint, so nothing about you is sent to Spotify. The exception is the album art itself: while something is playing, your browser loads that one image from Spotify’s CDN.",
          ],
        },
        {
          id: "hosting",
          segments: [
            "The site is hosted on ",
            { text: "Vercel", href: "https://vercel.com/legal/privacy-policy" },
            ", which keeps the usual server request logs, including IP addresses, for operations and abuse handling. That is the host’s log rather than something this site reads or acts on.",
          ],
        },
      ],
    },
    {
      label: "Content, agents and reuse",
      paragraphs: [
        {
          id: "agents",
          segments: [
            "Crawlers and agents are welcome. Every page is served as markdown at its own path plus ",
            { text: ".md", href: "/index.md", resource: true },
            ", and ",
            { text: "llms.txt", href: "/llms.txt", resource: true },
            " indexes the lot. The write-ups and lab experiments may be used for training and summarisation, and attribution is appreciated when they are quoted. The endpoints under ",
            { code: "/api/" },
            " are for this site’s own use and are disallowed in ",
            { text: "robots.txt", href: "/robots.txt", resource: true },
            ".",
          ],
        },
      ],
    },
    {
      label: "Questions",
      paragraphs: [
        {
          id: "questions",
          segments: [
            "Write to ",
            { text: EMAIL, href: `mailto:${EMAIL}` },
            " with anything about this page, about content usage, or to ask that something be taken down. This page describes the site as it is deployed right now. If any of it changes, this page changes with it.",
          ],
        },
      ],
    },
  ],
};

/**
 * The three of them, in the order the footer lists them. `about` first, since it
 * is the one a reader is most likely to want.
 */
export const staticPages: StaticPage[] = [about, contact, privacy];

export function staticPageFor(slug: string): StaticPage | undefined {
  return staticPages.find((page) => page.slug === slug);
}

/**
 * The same lookup, throwing rather than returning a maybe.
 *
 * The three route files want a value, and a slug that is not in the array above
 * means the route exists with no copy behind it, which is a build error and not
 * an empty page. `markdownFor` wants the maybe instead, so it can fall through
 * to its own 404.
 */
export function requireStaticPage(slug: string): StaticPage {
  const page = staticPageFor(slug);
  if (!page) throw new Error(`lib/pages.ts has no "${slug}" entry`);
  return page;
}

export interface SiteRoute {
  href: string;
  title: string;
  /** one line saying what is on it, for `llms.txt` */
  note: string;
}

/**
 * Every page a reader can navigate to, in the order the site is organised in.
 *
 * Two things read it. `PageNav` at the foot of a static page renders it minus
 * the page it is on, which is the only navigation those three pages have.
 * `llmsIndex` in `lib/markdown.ts` renders the same list with each note, which
 * is what an agent reads first. A page added here shows up in both.
 *
 * The notes are written for the agent index rather than for the nav, since the
 * nav shows the title alone.
 */
export const siteRoutes: SiteRoute[] = [
  {
    href: "/",
    title: "Home",
    note: "who this is, and everything below in one place",
  },
  {
    href: "/work",
    title: "Work",
    note: "companies and side projects, newest first",
  },
  { href: "/blogs", title: "Blogs", note: "the writing index" },
  { href: "/lab", title: "Lab", note: "the UI experiment index" },
  ...staticPages.map((page) => ({
    href: `/${page.slug}`,
    title: page.title,
    note: page.note,
  })),
];
