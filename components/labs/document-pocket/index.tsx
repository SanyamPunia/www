"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { cn } from "@/lib/utils";
import {
  CONTACT,
  corner,
  hitTest,
  POCKET,
  pose,
  STAGE_ASPECT,
  type State,
  TILT,
} from "./poses";

/**
 * A pocket of paper. Hovering the pocket fans the cards up out of it and tilts
 * its front panel forward, hovering one card singles it out of the fan, and
 * clicking one grows it to the middle of the stage with the rest pushed off to
 * the sides.
 *
 * Three layers under one perspective, back to front: the pocket's wall, the
 * cards, and the shorter front panel the cards sit behind. Nothing is nested,
 * because a wrapper with `perspective` is its own stacking context and the cards
 * have to interleave between the two faces rather than sit above or below both.
 */

/**
 * The pile, in fan order, each entry carrying the arrangement it draws and the
 * hue that tells it apart.
 *
 * Written out rather than derived from the index. The run of arrangements is
 * then a decision instead of whatever `i % 3` happens to land on, and the middle
 * card gets the one with a header, since at rest the middle card is on top and a
 * header is the only part of it showing above the front panel.
 *
 * An odd count is deliberate: it gives a true centre card that sits square and
 * unrotated at rest, which is what makes the fan read as a fan opening rather
 * than as a stack being shuffled.
 *
 * **Colour is the differentiator here, not decoration**, which is the same
 * exception `tab-overview` takes and the same one the brand marks get: five
 * skeletons built from three arrangements are otherwise one texture, and at fan
 * size the arrangement alone does not separate them. It is scoped to this
 * experiment. These are not tokens, nothing else may reach for them, and the body
 * lines stay grey, since the site does not put an accent on text.
 *
 * Two strengths per card, the same split `tab-overview` uses: `mark` is saturated
 * and paints exactly one element, `tint` is a wash and paints exactly one block.
 * Every `mark` clears 3:1 on white paper, which is what a meaningful graphic
 * needs. `amber` is the floor at 3.19 and is kept at the 600 step anyway, because
 * the 700 step reads heavier than the other four rather than merely darker. Every
 * `tint` lands between 1.25 and 1.42, the same band as the `stroke-strong` grey it
 * replaces at 1.37, so a card gains a hue without gaining weight.
 *
 * Ordered so no two neighbours in the fan sit near each other in hue, since
 * neighbours are what overlap.
 */
const CARDS = [
  { id: "left", paper: 1, mark: "#7c3aed", tint: "#ddd6fe" },
  { id: "left-inner", paper: 2, mark: "#d97706", tint: "#fde68a" },
  { id: "middle", paper: 0, mark: "#2563eb", tint: "#bfdbfe" },
  { id: "right-inner", paper: 1, mark: "#e11d48", tint: "#fecdd3" },
  { id: "right", paper: 2, mark: "#0f766e", tint: "#99f6e4" },
] as const;

type Card = (typeof CARDS)[number];

const COUNT = CARDS.length;

/*
 * Springs by intent, not by element. Opening is allowed to show off, closing
 * gets out of the way without bouncing, and singling a card out happens often
 * enough that it would read as a toy if it bounced at all.
 *
 * `OPEN` and `SHUT` were 0.55 and 0.3 and moved up together, keeping their 1.8
 * ratio. Paper has some weight to it and the fan was travelling faster than it
 * looked like it should, but the ratio is the deliberate part: opening is the
 * gesture worth watching, and closing follows a pointer that has already left.
 * `SINGLE` deliberately did not follow them, since it answers a hover and any
 * slower reads as lag.
 */
const OPEN = { type: "spring", duration: 0.65, bounce: 0.34 } as const;
const SHUT = { type: "spring", duration: 0.36, bounce: 0.08 } as const;
const SINGLE = { type: "spring", duration: 0.3, bounce: 0.16 } as const;
const STAGE = { type: "spring", duration: 0.5, bounce: 0.18 } as const;
const INSTANT = { duration: 0 } as const;

