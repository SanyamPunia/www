/**
 * The lab registry: one entry per experiment, newest last.
 *
 * `description` carries the same two-token inline markup the blog uses,
 * `backticks` for code and [text](url) for links, rendered by `RichText`.
 *
 * There is no `image` field. The old registry pointed at screenshots of the
 * dark build, which are both wrong on a white page and wrong about what the
 * components now look like. The detail page renders the real component, so a
 * still of it was never earning its place.
 */
export interface LabMetadata {
  slug: string;
  title: string;
  description: string[];
  /** ISO `YYYY-MM-DD`, formatted for display by `formatLabDate` */
  createdAt: string;
  source?: string;
  reference?: string;
  /**
   * Render without the `Demo` frame, so the experiment gets the column's full
   * width. For a demo that draws its own container: the frame's hairline then
   * sits a padding-width outside the experiment's own edge, and two nested
   * boxes read as chrome around chrome.
   */
  bare?: boolean;
}

export const labsRegistry: LabMetadata[] = [
  {
    slug: "cursor-origin-button",
    title: "Cursor Origin Button",
    description: [
      "A button component that follows the cursor's position for its hover effect origin point. The expansion animation originates from wherever your cursor enters the button.",
      "grabbed mouse origin coords on the fly using `ref`, added a buffer to the origin instead of locking to the exact mouse-enter point, used a `::before` pseudo for the animated background scaling from cursor-origin using CSS variables, and set `transform-origin` dynamically to follow mouse position",
    ],
    createdAt: "2025-08-23",
    source: "https://x.com/sanyampunia/status/1959210575361142944",
  },
  {
    slug: "phrase-transition",
    title: "Phrase Transition",
    description: [
      "Built a phrase transition component using Framer Motion's `AnimatePresence` with staggered opacity/y transforms.",
      'key insight: `useEffect` with `setInterval` + `setTimeout` creates smooth state transitions without jank. the magic is in the exit/enter animations with `mode="wait"` - prevents layout shift while cycling through phrases.',
    ],
    createdAt: "2025-09-27",
    source: "https://x.com/sanyampunia/status/1971659845028733322",
  },
  {
    slug: "split-to-edit",
    title: "Split to Edit",
    description: [
      "my take on `split-to-edit` interaction. built using Next.js + Framer Motion.",
      'allow smooth transition wrapped within `LayoutGroup` + shared `layoutId` on the three segments i.e animates the position/size between "together" and "separated" layouts.',
      "use `contentEditable` instead of inputs to maintain pixel perfect UI, `settleBordersAfter()` delays switching inner corners from rounded to sharp, so borders don't snap immediately after saving.",
    ],
    createdAt: "2025-09-04",
    source: "https://x.com/sanyampunia/status/1963333460065391066",
  },
  {
    slug: "spring-image",
    title: "Spring Image",
    description: [
      "a draggable profile image with smooth spring physics using Framer Motion's `useMotionValue` and `useSpring` hooks.",
      "key insight: using `useMotionValue` for base position values, `useSpring` for smooth physics, and `dragConstraints` to limit drag area. the placeholder appears during drag/animation states to maintain layout stability.",
      "combines `drag`, `whileDrag`, `onDragStart/End` with spring physics for natural feel. the `setTimeout` ensures placeholder visibility matches spring animation duration.",
    ],
    createdAt: "2025-08-11",
    source: "https://x.com/sanyampunia/status/1954901980180254787",
  },
  {
    slug: "discount-code-input",
    title: "Discount Code Input",
    description: [
      "stripe-inspired button-to-input morph built with framer motion. implements a single state machine driving four distinct UI states: idle, editing, loading, and applied.",
      "key insight: measuring DOM nodes with `offsetWidth` in `useLayoutEffect` before paint, then animating between measured values. this prevents text scaling artifacts during width transitions.",
      "progressive width morphs using cubic-bezier easing `[0.2, 0, 0.38, 0.9]`. each state transition maintains pixel-perfect layout by pre-calculating target widths rather than relying on content reflow.",
    ],
    createdAt: "2025-10-10",
    source: "https://x.com/sanyampunia/status/1976531889226695106",
  },
  {
    slug: "file-tree-explorer",
    title: "File Tree Explorer",
    description: [
      "framer-motion powered tree view with animated expand/collapse interactions and subtle hover reactions.",
      "focuses on readability and polish: depth-aware indentation, animated chevrons, and smooth height transitions for nested folders.",
    ],
    createdAt: "2025-11-07",
    source: "https://x.com/sanyampunia/status/1987472200174346528",
  },
  {
    slug: "sonner-extended-toast",
    title: "Extended Sonner Toast",
    description: [
      "custom sonner toast layout with animated background fill, icon states, footer, and promise-aware durations.",
      "gradient glass panel, animated dot rows, and per-state color accents; includes promise demo with loading/success/error.",
      "extended sonner with shared vs unique toast ids, single-instance updates, bottom-right toaster, no icons, and promise-driven state transitions.",
    ],
    createdAt: "2025-12-07",
    source:
      "https://github.com/SanyamPunia/www/blob/main/components/labs/sonner-extended-toast/index.tsx",
  },
  {
    slug: "number-counter",
    title: "Number Counter",
    description: [
      "animated number counter with directional slide transitions using Framer Motion's AnimatePresence.",
      "key insight: using `useRef` to track direction (1 for increment, -1 for decrement) and passing it as `custom` prop to control enter/exit animations. the `mode='popLayout'` prevents layout shift during transitions.",
      "variants handle y-axis movement based on direction - numbers slide up when incrementing and down when decrementing. `tabular-nums` ensures consistent width for smooth transitions.",
    ],
    createdAt: "2025-12-22",
    source:
      "https://github.com/SanyamPunia/www/blob/main/components/labs/number-counter/index.tsx",
  },
  {
    slug: "multi-step-form",
    title: "Multi Step Form",
    description: [
      "a sequential multi-step form with a smooth height transition between steps (no layout jump).",
      'key insight: observe the active step content with `ResizeObserver`, store its `offsetHeight`, and animate a wrapper `motion.div` height with a spring. `AnimatePresence` (mode="wait") keeps enter/exit clean while the height animates to the next step.',
    ],
    createdAt: "2025-12-27",
    source:
      "https://github.com/SanyamPunia/www/blob/main/components/labs/multi-step-form/index.tsx",
  },
  {
    slug: "morphing-icons",
    title: "Morphing Icons",
    description: [
      "minimal keyboard-like UI for smooth icon morphing using Framer Motion. preview icon at top with dot indicators showing sequence position, keyboard grid below with 21 icons arranged 6 per row.",
      "key insight: all icons use exactly 3 lines with standardized coordinates (center at 50,50). unused lines collapse to center point. Framer Motion's `motion.line` animates coordinate transitions with 150ms easeOut timing. opacity handles zero-length lines for smooth fade in/out during morphing.",
      "click icons to toggle selection (highlighted state), click preview to cycle through selected sequence. dot indicators show total count and current position. minimal select all/none controls. each icon button scales to 0.98 on tap for tactile feedback.",
    ],
    createdAt: "2026-01-15",
    source:
      "https://github.com/SanyamPunia/www/blob/main/components/labs/morphing-icons/morphing-icon-demo.tsx",
    reference: "https://benji.org/morphing-icons-with-claude",
  },
  {
    slug: "animated-dashed-border",
    title: "Animated Dashed Border",
    description: [
      "an SVG-based animated dashed border that appears on hover. the dashes march around the border continuously using `stroke-dashoffset` animation.",
      "key insight: using an SVG `path` starting from the middle of the top edge instead of a corner hides the animation seam. `vectorEffect='non-scaling-stroke'` keeps stroke width consistent regardless of container size. `preserveAspectRatio='none'` stretches the path to fit any aspect ratio.",
      "the path is drawn clockwise from center-top, through all four rounded corners using arc commands (`A`). CSS keyframes animate `stroke-dashoffset` from 0 to -14 (dash + gap sum) creating the marching effect. `group-hover` triggers opacity fade-in for smooth appearance.",
    ],
    createdAt: "2026-02-21",
    source:
      "https://github.com/SanyamPunia/www/blob/main/components/labs/animated-dashed-border/index.tsx",
  },
];

