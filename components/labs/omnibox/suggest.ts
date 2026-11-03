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
 * suggestion always goes somewhere real. Posts are not here: their list is read
 * off the file system, which a client component cannot reach.
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

/**
 * The inline completion for what has been typed: the entry it finishes, and
 * the rest of that entry's address. The previous pick is kept while it still
 * matches, so typing the next letter of a completion eats it instead of
 * swapping in a different page. Otherwise the shortest address wins, which is
 * the one a person is most likely to be on their way to.
 */
export function complete(
  typed: string,
  keep: Entry | null,
): { entry: Entry; rest: string } | null {
  if (!typed) return null;
  if (keep) {
    const rest = restOf(keep, typed);
    if (rest !== null) return { entry: keep, rest };
  }
  let best: { entry: Entry; rest: string } | null = null;
  for (const entry of ENTRIES) {
    const rest = restOf(entry, typed);
    if (rest === null) continue;
    if (
      !best ||
      rest.length < best.rest.length ||
      (rest.length === best.rest.length && address(entry) < address(best.entry))
    ) {
      best = { entry, rest };
    }
  }
  return best;
}

export type Range = readonly [number, number] | null;

export interface Hit {
  entry: Entry;
  /** the matched letters in the title and in the address, to set in ink */
  title: Range;
  url: Range;
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
 * typed beats a title that does, which beats a word inside either. The
 * completed entry always leads, since it is what Enter goes to.
 */
export function suggest(typed: string, lead: Entry | null, limit = 6): Hit[] {
  const t = typed.trim().toLowerCase();
  if (!t) {
    return ENTRIES.filter((entry) => !entry.path.startsWith("lab/"))
      .slice(0, limit)
      .map((entry) => ({ entry, title: null, url: null }));
  }
  const scored: { hit: Hit; score: number }[] = [];
  for (const entry of ENTRIES) {
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
    if (entry === lead) score = 10;
    const range = (m: { at: number } | null): Range =>
      m ? [m.at, m.at + t.length] : null;
    scored.push({
      hit: { entry, title: range(inTitle), url: range(inUrl) },
      score,
    });
  }
  scored.sort(
    (a, b) =>
      b.score - a.score ||
      a.hit.entry.path.length - b.hit.entry.path.length ||
      a.hit.entry.title.localeCompare(b.hit.entry.title),
  );
  return scored.slice(0, limit).map((s) => s.hit);
}
