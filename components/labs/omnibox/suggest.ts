import {
  CursorClickIcon,
  EnvelopeIcon,
  FileTextIcon,
  FolderIcon,
  InfoIcon,
  NoteIcon,
  PaletteIcon,
  SealCheckIcon,
  SquaresFourIcon,
  UserIcon,
} from "@/components/icons";
import type { IconComponent } from "@/components/icons/icon";
import { labsRegistry } from "@/lib/labs";
import { siteRoutes } from "@/lib/pages";

export const SITE = "sanyam.sh";

export interface Entry {
  title: string;
  /** the path without its leading slash, "" for the home page */
  path: string;
  Icon: IconComponent;
}

const PAGE_ICONS: Record<string, IconComponent> = {
  "/": UserIcon,
  "/work": FolderIcon,
  "/blog": NoteIcon,
  "/lab": SquaresFourIcon,
  "/icons": PaletteIcon,
  "/about": InfoIcon,
  "/contact": EnvelopeIcon,
  "/privacy": SealCheckIcon,
};

/**
 * Every page and every lab, read off the lists the site renders from, so a
 * suggestion always goes somewhere real. Posts arrive later from the blog's
 * feed, since their list is read off the file system, which the browser cannot
 * reach.
 */
export const ENTRIES: readonly Entry[] = [
  ...siteRoutes.map((route) => ({
    title: route.title,
    path: route.href.slice(1),
    Icon: PAGE_ICONS[route.href] ?? FileTextIcon,
  })),
  ...labsRegistry.map((lab) => ({
    title: lab.title,
    path: `lab/${lab.slug}`,
    Icon: CursorClickIcon,
  })),
];

export const START: Entry =
  ENTRIES.find((entry) => entry.path === "lab") ?? ENTRIES[0];

/** The posts in a JSON Feed, as entries. An item off this site is dropped. */
export function postEntries(
  items: readonly { url?: string; title?: string }[],
): Entry[] {
  const origin = `https://${SITE}/`;
  return items.flatMap((item) =>
    item.url?.startsWith(origin) && item.title
      ? [
          {
            title: item.title,
            path: item.url.slice(origin.length),
            Icon: FileTextIcon,
          },
        ]
      : [],
  );
}

export function address(entry: Entry): string {
  return entry.path ? `${SITE}/${entry.path}` : SITE;
}

/** The strings a typed address may be the start of: with the host, and without */
function forms(entry: Entry): string[] {
  const full = address(entry);
  return entry.path ? [full, entry.path, `/${entry.path}`] : [full];
}

function restOf(entry: Entry, typed: string): string | null {
  const t = typed.toLowerCase();
  for (const form of forms(entry)) {
    if (form.toLowerCase().startsWith(t)) return form.slice(t.length);
  }
  return null;
}

/** Where `path` sits in the history, most recent first, or past the end */
function recency(history: readonly string[], path: string): number {
  const at = history.indexOf(path);
  return at === -1 ? history.length : at;
}

/**
 * The inline completion for what has been typed: the entry it finishes, and
 * the rest of that entry's address. The previous pick is kept while it still
 * matches, so typing the next letter of a completion eats it instead of
 * swapping in a different page. Otherwise a page visited more recently wins,
 * then the shortest address, which is the one a person is most likely to be on
 * their way to.
 */
export function complete(
  typed: string,
  keep: Entry | null,
  entries: readonly Entry[],
  history: readonly string[],
): { entry: Entry; rest: string } | null {
  if (!typed) return null;
  if (keep) {
    const rest = restOf(keep, typed);
    if (rest !== null) return { entry: keep, rest };
  }
  let best: { entry: Entry; rest: string; seen: number } | null = null;
  for (const entry of entries) {
    const rest = restOf(entry, typed);
    if (rest === null) continue;
    const seen = recency(history, entry.path);
    if (
      !best ||
      seen < best.seen ||
      (seen === best.seen &&
        (rest.length < best.rest.length ||
          (rest.length === best.rest.length &&
            address(entry) < address(best.entry))))
    ) {
      best = { entry, rest, seen };
    }
  }
  return best && { entry: best.entry, rest: best.rest };
}

export type Range = readonly [number, number] | null;

export interface Hit {
  entry: Entry;
  /** the matched letters in the title and in the address, to set in ink */
  title: Range;
  url: Range;
  /** whether it is in this session's history, which the row shows */
  visited: boolean;
}

const BOUNDARY = /[\s/.-]/;

/** Where `t` first starts a word in `text`, or failing that where it first appears */
function find(text: string, t: string): { at: number; word: boolean } | null {
  const lower = text.toLowerCase();
  let at = lower.indexOf(t);
  let first: number | null = null;
  while (at !== -1) {
    if (first === null) first = at;
    if (at === 0 || BOUNDARY.test(lower[at - 1])) return { at, word: true };
    at = lower.indexOf(t, at + 1);
  }
  return first === null ? null : { at: first, word: false };
}

/**
 * The rows under the bar, best first. An address that starts with what was
 * typed beats a title that does, which beats a word inside either, and a page
 * already visited this session steps up one band. The completed entry always
 * leads, since it is what Enter goes to.
 *
 * With nothing typed the history leads, newest first, and the main pages fill
 * the rest.
 */
export function suggest(
  typed: string,
  lead: Entry | null,
  entries: readonly Entry[],
  history: readonly string[],
  limit = 6,
): Hit[] {
  const t = typed.trim().toLowerCase();
  const seen = new Set(history);
  if (!t) {
    const byPath = new Map(entries.map((entry) => [entry.path, entry]));
    const recent = history.flatMap((path) => byPath.get(path) ?? []);
    const pages = entries.filter(
      (entry) => !seen.has(entry.path) && !entry.path.includes("/"),
    );
    return [...recent, ...pages].slice(0, limit).map((entry) => ({
      entry,
      title: null,
      url: null,
      visited: seen.has(entry.path),
    }));
  }
  const scored: { hit: Hit; score: number }[] = [];
  for (const entry of entries) {
    const url = address(entry);
    const inTitle = find(entry.title, t);
    const inUrl = find(url, t);
    if (!inTitle && !inUrl) continue;
    let score = 0;
    if (restOf(entry, t) !== null) score = 4;
    else if (inTitle?.at === 0) score = 3;
    else if (inTitle?.word) score = 2.5;
    else if (inUrl?.word) score = 2;
    else if (inTitle) score = 1;
    else score = 0.5;
    const visited = seen.has(entry.path);
    if (visited) score += 1;
    if (lead && entry.path === lead.path) score = 10;
    const range = (m: { at: number } | null): Range =>
      m ? [m.at, m.at + t.length] : null;
    scored.push({
      hit: { entry, title: range(inTitle), url: range(inUrl), visited },
      score,
    });
  }
  scored.sort(
    (a, b) =>
      b.score - a.score ||
      recency(history, a.hit.entry.path) - recency(history, b.hit.entry.path) ||
      a.hit.entry.path.length - b.hit.entry.path.length ||
      a.hit.entry.title.localeCompare(b.hit.entry.title),
  );
  return scored.slice(0, limit).map((s) => s.hit);
}
