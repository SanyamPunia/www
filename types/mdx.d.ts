/**
 * TypeScript no longer pulls in every package under `node_modules/@types`
 * automatically. `@types/mdx` only ever contributes `declare module "*.mdx"`
 * and is never imported by name, so without this reference a blog route's
 * `import Content from "./page.mdx"` fails to resolve.
 */

/// <reference types="mdx" />
