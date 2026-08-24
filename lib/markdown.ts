import fs from "node:fs";
import path from "node:path";
import { getAllBlogs } from "./blogs";
import { SITE_URL } from "./constants";
import { isImplemented, labsRegistry } from "./labs";
import { PROFILE } from "./profile";
import {
  DESCRIPTION,
  EMAIL,
  type Paragraph,
  paragraphs,
  socials,
} from "./site";
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
 * A home page paragraph, rendered as the markdown it already is.
 *
 * The segments join with nothing between them, the same as the page does, since
 * each one carries its own spacing. An internal href is made absolute, because a
 * markdown file has no page to be relative to.
 */
function inline(paragraph: Paragraph): string {
  return paragraph.segments
    .map((segment) => {
      if (typeof segment === "string") return segment;
      if ("name" in segment) return segment.name;
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

/**
 * The index an agent looks for first, per the llmstxt.org convention: an `h1`, a
 * blockquote summary, then `##` sections of links with a note after each.
 *
 * It links the markdown rather than the pages, since the whole point of reaching
 * this file is to avoid parsing HTML. `llms-full.txt` is under `Optional`,
 * because the convention reserves that heading for what a client short of
 * context can skip, and one file holding every page is exactly that.
 */
export function llmsIndex(): string {
  const entry = (title: string, route: string, note: string) =>
    `- [${title}](${url(`${route}.md`)}): ${note}`;

  return doc(
    "# Sanyam Punia",
    `> ${DESCRIPTION}`,
    "Every page is served as markdown at its own path plus `.md`, and at its own path for a request sending `Accept: text/markdown`.",
    "## Pages",
    [
      entry("Home", "/index", "who this is, and everything below in one place"),
      entry("Work", "/work", "companies and side projects, newest first"),
      entry("Blogs", "/blogs", "the writing index"),
      entry("Lab", "/lab", "the UI experiment index"),
    ].join("\n"),
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
    `- [Every page in one file](${url("/llms-full.txt")}): the same documents concatenated`,
    // the hand-written half, which is everything about the person rather than
    // about a page. See `lib/profile.ts` for what this replaced.
    PROFILE,
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
