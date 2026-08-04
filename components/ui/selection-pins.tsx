"use client";

import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

/** One end of a selection: where the caret sits, and how tall it should be. */
interface CaretRect {
  x: number;
  y: number;
  height: number;
}

type Side = "start" | "end";

/** A text position: the node the caret is inside, and how far into it. */
interface TextPoint {
  node: Node;
  offset: number;
}

/** Visible bar width, px. Off the `--spacing` scale, like a border. */
const BAR = 3;
/** Grab area around the bar, px. A 3px target cannot be hit reliably. */
const HIT = 16;

/**
 * Turns a viewport point into a text position.
 *
 * Two APIs, because no single one is universal. `caretPositionFromPoint` is the
 * standard and what Firefox has always had, `caretRangeFromPoint` is the older
 * WebKit spelling Chrome and Safari have shipped for years. Neither is in this
 * TypeScript version's DOM lib, hence the local shape.
 */
function textPointFromPoint(x: number, y: number): TextPoint | null {
  const doc = document as Document & {
    caretPositionFromPoint?: (
      x: number,
      y: number,
    ) => { offsetNode: Node | null; offset: number } | null;
    caretRangeFromPoint?: (x: number, y: number) => Range | null;
  };

  const position = doc.caretPositionFromPoint?.(x, y);
  if (position?.offsetNode) {
    return { node: position.offsetNode, offset: position.offset };
  }

  const range = doc.caretRangeFromPoint?.(x, y);
  if (range) return { node: range.startContainer, offset: range.startOffset };

  return null;
}

/**
 * A caret at each end of a text selection, each draggable to extend or shrink
 * the selection from that edge.
 *
 * The carets cannot be done in CSS. `::selection` accepts `color`,
 * `background-color`, `text-shadow` and a couple of text-fill properties and
 * nothing else: no `content`, no pseudo-elements of its own, no children. So the
 * ends are measured off the live `Range` and drawn as a real overlay.
 *
 * `position: fixed` with the raw values from `getClientRects()`, because those
 * are already viewport-relative. Converting to page coordinates and using
 * `absolute` would mean adding scroll offsets back in and re-deriving them on
 * every scroll, for the same result.
 *
 * Still `aria-hidden`, even though the handles are interactive. They are a
 * pointer affordance for something the keyboard already does natively with shift
 * and the arrow keys, so exposing them would add two tab stops duplicating a
 * better-supported interaction.
 */
