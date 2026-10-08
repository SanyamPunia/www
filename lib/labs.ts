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
  /**
   * Two or three lines: what the thing is, then `key insight:` and the one
   * decision that made it work, then at most one more note. Not a write-up.
   * See CLAUDE.md, and note that the first line doubles as the page's meta
   * description and is clamped at 155 characters.
   */
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
  /**
   * Keep the `Demo` frame but drop its padding, so the experiment fills the
   * frame edge to edge. For a demo whose whole surface is the interaction rather
   * than a component sitting on a surface: the padding then reads as dead space
   * inside the thing you are meant to be poking.
   *
   * Not `bare`. That removes the frame, and a demo whose surface is the
   * interaction still wants the hairline to say where that surface stops.
   */
  flush?: boolean;
  /**
   * One line naming the gesture the experiment answers to, shown beside the
   * source links rather than inside the demo.
   *
   * For an experiment whose affordance is not visible: `event-stacking` looks
   * like a calendar and says nothing about the arrow keys. It lives here rather
   * than in the component because it is copy about the demo and not part of it,
   * and because that row is where the page already puts everything else in that
   * category.
   *
   * Not a replacement for `document-pocket`'s handwritten note, which is inside
   * the drawing and is pointing at one part of it.
   */
  hint?: string;
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
  {
    slug: "tab-overview",
    title: "Tab Overview",
    description: [
      "a terminal tab strip in three stages: a row of labels, a taller strip where each tab previews what it holds, and an overview grid where a tab is picked by its shape rather than its title.",
      "key insight: a tab is one element in all three stages, so a shared `layoutId` carries it between the strip and the grid rather than one node vanishing while another appears in place. tab order never changes, which is what makes that readable.",
      'everything runs on one spring so the card, the strip and the window resize together. `layout="position"` on the content plus `overflow-hidden` on the card is what stops the label riding the scale, and locking only the label is worse than locking neither.',
    ],
    createdAt: "2026-08-19",
    source:
      "https://github.com/SanyamPunia/www/blob/main/components/labs/tab-overview/index.tsx",
    reference: "https://x.com/mitchellh/status/2087537750182666290",
    bare: true,
  },
  {
    slug: "tether-button",
    title: "Tether Button",
    description: [
      "a button with its own cursor. pressing anywhere on the stage shoots a web at the nearest edge of the button, and the button goes down when the web lands rather than when the mouse does.",
      "key insight: `cursor-none` has to go on the whole subtree, not just the stage. the UA stylesheet sets `cursor: default` on a `button`, and a real declaration beats an inherited value, so the system arrow comes back over the one thing you aim at.",
      "the anchor is fixed at impact, so holding the press and moving the hand pays the strand out against one point. re-deriving the nearest edge every frame slides the splat around the button, and a splat that slides is not stuck to anything.",
    ],
    createdAt: "2026-08-20",
    source:
      "https://github.com/SanyamPunia/www/blob/main/components/labs/tether-button/index.tsx",
    reference: "https://x.com/ozzyxs1a/status/2086332798709715445",
    flush: true,
  },
  {
    slug: "document-pocket",
    title: "Document Pocket",
    description: [
      "a pocket of paper. hovering fans the cards out and tilts the front panel forward, hovering one singles it out, and clicking grows it to the middle of the stage.",
      "key insight: hover is answered by hit-testing the fan's neutral geometry, never the DOM. a card that moves because it was hovered moves out from under the pointer, the hover drops, the card falls back and the fan flickers. reading the boxes with nothing hovered means a hover cannot change the geometry that decides it.",
      "a card is staged by animating `width`, never `scale`: 113px to 322px would paint its 1px hairline at 3px. contents are `cqw` against the card, but `cqw` on the card itself resolves against the stage, which inflated every card past twice its size before it was found.",
    ],
    createdAt: "2026-08-20",
    source:
      "https://github.com/SanyamPunia/www/blob/main/components/labs/document-pocket/index.tsx",
    reference: "https://x.com/raul_dronca/status/1992227756407685269",
    flush: true,
  },
  {
    slug: "event-stacking",
    title: "Event Stacking",
    description: [
      "a four-day calendar whose events drag between slots. drop a card on another and they join as a pile, and the pile compresses to fit the cell it is in.",
      "key insight: `dragSnapToOrigin`'s spring has to match the `layout` spring exactly. drag writes an offset from a box the drop has already moved, and `layout`'s own transform unwinds from the old cell, so the two compose to the pointer on the first frame and the target cell on the last. different springs send the card round a curve.",
      "`dragConstraints` is a plain object of numbers and never the grid's ref. ref constraints put a `ResizeObserver` on the draggable and rewrite `x`/`y` on every resize, which strands a card that changed height mid-drop a cell away from where it was dropped.",
    ],
    createdAt: "2026-08-23",
    source:
      "https://github.com/SanyamPunia/www/blob/main/components/labs/event-stacking/index.tsx",
    reference: "https://x.com/artntek/status/2090533166696014035",
    hint: "Hold a stack to take it whole, or move one with the arrow keys.",
    bare: true,
  },
  {
    slug: "stamp-collection",
    title: "Stamp Collection",
    description: [
      "three stamps on a dark table. hovering lifts one, clicking brings it to the front and pushes the others behind it, and the print inside a focused stamp slides under its own window.",
      "key insight: the hover lift felt laggy for four separate reasons and only the last one mattered. it is a tween and not a spring, because 14px on a spring is 1.5px a frame and spends most of its time on the last two, and sub-pixel creep reads as sluggish however short the total is.",
      "the paper is an SVG rather than a div with a CSS mask, so its `drop-shadow` follows the scallops instead of the bounding box. the holes sit centred on the edge line so half of each one bites in, which is the shape a torn perforation has.",
    ],
    createdAt: "2026-08-24",
    source:
      "https://github.com/SanyamPunia/www/blob/main/components/labs/stamp-collection/index.tsx",
    reference: "https://x.com/AdityaSur11/status/2091805210280919082",
    hint: "Hover a stamp to lift it, click one to bring it forward.",
    flush: true,
  },
  {
    slug: "book-opening",
    title: "Book Opening",
    description: [
      "a book on a table, fourteen sheets deep. hovering fans every leaf off the spine and lays the front board out to the left.",
      "key insight: one inherited custom property drives all fourteen transforms. the stage carries `--book-open` and each sheet is `rotateY(calc(var(--book-open) * var(--sheet-angle)))`, so a frame is one `setProperty` and nothing in the component renders.",
      "the lerp is of the fore-edge and not of the angle. even angles are not even paper: a sheet's free end sits at `cos(angle)` of the way out, so half the fan was slivers and half was wide open pages. spacing the edges and taking the angle back out with `acos` shows the same strip of every sheet.",
    ],
    createdAt: "2026-08-27",
    source:
      "https://github.com/SanyamPunia/www/blob/main/components/labs/book-opening/index.tsx",
    hint: "Hover the book, or pick cursor and move left across the stage.",
    flush: true,
  },
  {
    slug: "folder-stack",
    title: "Folder Stack",
    description: [
      "a drawer of card index folders, eight tabs deep. hovering pulls that one folder up out of the pile.",
      "key insight: the reveal is occlusion. every card is the same box in the same place and exactly one `translateY` moves, so the hovered card comes out from behind the card in front of it and there is nothing to fade, mount or measure.",
      "the lift is a whole number of rows, and three of them. at any other value the lifted card's paper edge lands part way through a tab behind it and slices it, which reads as a rendering fault rather than as one card in front of another.",
    ],
    createdAt: "2026-08-28",
    source:
      "https://github.com/SanyamPunia/www/blob/main/components/labs/folder-stack/index.tsx",
    reference: "https://x.com/edo_lunardi/status/2085743043982897338",
    hint: "Hover a folder to open it, or tap one.",
    flush: true,
  },
  {
    slug: "window-shade",
    title: "Window Shade",
    description: [
      "a cabin window with a shade drawn down by hand, and a cabin that goes dark as it comes.",
      "key insight: one number carries the panel and the whole palette. every tone on the stage is `color-mix(in oklab, <light token>, <inverse token>, var(--shade))`, so the theme is a position rather than a state and half way down is a place a reader can stop.",
      "`oklab` and not the default `srgb`, which is already dark for most of its travel and lurches at the end. text cannot interpolate at all, since its tone has to cross the ground it sits on, so the ink steps over 0.04 of travel at the point where both sides are least unequal.",
    ],
    createdAt: "2026-08-29",
    source:
      "https://github.com/SanyamPunia/www/blob/main/components/labs/window-shade/index.tsx",
    reference: "https://x.com/mjbarton_/status/2093354383379399012",
    hint: "Drag the shade down by its grip, or tap the window.",
    flush: true,
  },
  {
    slug: "rain-splatter",
    title: "Rain Splatter",
    description: [
      "a painting that makes itself. rain lands on a floor drawn in perspective, and every landing throws specks that bead or skid depending on how fast they arrive.",
      "key insight: two canvases, and that split is the whole design. one is cleared every frame and holds what is moving, the other is never cleared and holds what has landed. a mark costs one draw and then nothing, which is what lets the piece accumulate thousands on one clear.",
      "the fade is spent in whole steps, since a canvas holds 8 bits a channel and an erase under 1/255 rounds to nothing and silently stops fading. `destination-out` rather than a wash of the ground colour, so the layer stays transparent.",
    ],
    createdAt: "2026-08-29",
    source:
      "https://github.com/SanyamPunia/www/blob/main/components/labs/rain-splatter/index.tsx",
    reference: "https://x.com/okazz_/status/2092923357931176017",
    hint: "Press the stage to aim a drop, or tab in and use the arrows.",
    flush: true,
  },
  {
    slug: "sticker-peel",
    title: "Sticker Peel",
    description: [
      "five die-cut stickers loose on a board. press one and pull, and the paper folds back over itself so what is on top of the sticker is the back of the same sticker.",
      "key insight: the fold is a reflection. mirroring the sticker across a crease square to the pull carries the peeling edge exactly onto the hand, so one clip polygon serves both the face and the flap and there is no second clip to keep in step with the first.",
      "the peel runs from an edge picked once and then held. deriving it from the pull every frame is the obvious build and it makes the lifted corner hop from one side of the sticker to another every time the hand changes direction.",
    ],
    createdAt: "2026-09-02",
    source:
      "https://github.com/SanyamPunia/www/blob/main/components/labs/sticker-peel/index.tsx",
    hint: "Press a sticker and pull to peel it off, then drop it anywhere.",
    flush: true,
  },
  {
    slug: "halftone-ripple",
    title: "Halftone Ripple",
    description: [
      "a pill toggle with a heart and a count. pressing it sends a ripple of dots out across the button from under the pointer, on a fixed grid.",
      "key insight: the ripple is a field sampled on a grid and no dot ever moves. every frame asks each grid point how far it is from the crest and the answer is the size of the dot there, which is what a halftone screen being run looks like. scaling a drawing of a ring reads as a texture sliding instead.",
      "a dot has six sizes rather than sliding, and its radius goes with the square root of the field, since the eye reads a halftone's ink area and area goes with the square of the radius. the ink is the state: a press that turns the button off sends the same ripple in `text-muted`.",
    ],
    createdAt: "2026-09-03",
    source:
      "https://github.com/SanyamPunia/www/blob/main/components/labs/halftone-ripple/index.tsx",
  },
  {
    slug: "notch-drop",
    title: "Notch Drop",
    description: [
      "a notch hanging from the top edge of a page of cards. lift a card, hold it over the notch, and let go: a black drop leaves the card and merges into the notch.",
      "key insight: the notch is a liquid, which is two black shapes under one SVG filter. `feGaussianBlur` bleeds them into each other and an `feColorMatrix` alpha row of `22 -10` cuts the bleed back to an edge, so two shapes within a few pixels grow a neck.",
      "the label is not under the filter, since the threshold destroys any edge worth keeping, so the face is a second layer animated to the same box. the opening spring overshoots on purpose: a box resizing on an ease is a box resizing.",
    ],
    createdAt: "2026-09-04",
    source:
      "https://github.com/SanyamPunia/www/blob/main/components/labs/notch-drop/index.tsx",
    hint: "Drag a card up to the notch, or focus one and press Enter.",
    flush: true,
  },
  {
    slug: "island-menu",
    title: "Island Menu",
    description: [
      "a pill of a nav bar that opens into a menu in two moves. tall first, a black slab rising off the bar, then wide, and only then does the menu arrive in it.",
      "key insight: the two moves overlap by 30% and their order flips with the direction. a menu that grew tall then wide has to shrink wide then short, or the shape it passes through on the way out is one it never had on the way in. butted end to end they read as two animations, and a spring runs both axes at once, which reads as a zoom.",
      "the width is measured against the stage, and the stage needs `min-w-0` to be measurable at all: as a flex item at `min-width: auto` its used width is its own child's, so the ruler was elastic and the thing it measured was stretching it.",
    ],
    createdAt: "2026-09-06",
    source:
      "https://github.com/SanyamPunia/www/blob/main/components/labs/island-menu/index.tsx",
    reference: "https://annnimate.com/",
    hint: "Press Menu to open it, and Close or Escape to shut it.",
  },
  {
    slug: "custom-cursor",
    title: "Custom Cursor",
    description: [
      "a gallery of four cards under a cursor of its own. crossing into the stage swaps the arrow for a dot that chases the hand, and hovering a card grows the dot into a pill naming the lab.",
      "key insight: the dot and the pill are one element and nothing scales. a `clip-path` window decides how much of the pill shows, because `torph` sizes its box off `getBoundingClientRect`, which reports the transformed size, so a label changed while the pill was small got a box a fraction of its text's width.",
      "the one lab on `gsap`. one `quickTo` per axis keeps a single tween and retargets it on every move, and the hand is read once a frame at the front of the ticker, so a burst of events at 120Hz costs one layout read rather than one each.",
    ],
    createdAt: "2026-09-07",
    source:
      "https://github.com/SanyamPunia/www/blob/main/components/labs/custom-cursor/index.tsx",
    flush: true,
    hint: "Hover the cards with a mouse. Touch gets the plain links.",
  },
  {
    slug: "radial-menu",
    title: "Radial Menu",
    description: [
      "a file on a stage. press it and pull, and a wheel of five formats opens around where it was. let go over one and the file converts.",
      "key insight: which wedge is under the hand is arithmetic and not a hit test. the file is what the pointer is over, so the wedges could never see it: `wedgeAt` maps the hand's angle onto five slices and returns null inside the dead zone, and the same maths serves a mouse, a finger and the arrow keys.",
      "the wedge under the hand previews its format on the file itself, drawn once and reused through `<use>` under an SVG filter. jpg blocks up, gif dithers to six levels, avif softens a touch and pdf sets it small on a white page, so the wheel demos what the names mean.",
    ],
    createdAt: "2026-09-08",
    source:
      "https://github.com/SanyamPunia/www/blob/main/components/labs/radial-menu/index.tsx",
    flush: true,
    hint: "Drag the file out. On a keyboard, press it and use the arrows.",
  },
  {
    slug: "flip-clock",
    title: "Flip Clock",
    description: [
      "a flip clock in 24-hour time. when a number changes the top half falls forward through 180 degrees as a real flap and lands on the stop with a bounce.",
      "key insight: the flap's front is the old number's top and its back is the new number's bottom, pre-turned 180 degrees, so the card reads right on every frame of the fall and nothing fades or morphs.",
      "a half is a full glyph box clipped to half a card, so both halves of both numbers meet at the hinge to the pixel whatever the glyph is. the cards carry a hue because black hid every bit of the depth pass: a sheen and a shadow on near-black are the same near-black.",
    ],
    createdAt: "2026-09-08",
    source:
      "https://github.com/SanyamPunia/www/blob/main/components/labs/flip-clock/index.tsx",
    flush: true,
    hint: "Press a card to set it forward by one.",
  },
  {
    slug: "wrapped-pattern",
    title: "Wrapped Pattern",
    description: [
      "a printed sheet that rolls into a column. flat it is a drawing, wrapped it turns under a drag, coasts when let go and idles on a slow turn.",
      "key insight: the roll is a bend, not seventy-two strips turning about their own centres, which tears the print into ragged verticals on the way. the sheet lies on a cylinder whose radius closes from infinite to `R`, so at every point the strips still lie edge to edge on one curved surface.",
      "two numbers drive everything and nothing renders. `--t` and `--rot` are written to the scene once a frame and every strip's transform, its shade and the shadow's width are `calc()` off them.",
    ],
    createdAt: "2026-09-09",
    source:
      "https://github.com/SanyamPunia/www/blob/main/components/labs/wrapped-pattern/index.tsx",
    reference: "https://x.com/joshpuckett/status/2095686863634006120",
    flush: true,
    hint: "Press the mode to roll it, then drag the column to turn it.",
  },
  {
    slug: "book-shelf",
    title: "Book Shelf",
    description: [
      "a shelf of twelve books. press a spine and that book comes out of the row, turns to face you and lands in the middle of the stage with a scrim behind it.",
      "key insight: the thing arriving in the centre is the object that was on the shelf, turned. the spine is the box's front face and the cover its right face, so bringing the cover to the reader is one rotation and nothing is faded into anything. a modal grown out of a card is two elements and a crossfade.",
      "the scrim is a plane in the same 3D scene at `translateZ(100px)`, since a `preserve-3d` context paints by depth and ignores `z-index`. no `backdrop-filter` on it: chrome cuts the backdrop where the book sits and leaves two seams the height of the stage.",
    ],
    createdAt: "2026-09-11",
    source:
      "https://github.com/SanyamPunia/www/blob/main/components/labs/book-shelf/index.tsx",
    flush: true,
    hint: "Press a spine to take the book out, Escape to put it back.",
  },
  {
    slug: "shelf-drop",
    title: "Shelf Drop",
    description: [
      "six prints standing on a picture ledge. press one and it is knocked off, tumbling as it goes. some fall in front of the ledge and some behind it, and which one you get is the experiment.",
      "key insight: front and back are the same fall with a different sign on one number. the scene is `preserve-3d`, which paints by depth and ignores stacking order, so a card travels to a depth in front of the ledge and grows, or to one behind it and shrinks and comes out under the fascia. no `z-index` is involved in either.",
      "gravity accelerates and a tumble does not, so the vertical travel eases in and the rotation, the drift and the depth all run linear. on one curve the spin appears to wind up as the card falls and the throw reads as a fling rather than a drop.",
    ],
    createdAt: "2026-09-12",
    source:
      "https://github.com/SanyamPunia/www/blob/main/components/labs/shelf-drop/index.tsx",
    reference: "https://x.com/Jaytel/status/2098595800427487324",
    flush: true,
    hint: "Press a print to knock it off the ledge.",
  },
  {
    slug: "crack-button",
    title: "Crack Button",
    description: [
      "a Save button made of glass. every press cracks it from the point it was hit, the cracks accumulate, and the eleventh takes the face apart.",
      "key insight: a crack stops where it meets an older crack. a fracture cannot cross a free surface, so real broken glass is one connected web of T-junctions and never a pile of independent stars laid over each other. every walk is truncated at its first intersection with anything already open.",
      "the break is a partition of the face rather than a pile of shapes: each shard is the wedge between two walks out of the last impact, so an edge is one walk shared by the two shards either side and no gap can open between them. the clip goes inside the thing that moves, or the pill becomes a window the pieces slide out of and vanish at.",
    ],
    createdAt: "2026-09-13",
    source:
      "https://github.com/SanyamPunia/www/blob/main/components/labs/crack-button/index.tsx",
    flush: true,
    hint: "Press the button until the glass gives.",
  },
  {
    slug: "stem-picker",
    title: "Stem Picker",
    description: [
      "a quantity stepper where the thing being counted is the thing you see. press the plus and a stem swings up into the fan, or grab the tie and pull to draw them in.",
      "key insight: the arrival and the resting place are the same geometry. every stem is pinned at the knot and differs from its neighbours by one number, the angle it leans at, so a stem arriving is that angle changing. arc an item into a straight row instead and the arc is decoration laid over the top.",
      "two springs, because two things happen on one press. `rotate` takes the quieter one and `scale` the livelier, and since only the arriving stem ever animates its scale, the bounce lands on that stem alone with no branch on which one is new.",
    ],
    createdAt: "2026-09-13",
    source:
      "https://github.com/SanyamPunia/www/blob/main/components/labs/stem-picker/index.tsx",
    reference: "https://x.com/archivess_19/status/2099135335171264618",
    flush: true,
    hint: "Pull the bunch up by its tie to add stems, or use the controls.",
  },
  {
    slug: "pixel-reveal",
    title: "Pixel Reveal",
    description: [
      "one flat tile that splits into four, then sixteen, and keeps halving until the tiles stop being tiles and the picture arrives over the top.",
      "key insight: nothing fades in. every level is a box filter over the one below it, so the picture is complete from the first frame and the filter is what throws it away. a reveal built as an opacity ramp says nothing about why detail arrives in the order it does.",
      "there are no levels either, which is the change that mattered most. it is a quadtree: every tile splits on its own schedule and inherits it from its parent, so detail spreads out of the places it already reached and the canvas holds four or five tile sizes at once.",
    ],
    createdAt: "2026-09-15",
    source:
      "https://github.com/SanyamPunia/www/blob/main/components/labs/pixel-reveal/index.tsx",
    reference: "https://x.com/SwamiMalode/status/2092578177092931724",
    flush: true,
    hint: "Pick a pattern, then press generate to resolve it.",
  },
  {
    slug: "ember-burst",
    title: "Ember Burst",
    description: [
      "a wick on a dark stage. tap it to strike, tap again to snuff it, hold it to blaze and drag it to draw.",
      "key insight: an ember's colour is its age. the ramp runs near-white through yellow and orange into a deep red the ground swallows, so a spark is gone before its alpha has finished and what the eye reads is the heat leaving rather than an opacity being taken away.",
      "dragging draws because the sparks leave carrying the wick's own velocity, at 62% of it, and nothing about the launch changes. the six things separating a spark from a particle are all knobs: run `spray`, `drag`, `lift`, `pops` and `trail` to their floors and what comes back is the wheel of equals the first build was.",
    ],
    createdAt: "2026-09-16",
    source:
      "https://github.com/SanyamPunia/www/blob/main/components/labs/ember-burst/index.tsx",
    flush: true,
    hint: "Tap the wick to strike it, hold it to blaze, and drag it to draw.",
  },
  {
    slug: "gooey-chips",
    title: "Gooey Chips",
    description: [
      "filter chips that merge into the tray they are dropped in. pick one and it flies out of the row, grows a neck and fuses into the slab, or carry one there by hand and hold it in the neck.",
      "key insight: the goo is a function of the gap and not of the clock. it reads the distance between the flying chip and the tray on every frame: zero far apart, widest about to touch, and zero again once they overlap, because two shapes that have merged have no neck left. one press and six at once behave the same, and the tear falls out for free.",
      "`sRGB` on the filter is load-bearing, since the default `linearRGB` lands the same alpha crush somewhere else and the neck comes out thin and grey. the blur has to be back at its floor before the filter comes off, or its removal is a frame of animation nobody wrote.",
    ],
    createdAt: "2026-09-17",
    source:
      "https://github.com/SanyamPunia/www/blob/main/components/labs/gooey-chips/index.tsx",
    reference: "https://annnimate.com/animations/gooey-filter-chips",
    hint: "Pick a tag to filter 20 camera lenses, or drag one into the tray.",
  },
  {
    slug: "notice-stack",
    title: "Notice Stack",
    description: [
      "a pile of notices in a tray. point at it and the one behind rises into a thicker edge, move onto that edge and it rises again to read its title, and press to advance.",
      "key insight: nothing here crossfades content. every card owns its own copy for the whole session and what changes is which depth it is at, so a notice arriving at the front is not being filled in, it is being uncovered.",
      "the peek is one number because the cards scale about `50% 0`. scaling from the top never moves the edge the peek is measured from, where scaling about the centre drags it down by a height nothing here knows and every peek would carry a correction.",
    ],
    createdAt: "2026-09-18",
    source:
      "https://github.com/SanyamPunia/www/blob/main/components/labs/notice-stack/index.tsx",
    reference: "https://rauno.me/notes/5",
    flush: true,
    hint: "Point at the pile, then at the edge that rises. Press it to advance.",
  },
  {
    slug: "tide-card",
    title: "Tide Card",
    description: [
      "press `Check the tide` and the button opens into a live tide: the station, the height now, and one cycle of water under a marker that creeps along it.",
      "key insight: the button is not replaced by the card, it is the card cropped to its title. one box, one ground, one label, and the whole morph is that box's `overflow-hidden` opening. the rows and the chart are laid out at full size the entire time the button is a pill, so nothing mounts and nothing can pop.",
      "the content arrives by coming into focus rather than by fading, since a blur is distance where an opacity is existence. three curves carry it: the box leaves at 2.25 times its own average speed, a row's slide is the sharpest ease-out in the piece, and a rack of focus is plain `ease`.",
    ],
    createdAt: "2026-09-19",
    source:
      "https://github.com/SanyamPunia/www/blob/main/components/labs/tide-card/index.tsx",
    reference: "https://x.com/wherescz/status/2100473433897222224",
    flush: true,
    hint: "Press the pill. It opens into the tide and the water comes in.",
  },
  {
    slug: "cube-orbit",
    title: "Cube Orbit",
    description: [
      "repeat a sequence of turns and the cube comes back to solved. the dial is one ring per cycle of that sequence, and the cube is home when every ring is.",
      "key insight: a ring's rotation is the permutation rather than a picture of one. a cycle's stickers sit on their ring in the order the sequence sends them, so one notch puts every one of them exactly where the sequence would have, and the dial and the cube cannot drift apart.",
      "one number folds the net into the cube. `--fold` drives the five hinges, the angle it is seen from and the light on each face, and the faces hang off each other the way the paper does, so a hinge is one rotation about an edge two faces already share.",
    ],
    createdAt: "2026-09-20",
    source:
      "https://github.com/SanyamPunia/www/blob/main/components/labs/cube-orbit/index.tsx",
    reference: "https://x.com/TheMathFlow/status/2101154346583154801",
    flush: true,
    hint: "Turn the dial. Press the cube to unfold it, then point at a ring.",
  },
  {
    slug: "foil-card",
    title: "Foil Card",
    description: [
      "a profile card stamped with a dot-matrix hologram. point at it and it tips toward the pointer, weighted, while the foil under the print picks up colour.",
      "key insight: none of that colour is an ink. a dot-matrix hologram is a grid of microscopic diffraction gratings, one per dot, and what leaves a dot is whichever wavelength its own grating sends to the eye at the angle the card is held at. the whole equation is one dot product against the half vector, and straight under the light that part is zero, so the dot beneath the pointer is dark and the coloured orders ring it.",
      "a press stretches the foil, and a stretched grating has a wider pitch, so the wave leaving the finger is a redshift rather than a ring of brightness. the card is weighted too: it turns about the ink-weighted centroid of its own print, measured off the rendered card, so a finger on the empty end has much the longer lever.",
    ],
    createdAt: "2026-09-20",
    source:
      "https://github.com/SanyamPunia/www/blob/main/components/labs/foil-card/foil.ts",
    reference: "https://jackandjill.ai",
    flush: true,
    hint: "Point at the card to move the light. Press to send a wave through it.",
  },
  {
    slug: "heart-flipbook",
    title: "Heart Flipbook",
    description: [
      "a like button and the strip it is played from. press the heart and a ring goes out, the confetti scatters and the heart lands in the middle of it.",
      "key insight: twitter's own heart is not an animation. it is a sprite sheet of 29 frames played with `steps(28)`, and it gets away with that because 29 frames over 800ms is one image every 28.6ms, which is under two display frames. the strip here is baked from the same painter that draws the live version, so swapping between them changes nothing you can see in the button.",
      "the ring is one stroked circle and never a disc with a smaller disc masked out of it. `r` grows while `lineWidth` shrinks, so the inner edge and the outer one travel at different rates from one shape, which is the seed dot, the disc, the hole punching through and the annulus thinning away in that order. the `run` knob is what breaks the flipbook, since the same 29 frames over 2.4s are 86ms apart.",
    ],
    createdAt: "2026-09-21",
    source:
      "https://github.com/SanyamPunia/www/blob/main/components/labs/heart-flipbook/burst.ts",
    flush: true,
    hint: "Open the sheet, then press the heart and swap to live.",
  },
  {
    slug: "arc-menu",
    title: "Arc Menu",
    description: [
      "a launcher whose items ride an arc. press the plus and five marbles file out from under it, swing round a circle and settle.",
      "key insight: one scalar carries the whole strand, and that has a consequence nobody expects. whichever ball is last through the mouth spends its entire passage in whatever part of the curve the end of the move lands on, so an ease-out puts the crawl on the last one in. measured per frame: 408ms for the leader, the biggest ball, against 33 for each of the others, which is why the two directions cannot share a curve.",
      "the strand is a chain rather than a rail. each ball follows the one ahead through its own exponential instead of sitting a fixed arc behind the leader, so it pays out under a fast hand and gathers when the hand stops. a hover peeks a sliver of the leader past the button's rim, and a crank turns a degree of strand per degree of hand.",
    ],
    createdAt: "2026-09-23",
    source:
      "https://github.com/SanyamPunia/www/blob/main/components/labs/arc-menu/track.ts",
    flush: true,
    hint: "Press the plus, or crank it round the arc. Pick a marble.",
  },
  {
    slug: "venetian-blind",
    title: "Venetian Blind",
    description: [
      "a venetian blind over a page, tilted by its two cords. pull the left cord and the slats turn open, pull the right one and they shut.",
      "key insight: the tilt runs down the blind instead of landing on every slat at once. each slat follows the one above it through its own exponential, the way a ladder tape carries the drum's turn down one rung at a time, so a hard tug reaches the foot a beat after the head and a slow pull shows no lag at all.",
      "the slats are taller than their pitch, so a shut blind overlaps itself and no light gets through until each slat is past 27 degrees. that dead band at the start of a pull is what a real blind does too.",
    ],
    createdAt: "2026-09-23",
    source:
      "https://github.com/SanyamPunia/www/blob/main/components/labs/venetian-blind/index.tsx",
    reference: "https://x.com/samdape/status/2102774261912068585",
    bare: true,
    hint: "Pull the left cord to open the slats, the right to shut them.",
  },
  {
    slug: "gust-flag",
    title: "Gust Flag",
    description: [
      "a flag toggle. press it and the flag runs up the pole, a gust rolls along the cloth with a halftone fill riding behind it, and the tails throw three splashes.",
      "key insight: the cloth is described once in its own coordinates, along it from the pole and across it from the top edge, and every point drawn goes through one `warp`. so the outline, the solid fill, the halftone dots and the spots the splashes leave from all bend by the same rule and cannot disagree.",
      "a raised flag never stops fluttering, and the halftone stays after the fill as the light on the folds: where the wave tilts the cloth away, the screen punches through. move the pointer past it and the pointer is wind.",
    ],
    createdAt: "2026-09-25",
    source:
      "https://github.com/SanyamPunia/www/blob/main/components/labs/gust-flag/flag.ts",
    reference: "https://x.com/kippe07/status/2103036199774585026",
    flush: true,
    hint: "Press the flag to raise it, and move past it to blow.",
  },
  {
    slug: "region-comment",
    title: "Region Comment",
    description: [
      "a poster under review. drag across it to mark a region and a composer comes up under the box. post it and the box keeps its colour and carries the comment as a pill.",
      "key insight: the composer answers the box, not the page. it lands under the box's left edge, flips above it when the stage runs out, and fades in travelling a few pixels away from the box, so it reads as coming out of the thing it is about. both it and the pill are fixed heights, so where they go is arithmetic rather than a measurement.",
      "a composer holding unsaved words does not close on a stray press: the press goes back to the field. press a pill to edit it, and a saved comment takes two presses to delete.",
    ],
    createdAt: "2026-09-26",
    source:
      "https://github.com/SanyamPunia/www/blob/main/components/labs/region-comment/index.tsx",
    reference: "https://x.com/nonzeroexitcode/status/2103203539174436892",
    flush: true,
    hint: "Drag across the poster to mark it, then leave a comment.",
  },
  {
    slug: "forecast-list",
    title: "Forecast List",
    description: [
      "a week of forecasts as five rows of type. point at a row and a card of that day's weather opens beside the list, and the word takes the weather too.",
      "key insight: the letters are measured, not guessed. the row's text is drawn onto a canvas in its own font and read back, which gives the top edge of the ink in every column, so snow settles on the letters and slumps, rain lands on them and runs down the stroke it hit, and leaving the row shakes it all off.",
      "the card beside the list is one card. it rides from row to row while its sky slides through it in the direction of travel behind a feathered edge, and its icon shrinks out and grows back in place.",
    ],
    createdAt: "2026-09-27",
    source:
      "https://github.com/SanyamPunia/www/blob/main/components/labs/forecast-list/index.tsx",
    reference: "https://useplanes.com/components/shader-index",
    flush: true,
    hint: "Point at a day, then run down the list.",
  },
  {
    slug: "photo-stack",
    title: "Photo Stack",
    description: [
      "a pile of photos, each tilted a different way. drag the front one off either side and it tucks in at the back while the next comes forward. press any photo, or the edge of one leaking out from behind, and it opens as a carousel.",
      "key insight: every card is always mounted and only ever moved. the pile and the carousel are two sets of poses for the same five elements, so opening a photo is that card travelling and growing from where it lay, and closing puts the one you were looking at on top.",
      "a thrown card stays in front until it is clear of the pile, so the only part of it that goes behind the new front card is the part still over it.",
    ],
    createdAt: "2026-09-28",
    source:
      "https://github.com/SanyamPunia/www/blob/main/components/labs/photo-stack/index.tsx",
    reference: "https://x.com/radiofun8/status/2103909911826702684",
    flush: true,
    hint: "Drag the top photo aside, or press one to open it.",
  },
  {
    slug: "invite-flap",
    title: "Invite Flap",
    description: [
      "an invite sealed under a flap. press the pill and it flips up over its own top edge like a page of a desk calendar, and what was under it is the code.",
      "key insight: the flap is one element with two faces, and it hinges on a line half a gap above the pill rather than on its edge. so half a turn lands it one gap clear of the code, its back is pre-turned by 180 degrees to read upright once it has gone over, and the code was mounted under it the whole time, so the reveal is occlusion and nothing fades in.",
      "one spring carries the flap whatever it is doing, so a press mid-flight turns it round from the speed it already has, and it overshoots its stop by about seven degrees, which is a page landing rather than a box rotating to an angle.",
    ],
    createdAt: "2026-09-29",
    source:
      "https://github.com/SanyamPunia/www/blob/main/components/labs/invite-flap/index.tsx",
    reference: "https://x.com/nitishkmrk/status/2103061978680086905",
    flush: true,
    hint: "Press the invite to flip it open, and press the flap to close it.",
  },
  {
    slug: "point-cloud",
    title: "Point Cloud",
    description: [
      "a figure drawn in dots. a few thousand points take the shape of a sphere, turn slowly, lean toward the pointer and scatter away from it, and one button folds them into the next shape.",
      "key insight: every shape is a cloud of the same number of points sorted by height, so dot i always goes to point i of the next shape. that one sort carries the top of a sphere to the top of a helix instead of throwing every dot across the room, and a staggered start with a swirl through the middle of each flight makes it read as the cloud rearranging itself rather than two pictures crossfading.",
      "a frame is ten fills, not one per dot: the dots are bucketed by depth into ten opacity bands and each band is one path, so 3,500 of them cost about as much to paint as the floor grid under them.",
    ],
    createdAt: "2026-09-30",
    source:
      "https://github.com/SanyamPunia/www/blob/main/components/labs/point-cloud/shapes.ts",
    flush: true,
    hint: "Move over the dots to scatter them. Press to reshape.",
  },
  {
    slug: "fingerprint-ink",
    title: "Fingerprint Ink",
    description: [
      "a blank fingerprint, drawn as the faint impression of its ridges. press the print and ink spreads out from that point through the patch of ridges around it, or drag across it, and once all seven patches are full a light reads the print and it verifies.",
      "key insight: every ridge is sampled once along its own outline, and each sample belongs to the nearest of seven hand-placed seeds. a press floods one seed's samples, each arriving by its distance from the press and growing a disc clipped to its own ridge, so the ink stains a patch of several ridges outward from the point of contact and a ridge crossing two patches is half inked until the second is pressed.",
      "the light that reads the print is also what turns it green: everything above the band has been read, so the colour change rides under the brightest part of it.",
    ],
    createdAt: "2026-10-01",
    source:
      "https://github.com/SanyamPunia/www/blob/main/components/labs/fingerprint-ink/ink.ts",
    flush: true,
    hint: "Press the print to ink a patch of it, or drag across it.",
  },
  {
    slug: "weather-morph",
    title: "Weather Morph",
    description: [
      "five flat weather icons, cloudy, a clear night, sunny, light rain and snow. press the icon and it morphs into the next one, outline into outline, with a slight dip in scale through the middle of the change.",
      "key insight: every icon is one body and its small parts, every outline is resampled to the same 256 points, and every morph is the same three moves. the body morphs into the next body, the old small parts wind home into it, and the new ones come out of it, so the sun pulls its rays in, becomes the cloud, and the rain drips out.",
      "the shape runs on a strong ease-out so it answers the press on the first frame, the small parts stagger round the icon, and a press mid-morph starts from the shapes as they are that frame, so it turns round without jumping back.",
    ],
    createdAt: "2026-10-02",
    source:
      "https://github.com/SanyamPunia/www/blob/main/components/labs/weather-morph/morph.ts",
    reference: "https://x.com/raul_dronca/status/2094013190673670458",
    flush: true,
    hint: "Press the icon to morph it into the next one.",
  },
  {
    slug: "bento-focus",
    title: "Bento Focus",
    description: [
      "five gradient tiles on a bento grid with one large focus slot. press a small tile and it grows into the slot, or carry it there by hand while the grid makes room, and the focus tile dragged onto a small slot swaps with the tile there.",
      "key insight: every tile is a window onto a picture laid out at the focus slot's size, so a tile that grows shows more of its picture rather than the same picture bigger, and the target's rim, the ball's flight and the holds only appear in the focus slot. its box is four motion values on one spring, so a drag and a press write the same values and a release carries the hand's speed.",
      "hover is tested against the resting slots, so a hovered tile can grow into the gap without moving the edge that decides it. the arrow keys walk the grid by position.",
    ],
    createdAt: "2026-10-03",
    source:
      "https://github.com/SanyamPunia/www/blob/main/components/labs/bento-focus/index.tsx",
    reference: "https://annnimate.com/animations/bento-focus",
    flush: true,
    hint: "Press a tile, or drag it into the focus slot.",
  },
  {
    slug: "sketch-book",
    title: "Sketch Book",
    description: [
      "a book drawn in thin pen strokes, seen from straight above, so all there is of it is a cover. hover it and the camera swings down to an isometric view and it turns out to be a cuboid, and press it and the cover opens and the first page writes itself.",
      "key insight: the book is four boxes and the camera is two angles under an orthographic projection, so the cover and the cuboid are one drawing at two poses. every line is a filled ribbon whose width is the pen's pressure, landing heavy and lifting thin, and every wobble is a share of its own line's length, so a side turning edge on takes its scribble with it.",
      "the drawing inks itself in the order a sketch is built when it first comes into view, and redraws its wobble about twelve times a second while the book moves.",
    ],
    createdAt: "2026-10-04",
    source:
      "https://github.com/SanyamPunia/www/blob/main/components/labs/sketch-book/book.ts",
    flush: true,
    hint: "Hover the book to turn it, then press to open it.",
  },
  {
    slug: "ambient-card",
    title: "Ambient Card",
    description: [
      "a picture that casts its shadow in its own colours. each side of the shadow is the colour most of that side of the picture is, so a picture that runs from cobalt to emerald throws blue off one corner and green off the other.",
      "key insight: the edge is cut into thirty segments and each one takes a majority vote over a band of the picture just inside it, 64 coarse bins and the mean of the fullest, because the average of a band holding two colours is a third colour that is on neither. each colour is then pulled darker and more saturated, since a shadow on white has to be darker than the page to show at all.",
      "the picture is a canvas sampled live, so dragging it round turns the shadow's colours with it, and a new picture's colours travel round the edge from the dot that was pressed.",
    ],
    createdAt: "2026-10-04",
    source:
      "https://github.com/SanyamPunia/www/blob/main/components/labs/ambient-card/glow.ts",
    flush: true,
    hint: "Drag the picture to turn it, or pick another below.",
  },
  {
    slug: "highlight-wave",
    title: "Highlight Wave",
    description: [
      "a page of notes you can mark up. select a run of text and a palette comes up over it, and picking a colour sends a wave along the selection: each character swells, glows in that colour and settles into it while the bar fills in behind.",
      "key insight: the bars are drawn from the mark's own line fragments in a layer under the text rather than as a background on it, so each line rounds its own ends and the bar can sweep in a line at a time behind the characters. every character holds its old colour until the wave reaches it, so recolouring a mark runs the same wave from one colour to the next.",
      "kerning is off on the notes, so a run split into characters for the wave sets at exactly the width it had as plain text and nothing reflows when it is marked.",
    ],
    createdAt: "2026-10-06",
    source:
      "https://github.com/SanyamPunia/www/blob/main/components/labs/highlight-wave/wave.ts",
    reference: "https://x.com/heydamir/status/2106779932659470606",
    flush: true,
    hint: "Select some text, then pick a colour.",
  },
  {
    slug: "abacus",
    title: "Abacus",
    description: [
      "an abacus drawn in single strokes: where the pointer sits along the rod splits the ten beads, the ones to its left packed against the left post and counted, the rest against the right.",
      "key insight: one pointer position always gives one arrangement, since the split is read against the rod, which never moves, and never against a bead. the beads cannot pass each other, so the bead at the front of each moving group leaves first.",
      "built on the `hairline` engine by [lucas markes](https://hairline.lucasmarkes.com/).",
    ],
    createdAt: "2026-10-07",
    source:
      "https://github.com/SanyamPunia/www/blob/main/components/labs/abacus/figure.ts",
    reference: "https://hairline.lucasmarkes.com/",
    flush: true,
    hint: "Move along the rod to count the beads.",
  },
  {
    slug: "scratch-card",
    title: "Scratch Card",
    description: [
      "a scratch card: nine symbols under a silver coating, and three of a kind wins a code. the card leans toward the pointer, lies flat under a press, and sheds shavings that blow off it when the prize comes up.",
      "key insight: the brush is the edge of a tilted coin, an ellipse with two nicks in it, so it clears a wider band across than along and leaves streaks a second pass takes. the scratch is one looping noise whose level, pitch and pan follow the coin's speed, place and the coating under it.",
      "a pen's pressure and a finger's contact patch scale the coin's edge, and a phone ticks under a finger on foil.",
    ],
    createdAt: "2026-10-08",
    source:
      "https://github.com/SanyamPunia/www/blob/main/components/labs/scratch-card/foil.ts",
    flush: true,
    hint: "Scratch the silver. Three of a kind wins. Sound on.",
  },
  {
    slug: "scribble-type",
    title: "Scribble Type",
    description: [
      "a note that types itself out a letter at a time in a hand, and a pen that goes back over it: once the typing passes a marked run, the pen circles, underlines, strikes or highlights it before the typing carries on.",
      "key insight: every character is laid out from the first frame and only its opacity changes, so nothing reflows while the note is written and every mark is measured off the finished text before the first letter appears. a loop turns 1.1 times and grows as it goes, so it ends outside where it started, and every mark is drawn twice, the second pass thinner and a beat behind.",
    ],
    createdAt: "2026-10-09",
    source:
      "https://github.com/SanyamPunia/www/blob/main/components/labs/scribble-type/doodle.ts",
    flush: true,
    hint: "Press the arrow for the next note.",
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
  "tab-overview",
  "tether-button",
  "document-pocket",
  "event-stacking",
  "stamp-collection",
  "book-opening",
  "folder-stack",
  "window-shade",
  "rain-splatter",
  "sticker-peel",
  "halftone-ripple",
  "notch-drop",
  "island-menu",
  "custom-cursor",
  "radial-menu",
  "flip-clock",
  "wrapped-pattern",
  "book-shelf",
  "shelf-drop",
  "crack-button",
  "stem-picker",
  "pixel-reveal",
  "ember-burst",
  "gooey-chips",
  "notice-stack",
  "tide-card",
  "cube-orbit",
  "foil-card",
  "heart-flipbook",
  "arc-menu",
  "venetian-blind",
  "gust-flag",
  "region-comment",
  "forecast-list",
  "photo-stack",
  "invite-flap",
  "point-cloud",
  "fingerprint-ink",
  "weather-morph",
  "bento-focus",
  "sketch-book",
  "ambient-card",
  "highlight-wave",
  "abacus",
  "scratch-card",
  "scribble-type",
] as const;

export type ImplementedLab = (typeof IMPLEMENTED_LABS)[number];

export function isImplemented(slug: string): slug is ImplementedLab {
  return (IMPLEMENTED_LABS as readonly string[]).includes(slug);
}
