"use client";

import { animate, useReducedMotion } from "motion/react";
import dynamic from "next/dynamic";
import {
  type ComponentType,
  createContext,
  useContext,
  useLayoutEffect,
  useMemo,
  useRef,
} from "react";
import type { ImplementedLab } from "@/lib/labs";
import { cn } from "@/lib/utils";

/*
 * The experiments are browser-only: they measure cursors, run springs and read
 * layout, none of which mean anything on the server. `ssr: false` keeps them
 * out of the prerender instead of rendering blank and hydrating.
 *
 * This has to be a client component. `next/dynamic` rejects `ssr: false` in a
 * server one, and the page itself stays a server component so it keeps its
 * metadata, static params and `notFound`.
 *
 * Typed against `ImplementedLab`, so listing a slug as implemented without
 * adding it here fails the build rather than rendering an empty frame.
 *
 * `file-tree-explorer` is the one slug whose directory is named differently,
 * carried over from the old repo.
 *
 * Every entry carries the same two additions. `loading` is the placeholder,
 * which the server renders into the HTML, so the frame has a body from the
 * first paint rather than being empty until the chunk arrives. `.then(ready)`
 * wraps the lab in a component that tells the slot it has mounted, which is
 * what fades it in and eases the frame from the placeholder's height to its
 * own. Both have to be written out per entry, since Next transforms each
 * `dynamic()` call where it stands and cannot see through a helper.
 */

/** where the lab sits, which decides the placeholder's corner */
export type LabFrame = "padded" | "flush" | "bare";

interface Slot {
  frame: LabFrame;
  ready: () => void;
}

const SlotContext = createContext<Slot | null>(null);

/**
 * The shape most labs are, an 8:5 stage with a floor for a phone, so a third of
 * them arrive at exactly its height and the rest ease to theirs. A skeleton
 * rather than a word, and `fill` with a slow pulse rather than a spinner, since
 * what is arriving is a surface.
 */
function Placeholder() {
  const slot = useContext(SlotContext);
  return (
    <div
      aria-hidden="true"
      // the preview recorder waits for this to go before it measures the demo
      data-lab-placeholder=""
      className={cn(
        "aspect-8/5 min-h-78 w-full bg-fill motion-safe:animate-pulse",
        slot?.frame === "padded" ? "rounded-md" : "rounded-lg",
      )}
    />
  );
}

/** wrap a lab's module so the slot hears it mount */
function ready(mod: { default: ComponentType }): ComponentType {
  const Lab = mod.default;
  return function Ready() {
    const slot = useContext(SlotContext);
    useLayoutEffect(() => {
      slot?.ready();
    }, [slot]);
    return <Lab />;
  };
}

