import path from "node:path";
import createMDX from "@next/mdx";
import type { NextConfig } from "next";

const withMDX = createMDX({
  extension: /\.mdx?$/,
  options: {
    // ids on every heading, which is what `TocRail` links to and what makes a
    // section addressable on its own. Named as a string, not imported: plugins
    // are passed to Turbopack's Rust side, which cannot take a JS function.
    rehypePlugins: ["rehype-slug"],
  },
});

const nextConfig: NextConfig = {
  // sibling projects in the parent folder mean Next can infer the wrong
  // workspace root, which changes how modules resolve
  turbopack: {
    root: path.resolve(import.meta.dirname),
  },
  // md/mdx intentionally excluded: blog content lives in page.mdx and is
  // re-exported by a sibling page.tsx that owns the route + metadata.
  pageExtensions: ["ts", "tsx", "js", "jsx"],
  reactStrictMode: true,
  // TypeScript 7 dropped the JS compiler API Next reads by default. This
  // routes Next's typecheck through the tsc CLI instead.
  experimental: {
    useTypeScriptCli: true,
  },
  compiler: {
    removeConsole: process.env.NODE_ENV === "production",
  },
  /*
   * Every page is also served as markdown at its own path plus `.md`.
   *
   * Two depths rather than one wildcard, because a literal suffix after a
   * repeated parameter is the pattern path matching does not reliably support:
   * `/:path*.md` does not match. The site is two segments deep at most.
   *
   * The root is `/index.md`, which falls out of the one-segment rule with `a`
   * set to `index`, so it needs no rule of its own. `lib/markdown.ts` maps that
   * segment back to the home page.
   */
  async rewrites() {
    return [
      { source: "/:a.md", destination: "/md/:a" },
      { source: "/:a/:b.md", destination: "/md/:a/:b" },
    ];
  },
  async redirects() {
    return [
      {
        source: "/cv",
        destination: "/files/sanyam_cv.pdf",
        permanent: false,
      },
      {
        source: "/resume",
        destination: "/files/sanyam_cv.pdf",
        permanent: false,
      },
    ];
  },
};

export default withMDX(nextConfig);
