/*
 * What a file is, before and after it is dropped. Pure, so the drag preview,
 * the drop and the list all answer the same questions the same way.
 *
 * - **A drag carries types and no names.** Until the drop, the browser hands
 *   over each item's MIME type and nothing else, so `preview` judges a drag by
 *   type alone. A file whose type is blank during the drag is judged again by
 *   its name once it lands.
 * - **A file is accepted or rejected for one stated reason**, and the reason is
 *   what the row says. No file is turned away silently.
 */

export type Kind = "image" | "pdf" | "sheet" | "archive" | "text";

/** one hue per kind, scoped to this experiment and not tokens */
export const HUE: Record<Kind, string> = {
  image: "#2f5fd0",
  pdf: "#c43c32",
  sheet: "#1f7a4c",
  archive: "#94600f",
  text: "#4b5563",
};

export const LIMIT = {
  /** the largest file the zone takes */
  bytes: 10 * 1024 * 1024,
  /** the most files one card takes at once */
  files: 20,
} as const;

const EXTENSIONS: Record<string, Kind> = {
  png: "image",
  jpg: "image",
  jpeg: "image",
  gif: "image",
  webp: "image",
  avif: "image",
  svg: "image",
  heic: "image",
  pdf: "pdf",
  csv: "sheet",
  tsv: "sheet",
  xls: "sheet",
  xlsx: "sheet",
  numbers: "sheet",
  zip: "archive",
  gz: "archive",
  tar: "archive",
  "7z": "archive",
  txt: "text",
  md: "text",
  json: "text",
  rtf: "text",
};

export function extension(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot > 0 ? name.slice(dot + 1).toLowerCase() : "";
}

/** what a MIME type is, or null when it says nothing the zone can use */
export function kindOfType(type: string): Kind | null {
  if (type.startsWith("image/")) return "image";
  if (type === "application/pdf") return "pdf";
  if (
    type === "text/csv" ||
    type === "text/tab-separated-values" ||
    type.includes("spreadsheet") ||
    type.includes("ms-excel")
  )
    return "sheet";
  if (type.includes("zip") || type.includes("compressed")) return "archive";
  if (type.startsWith("text/") || type === "application/json") return "text";
  return null;
}

/** the type first, then the name, since some systems drop a blank type */
export function kindOf(name: string, type: string): Kind | null {
  return kindOfType(type) ?? EXTENSIONS[extension(name)] ?? null;
}

export type Verdict =
  | { ok: true; kind: Kind }
  | { ok: false; reason: string; kind: Kind | null };

export function judge(
  name: string,
  type: string,
  size: number,
  room: number,
): Verdict {
  const kind = kindOf(name, type);
  if (!kind) return { ok: false, kind: null, reason: "Not supported" };
  if (size > LIMIT.bytes) return { ok: false, kind, reason: "Over 10 MB" };
  if (room <= 0) return { ok: false, kind, reason: "Too many files" };
  return { ok: true, kind };
}

/**
 * What a drag in flight will do, from the types it carries. `unknown` counts
 * the items whose type is blank, which a folder and some file systems hand
 * over, and which are judged by name once they land.
 */
export function preview(types: readonly string[]): {
  count: number;
  accepted: number;
  unknown: number;
} {
  let accepted = 0;
  let unknown = 0;
  for (const t of types) {
    if (t === "") unknown += 1;
    else if (kindOfType(t)) accepted += 1;
  }
  return { count: types.length, accepted, unknown };
}

/** the zone's one line while a drag is over the page */
export function dragLine(p: ReturnType<typeof preview>): string {
  if (p.count === 0) return "Drop to upload";
  const rejected = p.count - p.accepted - p.unknown;
  if (rejected === 0)
    return `Drop ${p.count} ${p.count === 1 ? "file" : "files"}`;
  if (rejected === p.count) return "Not supported";
  return `${p.count - rejected} of ${p.count} can upload`;
}

export function bytes(n: number): string {
  if (n < 1024) return `${Math.round(n)} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  const mb = n / (1024 * 1024);
  return `${mb < 10 ? mb.toFixed(1) : Math.round(mb)} MB`;
}

export function hash(n: number): number {
  let x = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b);
  x ^= x >>> 13;
  x = Math.imul(x, 0xc2b2ae35);
  x ^= x >>> 16;
  return (x >>> 0) / 4294967296;
}

export function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
