import { readdirSync } from "node:fs";
import { join } from "node:path";

/**
 * Which experiments have a hover preview clip, read off the filesystem rather
 * than declared in `labsRegistry`.
 *
 * `scripts/record-lab-previews.mjs` is what writes them, so the directory is
 * the only thing that knows which ones exist. A list kept by hand goes stale
 * the moment one recording fails, and what it fails into is a card playing
 * nothing. A lab with no clip renders no preview, which is the same trade a
 * post with no `meta.json` makes.
 *
 * `/lab` is statically prerendered, so this reads the directory once during the
 * build and never per request.
 */
const DIR = join(process.cwd(), "public/assets/labs");

export function labPreviewSlugs(): string[] {
  try {
    return readdirSync(DIR)
      .filter((file) => file.endsWith(".mp4"))
      .map((file) => file.slice(0, -4));
  } catch {
    // nothing recorded yet, which is a fresh clone rather than a failure
    return [];
  }
}
