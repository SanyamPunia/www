import fs from "node:fs";
import path from "node:path";
import { getAllBlogs } from "./blogs";
import { SITE_URL } from "./constants";
import { isImplemented, labsRegistry } from "./labs";
import {
  type ProseSegment,
  type StaticPage,
  siteRoutes,
  staticPageFor,
  staticPages,
} from "./pages";
import { AGENT_WHEN_TO_USE, PROFILE } from "./profile";
import { DESCRIPTION, EMAIL, paragraphs, socials } from "./site";
import { workSections } from "./work";

/*
 * Every page as markdown, for anything reading the site rather than looking at
 * it. Served at the page's own path plus `.md`, and at the page's own path for a
 * request that asks for `text/markdown`. `app/md/[...path]/route.ts` is the
 * handler and `proxy.ts` is the header half.
 *
 * **Nothing here restates a page's copy.** Every document is built from the same
 * source its page renders from: `meta.json` and `page.mdx` for a post,
 * `labsRegistry` for an experiment, `workSections` for the work page,
 * `lib/site.ts` for the home page. A hand-written second copy of a title or a
 * date is how the markdown ends up describing a page the site no longer has.
 *
 * The one thing that is not carried is prose written directly into JSX, which is
 * the home page's four paragraphs. Moving those into data would cost `DiaText`
 * on the name and the timed underlines on the three internal links, and both are
 * deliberate. So the home page's markdown is the site's index rather than a
 * transcript of it, and it says so.
 */

/** a page's markdown path, as the segments `/md/[...path]` receives */
export type MarkdownRoute = string[];

/**
 * `index` rather than an empty array, because a catch-all needs at least one
 * segment. The public URL is `/index.md`, which is the same spelling a directory
 * listing uses, so nothing has to be explained to a client that guesses.
 */
const HOME = "index";

export function markdownRoutes(): MarkdownRoute[] {
  return [
    [HOME],
    ["work"],
    ["blogs"],
    ...getAllBlogs().map((blog) => ["blogs", blog.slug]),
    ["lab"],
    // gated the same way `sitemap.ts` gates them: a registry entry with no
    // component 404s, and advertising a 404 as markdown is no better
    ...labsRegistry
      .filter((lab) => isImplemented(lab.slug))
      .map((lab) => ["lab", lab.slug]),
    // about, contact, privacy, in `siteRoutes`' own order
    ...staticPages.map((page) => [page.slug]),
  ];
}

/** the markdown for one route, or null if that route has none */
export function markdownFor(route: MarkdownRoute): string | null {
  const [first, second] = route;

  if (route.length === 1) {
    if (first === HOME) return home();
    if (first === "work") return work();
    if (first === "blogs") return blogIndex();
    if (first === "lab") return labIndex();

    const page = staticPageFor(first);
    if (page) return staticPage(page);

    return null;
  }

  if (route.length === 2) {
    if (first === "blogs") return blogPost(second);
    if (first === "lab") return labDetail(second);
  }

  return null;
}

/**
 * A YAML scalar, always quoted.
 *
 * A title is free text and several carry a colon, which is the one character
 * that turns a quoted-optional scalar into a parse error rather than into a
 * wrong value. Quoting every one of them means no caller has to know which.
 */
function scalar(value: string): string {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

function frontmatter(fields: Record<string, string | undefined>): string {
  const lines = Object.entries(fields)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => `${key}: ${scalar(value as string)}`);

  return `---\n${lines.join("\n")}\n---`;
}

/**
 * Joins blocks with one blank line, dropping any that came back empty.
 *
 * `undefined` is allowed so an optional field can be passed straight in rather
 * than every caller guarding it.
 */
function doc(...blocks: (string | undefined)[]): string {
  return `${blocks.filter(Boolean).join("\n\n").trim()}\n`;
}

const url = (route: string) => `${SITE_URL}${route}`;

/**
 * A paragraph of segments, rendered as the markdown it already is.
 *
 * The segments join with nothing between them, the same as the page does, since
 * each one carries its own spacing. An internal href is made absolute, because a
 * markdown file has no page to be relative to.
 *
 * Typed on `segments` alone rather than on `Paragraph`, since the home page's
 * paragraphs carry a tone and the static pages' do not, and neither shape's
 * extra fields mean anything here.
 */
