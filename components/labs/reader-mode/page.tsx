import { memo, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { AD_AFTER, ARTICLE, MOST_READ, READ_MINUTES } from "./article";

/** What reader mode is set to. Each value is an index into its own list */
export interface Look {
  size: number;
  width: number;
  theme: number;
}

/** Reader body sizes in px, off the type scale like any type printed on a drawn page */
export const SIZES = [15, 17, 19, 21] as const;
/** the sheet's width, padding included, capped at the column */
export const WIDTHS = [
  { name: "Narrow", rem: 21 },
  { name: "Medium", rem: 26 },
  { name: "Wide", rem: 33 },
] as const;
/**
 * Reader themes. A theme colours the sheet the article lifts onto and nothing
 * else: the page around it stays the ordinary page's grey. Every `lift` is the same list of four shadows in the
 * same order, inset first, with any a theme does not want left transparent:
 * two lists of different shapes cannot be blended, so the browser swaps the
 * shadow on the first frame while the colours are still easing. Paper is the site's tokens, night the inverse set, and
 * sepia is the one scoped set.
 */
export const THEMES = [
  {
    name: "Paper",
    sheet: "var(--color-bg)",
    ink: "var(--color-text-primary)",
    soft: "var(--color-text-secondary)",
    muted: "var(--color-text-muted)",
    lift: "inset 0 1px 0 rgb(255 255 255 / 0), 0 1px 2px rgb(0 0 0 / 0.06), 0 8px 20px -8px rgb(0 0 0 / 0.14), 0 0 0 1px var(--color-stroke)",
  },
  {
    name: "Sepia",
    sheet: "#f7f0e2",
    ink: "#3a2f22",
    soft: "#5f4f3c",
    muted: "#857262",
    lift: "inset 0 1px 0 rgb(255 255 255 / 0), 0 1px 2px rgb(74 52 24 / 0.08), 0 8px 20px -8px rgb(74 52 24 / 0.2), 0 0 0 1px rgb(74 52 24 / 0.08)",
  },
  {
    name: "Night",
    sheet: "var(--color-inverse-fill)",
    ink: "var(--color-inverse-text)",
    soft: "var(--color-inverse-text-secondary)",
    muted: "var(--color-inverse-text-secondary)",
    lift: "inset 0 1px 0 rgb(255 255 255 / 0.06), 0 1px 2px rgb(0 0 0 / 0.12), 0 8px 20px -8px rgb(0 0 0 / 0.3), 0 0 0 1px var(--color-inverse-stroke)",
  },
] as const;
export const DEFAULT_LOOK: Look = { size: 1, width: 1, theme: 0 };

/** a card standing on the ordinary page's grey ground */
const CARD =
  "rounded-lg bg-bg p-3 shadow-[0_1px_2px_rgb(0_0_0/0.06),0_6px_14px_-6px_rgb(0_0_0/0.1)] outline outline-stroke";
const SKY = "linear-gradient(180deg, #f3c9a8 0%, #e9a99b 45%, #8f8fb8 100%)";
const SEA = "linear-gradient(180deg, #6f7fa8 0%, #4b5a82 100%)";
/**
 * One clock for everything the page does: the glide in `index.tsx`, the sheet
 * and every colour. Colours on their own clock reached the new theme before the
 * sheet did, so the text changed first and the sheet after it.
 */
export const MOVE_MS = 480;
export const MOVE_EASE = "cubic-bezier(0.32, 0.72, 0, 1)";
/**
 * The same clock as classes, behind `motion-safe:`. Text size and the column's
 * width are transitions too, so text grows and rewraps continuously rather than
 * jumping to its new lines, and `index.tsx` holds the scroll on every frame.
 */
export const PAINT =
  "motion-safe:[transition:background-color_480ms_cubic-bezier(0.32,0.72,0,1),box-shadow_480ms_cubic-bezier(0.32,0.72,0,1)]";
const COLORS =
  "motion-safe:[transition:color_480ms_cubic-bezier(0.32,0.72,0,1),font-size_480ms_cubic-bezier(0.32,0.72,0,1)]";
const FRAME =
  "motion-safe:[transition:max-width_480ms_cubic-bezier(0.32,0.72,0,1),padding_480ms_cubic-bezier(0.32,0.72,0,1)]";

/**
 * The page. Every block that reader mode keeps carries `data-read` and every
 * block it drops carries `data-clutter`, which is all the toggle reads. The
 * same nodes are kept in both modes and only their classes change, so a block
 * can be measured before the change and after it.
 */
export const Page = memo(function Page({
  reader,
  look,
}: {
  reader: boolean;
  look: Look;
}) {
  const size = SIZES[look.size];
  const hide = reader ? "hidden" : "";
  const quiet = reader ? "text-(--rd-muted)" : "text-text-muted";

  return (
    // in reader mode this box is the sheet's size, and the sheet is its own
    // layer under it, so the sheet's box can glide while the box itself moves
    <div
      className={cn(
        "relative isolate mx-auto w-full",
        FRAME,
        reader && "p-5 sm:p-8",
      )}
      // always set, so a change of width has two lengths to move between
      style={{
        maxWidth: reader ? `min(${WIDTHS[look.width].rem}rem, 100%)` : "100%",
      }}
    >
      <span
        data-sheet
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute inset-0 -z-10 rounded-xl",
          PAINT,
        )}
        style={{
          backgroundColor: "var(--rd-sheet)",
          boxShadow: "var(--rd-lift)",
          opacity: reader ? 1 : 0,
        }}
      />
      <header
        data-clutter
        className={cn("mb-5 flex items-center justify-between gap-3", hide)}
      >
        <span className="font-medium text-action text-text-primary">
          The Harbour Times
        </span>
        <span className="rounded-full bg-text-primary px-2.5 py-1 text-meta text-bg">
          Subscribe
        </span>
      </header>

      <div
        className={
          reader
            ? "flex flex-col"
            : "grid gap-6 sm:grid-cols-[minmax(0,1fr)_8.5rem]"
        }
      >
        <article
          className={cn("flex min-w-0 flex-col", reader ? "gap-5" : "gap-3")}
        >
          <p data-read className={cn("text-meta", COLORS, quiet)}>
            {ARTICLE.kicker}
          </p>
          <h1
            data-read
            className={cn(
              "-mt-1 font-medium leading-tight",
              COLORS,
              reader ? "text-(--rd-ink)" : "text-[1.35rem] text-text-primary",
            )}
            style={reader ? { fontSize: size * 1.55 } : undefined}
          >
            {ARTICLE.title}
          </h1>
          <p
            data-read
            className={cn(
              "flex flex-wrap items-center gap-1.5 text-meta",
              COLORS,
              quiet,
            )}
          >
            <span>By {ARTICLE.author}</span>
            <Dot />
            <span>{ARTICLE.date}</span>
            {reader && (
              <>
                <Dot data-appear />
                <span data-appear>{READ_MINUTES} min read</span>
              </>
            )}
          </p>
          <div
            data-read
            data-scale
            aria-hidden="true"
            className="relative aspect-[16/9] w-full overflow-hidden rounded-lg shadow-[inset_0_0_0_1px_rgb(0_0_0/0.06)]"
            style={{ background: SKY }}
          >
            <span
              className="absolute inset-x-0 bottom-0 h-[30%]"
              style={{ background: SEA }}
            />
            <span className="absolute bottom-[26%] left-[58%] h-[46%] w-[6%] rounded-t-sm bg-bg" />
            <span className="absolute bottom-[72%] left-[57%] h-[6%] w-[8%] rounded-sm bg-text-primary/70" />
          </div>
          <p data-read className={cn("-mt-1 text-meta", COLORS, quiet)}>
            {ARTICLE.caption}
          </p>
          {ARTICLE.paragraphs.map((p, i) => (
            <WithAdvert key={p} index={i} reader={reader}>
              <p
                data-read
                className={cn(
                  COLORS,
                  reader
                    ? "text-(--rd-soft) leading-[1.7]"
                    : "text-body text-text-secondary",
                )}
                style={reader ? { fontSize: size } : undefined}
              >
                {p}
              </p>
            </WithAdvert>
          ))}
        </article>

        <aside
          data-clutter
          className={cn("flex flex-col gap-3 self-start", reader && "hidden")}
        >
          <div className={cn(CARD, "flex flex-col gap-2")}>
            <span className="text-meta text-text-muted">Most read</span>
            {MOST_READ.map((m, i) => (
              <span
                key={m}
                className="flex gap-2 text-meta text-text-primary leading-snug"
              >
                <span className="text-text-muted tabular-nums">{i + 1}</span>
                {m}
              </span>
            ))}
          </div>
          <Advert />
        </aside>
      </div>
    </div>
  );
});

function Dot(props: { "data-appear"?: boolean }) {
  return (
    <span
      {...props}
      aria-hidden="true"
      className="inline-block size-1 shrink-0 rounded-full bg-current opacity-60"
    />
  );
}

/** A paragraph, with the inline advert after the one it follows */
function WithAdvert({
  index,
  reader,
  children,
}: {
  index: number;
  reader: boolean;
  children: ReactNode;
}) {
  return (
    <>
      {children}
      {index === AD_AFTER && (
        <div data-clutter className={cn("my-1", reader && "hidden")}>
          <Advert />
        </div>
      )}
    </>
  );
}

function Advert() {
  return (
    <div className={cn(CARD, "flex flex-col gap-0.5")}>
      <span className="text-meta text-text-muted">Advertisement</span>
      <span className="font-medium text-action text-text-primary">
        Island ferries
      </span>
      <span className="text-meta text-text-secondary">
        Winter passes, 20% off
      </span>
    </div>
  );
}
