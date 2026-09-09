/**
 * Every promise this site makes to an agent, checked against a running server.
 *
 * It covers the four things the readiness audit asked for and the behaviour they
 * were built on top of: a real 404 with somewhere to go, an agent instruction
 * file that says when to use the site, the three trust pages, and identity
 * markup a parser can read. It also re-checks the paths that already worked, so
 * a change to the markdown pipeline cannot quietly break them.
 *
 * It drives a server that is already listening rather than starting one, since
 * two Next servers cannot share one `.next`.
 *
 *   pnpm dev && pnpm test:agents                     the dev server on 3100
 *   AGENT_BASE=http://localhost:3000 pnpm test:agents  a `next start` build
 *   AGENT_BASE=https://sanyam.sh pnpm test:agents      production
 *
 * `next dev` compiles a route on its first request, so the first few checks are
 * slower than the rest. Nothing here writes anything.
 */
import assert from "node:assert/strict";
import test from "node:test";

const BASE =
  process.env.AGENT_BASE ?? process.env.PREVIEW_BASE ?? "http://localhost:3100";

/** a path that is not a page and never will be, for the 404 checks */
const MISSING = "/this-path-does-not-exist-9c1f";

const TRUST = [
  { slug: "about", type: "AboutPage" },
  { slug: "contact", type: "ContactPage" },
  { slug: "privacy", type: "WebPage" },
];

/** every page the site claims to have, in `siteRoutes`' order */
const PAGES = [
  "/",
  "/work",
  "/blogs",
  "/lab",
  "/about",
  "/contact",
  "/privacy",
];

async function get(path, headers = {}) {
  const response = await fetch(new URL(path, BASE), {
    headers,
    redirect: "manual",
  });
  return {
    status: response.status,
    type: response.headers.get("content-type") ?? "",
    headers: response.headers,
    body: await response.text(),
  };
}

/**
 * The visible text of an HTML page, which is what the 500-character floor is
 * about. Script and style bodies go first, or the JSON-LD and the framework's
 * own payload would count toward the content.
 */