export function SelectionPins() {
  const [ends, setEnds] = useState<{
    start: CaretRect;
    end: CaretRect;
  } | null>(null);

  /**
   * The end that stays put for the duration of a drag, captured once on
   * pointerdown. Re-reading it per move would let it follow its own caret and the
   * selection would crawl instead of pivoting.
   */
  const anchorRef = useRef<(TextPoint & { side: Side }) | null>(null);

  /**
   * Whether the handles accept the pointer. False while any press is in progress
   * that did not start on a handle.
   *
   * This is not an optimisation, it fixes a real conflict. While you drag-select,
   * the closing caret tracks the pointer, so it sits directly under the cursor the
   * whole time. Left interactive it takes the pointer off the text, the browser's
   * own selection drag loses its target and stops, the caret then moves away, the
   * text gets the pointer back and the drag resumes. That oscillates every frame
   * and reads as violent flicker across the whole selection.
   */
  const [armed, setArmed] = useState(true);

  useEffect(() => {
    // `selectionchange` fires on every pointer move through a drag, so the read
    // is coalesced to one per frame rather than per event
    let frame = 0;

    // read per end, so a selection running from a heading into body copy gets a
    // caret matched to each rather than one size for both
    const fontSizeOf = (node: Node | null): number => {
      const element = node instanceof Element ? node : node?.parentElement;
      if (!element) return 0;
      return Number.parseFloat(getComputedStyle(element).fontSize) || 0;
    };

    const read = () => {
      frame = 0;
      const selection = window.getSelection();

      if (!selection || selection.isCollapsed || selection.rangeCount === 0) {
        setEnds(null);
        return;
      }

      const range = selection.getRangeAt(0);

      /*
       * A range can outlive the nodes it points at. `getClientRects()` on a
       * detached range still returns the coordinates those nodes last had, which
       * is how the carets ended up stranded mid-page after a navigation.
       */
      if (
        !range.startContainer.isConnected ||
        !range.endContainer.isConnected
      ) {
        setEnds(null);
        return;
      }

      /*
       * One rect per line, in document order. Zero-area rects are dropped: a
       * selection ending exactly at a line break produces an empty trailing rect
       * that would put the closing caret on the next line, alone.
       */
      const rects = Array.from(range.getClientRects()).filter(
        (rect) => rect.width > 0 && rect.height > 0,
      );

      const first = rects.at(0);
      const last = rects.at(-1);
      if (!first || !last) {
        setEnds(null);
        return;
      }

      /*
       * A rect's height is the whole line box: 23.04px against 14.4px of text, or
       * 26.64px on mobile where the leading is looser. A caret that tall
       * overshoots the glyphs at both ends, so the height is the computed font
       * size and it is centred in the line.
       *
       * Falls back to the line box if the font size cannot be read, which beats a
       * caret of height 0.
       */
      const startHeight = fontSizeOf(range.startContainer) || first.height;
      const endHeight = fontSizeOf(range.endContainer) || last.height;

      const next = {
        start: {
          x: first.left,
          y: first.top + (first.height - startHeight) / 2,
          height: startHeight,
        },
        // `top`, not `bottom`. The closing caret belongs to the last line, so it
        // is centred in that line's box the same way the opening one is.
        end: {
          x: last.right,
          y: last.top + (last.height - endHeight) / 2,
          height: endHeight,
        },
      };

      // bail when nothing moved, or a drag would re-render twice a frame for
      // pointer travel that never crossed a character
      setEnds((current) =>
        current &&
        current.start.x === next.start.x &&
        current.start.y === next.start.y &&
        current.start.height === next.start.height &&
        current.end.x === next.end.x &&
        current.end.y === next.end.y &&
        current.end.height === next.end.height
          ? current
          : next,
      );
    };

    const schedule = () => {
      if (frame === 0) frame = requestAnimationFrame(read);
    };

    document.addEventListener("selectionchange", schedule);
    // capture, so this also catches scrolling inside a nested scroller such as a
    // code block or the file-tree lab, not just the document
    window.addEventListener("scroll", schedule, true);
    window.addEventListener("resize", schedule);

    return () => {
      if (frame !== 0) cancelAnimationFrame(frame);
      document.removeEventListener("selectionchange", schedule);
      window.removeEventListener("scroll", schedule, true);
      window.removeEventListener("resize", schedule);
    };
  }, []);

  useEffect(() => {
    /*
     * Capture phase, so this runs before the handle's own `onPointerDown` and can
     * tell the two cases apart: a press that landed on a handle keeps them live,
     * because `setPointerCapture` needs the element to stay hit-testable, while
     * any other press disarms them for the duration.
     */
    const disarm = (event: PointerEvent) => {
      const target = event.target;
      if (
        target instanceof Element &&
        target.closest("[data-selection-caret]")
      ) {
        return;
      }
      setArmed(false);
    };
    const rearm = () => setArmed(true);

    document.addEventListener("pointerdown", disarm, true);
    document.addEventListener("pointerup", rearm, true);
    document.addEventListener("pointercancel", rearm, true);

    return () => {
      document.removeEventListener("pointerdown", disarm, true);
      document.removeEventListener("pointerup", rearm, true);
      document.removeEventListener("pointercancel", rearm, true);
    };
  }, []);

  /*
   * This component sits in the root layout, so it survives navigation while the
   * text it measured does not. Nothing fires `selectionchange` on a client-side
   * route change either, so without this the read never re-runs and the carets
   * stay painted at coordinates from the previous page.
   */
  const pathname = usePathname();
  // biome-ignore lint/correctness/useExhaustiveDependencies: pathname is the trigger, not an input. The body reads nothing from it, it only needs to run again when the route commits.
  useEffect(() => {
    setEnds(null);
    anchorRef.current = null;
  }, [pathname]);

  const handleGrab = useCallback(
    (event: React.PointerEvent<HTMLSpanElement>, side: Side) => {
      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0) return;

      const range = selection.getRangeAt(0);
      // the opposite end is what the drag pivots around
      anchorRef.current =
        side === "start"
          ? { side, node: range.endContainer, offset: range.endOffset }
          : { side, node: range.startContainer, offset: range.startOffset };

      /*
       * Capture, so every move and the release land on this element even once the
       * pointer has travelled away from it. Without it the first move outside the
       * handle goes to the text underneath and starts a fresh selection.
       */
      event.currentTarget.setPointerCapture(event.pointerId);
      // stops the browser collapsing the selection and beginning its own drag
      event.preventDefault();
    },
    [],
  );

  const handleDrag = useCallback(
    (event: React.PointerEvent<HTMLSpanElement>) => {
      const anchor = anchorRef.current;
      if (!anchor) return;

      /*
       * Both handles, not just the dragged one.
       *
       * A handle sits directly under the pointer for the whole drag, and both
       * point APIs hit-test, so they resolve to it rather than the text beneath.
       * Hiding only `event.currentTarget` covered that until a caret was dragged
       * past its partner: from then on the *other* handle is the one under the
       * pointer, the query hit that instead, and the selection lurched somewhere
       * different every frame exactly as before.
       *
       * Safe with an active pointer capture: capture routes events to the captured
       * element regardless of hit-testing, and both are restored before the handler
       * returns, so nothing is ever dispatched while they are off.
       */
      const handles = Array.from(
        document.querySelectorAll<HTMLElement>("[data-selection-caret]"),
      );
      const restore = handles.map((handle) => {
        const previous = handle.style.pointerEvents;
        handle.style.pointerEvents = "none";
        return () => {
          handle.style.pointerEvents = previous;
        };
      });

      const point = textPointFromPoint(event.clientX, event.clientY);

      for (const undo of restore) undo();

      // past the end of the text, or over something with no text position. Holding
      // the last good selection beats collapsing it.
      if (!point) return;

      /*
       * Refuse to drag an end past its partner.
       *
       * Crossing used to invert the selection, and on the way through it passed
       * through empty: the read saw a collapsed selection, dropped `ends`, and both
       * handles unmounted mid-drag. That is why the carets vanished, and why the
       * drag then leaked, since the release fired on an element that no longer
       * existed. Clamping here means the selection can never collapse under a drag,
       * so the handles stay mounted and the whole failure mode is gone.
       *
       * `comparePoint` against a range collapsed on the pivot returns -1 before,
       * 0 at, and 1 after. A closing caret has to stay after it, an opening one
       * before. It throws on a detached or foreign node, which is a reason to hold
       * the current selection rather than guess.
       */
      const pivot = document.createRange();
      try {
        pivot.setStart(anchor.node, anchor.offset);
        pivot.setEnd(anchor.node, anchor.offset);
        const side = pivot.comparePoint(point.node, point.offset);
        if (anchor.side === "end" ? side < 1 : side > -1) return;
      } catch {
        return;
      }

      /*
       * `setBaseAndExtent`, not two `Range` mutations. It takes the fixed end and
       * the live one in that order, so dragging one caret past the other reverses
       * the selection's direction rather than producing an empty range, and the
       * carets simply swap which end they render at on the next read.
       */
      window
        .getSelection()
        ?.setBaseAndExtent(
          anchor.node,
          anchor.offset,
          point.node,
          point.offset,
        );

      event.preventDefault();
    },
    [],
  );

  const handleRelease = useCallback(() => {
    anchorRef.current = null;
  }, []);

  if (!ends) return null;

  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-50">
      {/*
       * Each caret sits wholly outside the highlight, the opening one to the left
       * of its edge and the closing one to the right. It used to straddle the
       * boundary, which is what forced a near-black: a grey close in luminance to
       * the selection loses its inner half, `text-muted` at 1.26 over the emerald
       * and `text-secondary` at 1.52. Outside, the caret only ever sits on the
       * page, so it can be as light as `stroke-strong`, the same token the
       * `InlineLink` underline uses at rest.
       */}
      <Caret
        armed={armed}
        caret={ends.start}
        side="start"
        onGrab={handleGrab}
        onDrag={handleDrag}
        onRelease={handleRelease}
      />
      <Caret
        armed={armed}
        caret={ends.end}
        side="end"
        onGrab={handleGrab}
        onDrag={handleDrag}
        onRelease={handleRelease}
      />
    </div>
  );
}