export function getLabBySlug(slug: string): LabMetadata | undefined {
  return labsRegistry.find((lab) => lab.slug === slug);
}

/**
 * A lab's `description[0]` doubles as its meta description, but it is written as
 * body prose, so three of them run past 160 characters and get cut mid-word in a
 * search result. This clamps at a boundary instead: the last sentence that fits,
 * or failing that the last whole word.
 *
 * Metadata only. The page still renders the full paragraph, so nothing is lost
 * from what a reader sees, and no entry needs a second hand-written copy of its
 * own opening line to drift from.
 */
export function metaDescription(text: string, limit = 155): string {
  if (text.length <= limit) return text;

  const head = text.slice(0, limit);

  // prefer a sentence end, but only if it is not so early that the description
  // becomes a fragment of the real one
  const sentence = head.lastIndexOf(". ");
  if (sentence > limit * 0.6) return head.slice(0, sentence + 1);

  return `${head.slice(0, head.lastIndexOf(" "))}...`;
}

/** "2025-08-23" to "Aug 23, 2025". The stylesheet lowercases it on screen. */
export function formatLabDate(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

/**
 * Slugs whose component has been ported. The rest are still in the registry,
 * so they keep their entry and their date, but their page 404s until the
 * component lands rather than rendering an empty frame.
 *
 * `components/lab/experiment.tsx` types its map against this, so adding a slug
 * here without adding the component is a compile error, not a runtime blank.
 */
export const IMPLEMENTED_LABS = [
  "cursor-origin-button",
  "phrase-transition",
  "split-to-edit",
  "spring-image",
  "discount-code-input",
  "file-tree-explorer",
  "sonner-extended-toast",
  "number-counter",
  "multi-step-form",
  "morphing-icons",
  "animated-dashed-border",
] as const;

export type ImplementedLab = (typeof IMPLEMENTED_LABS)[number];

export function isImplemented(slug: string): slug is ImplementedLab {
  return (IMPLEMENTED_LABS as readonly string[]).includes(slug);
}
