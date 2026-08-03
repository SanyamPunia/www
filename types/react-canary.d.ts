/**
 * `ViewTransition` ships in React's stable runtime that Next bundles for the
 * App Router, but `@types/react` still declares it in `canary.d.ts`, which is
 * opt-in. This reference turns those declarations on.
 *
 * Done here rather than via `compilerOptions.types`, because adding that array
 * to `tsconfig.json` would switch off automatic `@types` discovery for
 * everything else.
 */

/// <reference types="react/canary" />
