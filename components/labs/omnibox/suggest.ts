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

/** Edits between two strings, counting a swap of neighbours as one */
function distance(a: string, b: string): number {
  const d = Array.from({ length: a.length + 1 }, (_, i) =>
    Array.from({ length: b.length + 1 }, (_, j) =>
      i === 0 ? j : j === 0 ? i : 0,
    ),
  );
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(
        d[i - 1][j] + 1,
        d[i][j - 1] + 1,
        d[i - 1][j - 1] + cost,
      );
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      }
    }
  }
  return d[a.length][b.length];
}

/** Whether every letter of `t` appears in `text`, in order */
function within(text: string, t: string): boolean {
  let at = 0;
  for (const c of text) if (c === t[at]) at++;
  return at === t.length;
}

/**
 * How far `t` is from an entry, as a share of its own length, 0 for a near
 * miss and above 1 for nothing alike. Each word of the title and each part of
 * the path is a candidate, and so is the title whole, so a typo in one word
 * and a typo in a phrase both land. Letters in order, `tbstrp` for tab strip,
 * count as close.
 */
function closeness(entry: Entry, t: string): number {
  const title = entry.title.toLowerCase();
  const words = [title, ...title.split(/\s+/), ...entry.path.split(/[/-]/)];
  let best = Number.POSITIVE_INFINITY;
  for (const word of words) {
    if (!word) continue;
    // a typed fragment is compared with the same length of the word
    const part = word.slice(0, Math.max(t.length, 1));
    best = Math.min(best, distance(t, part) / t.length);
  }
  const squashed = title.replace(/\s+/g, "");
  if (t.length >= 3 && within(squashed, t)) best = Math.min(best, 0.25);
  return best;
}

/**
 * What the list offers when nothing matches. The closest entries by typo
 * tolerance, best first, when any is close enough to be a guess. Otherwise the
 * main pages, since a list that is only "no" is a dead end.
 */
export function nearby(
  typed: string,
  entries: readonly Entry[],
  history: readonly string[],
  limit = 4,
): { close: boolean; hits: Hit[] } {
  const t = typed
    .trim()
    .toLowerCase()
    .replace(/^\/+|^sanyam\.sh\/?/g, "");
  const seen = new Set(history);
  const hit = (entry: Entry): Hit => ({
    entry,
    title: null,
    url: null,
    visited: seen.has(entry.path),
  });
  if (t.length >= 2) {
    const ranked = entries
      .map((entry) => ({ entry, score: closeness(entry, t) }))
      .filter((r) => r.score <= 0.4)
      .sort(
        (a, b) =>
          a.score - b.score ||
          recency(history, a.entry.path) - recency(history, b.entry.path) ||
          a.entry.path.length - b.entry.path.length,
      );
    if (ranked.length) {
      return {
        close: true,
        hits: ranked.slice(0, limit).map((r) => hit(r.entry)),
      };
    }
  }
  return {
    close: false,
    hits: entries
      .filter((entry) => !entry.path.includes("/"))
      .slice(0, limit)
      .map(hit),
  };
}
