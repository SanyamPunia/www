"use client";

import { XIcon } from "@phosphor-icons/react";
import {
  animate,
  type MotionValue,
  motion,
  useMotionValue,
  useMotionValueEvent,
  useReducedMotion,
  useTransform,
} from "motion/react";
import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { TextMorph } from "torph/react";
import { Tooltip, TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  BAND,
  BANDS,
  BLUR,
  type Box,
  cardBox,
  EASE,
  focusAt,
  HEAD_GAP,
  lift,
  MORPH,
  OPEN,
  PAD,
  pillBox,
  RISING,
  radius,
  SETTLE_SHARE,
  SHUT,
  SLIDE,
  settleAt,
} from "./card";
import {
  clockAt,
  formatHeight,
  formatSpan,
  heightAt,
  isRising,
  MINUTE,
  TIDE,
  toTurn,
} from "./tide";
import {
  AREA_D,
  drawnAt,
  dropAt,
  FLOOR,
  markerAt,
  WAVE,
  WAVE_D,
  xAt,
} from "./wave";

/*
 * A pill that becomes a card. Press "Check the tide" and the button opens into
 * a live tide: the station, the height now, and one cycle of water drawn under
 * a marker that creeps along it while the card is held open.
 *
 * **The button is not replaced by the card, it is the card cropped to its
 * title.** One box, one ground, one label, and the whole of the morph is that
 * box's `overflow-hidden` opening. The rows, the chart and the close control
 * are all laid out at the card's full size and mounted the entire time the
 * button is a pill, so nothing mounts, nothing reflows and nothing can pop.
 *
 * That is also why the label needs no animation of any kind. It sits at `PAD`
 * from the content's top left, and a box exactly `PAD` bigger than it on every
 * side is a pill with the label centred in it. Centred in the button and top
 * left in the card are the same one rule seen through two crops.
 */

/** where the marker sits before the water has come in */
const PARKED = markerAt(0);

const LABEL = "Check the tide";

/**
 * A focus ring for the card's near-black ground.
 *
 * The project's own pattern pins `ring-text-primary/15`, which is a near-black
 * ring on near-black, and Tailwind's ring paints a 2px offset in
 * `--tw-ring-offset-color`, which defaults to white and would put a bright band
 * round the control. This is the same substitution `window-shade`, `island-menu`
 * and `ember-burst` make, and the rule it bends says never to use a *weaker*
 * ring than the declared one.
 */
const DARK_FOCUS =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inverse-text/40";

/**
 * One row's share of the reveal, and the two things it does with it.
 *
 * The window is a slice of the master clock rather than a tween with a delay,
 * so three rows still cost one animation and the exit reverses without being
 * told to. **The clock is linear and both curves are applied here**, since a
 * global ease plus a windowed mapping would hand the last row a flatter part of
 * that curve than the first and slow its slide for no reason anyone chose.
 *
 * The row lands before it sharpens: the slide takes the first 42% of the band
 * on the strongest ease-out in the piece, and the focus takes all of it on an
 * `ease`. The fast half is the half the eye tracks, which is what makes a
 * sequence read as snappy rather than as three things fading.
 *
 * The opacity is the first 35% of the row's own focus, so a row is on screen
 * early and soft rather than arriving late and sharp. It is what lets the rows
 * be inside the box while the box is still growing round them.
 *
 * Both the filter and the transform come off entirely at rest rather than
 * sitting at `blur(0px)` and `translateY(0px)`, since each makes its element a
 * compositing layer whatever its value, and there are three rows here rather
 * than one wrapper. `gooey-chips` takes its own filter off for the same reason.
 * The transform is written as a string rather than through Motion's `y`
 * shorthand, which is not hardware accelerated.
 */
function useBand(
  reveal: MotionValue<number>,
  place: MotionValue<number>,
  from: number,
) {
  const focus = useTransform(
    useTransform(reveal, [from, from + BAND], [0, 1]),
    focusAt,
  );
  const placed = useTransform(place, [from, from + BAND], [0, 1]);
  return {
    opacity: useTransform(focus, [0, 0.35], [0, 1]),
    filter: useTransform(focus, (v) =>
      v >= 1 ? "none" : `blur(${((1 - v) * BLUR).toFixed(2)}px)`,
    ),
    transform: useTransform(placed, (v) => {
      const settled = settleAt(v / SETTLE_SHARE);
      return settled >= 1
        ? "none"
        : `translateY(${((1 - settled) * SLIDE).toFixed(2)}px)`;
    }),
  };
}