const EXPERIMENTS: Record<ImplementedLab, React.ComponentType> = {
  "cursor-origin-button": dynamic(
    () => import("@/components/labs/cursor-origin-button").then(ready),
    {
      ssr: false,
      loading: Placeholder,
    },
  ),
  "phrase-transition": dynamic(
    () => import("@/components/labs/phrase-transition").then(ready),
    {
      ssr: false,
      loading: Placeholder,
    },
  ),
  "split-to-edit": dynamic(
    () => import("@/components/labs/split-to-edit").then(ready),
    {
      ssr: false,
      loading: Placeholder,
    },
  ),
  "spring-image": dynamic(
    () => import("@/components/labs/spring-image").then(ready),
    {
      ssr: false,
      loading: Placeholder,
    },
  ),
  "discount-code-input": dynamic(
    () => import("@/components/labs/discount-code-input").then(ready),
    {
      ssr: false,
      loading: Placeholder,
    },
  ),
  "file-tree-explorer": dynamic(
    () => import("@/components/labs/file-tree").then(ready),
    {
      ssr: false,
      loading: Placeholder,
    },
  ),
  "sonner-extended-toast": dynamic(
    () => import("@/components/labs/sonner-extended-toast").then(ready),
    {
      ssr: false,
      loading: Placeholder,
    },
  ),
  "number-counter": dynamic(
    () => import("@/components/labs/number-counter").then(ready),
    {
      ssr: false,
      loading: Placeholder,
    },
  ),
  "multi-step-form": dynamic(
    () => import("@/components/labs/multi-step-form").then(ready),
    {
      ssr: false,
      loading: Placeholder,
    },
  ),
  "morphing-icons": dynamic(
    () => import("@/components/labs/morphing-icons").then(ready),
    {
      ssr: false,
      loading: Placeholder,
    },
  ),
  "animated-dashed-border": dynamic(
    () => import("@/components/labs/animated-dashed-border").then(ready),
    {
      ssr: false,
      loading: Placeholder,
    },
  ),
  "tab-overview": dynamic(
    () => import("@/components/labs/tab-overview").then(ready),
    {
      ssr: false,
      loading: Placeholder,
    },
  ),
  "tether-button": dynamic(
    () => import("@/components/labs/tether-button").then(ready),
    {
      ssr: false,
      loading: Placeholder,
    },
  ),
  "document-pocket": dynamic(
    () => import("@/components/labs/document-pocket").then(ready),
    {
      ssr: false,
      loading: Placeholder,
    },
  ),
  "event-stacking": dynamic(
    () => import("@/components/labs/event-stacking").then(ready),
    {
      ssr: false,
      loading: Placeholder,
    },
  ),
  "stamp-collection": dynamic(
    () => import("@/components/labs/stamp-collection").then(ready),
    {
      ssr: false,
      loading: Placeholder,
    },
  ),
  "book-opening": dynamic(
    () => import("@/components/labs/book-opening").then(ready),
    {
      ssr: false,
      loading: Placeholder,
    },
  ),
  "folder-stack": dynamic(
    () => import("@/components/labs/folder-stack").then(ready),
    {
      ssr: false,
      loading: Placeholder,
    },
  ),
  "window-shade": dynamic(
    () => import("@/components/labs/window-shade").then(ready),
    {
      ssr: false,
      loading: Placeholder,
    },
  ),
  "rain-splatter": dynamic(
    () => import("@/components/labs/rain-splatter").then(ready),
    {
      ssr: false,
      loading: Placeholder,
    },
  ),
  "sticker-peel": dynamic(
    () => import("@/components/labs/sticker-peel").then(ready),
    {
      ssr: false,
      loading: Placeholder,
    },
  ),
  "halftone-ripple": dynamic(
    () => import("@/components/labs/halftone-ripple").then(ready),
    {
      ssr: false,
      loading: Placeholder,
    },
  ),
  "notch-drop": dynamic(
    () => import("@/components/labs/notch-drop").then(ready),
    {
      ssr: false,
      loading: Placeholder,
    },
  ),
  "island-menu": dynamic(
    () => import("@/components/labs/island-menu").then(ready),
    {
      ssr: false,
      loading: Placeholder,
    },
  ),
  "custom-cursor": dynamic(
    () => import("@/components/labs/custom-cursor").then(ready),
    {
      ssr: false,
      loading: Placeholder,
    },
  ),
  "radial-menu": dynamic(
    () => import("@/components/labs/radial-menu").then(ready),
    {
      ssr: false,
      loading: Placeholder,
    },
  ),
  "flip-clock": dynamic(
    () => import("@/components/labs/flip-clock").then(ready),
    {
      ssr: false,
      loading: Placeholder,
    },
  ),
  "book-shelf": dynamic(
    () => import("@/components/labs/book-shelf").then(ready),
    {
      ssr: false,
      loading: Placeholder,
    },
  ),
  "wrapped-pattern": dynamic(
    () => import("@/components/labs/wrapped-pattern").then(ready),
    { ssr: false, loading: Placeholder },
  ),
  "shelf-drop": dynamic(
    () => import("@/components/labs/shelf-drop").then(ready),
    {
      ssr: false,
      loading: Placeholder,
    },
  ),
  "crack-button": dynamic(
    () => import("@/components/labs/crack-button").then(ready),
    {
      ssr: false,
      loading: Placeholder,
    },
  ),
  "stem-picker": dynamic(
    () => import("@/components/labs/stem-picker").then(ready),
    {
      ssr: false,
      loading: Placeholder,
    },
  ),
  "pixel-reveal": dynamic(
    () => import("@/components/labs/pixel-reveal").then(ready),
    {
      ssr: false,
      loading: Placeholder,
    },
  ),
  "ember-burst": dynamic(
    () => import("@/components/labs/ember-burst").then(ready),
    {
      ssr: false,
      loading: Placeholder,
    },
  ),
  "gooey-chips": dynamic(
    () => import("@/components/labs/gooey-chips").then(ready),
    {
      ssr: false,
      loading: Placeholder,
    },
  ),
  "notice-stack": dynamic(
    () => import("@/components/labs/notice-stack").then(ready),
    {
      ssr: false,
      loading: Placeholder,
    },
  ),
  "tide-card": dynamic(
    () => import("@/components/labs/tide-card").then(ready),
    {
      ssr: false,
      loading: Placeholder,
    },
  ),
  "cube-orbit": dynamic(
    () => import("@/components/labs/cube-orbit").then(ready),
    {
      ssr: false,
      loading: Placeholder,
    },
  ),
  "foil-card": dynamic(
    () => import("@/components/labs/foil-card").then(ready),
    {
      ssr: false,
      loading: Placeholder,
    },
  ),
  "heart-flipbook": dynamic(
    () => import("@/components/labs/heart-flipbook").then(ready),
    {
      ssr: false,
      loading: Placeholder,
    },
  ),
  "arc-menu": dynamic(() => import("@/components/labs/arc-menu").then(ready), {
    ssr: false,
    loading: Placeholder,
  }),
  "venetian-blind": dynamic(
    () => import("@/components/labs/venetian-blind").then(ready),
    {
      ssr: false,
      loading: Placeholder,
    },
  ),
  "gust-flag": dynamic(
    () => import("@/components/labs/gust-flag").then(ready),
    {
      ssr: false,
      loading: Placeholder,
    },
  ),
  "region-comment": dynamic(
    () => import("@/components/labs/region-comment").then(ready),
    {
      ssr: false,
      loading: Placeholder,
    },
  ),
  "forecast-list": dynamic(
    () => import("@/components/labs/forecast-list").then(ready),
    {
      ssr: false,
      loading: Placeholder,
    },
  ),
  "photo-stack": dynamic(
    () => import("@/components/labs/photo-stack").then(ready),
    {
      ssr: false,
      loading: Placeholder,
    },
  ),
  "invite-flap": dynamic(
    () => import("@/components/labs/invite-flap").then(ready),
    {
      ssr: false,
      loading: Placeholder,
    },
  ),
  "point-cloud": dynamic(
    () => import("@/components/labs/point-cloud").then(ready),
    {
      ssr: false,
      loading: Placeholder,
    },
  ),
  "fingerprint-ink": dynamic(
    () => import("@/components/labs/fingerprint-ink").then(ready),
    {
      ssr: false,
      loading: Placeholder,
    },
  ),
  "weather-morph": dynamic(
    () => import("@/components/labs/weather-morph").then(ready),
    {
      ssr: false,
      loading: Placeholder,
    },
  ),
  "bento-focus": dynamic(
    () => import("@/components/labs/bento-focus").then(ready),
    {
      ssr: false,
      loading: Placeholder,
    },
  ),
  "sketch-book": dynamic(
    () => import("@/components/labs/sketch-book").then(ready),
    {
      ssr: false,
      loading: Placeholder,
    },
  ),
  "ambient-card": dynamic(
    () => import("@/components/labs/ambient-card").then(ready),
    {
      ssr: false,
      loading: Placeholder,
    },
  ),
  "highlight-wave": dynamic(
    () => import("@/components/labs/highlight-wave").then(ready),
    {
      ssr: false,
      loading: Placeholder,
    },
  ),
  abacus: dynamic(() => import("@/components/labs/abacus").then(ready), {
    ssr: false,
    loading: Placeholder,
  }),
  "scratch-card": dynamic(
    () => import("@/components/labs/scratch-card").then(ready),
    {
      ssr: false,
      loading: Placeholder,
    },
  ),
};

