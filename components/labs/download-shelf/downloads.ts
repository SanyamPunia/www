/**
 * What the page offers and how a simulated transfer behaves. Pure and
 * DOM-free: the component asks these functions what to draw and writes it.
 * Nothing leaves the browser, since no file is real.
 */
export const HOST = "fieldnotes.example";
export const PATH = "/releases/2.4";

export type Kind = "app" | "doc" | "archive" | "image";

export interface Offer {
  name: string;
  kind: Kind;
  /** bytes */
  size: number;
  /** what the row says under the name */
  note: string;
  /** the share of the file a first attempt reaches before the network drops */
  failAt?: number;
}

const MB = 1024 * 1024;

export const OFFERS: readonly Offer[] = [
  {
    name: "field-notes-2.4.dmg",
    kind: "app",
    size: 184 * MB,
    note: "macOS 13 and later, Apple silicon and Intel",
  },
  {
    name: "release-notes.pdf",
    kind: "doc",
    size: 2.1 * MB,
    note: "What changed, in eight pages",
  },
  {
    name: "screens.zip",
    kind: "archive",
    size: 48 * MB,
    note: "Every screen of the new editor",
    failAt: 0.62,
  },
  {
    name: "wallpaper.png",
    kind: "image",
    size: 6.4 * MB,
    note: "The launch picture at 5K",
  },
];

/** how long a whole transfer takes, whatever its size, so a big file is watchable */
export function duration(size: number): number {
  return Math.min(5.2, 1.4 + Math.log2(1 + size / MB) * 0.5);
}

/** the rate wanders on two sines, so no two transfers move in step */
export function rate(base: number, t: number, seed: number): number {
  return (
    base *
    (1 + 0.28 * Math.sin(t * 2.1 + seed) + 0.14 * Math.sin(t * 5.3 + seed * 3))
  );
}

/** "48.2 MB", "184 MB", "640 KB" */
export function bytes(n: number): string {
  if (n < MB) return `${Math.max(1, Math.round(n / 1024))} KB`;
  const mb = n / MB;
  return `${mb < 100 ? mb.toFixed(1).replace(/\.0$/, "") : Math.round(mb)} MB`;
}

/** two numbers in one unit, the way a browser writes them: "48.2 of 184 MB" */
export function of(got: number, total: number): string {
  const unit = total < MB ? "KB" : "MB";
  const div = unit === "KB" ? 1024 : MB;
  const a = got / div;
  const s = a < 100 ? a.toFixed(1).replace(/\.0$/, "") : String(Math.round(a));
  return `${s} of ${bytes(total)}`;
}

export function left(seconds: number): string {
  if (seconds < 60) return `${Math.max(1, Math.ceil(seconds))} s left`;
  return `${Math.ceil(seconds / 60)} min left`;
}

/** a second copy is "screens (1).zip", the way a browser names it */
export function unique(name: string, taken: readonly string[]): string {
  if (!taken.includes(name)) return name;
  const dot = name.lastIndexOf(".");
  const stem = dot > 0 ? name.slice(0, dot) : name;
  const ext = dot > 0 ? name.slice(dot) : "";
  for (let n = 1; ; n++) {
    const next = `${stem} (${n})${ext}`;
    if (!taken.includes(next)) return next;
  }
}

/** a point on the quadratic arc a file flies along to the toolbar */
export function arc(
  from: { x: number; y: number },
  to: { x: number; y: number },
  t: number,
): { x: number; y: number } {
  // the button sits in the top edge of the window, which clips, so the arc
  // rises most of the way first and then sweeps across under that edge
  const c = { x: from.x + (to.x - from.x) * 0.2, y: to.y + 6 };
  const u = 1 - t;
  return {
    x: u * u * from.x + 2 * u * t * c.x + t * t * to.x,
    y: u * u * from.y + 2 * u * t * c.y + t * t * to.y,
  };
}

export const easeInOut = (t: number) =>
  t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