/**
 * The front panel winding back up, once the paper is home.
 *
 * The delay is the whole point of this one. Folding the fan away and shutting the
 * panel over it at the same time reads as a single collapse, and the paper going
 * back in is the half of the gesture worth watching, so it has to land first.
 *
 * A share of the cards' own duration rather than a second number to keep in sync:
 * they ride `SHUT` whenever the panel is heading for `TILT.shut`, and at 0.6 of it
 * the panel starts as they are settling, overlapping their tail instead of waiting
 * on it. Strictly sequential is what the reference does, and it is most of a
 * second of animation for a pointer that has already left.
 *
 * Coming back only. Tilting open stays immediate, or the pocket takes a fifth of
 * a second to answer a hover.
 */
const WIND = {
  type: "spring",
  duration: 0.5,
  bounce: 0.22,
  delay: SHUT.duration * 0.6,
} as const;

const FOCUS =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-primary/15 focus-visible:ring-offset-2";

/*
 * The pocket is matte, and its depth is light and shadow rather than palette.
 *
 * Every value below is white or black at low alpha over an `inverse-*` or a
 * surface token, never a new colour, because a lit edge and an occluded corner
 * are the same material catching more or less light. The base tone always stays
 * in a class so it stays a token, and only the light goes into `style`.
 *
 * Nothing here is glossy. There is no travelling highlight and no specular band,
 * both of which read as moulded plastic. What sells a matte surface instead is
 * grain, a cavity that gets darker as it gets deeper, and edges that catch a
 * single pixel of light.
 */

/**
 * Fractal noise, inline as a data URI, so the page makes no request for it.
 *
 * This is the one thing that separates a matte surface from a flat fill: a
 * diffuse material scatters light, and grain is what that looks like. It also
 * stops a near-black wall and a near-black panel reading as two vector
 * rectangles with a seam between them.
 *
 * `overlay` on the dark faces, which by its own maths does nothing to pure black
 * and everything to a mid tone, so the grain shows up exactly where the surface
 * is lit and stays out of the shadows. That is the right way round. `multiply` on
 * the paper, so it can only ever darken and never blow a white sheet out.
 */
const GRAIN = `url("data:image/svg+xml,%3Csvg viewBox='0 0 160 160' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='g'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23g)'/%3E%3C/svg%3E")`;

/**
 * The ground. A wide pool of light under the pocket with the corners falling
 * away, so the object sits in something rather than on a flat swatch.
 *
 * Kept gentle at the top, because the paper fans up into it and the paper is
 * white. Lighting that end of the stage would cost the cards their edges.
 */
const GROUND = [
  "radial-gradient(88% 74% at 50% 78%, rgb(255 255 255 / 0.85), rgb(255 255 255 / 0) 68%)",
  "radial-gradient(120% 100% at 50% 45%, rgb(0 0 0 / 0), rgb(0 0 0 / 0.05) 100%)",
].join(", ");

/**
 * The cavity: a lift from the top centre that is gone by two thirds of the way
 * down, so the interior reads as open and lit from where the paper leaves rather
 * than as a black rectangle.
 *
 * It is also what makes the grain visible on this face at all, since `overlay`
 * has nothing to work with on the unlit part.
 */
const WALL_LIGHT =
  "radial-gradient(125% 92% at 50% 0%, rgb(255 255 255 / 0.18), rgb(255 255 255 / 0) 64%)";

/**
 * What the cavity is worth, from the inside out.
 *
 * `inset 0 0 40px` is the depth itself: an interior is darkest where it meets its
 * own walls. The lit top edge is the back lip catching light and the bottom
 * occlusion is where the floor meets the wall. The three outward layers are one
 * contact shadow, one for form and one ambient, each faint on its own, because a
 * single shadow dark enough to read at this size looks like a drop shadow rather
 * than like light.
 */
const WALL_SHADOW = [
  "inset 0 1px 0 rgb(255 255 255 / 0.15)",
  "inset 0 -2px 6px rgb(0 0 0 / 0.7)",
  "inset 0 0 40px rgb(0 0 0 / 0.55)",
  "0 1px 2px rgb(0 0 0 / 0.1)",
  "0 8px 16px rgb(0 0 0 / 0.09)",
  "0 22px 38px rgb(0 0 0 / 0.11)",
].join(", ");

