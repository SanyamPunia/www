"use client";

import { SquaresFourIcon, TerminalWindowIcon } from "@phosphor-icons/react";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import "./styles.css";

/*
 * One window, three stages of the same tab strip:
 *
 *   closed    the strip is a row of labels
 *   peek      hovering the strip grows it and every tab shows what it holds
 *   overview  the strip empties into a grid filling the window
 *
 * A tab is one element in all three. `layoutId` is what carries it between the
 * strip and the grid, so a card is tracked from where it was picked up to where
 * it lands rather than one node vanishing while another appears in place. Tab
 * order never changes, which is what makes that readable.
 *
 * Everything that moves runs on one spring. A card, the strip and the window
 * resize together, and at different speeds they would read as three pieces
 * rather than one window.
 */

type Stage = "closed" | "peek" | "overview";
/** what a tab is for, said with arrangement rather than with content */
type Shape = "stack" | "columns" | "sidebar" | "idle";
type Size = "sm" | "md";

interface Tab {
  id: string;
  /** the strip and the cards have room for this */
  label: string;
  /** the panel header is the one place wide enough for a path */
  title: string;
  shape: Shape;
}

const TABS: Tab[] = [
  { id: "dev", label: "pnpm dev", title: "~/www: pnpm dev", shape: "stack" },
  { id: "diff", label: "git diff", title: "~/www: git diff", shape: "columns" },
  {
    id: "log",
    label: "git log",
    title: "~/www: git log --graph",
    shape: "sidebar",
  },
  { id: "shell", label: "zsh", title: "~/www: zsh", shape: "idle" },
];

const SPRING = {
  type: "spring",
  stiffness: 460,
  damping: 38,
  mass: 0.8,
} as const;
const FADE = { duration: 0.12, ease: "easeOut" } as const;
/*
 * The preview animates its own height, and that is what opens and closes a card.
 *
 * Every earlier attempt let the card's `layout` animation do it, and a layout
 * animation resizes with a transform: the real box changes in frame one and the
 * transform fakes the old size. So the preview was either clipped away instantly
 * by `overflow-hidden` on that real box, or, with the clip removed, scaled to
 * three times its size and thrown below the card, because a child with no
 * projection node of its own inherits the parent's scale. Neither leaves a fade
 * anyone can see.
 *
 * Animating the child's height instead means no transform anywhere: the card's
 * height simply follows its content frame by frame, and the fade plays on an
 * element that is where it looks like it is.
 */
const PREVIEW_MOTION = {
  height: { duration: 0.26, ease: [0.32, 0.72, 0, 1] },
  opacity: { duration: 0.2, ease: "easeOut" },
} as const;

/** the panel leaves and returns through the bottom of the window, which clips it */
const SLIDE = { y: 40, opacity: 0 } as const;

const FOCUS =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-primary/15 focus-visible:ring-offset-2";

/*
 * `rounded-xl` in pixels, passed through `style` rather than as that class,
 * because a card is the one element here whose own size animates.
 *
 * Motion animates size with a transform, which stretches a corner radius along
 * whichever axis grew, and it undoes that distortion only for values it renders
 * itself: `if (valuesToRender[key] === undefined) continue` in its scale
 * corrector. A radius that lives in a class is invisible to it, so the corners
 * flatten for the length of the animation and snap back at the end, which reads
 * as a flicker on every hover. It also has to be px or a percentage. Motion
 * returns any other unit untouched.
 */
const RADIUS = 12;

/*
 * Two sizes of one skeleton, a card and the panel. Cards keep `sm` in both the
 * strip and the grid, so a card crossing between them carries identical content
 * and only its box moves.
 */
const SIZES: Record<Size, { bar: string; gap: string }> = {
  sm: { bar: "h-2.5", gap: "gap-2.5" },
  md: { bar: "h-3.5", gap: "gap-5" },
};

function Bar({ size, width }: { size: Size; width: string }) {
  return (
    <span
      className={cn("bar block shrink-0 rounded-full", SIZES[size].bar, width)}
    />
  );
}

/**
 * What a tab holds, at either size. Four bars at most: the arrangement is the
 * whole signal, and more lines only make four tabs look like one texture.
 *
 * Every element is phrasing content, because a card renders this inside the
 * `<button>` that selects it, where a `div` would be invalid markup.
 */