function inline(paragraph: { segments: ProseSegment[] }): string {
  return paragraph.segments
    .map((segment) => {
      if (typeof segment === "string") return segment;
      if ("name" in segment) return segment.name;
      if ("code" in segment) return `\`${segment.code}\``;
      const href = segment.href.startsWith("http")
        ? segment.href
        : url(segment.href);
      return `[${segment.text}](${href})`;
    })
    .join("");
}

function home(): string {
  return doc(
    frontmatter({ title: "Sanyam Punia", url: url("/") }),
    "# Sanyam Punia",
    // the page's own four paragraphs, off the same array it renders from
    ...paragraphs.map(inline),
    "## Elsewhere",
    [
      ...Object.entries(socials).map(([name, href]) => `- ${name}: ${href}`),
      `- email: ${EMAIL}`,
    ].join("\n"),
    `Every page is served as markdown at its own path plus \`.md\`, and at its own path for a request sending \`Accept: text/markdown\`. The index is at ${url("/llms.txt")}.`,
  );
}

/** a page's own path as its markdown path. The root is `/index.md`. */
const mdPath = (href: string) => (href === "/" ? `/${HOME}` : href);

/** one `- [Title](url): note` row, which is the shape llmstxt.org asks for */
const entry = (title: string, route: string, note: string) =>
  `- [${title}](${url(`${route}.md`)}): ${note}`;

/**
 * The same row for a file that is not a page. The label is the path rather than
 * a title, since the path is the thing being named, and the target is absolute
 * so a client that read this document out of context can still follow it.
 */
const file = (route: string, note: string) =>
  `- [${route}](${url(route)}): ${note}`;

/**
 * The index an agent looks for first, per the llmstxt.org convention: an `h1`, a
 * blockquote summary, then `##` sections of links with a note after each.
 *
 * It links the markdown rather than the pages, since the whole point of reaching
 * this file is to avoid parsing HTML. `llms-full.txt` is under `Optional`,
 * because the convention reserves that heading for what a client short of
 * context can skip, and one file holding every page is exactly that.
 *
 * **The guidance comes before the link lists.** A client that reads the top of
 * this file and stops should already know whether the site is worth a second
 * request, so `AGENT_WHEN_TO_USE` sits directly under the summary rather than at
 * the end beside the profile. `/agents.md` is the same guidance on its own, for
 * anything that looks for an agent instruction file by name instead.
 */
export function llmsIndex(): string {
  return doc(
    "# Sanyam Punia",
    `> ${DESCRIPTION}`,
    "Every page is served as markdown at its own path plus `.md`, and at its own path for a request sending `Accept: text/markdown`. Nothing here needs a key, and nothing needs JavaScript to render.",
    AGENT_WHEN_TO_USE,
    "## Pages",
    // off `siteRoutes`, so a page added there is listed here with its own note
    siteRoutes
      .map((route) => entry(route.title, mdPath(route.href), route.note))
      .join("\n"),
    "## Blogs",
    getAllBlogs()
      .map((blog) => entry(blog.title, `/blogs/${blog.slug}`, blog.description))
      .join("\n"),
    "## Lab",
    labsRegistry
      .slice()
      .reverse()
      .filter((lab) => isImplemented(lab.slug))
      .map((lab) => entry(lab.title, `/lab/${lab.slug}`, lab.description[0]))
      .join("\n"),
    "## Optional",
    [
      `- [Agent instructions](${url("/agents.md")}): the guidance above on its own, with the fetch conventions`,
      `- [Every page in one file](${url("/llms-full.txt")}): the same documents concatenated`,
      `- [Sitemap](${url("/sitemap.xml")}): the same set of pages as XML`,
    ].join("\n"),
    // the hand-written half, which is everything about the person rather than
    // about a page. See `lib/profile.ts` for what this replaced.
    PROFILE,
  );
}

/**
 * `/agents.md`, the agent instruction file.
 *
 * It is `llms.txt`'s guidance without the link lists, plus the two things that
 * belong in an instruction file rather than an index: what is actually here, in
 * counts, and every machine-readable path with what it answers.
 *
 * **The guidance itself is one constant shared with `llms.txt`.** A second copy
 * would drift, and an agent that read both would get two answers. The counts
 * below are derived for the same reason.
 */