function text(html) {
  return html
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&(?:nbsp|#160);/g, " ")
    .replace(/&(?:amp|#38);/g, "&")
    .replace(/&(?:rsquo|#8217);/g, "’")
    .replace(/\s+/g, " ")
    .trim();
}

/** every JSON-LD block on a page, parsed */
function jsonLd(html) {
  const blocks = [
    ...html.matchAll(
      /<script[^>]+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi,
    ),
  ];
  return blocks.map((block) => JSON.parse(block[1].replace(/\\u003c/g, "<")));
}

/** the node of a given `@type`, whether the document is a `@graph` or not */
function node(schema, type) {
  const nodes = Array.isArray(schema["@graph"]) ? schema["@graph"] : [schema];
  return nodes.find((entry) => entry["@type"] === type);
}

test("an unknown path answers a real 404 with somewhere to go", async () => {
  const page = await get(MISSING);

  assert.equal(page.status, 404, "a missing page must not answer 200");
  assert.match(page.type, /text\/html/);

  // the recovery half: a reader that guessed wrongly is told where the index is
  const body = text(page.body);
  assert.match(body, /llms\.txt/i);
  assert.match(body, /sitemap\.xml/i);
  assert.match(page.body, /href="\/llms\.txt"/);
  assert.match(page.body, /href="\/sitemap\.xml"/);
});

test("an unknown .md path answers 404 as markdown", async () => {
  const page = await get(`${MISSING}.md`);

  assert.equal(page.status, 404);
  assert.match(page.type, /text\/markdown/);
  assert.match(page.body, /^---\n/);
  assert.match(page.body, /# Not found/);
  assert.match(page.body, /\/llms\.txt/);
  assert.match(page.body, /\/agents\.md/);
  assert.match(page.body, /\/sitemap\.xml/);
  assert.equal(page.headers.get("x-robots-tag"), "noindex");
  assert.match(page.headers.get("vary") ?? "", /accept/i);

  // and every page it could have meant instead
  for (const path of PAGES) {
    const md = path === "/" ? "/index.md" : `${path}.md`;
    assert.ok(page.body.includes(md), `the 404 body should list ${md}`);
  }
});

test("an unknown path negotiates to the same markdown 404", async () => {
  const page = await get(MISSING, { accept: "text/markdown" });

  assert.equal(page.status, 404);
  assert.match(page.type, /text\/markdown/);
  assert.match(page.body, /# Not found/);
  // the path it was asked for, echoed back so a client can log what it guessed
  assert.ok(page.body.includes(MISSING.slice(1)));
});

test("the markdown 404 body cannot be made to say anything", async () => {
  const page = await get("/<script>alert(1)</script>.md");

  assert.equal(page.status, 404);
  assert.ok(
    !page.body.includes("<script>"),
    "the echoed path must be narrowed",
  );
  assert.ok(!page.body.includes("alert(1)"));
});

test("llms.txt says when to use the site", async () => {
  const index = await get("/llms.txt");

  assert.equal(index.status, 200);
  assert.match(index.body, /^# Sanyam Punia/);
  assert.match(index.body, /## When to use this site/);
  assert.match(index.body, /## When not to use it/);
  assert.match(index.body, /## How to call it/);
  // the guidance comes before the link lists, so a client that stops early has it
  assert.ok(
    index.body.indexOf("## When to use this site") <
      index.body.indexOf("## Pages"),
  );

  assert.match(index.body, /\/agents\.md/);
  assert.match(index.body, /\/sitemap\.xml/);
  for (const { slug } of TRUST) {
    assert.ok(
      index.body.includes(`/${slug}.md`),
      `llms.txt should list ${slug}`,
    );
  }
});

test("agents.md is an agent instruction file", async () => {
  const doc = await get("/agents.md");

  assert.equal(doc.status, 200, "/agents.md must not be rewritten away");
  assert.match(doc.type, /text\/markdown/);
  assert.match(doc.body, /# Agent instructions for sanyam\.sh/);
  assert.match(doc.body, /## When to use this site/);
  assert.match(doc.body, /## When not to use it/);
  assert.match(doc.body, /## How to call it/);
  assert.match(doc.body, /## What is here/);
  assert.match(doc.body, /## Machine-readable paths/);
  // the counts are derived, so they have to be numbers rather than placeholders
  assert.match(doc.body, /- \d+ write-ups/);
  assert.match(doc.body, /- \d+ lab experiments/);
});

for (const { slug, type } of TRUST) {
  test(`/${slug} is a real page`, async () => {
    const page = await get(`/${slug}`);

    assert.equal(page.status, 200);
    assert.match(page.body, /<h1[^>]*>/);

    const content = text(page.body);
    assert.ok(
      content.length >= 500,
      `/${slug} has ${content.length} characters of text, under the 500 floor`,
    );

    // the markup a parser reads, and the two link relations the page announces
    const schema = jsonLd(page.body)[0];
    assert.ok(schema, `/${slug} should carry one JSON-LD block`);
    assert.equal(schema["@type"], type);
    assert.ok(schema.name);
    assert.ok(schema.description);
    assert.equal(schema.url, `https://sanyam.sh/${slug}`);
    assert.match(page.body, new RegExp(`rel="canonical"[^>]*/${slug}"`));
    assert.match(
      page.body,
      new RegExp(`type="text/markdown"[^>]*/${slug}\\.md"`),
    );
  });

  test(`/${slug}.md is the same page as markdown`, async () => {
    const doc = await get(`/${slug}.md`);

    assert.equal(doc.status, 200);
    assert.match(doc.type, /text\/markdown/);
    assert.match(doc.body, /^---\n/);
    assert.match(doc.body, new RegExp(`url: "https://sanyam\\.sh/${slug}"`));
    assert.match(doc.body, /^description: /m);
    assert.ok(doc.body.includes("## "), "the sections should survive");
    assert.ok(doc.body.length >= 500);
  });
}

test("the home page's identity markup carries name and description", async () => {
  const home = await get("/");

  assert.equal(home.status, 200);

  const schema = jsonLd(home.body)[0];
  assert.ok(schema, "the home page should carry one JSON-LD block");

  const person = node(schema, "Person");
  assert.ok(person, "a personal site's identity type is Person");
  assert.ok(person.name, "Person.name");
  assert.ok(person.description, "Person.description");
  assert.equal(person.url, "https://sanyam.sh");
  assert.ok(person.image, "Person.image");
  assert.ok(person.jobTitle, "Person.jobTitle");
  assert.ok(person.worksFor?.name, "Person.worksFor");
  assert.ok(Array.isArray(person.sameAs) && person.sameAs.length > 0);
  assert.ok(Array.isArray(person.knowsAbout) && person.knowsAbout.length > 0);

  const site = node(schema, "WebSite");
  assert.ok(site, "WebSite");
  assert.ok(site.name, "WebSite.name");
  assert.ok(site.description, "WebSite.description");
  assert.equal(site.url, "https://sanyam.sh");
  assert.equal(site.about?.["@id"], person["@id"]);
});

test("the sitemap lists the trust pages", async () => {
  const sitemap = await get("/sitemap.xml");

  assert.equal(sitemap.status, 200);
  for (const { slug } of TRUST) {
    assert.ok(
      sitemap.body.includes(`https://sanyam.sh/${slug}`),
      `sitemap.xml should list /${slug}`,
    );
  }
});

test("robots.txt still points a crawler at the sitemap", async () => {
  const robots = await get("/robots.txt");

  assert.equal(robots.status, 200);
  assert.match(robots.body, /Sitemap: https:\/\/sanyam\.sh\/sitemap\.xml/);
  assert.match(robots.body, /Disallow: \/api\//);
});

test("the pages that already worked still do", async () => {
  for (const path of PAGES) {
    const page = await get(path);
    assert.equal(page.status, 200, `${path} should still render`);
  }

  for (const path of ["/index.md", "/work.md", "/blogs.md", "/lab.md"]) {
    const doc = await get(path);
    assert.equal(doc.status, 200, `${path} should still render`);
    assert.match(doc.type, /text\/markdown/);
  }

  // the header half of the same feature
  const negotiated = await get("/work", { accept: "text/markdown" });
  assert.equal(negotiated.status, 200);
  assert.match(negotiated.type, /text\/markdown/);
  assert.match(negotiated.body, /^---\n/);
});

test("llms-full.txt carries every document, the new pages included", async () => {
  const full = await get("/llms-full.txt");

  assert.equal(full.status, 200);
  for (const { slug } of TRUST) {
    assert.ok(
      full.body.includes(`url: "https://sanyam.sh/${slug}"`),
      `llms-full.txt should include /${slug}`,
    );
  }
});