function Preview({ shape, size }: { shape: Shape; size: Size }) {
  const { gap } = SIZES[size];

  if (shape === "columns") {
    return (
      <span className={cn("grid grid-cols-2", gap)}>
        <span className={cn("flex flex-col", gap)}>
          <Bar size={size} width="w-full" />
          <Bar size={size} width="w-2/3" />
          <Bar size={size} width="w-5/6" />
        </span>
        <span className={cn("flex flex-col", gap)}>
          <Bar size={size} width="w-5/6" />
          <Bar size={size} width="w-full" />
          <Bar size={size} width="w-1/2" />
        </span>
      </span>
    );
  }

  if (shape === "sidebar") {
    return (
      <span className={cn("flex", gap)}>
        <span className={cn("flex w-1/4 flex-col", gap)}>
          <Bar size={size} width="w-full" />
          <Bar size={size} width="w-3/4" />
          <Bar size={size} width="w-5/6" />
        </span>
        <span className={cn("flex flex-1 flex-col", gap)}>
          <Bar size={size} width="w-2/3" />
          <Bar size={size} width="w-full" />
          <Bar size={size} width="w-1/2" />
        </span>
      </span>
    );
  }

  if (shape === "idle") {
    return (
      <span className={cn("flex flex-col", gap)}>
        <Bar size={size} width="w-1/2" />
        <Bar size={size} width="w-1/5" />
      </span>
    );
  }

  return (
    <span className={cn("flex flex-col", gap)}>
      <Bar size={size} width="w-3/4" />
      <Bar size={size} width="w-full" />
      <Bar size={size} width="w-2/3" />
      <Bar size={size} width="w-1/2" />
    </span>
  );
}

function TabCard({
  tab,
  current,
  expanded,
  onSelect,
  role,
}: {
  tab: Tab;
  current: boolean;
  /** a card carries its preview in the peek strip and in the grid, never closed */
  expanded: boolean;
  onSelect: () => void;
  role?: "tab";
}) {
  const filled = expanded || current;

  return (
    <motion.button
      layoutId={`tab-${tab.id}`}
      transition={SPRING}
      type="button"
      role={role}
      aria-selected={role === "tab" ? current : undefined}
      onClick={onSelect}
      style={{ borderRadius: RADIUS }}
      className={cn(
        `tone-${tab.id}`,
        // `card` is what carries hover and press, in the lab's stylesheet, since
        // both are washes of this tab's own hue
        "card flex h-full min-w-0 cursor-pointer flex-col p-2 text-left transition-colors duration-200",
        filled && "bg-bg ring-1 ring-inset",
        filled && (current ? "ring-stroke" : "ring-stroke-soft"),
        FOCUS,
      )}
    >
      <motion.span
        layout="position"
        transition={SPRING}
        className="flex min-w-0 items-center gap-1.5"
      >
        <TerminalWindowIcon
          aria-hidden="true"
          className="mark size-3.5 shrink-0"
        />
        <span
          className={cn(
            "truncate text-meta",
            current ? "text-text-primary" : "text-text-muted",
          )}
        >
          {tab.label}
        </span>
      </motion.span>

      {/*
       * The preview owns the open and close: its height animates, the card's
       * height follows its content, and no transform is involved anywhere. See
       * PREVIEW_MOTION for the three ways the card's own `layout` animation
       * failed at this.
       *
       * `overflow-hidden` sits on this box, the one that is actually changing
       * size, so the bars are revealed downward from under the label on the way
       * in and clipped back up under it on the way out, fading as they go.
       *
       * The spacing above the bars lives inside the animated box rather than in
       * a `gap` on the card, or the card would keep that spacing until the
       * moment this unmounts and then lose it in a single frame.
       */}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.span
            key="preview"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={PREVIEW_MOTION}
            className="block overflow-hidden px-1"
          >
            <span className="block pt-2">
              <Preview shape={tab.shape} size="sm" />
            </span>
          </motion.span>
        )}
      </AnimatePresence>
    </motion.button>
  );
}

