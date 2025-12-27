export interface LabMetadata {
  slug: string;
  title: string;
  description: string[];
  image: string;
  createdAt: string;
  source?: string;
}

export const labsRegistry: LabMetadata[] = [
  {
    slug: "cursor-origin-button",
    title: "Cursor Origin Button",
    description: [
      "A button component that follows the cursor's position for its hover effect origin point. The expansion animation originates from wherever your cursor enters the button.",
      "grabbed mouse origin coords on the fly using `ref`, added a buffer to the origin instead of locking to the exact mouse-enter point, used a `::before` pseudo for the animated background scaling from cursor-origin using CSS variables, and set `transform-origin` dynamically to follow mouse position",
    ],
    image: "/lab/cursor-origin-button.webp",
    createdAt: "Aug 23, 2025",
    source: "https://x.com/sanyampunia/status/1959210575361142944",
  },
  {
    slug: "phrase-transition",
    title: "Phrase Transition",
    description: [
      "Built a phrase transition component using Framer Motion's `AnimatePresence` with staggered opacity/y transforms.",
      'key insight: `useEffect` with `setInterval` + `setTimeout` creates smooth state transitions without jank. the magic is in the exit/enter animations with `mode="wait"` - prevents layout shift while cycling through phrases.',
    ],
    image: "/lab/phrase-transition.webp",
    createdAt: "sep 27, 2025",
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
    image: "/lab/split-to-edit.webp",
    createdAt: "sep 4, 2025",
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
    image: "/lab/spring-image.webp",
    createdAt: "aug 11, 2025",
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
    image: "/lab/discount-code-input.webp",
    createdAt: "oct 10, 2025",
    source: "https://x.com/sanyampunia/status/1976531889226695106",
  },
  {
    slug: "file-tree-explorer",
    title: "File Tree Explorer",
    description: [
      "framer-motion powered tree view with animated expand/collapse interactions and subtle hover reactions.",
      "focuses on readability and polish: depth-aware indentation, animated chevrons, and smooth height transitions for nested folders.",
    ],
    image: "/lab/file-tree-explorer.webp",
    createdAt: "nov 07, 2025",
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
    image: "/lab/toast.webp",
    createdAt: "dec 07, 2025",
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
    image: "/lab/number-counter.webp",
    createdAt: "dec 22, 2025",
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
    image: "/lab/multi-step-form.webp",
    createdAt: "dec 27, 2025",
    source:
      "https://github.com/SanyamPunia/www/blob/main/components/labs/multi-step-form/index.tsx",
  },
];

export function getLabBySlug(slug: string): LabMetadata | undefined {
  return labsRegistry.find((lab) => lab.slug === slug);
}
