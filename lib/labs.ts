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
      "a terminal-style tab strip with three stages of one window: a row of labels, a taller strip where every tab shows what it holds on hover, and an overview grid filling the window so a tab can be picked by its shape rather than its title.",
      "key insight: a tab is one element in all three stages, so a shared `layoutId` carries it between the strip and the grid. Motion tracks a card from where it was picked up to where it lands instead of one node vanishing while another appears in place, and tab order never changes, which is what makes that readable.",
      "everything that moves runs on one spring, so the card, the strip and the window resize together. At different speeds they read as three pieces rather than one window. The previews are one component at two sizes, and a card keeps the smaller one in both the strip and the grid, so crossing between them changes its box and nothing else.",
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
      "A button pressed from a distance. The cursor shoots a web at the button's nearest edge, and the button goes down when the web lands rather than when the mouse does. Hold it and the strand pays out, hangs slack as the hand comes closer, and falls as it snaps back on release.",
      "Key insight: one clamp into the button's rect, inset by its own radius, gives the nearest point on its boundary and also answers whether a press landed on the button at all. The anchor is then fixed, or the splat slides around the edge and stops reading as stuck.",
      "The strand is two mirrored threads wound around a spine, one quadratic per half lobe. They ride the spine's local normal, so slack bends the spine and the twist follows it round instead of staying square to a straight axis.",
      "The hands are OpenMoji glyphs, emoji as artwork rather than as a text glyph. Each pairs the black set's outline with the colour set's skin shape, since a stroke-only hand is transparent and the label read straight through it.",
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
      "A pocket of paper. Hovering it fans the cards up and tilts the front panel forward, hovering one card sinks the rest so that one stands clear, and clicking a card grows it to the middle of the stage with the others pushed off to the sides. Each sheet carries its own hue, since five skeletons built from three arrangements are otherwise one texture.",
      "Key insight: hover cannot be left to the DOM here. It hit tests boxes as they are currently animated, so a card that moves because it is hovered moves out from under the pointer, the hover drops, the card falls back, and it picks the pointer up again. The fan flickers, and a card cannot be reached at all unless the pointer crosses it inside one frame. One `pointermove` on the stage, tested against the fan's neutral geometry, has no loop left to close.",
      "A card is staged by animating its `width` rather than by scaling it. At three times the size a scale paints a 1px hairline at 3px and turns a corner into a stadium, so poses are stage pixels and a card's contents are sized in `cqw` against the card itself. An element is never its own query container though, so that unit on the card's own padding resolves against the viewport instead and inflates the box past twice its size.",
      "Three layers under one perspective, and none of them nested: an element carrying `perspective` is its own stacking context, and the cards have to interleave between the pocket's wall and its shorter front panel. The pocket's hover reach grows with it, from its own footprint when shut to the box around pocket and fan when open, or a diagonal out to an outer card crosses a dead band and shuts the fan halfway.",
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
      "A four-day calendar whose events are dragged between slots. A card dropped onto another joins it as a stack: the pile compresses to fit the cell it is in, the card underneath keeps a sliver of its own colour showing, and clicking the front card sends it to the back. Holding a press on a stack takes the whole thing, which then travels and lands as one.",
      "Key insight: `layout` is what moves a card between cells, and `layout=\"position\"` on the card's content is what stops that being a mangling. A layout animation covers a resize with a transform, and joining a pile takes every member from 70px to 63px, so a plain child squashes vertically on the way in and springs back at the end. The locked box holds its real size through its parent's.",
      "The drop is two animations at once. Drag writes a plain `x`/`y` offset from the card's own box, and the commit moves that box to another cell, so `dragSnapToOrigin` and `layout` each cover one half of the distance between them. Both ends land wherever the springs are, and matching the two is what keeps the card off a curve on its way into the slot.",
      "Both piles answer the drag and the card in the air does not. The cell it is heading for counts it before it lands, and the cell it left drops it the moment it is over another one, so breaking a pair leaves a lone card holding the whole cell. The lifted card keeps the box it had at rest, since a card that resizes under the pointer reads as the pointer doing it.",
      "A held pile travels by copying rather than by sharing. Drag writes to whichever motion value sits in the card the pointer has, so the rest of the pile subscribes to that one and mirrors it into its own, which is also what gives every card the same lean for nothing. The copy has to outlive the drop, since the leader's offset is still unwinding after the release.",
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
      "Three postage stamps laid out by hand on a dark table. Hovering one lifts it, clicking one brings it to the front of the stage and pushes the other two out behind it, and the print inside a focused stamp slides under its own window as the pointer moves around it.",
      "Key insight: the paper is an SVG, not a `div` with a CSS mask. Both can punch the perforations, but only the SVG gives a `drop-shadow` that follows the scallops instead of the bounding box, and a stamp whose shadow is a rectangle is a rectangle. The holes sit centred on the edge line so half of each one bites in, which is what leaves convex paper between them.",
      "A stamp is staged by animating its `width` and `height`, never by scaling it. A scale takes the perforated edge and the shadow blur with it, which is the one thing drawing the paper as vector was for. So the poses are stage pixels and the lettering is sized in `cqw` against the stamp itself, which makes it a query container for its own children and never for itself.",
      "The print is drawn larger than its window on every side, so the parallax has somewhere to slide and no edge of it can cross the cream frame however far the pointer pushes. It runs on a looser spring than the stamp: the stamp arrives and stops, the print keeps drifting for a moment, which is what reads as glass.",
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
      "A book on a table, fourteen sheets deep. Hovering it fans every leaf off the spine and lays the front board out to the left, and in cursor mode the fan answers the pointer instead: the further left of the shut book's fore-edge it goes, the further the cover comes round.",
      "Key insight: the stage carries one number and every sheet multiplies it by the angle it lands on at full open, so fourteen transforms come off one inherited property and the browser is the thing interpolating them. The fan is that same lerp run across the stack rather than across time, which leaves one value in the file deciding how wide the book opens.",
      "The smoothing is `a * (1 - t) + b * t` on a time constant rather than a fixed share of the gap per frame, which is a different curve on every refresh rate: 0.15 a frame settles in half the time at 120Hz that it does at 60Hz. Nothing overshoots, since paper does not bounce and a lerp toward a target cannot pass it, and the loop stops once the gap is under `1e-4`, since an exponential approach never actually lands.",
      "The pointer's target grows with the book and never shrinks under it. A fanned sheet sits well outside the shut book's footprint, so a reach fixed at that footprint shuts the book the moment the pointer follows the paper, and a reach made of the sheets themselves cannot work at all: they move because they were hovered, which is the loop `document-pocket` exists to close.",
      "Each board is two faces under `backface-visibility: hidden`, because a cover swung past 90 degrees shows its own back and a title read backwards is the one thing a book cannot do. The inside of both boards is paper, and each carries one end of the interpolation printed against its fore-edge, which is the only strip of a sheet its neighbour does not cover.",
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
      "A drawer of card index folders, eight tabs deep, with alphabetical dividers between the groups and every tab cut to one of three positions the way a real index is. Hovering a folder pulls that one folder up out of the pile, and what it holds was behind the card in front of it the whole time.",
      "The pile deals itself in on arrival, one card behind the next. Every folder is its own colour, and each holds a white sheet with a drawn trace of what its note says, which draws itself in from the left as the card comes out: a hedge with a train swelling through it, mud clicks under two gulls, ice giving way and the water settling, two guy wires three cycles against four. The viewBox stretches with the column and the strokes do not, so one trace fills a panel at any width and keeps its hairline.",
      "Key insight: the reveal is occlusion. Every card is the same box in the same place for the life of the demo and exactly one `translateY` moves, so nothing fades, mounts or is measured, and the card in front of the one being read never has to give way.",
      "The lift is a whole number of rows, which is not tidiness. A lifted card's paper edge cuts across whatever is behind it, so at any other value that edge lands part way through a tab and slices it. At a multiple of the row it lands exactly where a card's own paper starts, so every tab behind is either whole or gone, and at three rows, one whole turn of the cut cycle, it lands on a tab cut to the same position as its own and covers it exactly.",
      "A card is also taller than it looks, by exactly the lift, and that was a flicker. A tab band is transparent either side of the tab in it, so what shows through one card's band is the paper of the card behind. Lifting takes the foot of that paper up too, and a card any shorter stops covering its last few pixels: the pointer there lands on the card behind, which lifts and leaves in its turn, and the pile walks down through itself.",
      "`document-pocket` had to hit test its own neutral geometry, because a card that moves in response to being hovered moves out from under the pointer. Nothing here can: a lifted card's region strictly contains its resting one, nothing else on the stage moves at all, and so the state settles in at most one step. The hit region is the drawing rather than the box, down to the curve on each tab's shoulders.",
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
      "A cabin window with a shade you pull down by hand. The panel stays wherever it is let go, and the whole cabin crosses from a white ground to a near-black one as it comes, so half way down is a place to stop rather than a moment between two states.",
      "Key insight: the theme is not a switch, it is the position of a control. The stage carries one number and every tone on it is a `color-mix` between one of the site's light tokens and its `inverse-*` twin at that number, so a deliberately light-only design gets a light and dark crossing without gaining a second theme. In `oklab` rather than sRGB, or the ramp is already dark for most of its travel.",
      "Text is the one thing on the stage that cannot interpolate. A colour crossing from dark to light passes through the ground it is sitting on, and the ground is crossing the other way at the same time, so the two meet: the readout and the wall are the same value at half travel. It steps over 0.04 of the travel instead, where the two sides measure 4.2 and 4.0 against a wall that is 13.2 and 19.0 at the ends.",
      "What holds the dark state is a gap rather than an effect. The panel is a couple of pixels narrower than the pane, which is the clearance it needs to slide at all, so a seated shade leaves two hairlines of daylight down its sides and a stage that would otherwise finish as an empty rectangle finishes as a closed shade in a dark cabin.",
      "The cabin is line art and the only soft things in it are light: the pool on the wall, the falloff away from it, the bloom under the panel's foot and that leak. A panel joint in the sidewall is a groove rather than a tone, since a shadow carries it on the light wall and a lit lip carries it on the dark one, which is the one line here that escapes the flip.",
      "Outside the glass the split is by distance instead, and nothing out there is a shape. The cloud is `feTurbulence` rather than the row of white ovals it started as, since a lump reads as a cartoon at any falloff and cloud is made of turbulence, not of ovals. The sun is a bloom with no disc in it, the wing reads by tone rather than by an outline round it, and a vignette and a film grain over the pane tie the three layers into one image. Two decks drift at a 2.8 ratio, which is what makes the parallax read as depth rather than as one thing moving. All of it then sits behind one blur, since a view drawn this precisely competes with the panel that is the actual demo, and the inner pane of a cabin window is scratched acrylic anyway: the sheen, the vignette and the grain stay sharp, being the glass rather than what is past it.",
      "Grab and pull, not aim and jump, which is why this is not a native `range` the way the signature player's scrubber is: a range moves its thumb to the click, and a shade that leaps to meet your finger is not a shade. The cost is spelling out the keys. A phone keeps its scroll everywhere but the grip, and a tap on the glass throws the panel at whichever end it is not near.",
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
      "Coloured rain over a floor drawn in perspective, and the floor keeps everything that hits it. Each drop picks a depth on the way in, which sets how big it is, how hard it falls and how far up the stage it lands, so the near ones are fat and quick and go off the bottom edge while the far ones are specks that land near the horizon.",
      "Key insight: the stage is two canvases and the split is the whole thing. One is cleared every frame and holds what is moving, the other is never cleared and holds what has landed. A mark is drawn exactly once, at the moment it is made, so the piece can accumulate a poster's worth of splatter and still cost one clear and a few hundred small fills a frame. Redrawing the accumulation every frame is the version that gets slower the longer you watch it, and it is also the version that cannot be right, since two overlapping opaque marks have an order and the order is when they landed.",
      "Nothing authored a single ray. A splash throws specks, most of them high and a handful of them flat, and each one hops on its own gravity while the floor drags at it. What it leaves on landing is whatever speed it has left: one that came down slow beads into a dot, one that came in flat and fast skids into a stroke pointing back at the splash. The radiating look is that one rule, and the outriders past the end of a long ray are one bounce, capped at one so a splash cannot rattle its way across the floor.",
      "The fall is a stretch, not a circle. A drop at full pelt covers about 20px between two frames at 60Hz, so a round one paints as a dotted line however smooth the arithmetic under it is. It is drawn from its leading edge instead, stretched back along its own travel and narrowed a little as it goes, which is both the motion blur a camera gets for free and what a falling drop actually looks like. It arrives already moving, since it has been falling for as long as it took to reach the top of the frame.",
      "Fading laid paint has to be done in visible steps. A canvas holds 8 bits a channel, so an erase at an alpha under about 1/255 rounds to nothing and the oldest splatter never leaves. The stage owes itself a fade and spends it in whole 3% steps, which costs one `fillRect` every few frames and cannot round away.",
      "The affordance is a preview rather than a cursor. A crosshair says the surface answers a pointer and stops there, so the stage draws a ring instead, at the size of the splash a press would make at that depth: move up the stage and it shrinks and flattens, which is the perspective explaining itself before you commit. The stage is a real button rather than a div holding a `tabIndex`, so the arrows aim the same ring and Enter drops on it, and Space is swallowed because a button swallows it rather than because this demo asked to.",
      "The six inks sit beside the simulation rather than in the token file, the same exception `stamp-collection` gets for a printed stamp: colour is the subject here and not a tint on one. The one lie is that a sixth of every splash is thrown in someone else's ink, because a real cluster of this many colours is many splats layered over hours, and at any rate a demo can run at, that layering never happens.",
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
      "Five die-cut stickers loose on a board. Press one and pull, and the paper under your hand folds back over the rest of itself, so what is on top of the sticker is the back of the same sticker. Keep pulling and the last of it lets go, after which it follows the hand with the fold trailing behind it and lies down flat wherever it is dropped.",
      "Key insight: the fold is a reflection, and a whole gesture is one direction and one number. Mirroring the sticker across a crease square to the peeling edge and half the peel in front of it carries that edge exactly onto the hand, which is what a fold is: the paper behind the crease is the same paper, seen from behind, standing in front of the crease. Advance the number and the crease sweeps across on its own.",
      "The peeling edge is picked once and then held for the rest of the gesture, which is the difference between a sticker and a trick. Deriving it from the pull every frame is what a first version does, and it is wrong in the way that matters: a sticker carried across the board turns as the hand does, so the lifted corner hops from one side of it to another every time the drag changes direction. A corner that has come up has come up.",
      "One vector is the whole input and it arrives from three directions. While a sticker is stuck its body cannot move, so the gap between the hand and the press is the whole of the pull. Once it is off the board the body chases the hand, so the same gap is the body's own lag. Once it is let go the gap decays to nothing. What reaches the crease is that gap's component along the frozen edge, so a drag that veers off it advances the peel more slowly and one that comes back does not advance it at all.",
      "Which way the peel may move is three lines, because a peel is three situations. Stuck under a hand it only opens, since adhesive does not re-stick when a hand relaxes. Off the board under a hand the paper is free to relax, so it eases back to a carried fold or to whatever the drag is adding, whichever is more. Let go, it eases shut. Without that floor the carried curl is the lag alone, which goes to nothing every time the hand turns a corner.",
      "So placing one is not a drop followed by an unfold. Releasing changes nothing except that the hand stops being written, and the body finishes arriving where it was already heading while the flap closes over it on the way. The two read as one movement because they are one movement.",
      "One polygon clips both layers, which is the whole of the drawing. The face is clipped to the half of the board the sticker still lies on, so the peeled part stops painting where it left. The flap is the same sticker reflected and clipped to that same half, because a reflection carries the peeled half exactly onto it. Two layers, one clip, and nothing to keep in step with anything.",
      "The board stays light, which four experiments before this one could not manage. `document-pocket`, `stamp-collection`, `book-opening` and their neighbours all had paper as the object, and paper on a white page is fog. Vinyl is not paper: the face is saturated, the only white on it is the die cut and that carries its own hairline, so the ground can be the quiet grey `folder-stack` uses. The backing is warm rather than white for the same reason, since a flap spends half its life overhanging onto the board.",
      "The hit region is the die cut and not the box round it. A hexagon's bounding box claims a quarter of its own area in corners the shape does not have, and with five stickers loose on one board those corners are what decides which one a press reaches. A keyboard gets the same peel rather than a second code path: an arrow press takes hold of the leading edge and carries it a step, and the body catching up is the lag the fold is made of.",
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
      "A pill toggle with a count. Press it and a ripple of dots runs out across the button from under the pointer, on a fixed grid, so what spreads is a halftone screen being run rather than a glow.",
      "Key insight: the ripple is a continuous field read at fixed points, and the grid is the whole of the pixelation. No dot ever moves. Every frame asks each point of the grid how far it is from the crest, and the answer is how big the dot there is, so the wave passes through the grid the way a wave passes through water, which stays where it is. Scaling a drawing of a ring would carry its dots along with it, and dots that travel are a texture sliding, not a print.",
      "A dot has six sizes, not a continuum. The field under it is smooth, but a dot steps from one size to the next as the crest passes rather than sliding through every size between, so a frozen frame shows rings of dots at one size each and the motion reads as a screen being run. The radius goes with the square root of the field, since what the eye reads off a halftone is the ink's area and area goes with the square of the radius. On a straight line the small end of the field was nearly empty.",
      "The crest sets out fast and slows as it goes, reaching the pill's far corner in about a second. The band it raises widens as it travels, which is dispersion and is what keeps the late ripple from thinning to a single ring, and the trailing half of the band is longer than the leading half, so a hole opens behind the crest a beat after it passes. The reference showed both: a disc around the press, then a band at the far end with clean paper behind it.",
      "The ink is the state, not a decoration. A press that turns the button on sends the ripple out in the one hue this experiment owns, and the heart fills and takes the same hue while it is on. A press that turns it off sends the same ripple in the muted text tone, so the colour of the dots says which way the press went. The hue is a hot pink at 3.79:1 on the resting pill and 3.16 on the pressed one, which clears a graphic's floor on every ground the button paints while staying loud enough to be the show, and it lives in the component rather than in the token table.",
      "A pointer's ripple leaves the point that was pressed, and a keyboard's leaves the heart, since Space has no point to start from and the heart is what the press is about. The rest of the states are the site's own: hover lifts the label a tone as well as the fill, because the fill's own hover step is 1.04:1 and exists in the token table more than on the screen, the press is the darker fill step, instant in and timed out, focus is the shared ring, and nothing scales. The count is corrected rather than swapped, so its digit morphs.",
      "Nothing renders while a ripple runs. The canvas sits under the label and is clipped by the pill, a press pushes one record into a list, and one frame loop paints the list until it is empty and then stops asking for frames. Measured: 364 dots sampled a frame, no frames requested at rest, 64 for one ripple and none after it, and under a 4x CPU throttle with three ripples in the air at once 72 frames with the longest at 16.8ms.",
      "Reduced motion keeps the press and drops the travel. The field still appears, as a soft disc around the finger that fades where it is rather than a crest crossing the pill. The toggle, the count and the hue all change as they would have, which is what happened, and the ripple was only how it looked.",
    ],
    createdAt: "2026-09-03",
    source:
      "https://github.com/SanyamPunia/www/blob/main/components/labs/halftone-ripple/index.tsx",
  },
  {
    slug: "notch-drop",
    title: "Notch Drop",
    description: [
      "A notch hanging from the top edge of a page, and a page of things to carry to it. Lift one and the notch opens and asks for it. Hold it over the notch and the notch asks louder while the thing in your hand shrinks to fit. Let go and it is swallowed, a black drop leaving the card and merging into the notch, which says so and then closes back to its resting word.",
      "Key insight: the notch is a liquid, and a liquid is two shapes under one filter. A blur wide enough to bleed the shapes into each other, then an alpha threshold hard enough to cut the bleed back to an edge, and any two black shapes that come within a few pixels grow a neck between them. The notch's body and the drop that leaves a card sit under that filter. Nothing with an edge worth keeping does, so the label is a separate layer over it.",
      "The opening is a spring that overshoots, and the overshoot is the point. A box that resizes on an ease reads as a box resizing. A box that goes past its size and comes back reads as something soft giving way, which is what a notch that wants your card should look like. The thing in your hand is on a tighter spring, since a thing in a hand should feel held, and it shrinks to about half over the notch so the notch reads as the bigger mouth.",
      "The drop is tested against the notch's box with some reach past its edge, and the hand's release is heard on the stage rather than on the card, with the pointer captured at the lift, so a hand that runs off the card or off the notch is still the hand carrying it. Escape and a lost window put the card back. A focused card and Enter go straight into the notch, on the same path, so the keyboard sees the same capture the pointer does.",
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
      "A pill of a nav bar that opens into a menu in two moves. It grows tall first, a black slab rising off the bar with the bar's three controls still pinned to its foot, then wide, and only once it is the size of a menu does the menu arrive in it, the links one after another and the picture after them. Closing is the same three moves backwards.",
      "Key insight: a box that grows in one axis at a time is a box you can watch grow. Height and width on one clock is a rectangle scaling, which the eye reads as a zoom and cannot follow. One axis, then the other, is a thing unfolding, and the order carries information: up first says the menu comes out of the bar rather than out of nowhere.",
      "The order has to flip on the way out. A menu that grew tall then wide shrinks wide then short, or the shape it passes through on the way out is a shape it never had on the way in, and the close reads as a different object leaving. The content goes first in both directions, since a box should not resize around text that is still there.",
      "The bar's three controls never move. They sit pinned to the foot of the box and ride it up as it grows, so the reader's hand is still on the button that opened it when it is time to close it. The button's glyph turns from a pill into a square on the same clock as the box, and its label morphs from Menu to Close.",
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
      "A gallery of four cards under a cursor of its own. Crossing into the stage swaps the arrow for a dot that follows the hand a beat behind, and hovering a card grows the dot into a pill naming the lab the card opens. Move to the next card and the name morphs into the next one rather than popping out and back in.",
      "Key insight: a custom cursor is two positions, not one. The hand is where the browser says it is, and the drawn cursor is a tween chasing that point, retargeted on every move, so it arrives a beat late and settles rather than stopping dead. The lag is the whole feel of it, and it is also why the pill leans: its tilt is read off the speed of that chase, so a fast sweep tips it over and a stop swings it level.",
      "It is desktop only by the pointer's own account. A touch has no hover to take a cursor from and no arrow to replace, so a finger gets the cards as plain links and nothing is drawn. Reduced motion keeps the dot and the pill and drops the chase: the cursor sits exactly on the hand and the pill arrives without the overshoot.",
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
      "A file on a stage. Press it and pull, and a wheel of formats opens around the place it was, the shape of a game's weapon wheel: the hand carries the file, the wedge under the hand fills in and its name reads out in the empty slot, and letting go there converts the file. Letting go over the middle, or anywhere off a wedge, puts it back unchanged.",
      "Key insight: the wheel is centred on where the file was, never on the hand, so it holds still while the hand moves. Which wedge is under the hand is arithmetic on the hand's angle and distance from that centre rather than a hit test on the wedges, since the file is what the pointer is over and the wedges could never see it. Past the outer edge still counts: a wheel is a direction picker, and a hand that overshoots has still pointed.",
      "The keyboard gets the same wheel without the drag. Enter opens it on the top wedge, the arrows walk round it, Enter picks and Escape puts the file back. Reduced motion keeps every state and drops the travel: the wheel appears in place and the file is home in one step.",
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
      "A flip clock in 24-hour time. Three cards, hours in blue, minutes in green and seconds in terracotta, each a number split at a hinge across its middle. When a number changes, the top half falls forward through 180 degrees as a real flap, showing its back on the way down, and lands on the stop with a small bounce. The cards flip in from 00 when the page arrives, and the seconds keep the mechanism moving.",
      "Key insight: the flap is the only thing that moves. Behind it the top half already shows the next number and the bottom half still shows the old one, so the card reads right on every frame of the fall: the flap's front is the old number's top, its back is the new number's bottom, and it lands exactly where the bottom half was. Nothing fades and nothing morphs, which is what a mechanical clock looks like.",
      "The fall is gravity and the landing is a bounce. The first half of the run is an ease-in, since a falling card gathers speed, and the rest is the flap coming off the stop by eight degrees, then three, then resting. A press on a card sets it forward by one, so the hour and minute flaps can be watched without waiting for them.",
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
      "A printed sheet that rolls into a column. Flat, it is a drawing: a half-drop grid of dots on pale paper, a hairline rule every third column and a hue that cycles every fifth. Press the mode and it curls until its two edges meet behind it, and from there a drag turns the column, it coasts when let go, and it idles on a slow turn.",
      "Key insight: the roll is a bend rather than seventy-two strips each turning on their own. The sheet lies on a cylinder whose radius closes from infinite to the column's, so at every moment of the roll the strips lie edge to edge on one curved surface. One number carries all of them and one more turns the whole column, so the browser interpolates seventy-two transforms off two custom properties and nothing renders while the sheet rolls or the column turns.",
      "The light is arithmetic on the same two numbers. A strip darkens by the cosine of the angle it has turned to, its bearing plus the column's own turn, computed in CSS, so the column is shaded on every frame of a drag without a script touching a strip. Everything printed on the sheet repeats on a period that divides its width, the dots at 20 and the colour cycle at 100, so the seam where the two edges meet has nothing to show and turning the column walks through the five hues in order.",
    ],
    createdAt: "2026-09-09",
    source:
      "https://github.com/SanyamPunia/www/blob/main/components/labs/wrapped-pattern/index.tsx",
    flush: true,
    hint: "Press the mode to roll it, then drag the column to turn it.",
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
] as const;

export type ImplementedLab = (typeof IMPLEMENTED_LABS)[number];

export function isImplemented(slug: string): slug is ImplementedLab {
  return (IMPLEMENTED_LABS as readonly string[]).includes(slug);
}