export default function TabOverview() {
  const [activeId, setActiveId] = useState(TABS[0].id);
  const [stage, setStage] = useState<Stage>("closed");

  const active = TABS.find((tab) => tab.id === activeId) ?? TABS[0];
  const peeking = stage === "peek";
  const overview = stage === "overview";

  /*
   * Fixed height, and every stage fits inside it: the strip plus the panel
   * is exactly the content box. So the peek strip grows by pushing the panel
   * down past the bottom edge, which clips it, and nothing on the page moves
   * when the pointer crosses the strip. `shrink-0` on both is what makes the
   * panel overflow rather than being squeezed to fit.
   *
   * The shadow is load-bearing rather than decoration, and it is the one on
   * the site: the panel slides past this edge and needs the edge to read as
   * an edge, or it looks like the content is dissolving rather than passing
   * under something.
   */
  return (
    <div className="tab-overview relative flex h-88 w-full flex-col gap-2 overflow-hidden rounded-2xl bg-surface p-2 shadow-md ring-1 ring-stroke-soft ring-inset">
      {/* the strip grows as a whole, so the row owns the pointer rather than
            each tab. Peek only reads a closed strip, or crossing the row would
            drop the overview. */}
      <div
        onPointerEnter={() => stage === "closed" && setStage("peek")}
        onPointerLeave={() => stage === "peek" && setStage("closed")}
        className="flex shrink-0 items-start gap-2"
      >
        {/* a fixed square the height of a collapsed tab, in a row that is
              `items-start` in every stage, so this is the one thing in the
              window that never moves */}
        <button
          type="button"
          aria-pressed={overview}
          aria-label={overview ? "Hide all tabs" : "Show all tabs"}
          onClick={() => setStage(overview ? "closed" : "overview")}
          className={cn(
            "flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-xl text-text-muted transition-colors duration-200",
            "hover:bg-fill hover:text-text-primary active:bg-fill-hover",
            "aria-pressed:bg-fill aria-pressed:text-text-primary",
            FOCUS,
          )}
        >
          <SquaresFourIcon aria-hidden="true" className="size-4" />
        </button>

        {/* the tabs are in the grid while the overview is open, so the strip
              keeps nothing but its own control */}
        {!overview && (
          <div
            aria-label="Sessions"
            className="flex min-w-0 flex-1 gap-2"
            role="tablist"
          >
            {TABS.map((tab) => (
              // the wrapper owns the quarter of the row, so the card inside is
              // free to be measured and moved by `layoutId`
              <span key={tab.id} className="flex min-w-0 flex-1 flex-col">
                <TabCard
                  tab={tab}
                  role="tab"
                  current={tab.id === activeId}
                  expanded={peeking}
                  onSelect={() => setActiveId(tab.id)}
                />
              </span>
            ))}
          </div>
        )}
      </div>

      {overview && (
        <div className="grid h-72 shrink-0 grid-cols-2 grid-rows-2 gap-2">
          {TABS.map((tab) => (
            <TabCard
              key={tab.id}
              tab={tab}
              current={tab.id === activeId}
              expanded
              onSelect={() => {
                setActiveId(tab.id);
                setStage("closed");
              }}
            />
          ))}
        </div>
      )}

      {/*
       * The panel leaves through the bottom of the window and comes back the
       * same way, rather than being cut. `popLayout` takes it out of flow the
       * moment it starts leaving, so the window closes over it while it slides,
       * and the window's `overflow-hidden` is what does the clipping.
       *
       * The grid is deliberately outside this. Its cards are the elements the
       * `layoutId` morph moves, and keeping a copy of them alive through an
       * exit would put the same id on screen twice.
       */}
      <AnimatePresence initial={false} mode="popLayout">
        {!overview && (
          <motion.div
            key="panel"
            layout
            role="tabpanel"
            initial={SLIDE}
            animate={{ y: 0, opacity: 1 }}
            exit={SLIDE}
            transition={SPRING}
            className="flex h-72 shrink-0 flex-col gap-5 rounded-xl bg-bg p-5 ring-1 ring-stroke-soft ring-inset"
          >
            <span
              className={cn(
                `tone-${active.id}`,
                "flex min-w-0 items-center gap-1.5",
              )}
            >
              <TerminalWindowIcon
                aria-hidden="true"
                className="mark size-3.5 shrink-0"
              />
              <span className="truncate text-meta text-text-secondary">
                {active.title}
              </span>
            </span>

            {/* keyed on the tab, so switching tabs fades the new content in
                  rather than swapping it under the same box */}
            <motion.div
              key={active.id}
              className={`tone-${active.id}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={FADE}
            >
              <Preview shape={active.shape} size="md" />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
