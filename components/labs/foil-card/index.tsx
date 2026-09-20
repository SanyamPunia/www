"use client";

import {
  motion,
  useMotionTemplate,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
} from "motion/react";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { clamp01 } from "@/lib/lerp";
import {
  ASPECT,
  COVER,
  centreOfMass,
  LEAD,
  LIGHT_H,
  type Lump,
  META,
  PAD,
  PHOTO,
  type Point,
  PRESS,
  RADIUS,
  span,
  TILT,
  tiltAt,
  WIDTH,
} from "./card";
import {
  type Field,
  makeField,
  mask,
  paint,
  type Ripple,
  STAMP,
  type View,
} from "./foil";

/*
 * A profile card stamped with a dot-matrix hologram. Point at it and it tips
 * toward the pointer, weighted, and the foil under the print answers with
 * colour. Press it and a wave crosses the foil, redder as it goes.
 *
 * **None of those colours is an ink.** A dot-matrix hologram is a grid of
 * microscopic diffraction gratings, one per dot, and what leaves a dot is
 * whichever wavelength its own grating sends to the eye at the angle the card
 * is being held at. So the pointer is the light, the confetti is a spectrum,
 * and tipping the card sweeps it. `foil.ts` is that arithmetic.
 *
 * The card is also weighted rather than hinged in the middle: its balance
 * point is the ink-weighted centroid of everything printed on it, measured off
 * the rendered card, and the portrait is the only solid block of ink on the
 * thing. So a finger on the empty end has a long lever and one on the portrait
 * has almost none. `card.ts` is that.
 *
 * Nothing renders while any of it moves. Four motion values carry the card and
 * one frame loop paints the foil, and it stops asking for frames once the
 * light is off and the last wave has crossed.
 */

/** Shallow, so the tilt reads as a tip rather than as a card being thrown. */
const PERSPECTIVE = 1100;

/** How hard the light is driven: away, under a pointer, under a press. */
const LIT = { off: 0, hover: 1, press: 1.35 };

/**
 * The card's own weight, as a spring at a 0.69 damping ratio. 5% of overshoot
 * is what says the thing being tipped has mass, and a card that arrives dead
 * on its angle reads as a diagram of a card.
 */
const SWING = { stiffness: 210, damping: 20 };

/** The light, which has no mass, so it settles rather than swings. */
const LAMP = { stiffness: 280, damping: 34 };

/**
 * How far a press pushes the card into its own plane, and the spring that
 * brings it back.
 *
 * This is the one place the site's "nothing scales on press" override is off,
 * and it is off deliberately. See CLAUDE.md: the rule is written for an inline
 * target, where 2% is a fraction of a pixel of edge and the cost is smeared
 * antialiasing on a crisp resting raster. This is a 420px card already under a
 * perspective and already resampled on every frame of the tilt, so 2.2% is
 * 9.2px of edge and there is no crisp raster to smear.
 *
 * A 0.44 damping ratio, which is loose enough that the release overshoots by
 * about a fifth of the travel and the card comes back past its own size before
 * settling. That overshoot is the whole point: it is what makes a press read
 * as a press on something rather than as a box being resized.
 */
const PUSH = { depth: 0.018, stiffness: 420, damping: 18 };

/** Longer than a wave's own life, so a spent one is pruned and never missed. */
const WAVE_LIFE = 1200;