/** the panel's face, lit from the upper left and shaded toward its own foot */
const PANEL_LIGHT =
  "linear-gradient(158deg, rgb(255 255 255 / 0.08), rgb(255 255 255 / 0.015) 44%, rgb(0 0 0 / 0.3) 100%)";

/**
 * The panel's own edges and what it casts.
 *
 * The lit top edge is what makes the panel read as a fold rather than as a flat
 * region of the same colour, and the two side rims give it a thickness. The
 * upward shadow is what seats the paper behind it: a shadow paints in its own
 * element's layer, and the panel is above the cards, so this lands on the white
 * paper rather than under it.
 */
const PANEL_EDGE = [
  "inset 0 1px 0 rgb(255 255 255 / 0.17)",
  "inset 1px 0 0 rgb(255 255 255 / 0.06)",
  "inset -1px 0 0 rgb(255 255 255 / 0.06)",
  "0 -4px 12px -2px rgb(0 0 0 / 0.35)",
].join(", ");

/** paper is not flat white: a breath of shade toward the foot of the sheet */
const PAPER_LIGHT =
  "linear-gradient(to bottom, rgb(255 255 255 / 0) 52%, rgb(0 0 0 / 0.025) 100%)";

/**
 * Paper lifted off the ground in three layers, as classes rather than an inline
 * `boxShadow`. A ring is a box-shadow too, so an inline value would overwrite
 * the card's hairline instead of composing with it. Tailwind composes its own.
 */
const PAPER_LIFT =
  "shadow-[0_1px_2px_rgb(0_0_0/0.05),0_4px_10px_rgb(0_0_0/0.05),0_10px_24px_-6px_rgb(0_0_0/0.1)]";
const PAPER_LIFT_STAGED =
  "shadow-[0_2px_4px_rgb(0_0_0/0.06),0_10px_24px_rgb(0_0_0/0.07),0_28px_56px_-12px_rgb(0_0_0/0.16)]";

/** the grain layer itself, on whichever face wants it */
const GRAIN_LAYER = "pointer-events-none absolute inset-0 rounded-[inherit]";

/*
 * Everything inside a card is sized in `cqw`, so the card is its own container
 * and its contents are a proportion of it. That is what lets a card be staged by
 * animating its width: one element is a legible miniature at 113px and a
 * document at 322px, rules and padding growing to match, with no transform
 * anywhere, so its hairline stays one pixel and its corners stay corners.
 *
 * **The padding has to live here rather than on the card.** An element is a query
 * container for its descendants and never for itself, so `cqw` in a property on
 * the card resolves against the card's own nearest ancestor container, and there
 * is none, which means the small viewport. On a wide window that put roughly
 * 115px of padding on each side of a 113px card. `box-sizing: border-box` floors
 * a border box at its own padding, so the cards inflated to over twice their size
 * and `overflow-hidden` clipped every bar out of them: five blank rectangles,
 * cascading down and to the right of the pocket.
 *
 * There is no token for any of these, since they are proportions of a box rather
 * than steps on the spacing scale.
 */
const SHEET = "flex flex-col gap-[4.5cqw] p-[8cqw]";
const LINE = "block h-[3.4cqw] shrink-0 rounded-full bg-stroke-strong";
/** the one saturated element on a card, as a bar or as a dot */
const MARK = "block h-[3.4cqw] shrink-0 rounded-full bg-[var(--mark)]";
const DOT = "block size-[12cqw] shrink-0 rounded-full bg-[var(--mark)]";
/** and the one washed area */
const BLOCK = "block shrink-0 rounded-[2cqw] bg-[var(--tint)]";

/**
 * A card's own two tones, as custom properties, so the hexes stay in `CARDS` and
 * the elements below name a role rather than a colour.
 *
 * Set here on a plain `span` rather than on the card itself, which is a motion
 * component: Motion reads custom properties in `style` as animatable values, and
 * there is nothing to gain by handing it two constants.
 *
 * The cast is because `CSSProperties` has no index signature for custom
 * properties. It is the only one in this file.
 */
const tones = (card: Card) =>
  ({ "--mark": card.mark, "--tint": card.tint }) as React.CSSProperties;