export function agentInstructions(): string {
  const posts = getAllBlogs().length;
  const labs = labsRegistry.filter((lab) => isImplemented(lab.slug)).length;

  return doc(
    frontmatter({ title: "Agent instructions", url: url("/agents.md") }),
    "# Agent instructions for sanyam.sh",
    `> ${DESCRIPTION}`,
    "This is the whole of the agent-facing configuration for this site. There is no key to hold, no rate plan and no login.",
    "## What is here",
    [
      `- ${siteRoutes.length} pages: ${siteRoutes.map((route) => route.title).join(", ")}.`,
      `- ${posts} write-ups, each with a date and a description.`,
      `- ${labs} lab experiments, each with a build note.`,
    ].join("\n"),
    AGENT_WHEN_TO_USE,
    "## Machine-readable paths",
    [
      file(
        "/llms.txt",
        "the index. Every page with a line on each. Fetch this first.",
      ),
      file("/agents.md", "this file."),
      file(
        "/llms-full.txt",
        "every page in one file. Large, and only worth it if you want all of it.",
      ),
      file(
        "/sitemap.xml",
        "the same pages as XML, with a date wherever a real one exists.",
      ),
      file("/robots.txt", "crawl rules. Everything is allowed except `/api/`."),
      "- Any page plus `.md`, or any page with `Accept: text/markdown`: that one page as markdown.",
    ].join("\n"),
    "## Contact",
    `Questions about the content, about usage, or a request to take something down: ${EMAIL}. ${url("/contact.md")} says what else is worth writing about.`,
  );
}

/**
 * The body a 404 answers with when the client wanted markdown.
 *
 * A real 404 status is the important half and the site already returned one. The
 * other half is that an agent which guessed a path wrongly has no way to recover
 * from the word "Not found": it does not know the index exists, and it has spent
 * a request to learn nothing. So the body names the index, the sitemap and every
 * page, which makes a wrong guess cost one more request rather than a dead end.
 *
 * **The path is echoed back, sanitised.** It comes from the route's own params
 * rather than from a header, and this is served as `text/markdown` rather than
 * HTML, so nothing here can execute. It is narrowed and capped anyway, since a
 * body that quotes a request is a body that can be made to say anything.
 */
export function notFoundMarkdown(route: MarkdownRoute = []): string {
  const asked = route
    .join("/")
    .replace(/[^\w./-]/g, "")
    .slice(0, 120);

  return doc(
    frontmatter({ title: "Not found", status: "404" }),
    "# Not found",
    asked
      ? `\`/${asked}\` is not a page on this site. This response is a real HTTP 404.`
      : "That is not a page on this site. This response is a real HTTP 404.",
    "## Where to look instead",
    [
      `- [llms.txt](${url("/llms.txt")}): every page on this site, with a line on each`,
      `- [agents.md](${url("/agents.md")}): when to use this site, and how to fetch it`,
      `- [sitemap.xml](${url("/sitemap.xml")}): the same set as XML`,
    ].join("\n"),
    "## Pages",
    siteRoutes
      .map((page) => entry(page.title, mdPath(page.href), page.note))
      .join("\n"),
    "Every page is served as markdown at its own path plus `.md`, and at its own path for a request sending `Accept: text/markdown`.",
  );
}

/**
 * Every document in one file, each keeping its own frontmatter so a client can
 * still tell where one page ends and the next begins.
 *
 * The home document goes first and the rest follow `markdownRoutes`, which is
 * the order the site itself is organised in rather than an alphabetical one.
 */
export function llmsFull(): string {
  return `${markdownRoutes()
    .map((route) => markdownFor(route))
    .filter(Boolean)
    .join("\n")}`;
}

function work(): string {
  return doc(
    frontmatter({ title: "Work", url: url("/work") }),
    "# Work",
    ...workSections.map((section) =>
      [
        `## ${section.label}`,
        "",
        section.rows
          .map((row) => `- [${row.name}](${row.href}), ${row.meta}`)
          .join("\n"),
      ].join("\n"),
    ),
  );
}

/**
 * One of the three prose pages, off the same array the page renders from.
 *
 * A section is a `##` and its paragraphs, which is the whole structure those
 * pages have, so this is a transcript rather than a summary. Same `inline` call
 * the home page's paragraphs go through, since both carry the same segments.
 */