/** whether a press came from the keyboard, which is what decides the handover */
function pressed(node: HTMLButtonElement | null): boolean {
  return (
    node !== null &&
    document.activeElement === node &&
    node.matches(":focus-visible")
  );
}

export default function TideCard() {
  const reduce = useReducedMotion();
  const [open, setOpen] = useState(false);
  const [pill, setPill] = useState<Box | null>(null);
  const [card, setCard] = useState<Box | null>(null);
  /*
   * The tide's own state, which is the only thing here that commits: the height
   * about every six seconds and the countdown about every one, because `torph`
   * needs a render to morph a character. Everything the chart does is written
   * straight to a node.
   */
  const [clock, setClock] = useState(() => ({
    height: formatHeight(heightAt(TIDE.start)),
    turn: formatSpan(toTurn(TIDE.start)),
    rising: isRising(TIDE.start),
  }));

  const stage = useRef<HTMLDivElement>(null);
  const title = useRef<HTMLParagraphElement>(null);
  const face = useRef<HTMLButtonElement>(null);
  const shutter = useRef<HTMLButtonElement>(null);
  const marker = useRef<SVGGElement>(null);
  const drop = useRef<SVGLineElement>(null);
  /** scoped, or two of these on one page would share a clip */
  const water = useId();

  /** the box, which is the only thing the morph moves */
  const w = useMotionValue(0);
  const h = useMotionValue(0);
  /** the rows coming into focus, and then the water coming in */
  const reveal = useMotionValue(0);
  /**
   * The rows' position, which is a second number because **the slide is an
   * entrance and not a state.**
   *
   * Read off `reveal` it reversed for free along with the focus, and that is
   * exactly what it must not do: a row that rose into place sank back out of
   * it, 12px crammed into a 260ms exit, and did it while it could still be
   * read. Traced through a close, the meta row was at 0.63 opacity and already
   * dropping. The focus is right to reverse, since the card really is going out
   * of focus, and the position is not, since the card is not putting anything
   * back where it came from.
   *
   * So this is held through the close and reset once the exit has finished, at
   * which point every row is at zero opacity and the box is a third of the way
   * back to a pill, so nothing can see it. An interrupted close reopens with
   * the rows where they are and no slide at all, which is the right answer
   * rather than a shortcoming: they never left.
   */
  const place = useMotionValue(0);
  const flood = useMotionValue(0);
  /** where the tide is in its cycle: 0 is low water and 0.5 is high */
  // typed, or `as const` on the data makes this a `MotionValue<0.301>`
  const phase = useMotionValue<number>(TIDE.start);

  const shadow = useTransform(h, lift);

  const meta = useBand(reveal, place, BANDS[0]);
  const readout = useBand(reveal, place, BANDS[1]);
  const chart = useBand(reveal, place, BANDS[2]);

  /**
   * How much of the cycle is painted: where the tide actually is, scaled by how
   * much of the drawing has arrived. One number carries the tide and one
   * carries the reveal, and the water's edge, the curve's solid half and the
   * marker all read the same product rather than three clocks that could
   * disagree.
   */
  const along = useTransform<number, number>(
    [phase, flood],
    ([p, f]: number[]) => (p - Math.floor(p)) * f,
  );
  /** the water's edge, which is a clip rather than a path rebuilt per frame */
  const edge = useTransform(along, xAt);
  const trail = useTransform(along, (s) => 1 - drawnAt(s));

  useMotionValueEvent(along, "change", (s) => {
    marker.current?.setAttribute("transform", markerAt(s));
    drop.current?.setAttribute("y2", dropAt(s).toFixed(2));
  });

  useMotionValueEvent(phase, "change", (p) => {
    setClock((was) => {
      const next = {
        height: formatHeight(heightAt(p)),
        turn: formatSpan(toTurn(p)),
        rising: isRising(p),
      };
      return was.height === next.height &&
        was.turn === next.turn &&
        was.rising === next.rising
        ? was
        : next;
    });
  });

  /*
   * Both boxes are measured rather than declared: the card's from the stage it
   * is given, and the pill's from the title's own rendered box, since the pill
   * *is* the title plus the card's padding. A layout effect, so the first paint
   * is already a pill rather than a box growing out of nothing, and again on
   * `document.fonts.ready`, since a first paint in the fallback face measures a
   * different label.
   */
  useLayoutEffect(() => {
    const read = () => {
      if (!stage.current || !title.current) return;
      const stageBox = stage.current.getBoundingClientRect();
      const titleBox = title.current.getBoundingClientRect();
      const next = cardBox({ w: stageBox.width, h: stageBox.height });
      const seat = pillBox({ w: titleBox.width, h: titleBox.height });

      setCard((was) => (was?.w === next.w && was?.h === next.h ? was : next));
      setPill((was) => (was?.w === seat.w && was?.h === seat.h ? was : seat));
    };

    read();
    document.fonts?.ready.then(read);

    const observer = new ResizeObserver(read);
    observer.observe(stage.current as Element);
    return () => observer.disconnect();
  }, []);

  /*
   * The box, and everything that rides it.
   *
   * **A re-measure is not a gesture**, so a font arriving late or a window being
   * dragged wider sets the box rather than animating it, and only a change of
   * `open` animates. `gooey-chips` documents the same rule: the first build
   * sprang the whole layout out of a stale measurement the moment Inter loaded.
   */
  const stance = useRef<boolean | null>(null);
  useEffect(() => {
    if (!pill || !card) return;
    const to = open ? card : pill;
    const moved = stance.current !== null && stance.current !== open;
    stance.current = open;

    if (!moved || reduce) {
      w.set(to.w);
      h.set(to.h);
      reveal.set(open ? 1 : 0);
      place.set(open ? 1 : 0);
      flood.set(open ? 1 : 0);
      return;
    }

    const box = open ? OPEN.box : { ...SHUT.box };
    const runs = [
      animate(w, to.w, { ...box, ease: EASE }),
      animate(h, to.h, { ...box, ease: EASE }),
      // linear, because every curve the rows use is applied inside `useBand`
      open
        ? animate(reveal, 1, { ...OPEN.content, ease: "linear" })
        : animate(reveal, 0, {
            ...SHUT.content,
            ease: "linear",
            // the rows keep their place for the whole exit and are put back
            // only once they cannot be seen
            onComplete: () => place.set(0),
          }),
      open ? animate(place, 1, { ...OPEN.content, ease: "linear" }) : null,
      open
        ? animate(flood, 1, { ...OPEN.water, ease: "easeOut" })
        : animate(flood, 0, { ...SHUT.content, ease: "linear" }),
    ];
    return () => {
      for (const run of runs) run?.stop();
    };
  }, [open, pill, card, reduce, w, h, reveal, place, flood]);

  /*
   * The tide runs while the card is open and is left where it got to when it
   * shuts, which is the one thing a cycle lets a demo do honestly. See
   * `MINUTE`. It runs to the next low water and then again, so the marker
   * leaving the right edge of the chart is the same water arriving at the left.
   */
  useEffect(() => {
    if (!open) return;
    let run: ReturnType<typeof animate> | null = null;
    const cycle = () => {
      const from = phase.get();
      const to = Math.floor(from) + 1;
      run = animate(phase, to, {
        duration: (to - from) * TIDE.period * MINUTE,
        ease: "linear",
        // the chart is exactly one cycle, so the water running off its right
        // edge is the same water arriving at its left and the drawing does
        // not move
        onComplete: () => {
          phase.set(phase.get() - 1);
          cycle();
        },
      });
    };
    cycle();
    return () => run?.stop();
  }, [open, phase]);

  /*
   * **The control that was pressed is the one that goes away**, since the face
   * and the close button are each other's opposite state, so focus is handed
   * across or a keyboard reader is left on `body` after one press. Only when
   * the press was a keyboard one: moving focus on a mouse press paints a ring
   * on every click, because Chrome judges a scripted focus rather than the
   * press that led to it. `notice-stack` and `sticker-peel` both document
   * running into this.
   */
  const chase = useRef(false);

  const shut = useCallback(() => {
    chase.current = pressed(shutter.current);
    setOpen(false);
  }, []);

  useEffect(() => {
    if (!chase.current) return;
    chase.current = false;
    (open ? shutter : face).current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") shut();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, shut]);

  const box = card ?? { w: 0, h: 0 };

  return (
    <TooltipProvider delayDuration={200}>
      {/* `select-none` on the stage: every gesture here is a press on one
          control, and the card is a readout rather than prose, so there is
          nothing in it a reader would want to drag across. */}
      <div
        ref={stage}
        className="relative flex aspect-8/5 min-h-78 w-full select-none items-center justify-center overflow-hidden rounded-lg bg-fill ring-1 ring-stroke ring-inset"
      >
        <motion.div
          style={{
            width: w,
            height: h,
            borderRadius: pill ? radius(pill) : 0,
            boxShadow: shadow,
          }}
          className="-translate-x-1/2 -translate-y-1/2 absolute top-1/2 left-1/2 overflow-hidden bg-text-primary"
        >
          {/* The card, at the card's size, whatever size the box currently is.
              `inert` while shut, or a screen reader would read a whole tide
              table out of a button that says three words. */}
          <div
            inert={!open}
            style={{ width: box.w, height: box.h, padding: PAD }}
            className="@container absolute top-0 left-0 flex flex-col"
          >
            {/* the one element both states share, at one size and one place */}
            <p
              ref={title}
              className="w-max whitespace-nowrap text-action font-medium text-inverse-text"
            >
              {LABEL}
            </p>

            {/* Everything below is `cqw` against the card, so a card on a
                phone is a miniature of the same drawing, and every size carries
                a px floor because at some width that stops being true: the meta
                row is 3cqw, which is 12.1px on a lab column and 7.4px at 320.
                `CARD_MIN_H` is the other half of the same decision. */}
            <div
              style={{ marginTop: HEAD_GAP }}
              className="flex min-h-0 flex-1 flex-col justify-between"
            >
              <motion.div
                style={meta}
                className="flex items-baseline justify-between text-[max(9.5px,3cqw)] text-inverse-text-secondary leading-none"
              >
                <span className="[text-transform:none] tracking-[0.08em]">
                  {TIDE.station}
                </span>
                <span>{TIDE.kind}</span>
                <span className="[text-transform:none]">{TIDE.zone}</span>
              </motion.div>

              <motion.div
                style={readout}
                className="flex items-end justify-between gap-[3cqw]"
              >
                {/* The height, and the state beside it rather than over it.
                    Stacked, the two spent a third of the card on four lines
                    and left the chart squashed against the foot. */}
                <p className="flex min-w-0 items-baseline gap-[2cqw] whitespace-nowrap leading-none">
                  <span className="text-[max(22px,7.6cqw)] font-semibold text-inverse-text">
                    <TextMorph duration={MORPH.duration} ease={MORPH.ease}>
                      {clock.height}
                    </TextMorph>
                  </span>
                  <span className="text-[max(10px,3.2cqw)] text-inverse-text-secondary">
                    m
                  </span>
                  {/* the one hue in the piece. A tide going out is not wrong,
                      so it takes the quiet tone rather than a second colour,
                      which is `halftone-ripple`'s call for its own off state. */}
                  <span
                    style={{ color: clock.rising ? RISING : undefined }}
                    className={cn(
                      "ml-[1.6cqw] flex items-baseline gap-[1.4cqw] text-[max(9.5px,3cqw)]",
                      !clock.rising && "text-inverse-text-secondary",
                    )}
                  >
                    <span
                      aria-hidden="true"
                      style={{ background: clock.rising ? RISING : undefined }}
                      className={cn(
                        "inline-block size-[max(5px,1.6cqw)] shrink-0 translate-y-[-0.15em] rounded-full",
                        !clock.rising && "bg-inverse-text-secondary",
                      )}
                    />
                    <TextMorph duration={MORPH.duration} ease={MORPH.ease}>
                      {clock.rising ? "rising" : "falling"}
                    </TextMorph>
                  </span>
                </p>

                <div className="flex shrink-0 flex-col items-end gap-[1.8cqw]">
                  <p className="whitespace-nowrap text-[max(9.5px,3cqw)] text-inverse-text-secondary leading-none">
                    <TextMorph duration={MORPH.duration} ease={MORPH.ease}>
                      {clock.rising ? "High water in" : "Low water in"}
                    </TextMorph>
                  </p>
                  <p className="whitespace-nowrap text-[max(14px,4.8cqw)] font-medium text-inverse-text leading-none">
                    <TextMorph duration={MORPH.duration} ease={MORPH.ease}>
                      {clock.turn}
                    </TextMorph>
                  </p>
                </div>
              </motion.div>

              <motion.div style={chart} className="flex flex-col gap-[1.6cqw]">
                <svg
                  aria-hidden="true"
                  viewBox={`0 0 ${WAVE.w} ${WAVE.h}`}
                  className="w-full overflow-visible"
                >
                  {/* The water that has come in, clipped at its own edge
                      rather than rebuilt as a path every frame. */}
                  <clipPath id={water}>
                    <motion.rect
                      x={0}
                      y={0}
                      height={WAVE.h}
                      style={{ width: edge }}
                    />
                  </clipPath>
                  {/* A gradient rather than a flat fill. At one alpha the area
                      is a dark slab with a hard foot, and what it stands for is
                      depth: the water is dense at the surface and gone by the
                      floor.

                      The stops name the token rather than `currentColor`, which
                      is the trap here: a gradient stop resolves `currentColor`
                      against the gradient element's own computed colour and not
                      against whatever references it, so a class on the path
                      paints nothing and the water was invisible. */}
                  <linearGradient
                    id={`${water}-ink`}
                    x1="0"
                    x2="0"
                    y1="0"
                    y2="1"
                  >
                    <stop
                      offset="0%"
                      stopColor="var(--color-inverse-text)"
                      stopOpacity={0.3}
                    />
                    <stop
                      offset="100%"
                      stopColor="var(--color-inverse-text)"
                      stopOpacity={0.03}
                    />
                  </linearGradient>
                  <path
                    d={AREA_D}
                    clipPath={`url(#${water})`}
                    fill={`url(#${water}-ink)`}
                  />

                  {/* the cycle, and then the part of it that is behind. Two
                      strokes on one path, so the past cannot take a different
                      line from the tide it is tracing. */}
                  <path
                    d={WAVE_D}
                    fill="none"
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeDasharray="3.5 6.5"
                    className="stroke-inverse-text-secondary"
                  />
                  <motion.path
                    d={WAVE_D}
                    pathLength={1}
                    fill="none"
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeDasharray="1 1"
                    style={{ strokeDashoffset: trail }}
                    className="stroke-inverse-text"
                  />

                  <line
                    x1={0}
                    x2={WAVE.w}
                    y1={FLOOR}
                    y2={FLOOR}
                    strokeWidth={1}
                    className="stroke-inverse-text/15"
                  />

                  {/* Now. The halo is the card's own ground, so the marker
                      reads wherever it sits on the curve, which is the trick
                      the signature player's nib uses. */}
                  <g ref={marker} transform={PARKED}>
                    <line
                      ref={drop}
                      x1={0}
                      x2={0}
                      y1={0}
                      y2={0}
                      strokeWidth={1}
                      className="stroke-inverse-text/25"
                    />
                    <circle r={5.4} className="fill-text-primary" />
                    <circle r={3.2} className="fill-inverse-text" />
                  </g>
                </svg>

                <div className="flex justify-between text-[max(8.5px,2.6cqw)] text-inverse-text-secondary leading-none">
                  {[0, 0.5, 1].map((at) => (
                    <span key={at} className="[text-transform:none]">
                      {clockAt(at)}
                    </span>
                  ))}
                </div>
              </motion.div>
            </div>

            {/* The one thing on the card that never blurs, because it is a
                control and not content. It needs no entrance either: at `PAD`
                from the card's right edge it is simply outside the pill's crop
                until the box is nearly the card. */}
            <Tooltip label="Close">
              <button
                ref={shutter}
                type="button"
                aria-label="Close"
                onClick={shut}
                style={{ top: PAD, right: PAD }}
                className={cn(
                  "absolute flex size-9 cursor-pointer items-center justify-center rounded-full",
                  "bg-inverse-text/10 text-inverse-text transition-colors duration-150",
                  "hover:bg-inverse-text/18 active:bg-inverse-text/24 active:duration-0",
                  DARK_FOCUS,
                  "focus-visible:ring-offset-2 focus-visible:ring-offset-text-primary",
                )}
              >
                <XIcon aria-hidden="true" className="size-3.5" />
              </button>
            </Tooltip>
          </div>

          {/* The button, which is the box's whole face while it is a pill.
              Not the box itself: a card carrying a close control cannot also be
              a button, which is the split `notice-stack` documents.

              It carries `aria-expanded` and no matching hover class, which is
              the one open trigger on the site that needs none: it becomes the
              thing it opened, and it is inert and transparent to the pointer
              from that moment, so there is no state left for it to let go
              of. */}
          <button
            ref={face}
            type="button"
            aria-label={LABEL}
            aria-expanded={open}
            inert={open}
            onClick={() => {
              chase.current = pressed(face.current);
              setOpen(true);
            }}
            className={cn(
              "absolute inset-0 cursor-pointer rounded-[inherit]",
              // shading a dark surface is light, never a palette step
              "bg-inverse-text/0 transition-colors duration-150",
              "hover:bg-inverse-text/6 active:bg-inverse-text/12 active:duration-0",
              open && "pointer-events-none",
              DARK_FOCUS,
              "focus-visible:ring-inset",
            )}
          />
        </motion.div>
      </div>
    </TooltipProvider>
  );
}