/**
 * What a document looks like from across a room, in three arrangements.
 *
 * Every one has the same colour anatomy: one saturated mark, one washed block,
 * and grey body lines. So two cards sharing an arrangement differ by hue alone,
 * and two cards sharing a hue would differ by arrangement alone, and neither
 * carries more weight than the other.
 *
 * Three arrangements, because five identical cards read as one texture and more
 * than three read as five unrelated things rather than one folder's worth of
 * paper.
 *
 * Every element is phrasing content, because a card renders this inside the
 * `<button>` that opens it, where a `div` would be invalid markup.
 */
function Paper({ card }: { card: Card }) {
  if (card.paper === 1) {
    return (
      <span className={SHEET} style={tones(card)}>
        <span className={cn(MARK, "w-1/2")} />
        <span className={cn(BLOCK, "aspect-[5/2] w-full")} />
        <span className={cn(LINE, "w-full")} />
        <span className={cn(LINE, "w-2/3")} />
      </span>
    );
  }

  if (card.paper === 2) {
    return (
      <span className={SHEET} style={tones(card)}>
        <span className={cn(MARK, "w-2/5")} />
        <span className={cn(LINE, "w-full")} />
        <span className={cn(LINE, "w-full")} />
        <span className={cn(LINE, "w-3/4")} />
        <span className={cn(BLOCK, "aspect-[7/2] w-full")} />
      </span>
    );
  }

  return (
    <span className={SHEET} style={tones(card)}>
      <span className="flex items-center gap-[4cqw]">
        <span className={DOT} />
        <span className="flex min-w-0 flex-1 flex-col gap-[3cqw]">
          <span className={cn(LINE, "w-3/4")} />
          <span className={cn(LINE, "w-1/2")} />
        </span>
      </span>
      <span className={cn(LINE, "w-full")} />
      <span className={cn(LINE, "w-5/6")} />
      <span className={cn(BLOCK, "aspect-[7/2] w-full")} />
    </span>
  );
}

