import { caveat } from "@/app/fonts";
import { cn } from "@/lib/utils";
import { STAGE_VIEWBOX } from "./poses";

/**
 * A note pencilled in the stage's bottom left corner, with an arrow up to the
 * pocket.
 *
 * The demo does nothing until the pointer is over the pocket, and nothing about a
 * dark box says "hover me", so without this the experiment reads as a still
 * image. It is the one place here that gets a handwriting face: the note is about
 * the demo rather than part of it, and Inter would read as another label inside
 * the piece.
 *
 * It goes away once the fan is out, because a hint that outlives the thing it
 * points at is just clutter.
 */

/**
 * The arrow, in the stage's own 1300x900 units, so it scales with everything
 * else and needs no correction.
 *
 * **The end tangent is the whole design.** It is (24, -14), or 30 degrees above
 * horizontal, which is the real bearing from the note to the middle of the pocket.
 * It was (20, -102) first, which is 79 degrees: a nearly vertical arrow that
 * climbed past the pocket's left edge and pointed at the empty stage above it. An
 * arrow is only pointing at something if its tangent is aimed at that thing, and
 * everything else about the curve follows from that.
 *
 * Small on purpose: 35x16px at the full stage width, from 52x62 originally. A
 * hint is the quietest thing on the stage, so it is sized to be noticed second.
 *
 * It stops 20px short of the pocket rather than 7. An arrow that nearly touches
 * what it points at reads as an assembly diagram calling out a part, where one
 * standing off it reads as a note gesturing at the whole thing. It also clears
 * the note's own ascenders by 12px, so it is drawn above the words and never
 * through them.
 *
 * Two paths. The spine leaves the note almost horizontally, since it emerges from
 * the end of the words, then bends up. The head is one stroke running barb, tip,
 * barb with a bow on each side, because straight barbs read as a vector
 * arrowhead and this is meant to look drawn.
 */
const SPINE = "M205 778 C238 782 270 757 289 745";
const HEAD = "M281 764 Q287 755 289 745 Q277 740 266 744";

/** the note's own corner, as percentages of the stage */
const TEXT = { left: "3.5%", bottom: "4%" } as const;
/** and its size, as a fraction of the stage's width, like every other value here */
const SIZE = 0.042;
/** the arrow's weight in stage units, which is about 1.6px at the full width */
const STROKE = 3.8;

export function Hint({ stage, show }: { stage: number; show: boolean }) {
  return (
    <div
      /*
       * `pointer-events-none` matters twice. The hint must never be a hover
       * target of its own, and it must not sit between the pointer and the
       * stage's own `pointermove`, which is what decides everything else here.
       *
       * Hidden where there is no hover to give, since the copy would be a lie on
       * a touch screen and the panel is tappable there instead.
       */
      className={cn(
        "pointer-events-none absolute inset-0 z-10 hidden text-text-muted",
        "transition-opacity duration-300 [@media(hover:hover)]:block",
        show ? "opacity-100" : "opacity-0",
      )}
    >
      <svg
        aria-hidden="true"
        focusable="false"
        viewBox={STAGE_VIEWBOX}
        /*
         * Fainter than the words it belongs to. The note is what carries the
         * meaning, and the arrow only says which way to look, so it should be the
         * last thing read rather than a line competing with the pocket's own
         * edge. Nested inside the wrapper's own opacity, which multiplies, so
         * hiding still reaches zero.
         */
        className="absolute inset-0 size-full opacity-70"
        fill="none"
        stroke="currentColor"
        strokeWidth={STROKE}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d={SPINE} />
        <path d={HEAD} />
      </svg>

      {/* real text, not an SVG `<text>`, so it takes the stylesheet's lowercasing
          and the font class the same way any other copy does */}
      <p
        className={cn(caveat.className, "absolute font-medium leading-none")}
        style={{
          left: TEXT.left,
          bottom: TEXT.bottom,
          fontSize: stage * SIZE,
        }}
      >
        Hover this
      </p>
    </div>
  );
}