function Caret({
  armed,
  caret,
  side,
  onGrab,
  onDrag,
  onRelease,
}: {
  armed: boolean;
  caret: CaretRect;
  side: Side;
  onGrab: (event: React.PointerEvent<HTMLSpanElement>, side: Side) => void;
  onDrag: (event: React.PointerEvent<HTMLSpanElement>) => void;
  onRelease: () => void;
}) {
  /*
   * The hit box is centred on the bar, not on the selection edge, so widening the
   * target grows it symmetrically without moving what you see. The bar still sits
   * just outside the highlight: half a bar left of the opening edge, half a bar
   * right of the closing one.
   */
  const centre = side === "start" ? caret.x - BAR / 2 : caret.x + BAR / 2;

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: a pointer-only affordance inside an aria-hidden overlay, duplicating shift-arrow selection that the keyboard already has natively, so giving it a role or a tab stop would add noise rather than access
    <span
      onPointerDown={(event) => onGrab(event, side)}
      /*
       * `mousedown` is what actually starts the browser's own selection drag, and
       * cancelling `pointerdown` does not reliably suppress it. Without this the
       * browser writes the selection from its anchor and this component writes it
       * from ours, twice a frame, which flickered exactly like an unarmed handle.
       */
      onMouseDown={(event) => event.preventDefault()}
      onPointerMove={onDrag}
      onPointerUp={onRelease}
      onPointerCancel={onRelease}
      data-selection-caret=""
      /*
       * Only these two boxes ever catch the pointer, and only once no press is in
       * progress. The rest of the overlay is `pointer-events-none`, so it never
       * interferes with the drag that creates a selection.
       *
       * `touch-none`, or a touch drag scrolls the page instead of moving the
       * handle. `cursor-ew-resize` rather than the project's usual
       * `cursor-pointer`: this is a drag along one axis, not a click.
       */
      className={`group absolute flex -translate-x-1/2 touch-none select-none items-center justify-center ${
        armed ? "pointer-events-auto cursor-ew-resize" : "pointer-events-none"
      }`}
      style={{ left: centre, top: caret.y, height: caret.height, width: HIT }}
    >
      {/*
       * Grows on hover, and only on the y axis.
       *
       * A uniform scale would take the bar to 3.3px wide, and a fractional width
       * on a 3px hairline smears its antialiasing sideways rather than reading as
       * growth. That is the same reason nothing in this codebase scales on press.
       * Height is already fractional, so scaling it introduces nothing new.
       *
       * `group-hover`, because the hover target is the 16px hit box around this,
       * not the bar itself. `motion-safe:` keeps it off for anyone who asked for
       * less motion, who still get the `ew-resize` cursor as the affordance.
       */}
      <span
        className="h-full origin-center rounded-full bg-stroke-strong transition-transform duration-200 ease-out motion-safe:group-hover:scale-y-125"
        style={{ width: BAR }}
      />
    </span>
  );
}