export default function DocumentPocket() {
  const stageRef = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();

  /*
   * The stage's width in pixels, and the only thing measured. Every pose is a
   * proportion of it, so this is what makes the experiment resize.
   */
  const [stage, setStage] = useState(0);

  const [open, setOpen] = useState(false);
  const [hovered, setHovered] = useState<number | null>(null);
  const [active, setActive] = useState<number | null>(null);

  /**
   * The last card staged. A ref rather than state: it only ever changes in the
   * same beat as `active`, which renders anyway, and nothing should re-render
   * just because the pile's memory moved.
   */
  const touched = useRef<number | null>(null);
  /** whether the pointer is on the pocket or its paper, which closing has to ask */
  const hovering = useRef(false);

  useLayoutEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) =>
      setStage(entry.contentRect.width),
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  /*
   * What the pointer is over, decided by `hitTest` against the fan's own
   * geometry rather than by the DOM.
   *
   * One `pointermove` on the stage replaces a `pointerenter` and a
   * `pointerleave` on the pocket and on every card. That is not only fewer
   * listeners, it is the fix: the DOM hit tests the boxes as they are currently
   * animated, so a card that moves in response to being hovered moves out from
   * under the pointer and the hover oscillates. `hitTest` reads the neutral
   * geometry, which a hover cannot change, so nothing can feed back. See
   * `poses.ts`.
   *
   * Bound to the node rather than written as JSX props, because the stage is not
   * a control. It is a region the pointer passes through, and it has no honest
   * interactive role to carry: `group`, the closest ARIA has, means a set of form
   * fields.
   */
  useEffect(() => {
    const el = stageRef.current;
    if (!el || stage === 0) return;

    const move = (event: PointerEvent) => {
      const box = el.getBoundingClientRect();
      const hit = hitTest(
        { x: event.clientX - box.x, y: event.clientY - box.y },
        COUNT,
        { open, hovered: null, active, touched: touched.current },
        stage,
      );
      hovering.current = hit.reach;
      // a staged card owns the whole stage, so the fan is not listening. Only
      // `hovering` keeps being tracked, for what `close` has to ask.
      if (active !== null) return;
      setOpen(hovering.current);
      setHovered(hit.card);
    };

    const leave = () => {
      hovering.current = false;
      if (active !== null) return;
      setOpen(false);
      setHovered(null);
    };

    el.addEventListener("pointermove", move);
    el.addEventListener("pointerleave", leave);
    return () => {
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerleave", leave);
    };
  }, [open, active, stage]);

  /*
   * Keyboard parity, on the stage because `focusin` and `focusout` bubble and a
   * card taking focus has to reach up here.
   */
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;

    const focusIn = () => setOpen(true);
    const focusOut = (event: FocusEvent) => {
      // tabbing from one card to the next leaves the pocket open
      if (el.contains(event.relatedTarget as Node | null)) return;
      setOpen(hovering.current);
      setHovered(null);
    };

    el.addEventListener("focusin", focusIn);
    el.addEventListener("focusout", focusOut);
    return () => {
      el.removeEventListener("focusin", focusIn);
      el.removeEventListener("focusout", focusOut);
    };
  }, []);

  const close = useCallback(() => {
    setActive(null);
    // a card can be closed with the pointer still on the pocket, and the fan
    // should not shut under it. There is no second `pointerenter` coming.
    setOpen(hovering.current);
  }, []);

  const step = useCallback((by: number) => {
    setActive((current) => {
      if (current === null) return current;
      return Math.min(COUNT - 1, Math.max(0, current + by));
    });
  }, []);

  // whatever is on stage is what the pile remembers, including a card stepped to
  useEffect(() => {
    if (active !== null) touched.current = active;
  }, [active]);

  useEffect(() => {
    if (active === null) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
      else if (event.key === "ArrowRight") step(1);
      else if (event.key === "ArrowLeft") step(-1);
      else return;
      event.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, close, step]);

  const state: State = { open, hovered, active, touched: touched.current };

  /*
   * Which spring a card is riding, by what just changed. Staging owns the motion
   * whenever it is on, or a card flying out to the middle would travel at the
   * speed of a hover.
   */
  const transition = reduced
    ? INSTANT
    : active !== null
      ? STAGE
      : hovered !== null
        ? SINGLE
        : open
          ? OPEN
          : SHUT;

  return (
    <div
      ref={stageRef}
      /*
       * The stage clips, and it has to. A card pushed aside for a staged one is
       * meant to hang off the edge with only a sliver showing, which puts most
       * of it past the frame, and `Demo` does not clip its own contents. Without
       * this a card slides out over the page beside the frame.
       *
       * `rounded-lg` is `Demo`'s radius. Flush, so the stage fills the frame and
       * the two boxes are the same box.
       *
       * `bg-fill` rather than the frame's white, because the paper is white. On
       * white the fanned cards were a hairline and a shadow and nothing else.
       */
      className="relative w-full select-none overflow-hidden rounded-lg bg-fill [perspective:1000px]"
      style={{ aspectRatio: STAGE_ASPECT, backgroundImage: GROUND }}
    >
      {/* The shadow the pocket casts on the floor. Behind the wall and centred on
          its bottom edge, so the pocket hides the top half and only the spill
          shows. `FLOOR` is all the room there is under the pocket, which is why
          it is short and wide rather than deep. */}
      <div
        aria-hidden="true"
        className="absolute z-0 rounded-full bg-inverse-bg/25 blur-lg"
        style={{
          left: CONTACT.left,
          width: CONTACT.width,
          top: CONTACT.top,
          height: CONTACT.height,
        }}
      />

      {/* The pocket's wall: the darkest thing here, because it is an interior in
          shadow. The paper reads against it, which a light pocket could not do. */}
      <div
        aria-hidden="true"
        className="absolute z-0 bg-inverse-bg"
        style={{
          left: POCKET.left,
          width: POCKET.width,
          top: POCKET.top,
          height: POCKET.height,
          borderRadius: corner(stage),
          backgroundImage: WALL_LIGHT,
          boxShadow: WALL_SHADOW,
        }}
      >
        <span
          className={cn(GRAIN_LAYER, "opacity-[0.22] mix-blend-overlay")}
          style={{ backgroundImage: GRAIN }}
        />
      </div>

      {/* Cards only once the stage has been measured. A pose is pixels, and a
          card rendered at a stage width of zero would grow in from nothing on
          the first frame. */}
      {stage > 0 &&
        CARDS.map((card, i) => {
          const { x, y, width, height, rotate, opacity, borderRadius, z } =
            pose(i, COUNT, state, stage);
          const staged = i === active;

          return (
            <motion.button
              key={card.id}
              type="button"
              // the label is the only thing saying which card this is, since a
              // skeleton has no title to read
              aria-label={
                staged ? "Close document" : `Open document ${i + 1} of ${COUNT}`
              }
              onClick={() => (staged ? close() : setActive(i))}
              initial={false}
              animate={{ x, y, width, height, rotate, opacity, borderRadius }}
              transition={transition}
              style={{
                position: "absolute",
                left: 0,
                top: 0,
                zIndex: z,
                backgroundImage: PAPER_LIGHT,
              }}
              className={cn(
                "@container cursor-pointer overflow-hidden bg-bg text-left",
                // a hairline now the three-layer lift does the separating. It was
                // `stroke-strong`, which reads as a drawn border once the sheet
                // has a real shadow under it.
                "ring-1 ring-stroke ring-inset",
                // press is a background step, not a scale. Nothing on this site
                // scales on press, see CLAUDE.md.
                "transition-shadow duration-200 active:bg-surface",
                staged ? PAPER_LIFT_STAGED : PAPER_LIFT,
                FOCUS,
              )}
            >
              <span
                className={cn(GRAIN_LAYER, "opacity-[0.05] mix-blend-multiply")}
                style={{ backgroundImage: GRAIN }}
              />
              <Paper card={card} />
            </motion.button>
          );
        })}

      {/* The front panel: one step up from the wall and shorter than it, so it
          reads as a fold in front of the paper rather than a second box. */}
      <motion.button
        type="button"
        aria-label={open ? "Close the pocket" : "Open the pocket"}
        aria-expanded={open}
        // for touch, where there is no hover to fan the pocket with
        onClick={() => active === null && setOpen((was) => !was)}
        // tilt only. The panel does not fade for a staged card: it is a panel,
        // and the scrim above it is what veils the pocket. See `TILT`.
        animate={{
          rotateX: active !== null ? TILT.staged : open ? TILT.fan : TILT.shut,
        }}
        /*
         * Only the last case waits. Leaning back for a staged card rides that
         * card's own spring so the two read as one movement, and tilting open has
         * to answer the pointer immediately. See `WIND`.
         */
        transition={
          reduced ? INSTANT : active !== null ? STAGE : open ? OPEN : WIND
        }
        className={cn(
          "absolute z-20 cursor-pointer bg-inverse-fill",
          "[transform-origin:bottom_center]",
          /*
           * Hover is a wash of the inverse text tone rather than a second
           * background, since the face is a gradient and a `bg-*` class cannot
           * step it. `aria-expanded` carries the same wash, per the rule that an
           * open trigger keeps its hover state.
           */
          "before:absolute before:inset-0 before:rounded-[inherit] before:bg-inverse-text before:content-['']",
          "before:opacity-0 before:transition-opacity before:duration-200",
          "hover:before:opacity-[0.06] aria-expanded:before:opacity-[0.06]",
          FOCUS,
        )}
        style={{
          left: POCKET.left,
          width: POCKET.width,
          top: POCKET.panelTop,
          bottom: POCKET.panelBottom,
          borderRadius: corner(stage),
          backgroundImage: PANEL_LIGHT,
          boxShadow: PANEL_EDGE,
        }}
      >
        <span
          className={cn(GRAIN_LAYER, "opacity-[0.18] mix-blend-overlay")}
          style={{ backgroundImage: GRAIN }}
        />
      </motion.button>

      {/* Between the panel and the staged cards, so the pocket goes soft while
          one document is being read. Clicking it puts everything back. */}
      <AnimatePresence>
        {active !== null && (
          <motion.button
            type="button"
            aria-label="Close document"
            onClick={close}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={reduced ? INSTANT : { duration: 0.24 }}
            className="absolute inset-0 z-30 cursor-pointer bg-fill/80 backdrop-blur-sm"
          />
        )}
      </AnimatePresence>
    </div>
  );
}