/** `#9b9b9b` to `[155, 155, 155]`. A canvas fill cannot take a `var()`. */
function channels(hex: string): [number, number, number] | null {
  const raw = hex.trim().replace("#", "");
  const full =
    raw.length === 3
      ? raw
          .split("")
          .map((c) => c + c)
          .join("")
      : raw;
  if (full.length !== 6) return null;
  const n = Number.parseInt(full, 16);
  if (Number.isNaN(n)) return null;
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export default function FoilCard() {
  const reduce = useReducedMotion();
  const gestureId = useId();

  /** the balance point, as a share of the card, for `transform-origin` */
  const [pivot, setPivot] = useState<Point>({ x: 0.5, y: 0.5 });

  const aimTipX = useMotionValue(0);
  const aimTipY = useMotionValue(0);
  const aimLit = useMotionValue(0);
  const aimPress = useMotionValue(0);

  const swingTipX = useSpring(aimTipX, SWING);
  const swingTipY = useSpring(aimTipY, SWING);
  const swingLit = useSpring(aimLit, LAMP);
  const swingPress = useSpring(aimPress, LAMP);
  const swingPush = useSpring(aimPress, {
    stiffness: PUSH.stiffness,
    damping: PUSH.damping,
  });

  /*
   * Reduced motion keeps every state and drops the travel, and it has to be
   * done here: `MotionProvider` governs motion components and never a
   * `useSpring`, which `event-stacking` documents. So the target and the
   * sprung value are both live and the render picks which one is shown.
   */
  const tipX = reduce ? aimTipX : swingTipX;
  const tipY = reduce ? aimTipY : swingTipY;
  const lit = reduce ? aimLit : swingLit;
  const press = reduce ? aimPress : swingPress;

  /* the shadow and the push read the same target on two different springs: a
     shadow closing is not a thing that bounces and a card being pressed is */
  const scale = useTransform(
    reduce ? aimPress : swingPush,
    (held: number) => 1 - held * PUSH.depth,
  );

  const transform = useMotionTemplate`perspective(${PERSPECTIVE}px) rotateX(${tipX}deg) rotateY(${tipY}deg) scale(${scale})`;

  /*
   * The card's lift, three layers on `document-pocket`'s recipe. It slides out
   * from under whichever end has tipped up, and a press closes it, which is
   * `crack-button`'s way of seating a slab.
   *
   * **On the card, never on a sibling behind it.** A sibling is the tidier
   * idea, since a shadow lies on the table and does not tip with the thing
   * casting it, and it is wrong the moment the card turns: the sibling stays
   * axis-aligned, the card rotates off it, and what shows in the gap is the
   * sibling's own rounded rectangle. That reads as a second card parked behind
   * the first, which is exactly the container this stage is not meant to have.
   * On the card it is behind the card by construction, and the tipping it
   * picks up at 9 degrees is not visible.
   */
  const shadow = useTransform([tipX, tipY, press], ([x, y, held]: number[]) => {
    const near = 1 - held * 0.42;
    const dx = (-y / TILT) * 7;
    const dy = (x / TILT) * 7;
    return [
      `${dx * 0.2}px ${1 + dy * 0.2}px 2px rgb(0 0 0 / 0.05)`,
      `${dx * 0.6}px ${6 * near + dy * 0.6}px ${12 * near}px ${-4 * near}px rgb(0 0 0 / 0.06)`,
      `${dx}px ${16 * near + dy}px ${32 * near}px ${-12 * near}px rgb(0 0 0 / 0.08)`,
    ].join(", ");
  });

  const slot = useRef<HTMLDivElement>(null);
  const card = useRef<HTMLDivElement>(null);
  const print = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);

  const ctx = useRef<CanvasRenderingContext2D | null>(null);
  const buffer = useRef<HTMLCanvasElement | null>(null);
  const bufferCtx = useRef<CanvasRenderingContext2D | null>(null);
  const stamp = useRef<CanvasPattern | null>(null);
  const field = useRef<Field | null>(null);

  const box = useRef<{
    w: number;
    h: number;
    dpr: number;
    /** card pixels a dot */
    cell: number;
    /** device pixels a dot */
    dev: number;
  }>({ w: 0, h: 0, dpr: 1, cell: STAMP.cell, dev: STAMP.cell });
  const com = useRef<Point>({ x: 0.5, y: 0.5 });
  const tooth = useRef<[number, number, number]>([155, 155, 155]);

  const ripples = useRef<Ripple[]>([]);
  const frame = useRef(0);
  const still = useRef(false);
  const held = useRef(false);
  /** where the light stands, as a share of the card */
  const at = useRef<Point>({ x: 0.5, y: 0.5 });
  /** a touch's light, held on just long enough to watch its own wave */
  const linger = useRef(0);
  /** whichever pair of values the render is showing, for the loop to read */
  const shown = useRef({ tipX, tipY, lit });

  useEffect(() => {
    shown.current = { tipX, tipY, lit };
  }, [tipX, tipY, lit]);

  useEffect(() => {
    still.current = reduce ?? false;
  }, [reduce]);

  const wake = useCallback(() => {
    if (frame.current) return;

    const run = (now: number) => {
      const c = ctx.current;
      const f = field.current;
      const b = buffer.current;
      const bc = bufferCtx.current;
      const pattern = stamp.current;
      if (!c || !f || !b || !bc || !pattern) {
        frame.current = 0;
        return;
      }

      if (ripples.current.length > 0) {
        ripples.current = ripples.current.filter(
          (r) => now - r.born < WAVE_LIFE,
        );
      }

      const { w, h, cell, dev } = box.current;
      const ox = com.current.x * w;
      const oy = com.current.y * h;

      const view: View = {
        rx: (shown.current.tipX.get() * Math.PI) / 180,
        ry: (shown.current.tipY.get() * Math.PI) / 180,
        lx: at.current.x * w - ox,
        ly: oy - at.current.y * h,
        lz: LIGHT_H * w,
        lit: shown.current.lit.get(),
        cell,
        ox,
        oy,
      };

      const alive = paint(
        f,
        view,
        ripples.current,
        now,
        still.current,
        tooth.current,
      );

      bc.putImageData(f.buffer, 0, 0);
      c.clearRect(0, 0, c.canvas.width, c.canvas.height);
      c.drawImage(b, 0, 0, f.cols, f.rows, 0, 0, f.cols * dev, f.rows * dev);
      /* the gaps between the dots, punched rather than painted */
      c.globalCompositeOperation = "destination-in";
      c.fillStyle = pattern;
      c.fillRect(0, 0, c.canvas.width, c.canvas.height);
      c.globalCompositeOperation = "source-over";

      frame.current = alive ? requestAnimationFrame(run) : 0;
    };

    frame.current = requestAnimationFrame(run);
  }, []);

  useEffect(() => {
    const el = card.current;
    const c = canvas.current;
    if (!el || !c) return;
    const context = c.getContext("2d");
    if (!context) return;
    ctx.current = context;

    tooth.current =
      channels(
        getComputedStyle(document.documentElement).getPropertyValue(
          "--color-text-muted",
        ),
      ) ?? tooth.current;

    const measure = () => {
      /*
       * `offsetWidth` and not a rect: the card carries a 3D transform, and a
       * rect of a rotated box is its bounding box rather than its own.
       */
      const w = el.offsetWidth;
      const h = el.offsetHeight;
      if (w < 2 || h < 2) return;

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      /* a whole number of device pixels a dot, or the grid blurs on the blit */
      const dev = Math.max(2, Math.round(STAMP.cell * dpr));

      c.width = Math.round(w * dpr);
      c.height = Math.round(h * dpr);
      /* sizing a canvas resets its context, so both of these go back on after */
      context.imageSmoothingEnabled = false;
      stamp.current = context.createPattern(
        mask(dev, Math.max(1, Math.round(STAMP.dot * dpr))),
        "repeat",
      );

      const cols = Math.ceil(c.width / dev);
      const rows = Math.ceil(c.height / dev);
      const old = field.current;
      if (!old || old.cols !== cols || old.rows !== rows) {
        field.current = makeField(cols, rows);
        const b = document.createElement("canvas");
        b.width = cols;
        b.height = rows;
        buffer.current = b;
        bufferCtx.current = b.getContext("2d");
      }

      box.current = { w, h, dpr, cell: dev / dpr, dev };

      /*
       * The balance point, weighed off the card's own print. Layout offsets
       * rather than rects for the reason above, and they are relative to the
       * print layer, which is `absolute inset-0` of the card and so shares its
       * origin.
       */
      const lumps: Lump[] = [];
      for (const node of print.current?.querySelectorAll<HTMLElement>(
        "[data-ink]",
      ) ?? []) {
        lumps.push({
          x: node.offsetLeft / w,
          y: node.offsetTop / h,
          w: node.offsetWidth / w,
          h: node.offsetHeight / h,
          ink: node.dataset.ink === "disc" ? COVER.disc : COVER.type,
        });
      }
      const next = centreOfMass(lumps);
      com.current = next;
      setPivot((prev) =>
        Math.abs(prev.x - next.x) < 0.001 && Math.abs(prev.y - next.y) < 0.001
          ? prev
          : next,
      );

      wake();
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);

    return () => {
      observer.disconnect();
      window.clearTimeout(linger.current);
      cancelAnimationFrame(frame.current);
      frame.current = 0;
    };
  }, [wake]);

  /** Point the light somewhere on the card and tip the card to match. */
  const aim = useCallback(
    (x: number, y: number) => {
      at.current = { x, y };
      const lever = tiltAt(x, y, com.current);
      const swing = TILT + (held.current ? PRESS : 0);
      aimTipX.set(lever.y * swing);
      aimTipY.set(lever.x * swing);
      wake();
    },
    [aimTipX, aimTipY, wake],
  );

  /** Send a wave out from wherever the light is standing. */
  const strike = useCallback(() => {
    const { w, h } = box.current;
    ripples.current.push({
      x: (at.current.x - com.current.x) * w,
      y: (com.current.y - at.current.y) * h,
      born: performance.now(),
    });
    wake();
  }, [wake]);

  const rest = useCallback(() => {
    window.clearTimeout(linger.current);
    held.current = false;
    aimPress.set(0);
    aimLit.set(LIT.off);
    aimTipX.set(0);
    aimTipY.set(0);
    wake();
  }, [aimPress, aimLit, aimTipX, aimTipY, wake]);

  /*
   * The pointer is measured against the slot, which is the card's own
   * untransformed box, and never against the card. Reading the rotated box
   * would let the tilt move the coordinate that produced it, which is the loop
   * `document-pocket` has to hit test neutral geometry to avoid. The cost is a
   * few pixels of disagreement at the edges, where the tilted card overhangs
   * its layout box, and the reading is clamped for that.
   */
  const track = (event: React.PointerEvent<HTMLButtonElement>) => {
    const el = slot.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) return;
    aim(
      clamp01((event.clientX - r.left) / r.width),
      clamp01((event.clientY - r.top) / r.height),
    );
  };

  /* mouse and pen hover and everything else taps, `folder-stack`'s gate */
  const enter = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (event.pointerType === "touch") return;
    aimLit.set(LIT.hover);
    track(event);
  };

  const move = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (event.pointerType === "touch" && !held.current) return;
    track(event);
  };

  const down = (event: React.PointerEvent<HTMLButtonElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    window.clearTimeout(linger.current);
    held.current = true;
    aimPress.set(1);
    aimLit.set(LIT.press);
    track(event);
    strike();
  };

  const up = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (!held.current) return;
    held.current = false;
    aimPress.set(0);

    /*
     * A finger has no hover to fall back to, so the light goes out with it.
     * Not on the same frame, though: the press has just sent a wave, and the
     * wave is drawn in diffracted light, so cutting the light on the release
     * means a tap that shows nothing at all. The card levels at once, which is
     * the finger leaving, and the light holds for as long as the wave takes to
     * cross and then goes.
     */
    if (event.pointerType === "touch") {
      aimTipX.set(0);
      aimTipY.set(0);
      linger.current = window.setTimeout(() => {
        aimLit.set(LIT.off);
        wake();
      }, WAVE_LIFE);
      wake();
      return;
    }

    aimLit.set(LIT.hover);
    track(event);
  };

  const keyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      /* keydown repeats while a key is down, and the click would double it */
      event.preventDefault();
      if (held.current) return;
      held.current = true;
      aimPress.set(1);
      aimLit.set(LIT.press);
      aim(at.current.x, at.current.y);
      strike();
      return;
    }

    const step = event.shiftKey ? 0.02 : 0.07;
    let { x, y } = at.current;
    if (event.key === "ArrowLeft") x -= step;
    else if (event.key === "ArrowRight") x += step;
    else if (event.key === "ArrowUp") y -= step;
    else if (event.key === "ArrowDown") y += step;
    else return;

    event.preventDefault();
    aimLit.set(held.current ? LIT.press : LIT.hover);
    aim(clamp01(x), clamp01(y));
  };

  const keyUp = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    held.current = false;
    aimPress.set(0);
    aimLit.set(LIT.hover);
    aim(at.current.x, at.current.y);
  };

  return (
    <div className="@container relative flex aspect-8/5 min-h-82 w-full select-none items-center justify-center overflow-hidden rounded-lg bg-bg ring-1 ring-stroke ring-inset">
      <div
        ref={slot}
        className="relative"
        style={
          {
            "--card": WIDTH,
            width: "var(--card)",
            aspectRatio: ASPECT,
          } as React.CSSProperties
        }
      >
        <motion.div
          ref={card}
          style={{
            transform,
            transformOrigin: `${pivot.x * 100}% ${pivot.y * 100}%`,
            borderRadius: span(RADIUS, 7),
            boxShadow: shadow,
          }}
          /* the hairline is an `outline` and not a ring, since a ring is a
             box-shadow too and the inline one above would overwrite it,
             which is `book-opening`'s pairing */
          className="pointer-events-none absolute inset-0 overflow-hidden bg-bg outline-1 outline-stroke"
        >
          <canvas
            ref={canvas}
            className="pointer-events-none absolute inset-0 size-full"
          />

          {/* the print sits over the foil, the way ink sits over a stamped
              ground, and takes no pointer: the button below owns the gesture */}
          <div
            ref={print}
            className="pointer-events-none absolute inset-0 flex flex-col justify-between"
            style={{ padding: span(PAD, 12) }}
          >
            <div
              className="flex items-start justify-between"
              style={{ gap: span(0.04, 10) }}
            >
              <div className="flex flex-col items-start">
                <p
                  data-ink="type"
                  style={{ fontSize: span(LEAD, 15) }}
                  className="whitespace-nowrap text-text-primary leading-tight"
                >
                  Sanyam Punia
                </p>
                {/* the same size as the name, a tone below it: the site's own
                    rule that a title and its sub-line separate by tone */}
                <p
                  data-ink="type"
                  style={{ fontSize: span(LEAD, 15) }}
                  className="whitespace-nowrap text-text-secondary leading-tight"
                >
                  Frontend Engineer
                </p>
              </div>

              {/* biome-ignore lint/performance/noImgElement: a 200px portrait already on disk, painted into a 60px disc, is not worth an image pipeline */}
              <img
                data-ink="disc"
                src="/assets/sanyam.png"
                alt=""
                draggable={false}
                style={{ width: span(PHOTO, 34), height: span(PHOTO, 34) }}
                className="shrink-0 select-none rounded-full object-cover ring-1 ring-stroke"
              />
            </div>

            <div
              className="flex items-center justify-between"
              style={{ gap: span(0.04, 10) }}
            >
              <p
                data-ink="type"
                style={{ fontSize: span(META, 9.5) }}
                className="whitespace-nowrap text-text-muted leading-none"
              >
                Gurugram, India
              </p>
              {/* no pill behind it. A filled lozenge is a container, and the
                  only object on this stage is the card: the foot of it is two
                  quiet runs of print, which is also what lets the grain run
                  behind both of them rather than stopping at one. */}
              <p
                data-ink="type"
                style={{ fontSize: span(META, 9.5) }}
                className="shrink-0 whitespace-nowrap text-text-secondary leading-none"
              >
                sanyam.sh
              </p>
            </div>
          </div>
        </motion.div>

        {/*
          The card is a drawing and this is the control over it, which is the
          split `notice-stack` and `tide-card` make: a card carrying its own
          content cannot also be a button, or its name is everything printed
          on it.

          **It is a sibling of the card and never a child of it, so it does not
          carry the tilt.** As a child its hit area is the rotated card, and a
          face that turns away from the eye under a perspective also shrinks,
          so the painted edge nearest the pointer pulls about 8.5px inward and
          the pointer that caused the tilt is left standing off the target. The
          leave fires, the card levels, the edge comes back under the pointer
          and it tilts away again. That is `document-pocket`'s loop exactly,
          and measuring the pointer against the untransformed slot only closed
          half of it: the coordinate was stable and the hit test was not.
          Untransformed at `inset-0` of the slot, the region is the card's
          layout box and cannot move, so no loop is available. The tilt only
          ever pulls the near edge in, and the edge that overhangs the box is
          the far one, where the pointer is not.

          It also puts the focus ring outside the card's `overflow-hidden`,
          which was clipping it away entirely.

          `touch-action: pan-y` so a thumb scrolling past the demo is never
          trapped by a stage the card fills, `window-shade`'s trade.
          */}
        <button
          type="button"
          aria-label="Press the foil"
          aria-describedby={gestureId}
          onPointerEnter={enter}
          onPointerMove={move}
          onPointerDown={down}
          onPointerUp={up}
          onPointerCancel={rest}
          onPointerLeave={(event) => {
            /*
             * A touch `pointerleave` is a lift and not a departure: the
             * pointer stops existing when the finger comes off, so it
             * arrives right after the release with nothing having gone
             * anywhere. `book-opening` documents the same trap. Ungated it
             * put the light out on the frame of the tap, which cancelled
             * the wave the tap had just sent before a single dot of it was
             * drawn.
             */
            if (event.pointerType === "touch") return;
            if (!held.current) rest();
          }}
          onKeyDown={keyDown}
          onKeyUp={keyUp}
          onFocus={(event) => {
            /*
             * Only a focus the browser itself calls visible, which is what
             * keeps a tap from leaving the card lit and tipped for good. A
             * press focuses the button through its compatibility mouse
             * event, which lands after the release has already put the card
             * down, so an ungated handler picked it straight back up: on a
             * phone that is a card that answers one tap and then never lets
             * go. `sticker-peel` documents the same heuristic from the
             * other side, where calling `focus()` by hand painted a ring on
             * every press.
             */
            if (held.current || !event.currentTarget.matches(":focus-visible"))
              return;
            aimLit.set(LIT.hover);
            aim(at.current.x, at.current.y);
          }}
          onBlur={rest}
          onClick={(event) => {
            /* only what an assistive technology synthesises: a real click
                 reports a count and the pointer has already served it */
            if (event.detail !== 0) return;
            aimLit.set(LIT.hover);
            aim(at.current.x, at.current.y);
            strike();
          }}
          style={{
            borderRadius: span(RADIUS, 7),
            touchAction: "pan-y",
          }}
          className="absolute inset-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-primary/15 focus-visible:ring-offset-2"
        />
      </div>

      <p id={gestureId} className="sr-only">
        Move the pointer over the card, or the arrow keys, to move the light.
        Press to send a wave through the foil.
      </p>
    </div>
  );
}