/** how long the frame takes to reach the lab's own height, and the lab to fade in */
const GROW = 0.32;
const FADE = 0.4;

export function Experiment({
  slug,
  frame,
}: {
  slug: ImplementedLab;
  frame: LabFrame;
}) {
  const Component = EXPERIMENTS[slug];
  const reduce = useReducedMotion() ?? false;
  const outer = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  // the placeholder's height, 0 until it is measured and -1 once the lab is in
  const held = useRef(0);

  // children's layout effects run first, so a lab whose chunk was already
  // loaded has called `ready` by now and this finds -1 and leaves it alone
  useLayoutEffect(() => {
    if (held.current === 0 && inner.current) {
      held.current = inner.current.offsetHeight;
    }
  }, []);

  const slot = useMemo<Slot>(
    () => ({
      frame,
      ready: () => {
        const o = outer.current;
        const i = inner.current;
        const from = held.current;
        held.current = -1;
        if (!o || !i || reduce) return;
        // before the first paint, so the lab is never seen at full strength
        i.style.opacity = "0";
        animate(i, { opacity: 1 }, { duration: FADE, ease: "easeOut" });
        const to = i.offsetHeight;
        if (from <= 0 || Math.abs(from - to) < 1) return;
        // the frame eases between the two heights with the lab centred in it
        // and clipped, then lets go of both so the lab owns its height again
        // Motion runs a height on its own frame loop, which starts a frame
        // late, so the old height is pinned before this paint or the frame
        // shows the lab's own height for one frame first
        o.style.overflow = "hidden";
        o.style.height = `${from}px`;
        animate(
          o,
          { height: [`${from}px`, `${to}px`] },
          { duration: GROW, ease: [0.25, 1, 0.5, 1] },
        ).then(() => {
          o.style.height = "";
          o.style.overflow = "";
        });
      },
    }),
    [frame, reduce],
  );

  return (
    <SlotContext.Provider value={slot}>
      <div ref={outer} className="flex w-full flex-col justify-center">
        <div ref={inner} className="grid w-full place-items-center">
          <Component />
        </div>
      </div>
    </SlotContext.Provider>
  );
}