function staticPage(page: StaticPage): string {
  return doc(
    frontmatter({
      title: page.title,
      url: url(`/${page.slug}`),
      description: page.description,
    }),
    `# ${page.title}`,
    page.lead,
    ...page.sections.map((section) =>
      [
        `## ${section.label}`,
        "",
        section.paragraphs.map(inline).join("\n\n"),
      ].join("\n"),
    ),
  );
}

function blogIndex(): string {
  return doc(
    frontmatter({ title: "Blogs", url: url("/blogs") }),
    "# Blogs",
    getAllBlogs()
      .map(
        (blog) =>
          `- [${blog.title}](${url(`/blogs/${blog.slug}`)}), ${blog.date}, ${blog.readTime}\n  ${blog.description}`,
      )
      .join("\n"),
  );
}

function blogPost(slug: string): string | null {
  const meta = getAllBlogs().find((blog) => blog.slug === slug);
  if (!meta) return null;

  return doc(
    frontmatter({
      title: meta.title,
      url: url(`/blogs/${slug}`),
      date: meta.date,
      readTime: meta.readTime,
      description: meta.description,
    }),
    `# ${meta.title}`,
    mdxBody(slug),
  );
}

/**
 * A post's `page.mdx`, which is already markdown apart from two things.
 *
 * The import at the top and the demo component mounted in the prose both belong
 * to the rendered page and cannot mean anything here, so they go rather than
 * turning into a stray tag an agent has to guess at. Everything else, headings
 * and code fences included, passes through untouched.
 *
 * **The fence flag is why this is a fold and not a regex over the whole file.**
 * Plenty of the code inside a fence starts with `<` or the word `import`, and a
 * pass that could not see where a fence began stripped lines out of the middle
 * of the examples the posts exist to show.
 */
function mdxBody(slug: string): string {
  const file = path.join(process.cwd(), "app", "blogs", slug, "page.mdx");
  if (!fs.existsSync(file)) return "";

  let fenced = false;
  const kept: string[] = [];

  for (const line of fs.readFileSync(file, "utf-8").split("\n")) {
    if (line.trimStart().startsWith("```")) {
      fenced = !fenced;
      kept.push(line);
      continue;
    }

    if (fenced) {
      kept.push(line);
      continue;
    }

    if (/^import\s/.test(line)) continue;

    /*
     * A self-closing capitalised element on its own line, which is how every
     * post mounts its demo. It leaves a note rather than nothing: two of the
     * posts put their demo under a heading of its own, and dropping the line
     * outright left a "## Live Demo" with an empty section under it.
     */
    if (/^<[A-Z][\w.]*\s*\/>$/.test(line.trim())) {
      kept.push("_An interactive demo runs here on the page._");
      continue;
    }

    kept.push(line);
  }

  // the stripped lines leave their blank neighbours behind
  return kept
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function labIndex(): string {
  return doc(
    frontmatter({ title: "Lab", url: url("/lab") }),
    "# Lab",
    // the registry reads oldest first and the index shows newest, the same as
    // `app/lab/page.tsx`
    labsRegistry
      .slice()
      .reverse()
      .filter((lab) => isImplemented(lab.slug))
      .map(
        (lab) =>
          `- [${lab.title}](${url(`/lab/${lab.slug}`)}), ${lab.createdAt}\n  ${lab.description[0]}`,
      )
      .join("\n"),
  );
}

function labDetail(slug: string): string | null {
  const lab = labsRegistry.find((entry) => entry.slug === slug);
  if (!lab || !isImplemented(slug)) return null;

  const sources = [
    lab.reference && `- Reference: ${lab.reference}`,
    lab.source && `- Source: ${lab.source}`,
  ].filter(Boolean) as string[];

  return doc(
    frontmatter({
      title: lab.title,
      url: url(`/lab/${slug}`),
      date: lab.createdAt,
    }),
    `# ${lab.title}`,
    lab.hint,
    // already carries this site's own two inline tokens, `backticks` and
    // [text](url), both of which are markdown to begin with
    lab.description.join("\n\n"),
    sources.length > 0 ? sources.join("\n") : "",
  );
}
