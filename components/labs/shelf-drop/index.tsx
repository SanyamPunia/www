"use client";

import { motion, useReducedMotion } from "motion/react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { useCallback, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { GAP, LEFT, PRINTS, type Print, ROW_WIDTH } from "./items";

/*
 * Prints on a picture ledge, and pressing one knocks it off.
 *
 * The point is which side of the shelf it falls on. A card that drops in front
 * of the ledge passes over the fascia and grows on the way down; one that drops
 * behind it goes under the fascia, is hidden by it for a few frames, and comes
 * out below smaller than it went in. Both are the same fall with a different
 * sign on one number, and neither needs a z-index: the scene is `preserve-3d`,
 * which paints by depth, so the fascia is simply a plane at a depth the card is
 * either in front of or behind. That is `book-shelf`'s note about its scrim,
 * used here for the whole mechanic rather than for one overlay.
 *
 * **Gravity accelerates and a tumble does not.** A falling body covers ground
 * as the square of the time, which is a quadratic ease-in, while it spins at
 * whatever rate it left with, which is linear. Put both on one curve and the
 * spin appears to speed up as it falls, and the card reads as thrown rather
 * than dropped. So `y` eases in, `rotate` and `x` run linear, and the depth
 * runs linear too, since nothing is pushing the card once it is off the shelf.
 *
 * **The tumble is about the horizontal axis, and it leans the way the card is
 * going.** A print knocked off a ledge topples, it does not spin like a coin on
 * a table: it pivots on the edge it was standing on and goes over forwards or
 * backwards. One coming toward the reader tips its head this way, one going
 * away tips it the other, so the lean and the depth say the same thing twice
 * and the drop is legible before the size difference has had time to show.
 *
 * A card that goes past ninety degrees is showing its back, so it has one: a
 * sheet of plain paper on the other face, `backface-hidden` on both. Without
 * it the picture is drawn mirrored through the card, which is the one thing a
 * printed photograph never does.
 */

/** the frame, and where the ledge's surface sits in it */
const STAGE = 400;
const SURFACE = 214;
/** how much frame is kept clear either side of the row */
const MARGIN = 44;

/**
 * Where the ledge's front face stands, and where a card goes when it is
 * knocked off.
 *
 * A print at rest sits at zero, which is behind the fascia. That is what a
 * ledge is: the lip covers the foot of whatever stands on it, and without the
 * offset the cards look stuck to a painted line instead of standing on a
 * shelf.
 */
const LIP = 26;
/**
 * Far enough that the two sides are told apart by size alone.
 *
 * The occlusion is the honest cue and it is over in a few frames, since a
 * picture ledge is a thin slab and there is not much of it to pass behind. The
 * scale has to carry the rest: at a 1100px perspective these work out to 1.24
 * toward the reader and 0.85 away, so a card that went forward lands half as
 * big again as one that went back. The first pair measured 1.16 and 0.91, a
 * difference a probe can find and an eye cannot.
 */
const FRONT = 215;
const BACK = -195;

/** how far below the frame a card has to get before it is out of sight */
const FLOOR = STAGE + 180;

export default function ShelfDrop() {
  const reduce = useReducedMotion();
  const [fallen, setFallen] = useState<Record<string, Throw>>({});
  const bag = useRef<boolean[]>([]);

  /**
   * Which way the next one goes.
   *
   * A coin gives runs, and a run of five backs reads as a rule rather than as
   * chance, which is the opposite of the thing being demonstrated. A bag holds
   * one of each side per print, shuffled, and is refilled once it empties, so
   * the two are balanced over any six presses and the order still surprises.
   */
  const last = useRef<boolean | null>(null);
  const nextSide = useCallback(() => {
    if (bag.current.length === 0) {
      const sides = PRINTS.map((_, index) => index % 2 === 0);
      for (let i = sides.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [sides[i], sides[j]] = [sides[j], sides[i]];
      }
      /*
       * A fresh bag must not open on the side the last one closed with, or the
       * two runs join across the seam: three at the end of one and three at the
       * start of the next is a run of six, which is the thing the bag exists to
       * prevent. Measured without this: 30 drops split 15 and 15 with a longest
       * run of four. With it a bag holds three of each, so no run can pass
       * three.
       */
      const first = sides[sides.length - 1];
      if (last.current !== null && first === last.current) {
        const other = sides.findIndex((side) => side !== first);
        if (other >= 0) {
          sides[sides.length - 1] = sides[other];
          sides[other] = first;
        }
      }
      bag.current = sides;
    }
    const side = bag.current.pop() ?? true;
    last.current = side;
    return side;
  }, []);

  const knock = useCallback(
    (print: Print, index: number) => {
      if (fallen[print.id]) return;
      const front = nextSide();
      /*
       * The throw is rolled once, on the press, and kept. Rolling it while
       * rendering would re-roll it on every state change and the card would
       * change its mind mid-fall.
       */
      setFallen((current) => ({
        ...current,
        [print.id]: {
          front,
          /*
           * The in-plane spin is the small half of the tumble now. The topple
           * carries the motion, and a card doing both at full rate reads as
           * tossed: this is the wobble around it, signed away from the middle
           * of the row the way a knocked one goes.
           */
          spin:
            (index < PRINTS.length / 2 ? -1 : 1) * (16 + Math.random() * 44),
          /*
           * Enough sideways to say the card was knocked rather than released,
           * and no more. At 64 the outermost prints left through the side of
           * the frame while they were still above the ledge, which reads as
           * sliding out rather than as falling.
           */
          drift:
            (index < PRINTS.length / 2 ? -1 : 1) * (12 + Math.random() * 32),
          /*
           * The topple. Negative tips the head toward the reader, since CSS
           * rotates from +Y to +Z and +Y is down the screen, so a card coming
           * forward takes the negative sign. Past ninety it is showing its
           * back, which is most of why the fall reads as an object rather than
           * as a picture sliding down the wall.
           */
          tilt: (front ? -1 : 1) * (84 + Math.random() * 76),
          /*
           * Slower than the real thing on purpose. A 400px stage at proper
           * gravity empties in about a third of a second, which is over before
           * the lean has read. This is long enough to watch the card go over
           * and short enough that it is still falling rather than floating.
           */
          fall: 0.84 + Math.random() * 0.24,
        },
      }));
    },
    [fallen, nextSide],
  );

  const anyFallen = Object.keys(fallen).length > 0;

  return (
    <div
      className="relative w-full select-none overflow-hidden rounded-lg ring-1 ring-stroke ring-inset"
      style={{
        height: STAGE,
        /*
         * A wall rather than a white page. Two of the six prints are pale, and
         * on `bg` their mounts were a hairline and nothing else. The light
         * pools above the ledge so the row is the brightest thing in frame,
         * which is `book-shelf`'s call for its own lit shelf.
         */
        backgroundColor: "var(--color-surface)",
        backgroundImage:
          "radial-gradient(115% 78% at 50% 24%, var(--color-bg) 0%, var(--color-surface) 50%, var(--color-fill) 100%)",
      }}
    >
      <Scene>
        {/* what the row casts on the surface it stands on */}
        <div
          className="absolute left-1/2 rounded-full bg-black/12 blur-md"
          style={{
            width: ROW_WIDTH + GAP,
            height: 9,
            top: SURFACE - 5,
            marginLeft: -(ROW_WIDTH + GAP) / 2,
          }}
        />

        <div
          className="absolute left-1/2 transform-3d"
          style={{
            width: ROW_WIDTH,
            height: SURFACE,
            top: 0,
            marginLeft: -ROW_WIDTH / 2,
          }}
        >
          {PRINTS.map((print, index) => (
            <Card
              key={print.id}
              print={print}
              left={LEFT[index]}
              thrown={fallen[print.id]}
              order={index}
              reduce={reduce ?? false}
              onKnock={() => knock(print, index)}
            />
          ))}
        </div>

        <Ledge />
      </Scene>

      {/*
       * The way back. It sits outside the 3D scene, because a plane inside one
       * is subject to the perspective and a control is not part of the picture.
       */}
      <div className="pointer-events-none absolute top-0 right-0 p-3">
        <motion.button
          type="button"
          onClick={() => setFallen({})}
          tabIndex={anyFallen ? 0 : -1}
          aria-hidden={!anyFallen}
          className={cn(
            "rounded-full bg-fill px-4 py-2 text-action text-text-secondary ring-1 ring-stroke transition-colors hover:bg-fill-hover active:bg-fill-active focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-primary/15 focus-visible:ring-offset-2",
            anyFallen ? "pointer-events-auto cursor-pointer" : "",
          )}
          initial={false}
          animate={{ opacity: anyFallen ? 1 : 0, y: anyFallen ? 0 : 6 }}
          transition={reduce ? { duration: 0 } : { duration: 0.22 }}
        >
          Put them back
        </motion.button>
      </div>
    </div>
  );
}

/** what a press decided: which side, how hard, and how long the fall runs */
type Throw = {
  front: boolean;
  spin: number;
  drift: number;
  tilt: number;
  fall: number;
};

/**
 * The 3D scene, fitted to the frame.
 *
 * The row is sized for the column rather than for the narrowest screen it has
 * to survive, and scaled down when the frame is narrower than that. The scale
 * is about the stage's own centre, so the margin it keeps at the sides buys
 * height top and bottom as well.
 */
function Scene({ children }: { children: React.ReactNode }) {
  const stage = useRef<HTMLDivElement>(null);

  const measure = useCallback((node: HTMLDivElement | null) => {
    stage.current = node;
    if (!node) return;
    const fit = () => {
      node.style.setProperty(
        "--fit",
        String(
          Math.min(1, (node.clientWidth - MARGIN * 2) / (ROW_WIDTH + GAP)),
        ),
      );
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(node);
  }, []);

  return (
    <div
      ref={measure}
      className="absolute inset-0 transform-3d [perspective:1100px]"
      style={{
        perspectiveOrigin: `50% ${SURFACE - 40}px`,
        transform: "scale(var(--fit, 1))",
      }}
    >
      {children}
    </div>
  );
}

/**
 * The ledge: a front face and the edge of its top, at the depth the prints
 * stand behind.
 *
 * It is drawn rather than modelled. A real board is five faces of which a
 * reader sees two, and at this perspective the top face is four pixels of
 * gradient, which a gradient draws for the cost of nothing.
 */
function Ledge() {
  return (
    <div
      className="absolute left-1/2 transform-3d"
      style={{
        width: ROW_WIDTH + GAP * 4,
        marginLeft: -(ROW_WIDTH + GAP * 4) / 2,
        top: SURFACE,
        transform: `translateZ(${LIP}px)`,
      }}
    >
      {/* what the ledge throws on the wall under it, which is how it reads as fixed to one */}
      <div
        className="absolute inset-x-3 top-3 h-6 rounded-[50%] bg-black/10 blur-md"
        aria-hidden="true"
      />
      <div
        className="relative h-4 rounded-[3px]"
        style={{
          /*
           * The top face is the first three pixels of this, not a second
           * element. At a 1100px perspective a board seen from slightly above
           * shows about that much of its top, which a gradient stop draws for
           * nothing.
           */
          background:
            "linear-gradient(180deg, #ffffff 0%, var(--color-bg) 22%, var(--color-bg) 48%, var(--color-fill) 100%)",
          boxShadow:
            "inset 0 1px 0 rgb(255 255 255 / 0.9), inset 0 -1px 0 var(--color-stroke), 0 1px 2px rgb(0 0 0 / 0.06)",
        }}
      />
    </div>
  );
}

/** one print, standing until it is knocked off */
function Card({
  print,
  left,
  thrown,
  order,
  reduce,
  onKnock,
}: {
  print: Print;
  left: number;
  thrown: Throw | undefined;
  order: number;
  reduce: boolean;
  onKnock: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const down = FLOOR - (SURFACE - print.height);

  /*
   * Under reduced motion a knocked card goes out where it stands. The fall is
   * the whole subject here, so there is no gentler version of it to show: what
   * survives is that pressing a print takes it off the shelf, which opacity
   * says on its own.
   */
  const animate = thrown
    ? reduce
      ? { opacity: 0 }
      : {
          y: down,
          x: thrown.drift,
          z: thrown.front ? FRONT : BACK,
          rotate: thrown.spin,
          rotateX: thrown.tilt,
          opacity: 1,
        }
    : { y: 0, x: 0, z: 0, rotate: print.lean, rotateX: 0, opacity: 1 };

  const transition = reduce
    ? { duration: 0.18 }
    : thrown
      ? {
          /* the acceleration, and the only part of the fall that is not linear */
          y: { duration: thrown.fall, ease: [0.45, 0, 0.9, 0.72] as const },
          x: { duration: thrown.fall, ease: "linear" as const },
          z: { duration: thrown.fall, ease: "linear" as const },
          rotate: { duration: thrown.fall, ease: "linear" as const },
          rotateX: { duration: thrown.fall, ease: "linear" as const },
        }
      : {
          /*
           * Putting them back is not the fall reversed. A card rising on the
           * same curve it fell on reads as anti-gravity, so this is a hand
           * setting each one down: a spring, and a stagger across the row so
           * the shelf fills rather than appearing at once.
           */
          type: "spring" as const,
          stiffness: 260,
          damping: 30,
          delay: order * 0.05,
        };

  return (
    <motion.button
      type="button"
      aria-label={`Knock ${print.title} off the shelf`}
      onClick={onKnock}
      /* touch fires a hover on tap that then sticks, so only a real pointer tips a print */
      onPointerEnter={(event: ReactPointerEvent) => {
        if (event.pointerType !== "touch") setHovered(true);
      }}
      onPointerLeave={() => setHovered(false)}
      disabled={Boolean(thrown)}
      className="absolute cursor-pointer transform-3d rounded-[5px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-primary/15 focus-visible:ring-offset-2 disabled:pointer-events-none"
      style={{
        left,
        width: print.width,
        height: print.height,
        top: SURFACE - print.height,
        /* a standing card pivots on the edge it is standing on, not its middle */
        transformOrigin: "center bottom",
      }}
      initial={false}
      animate={animate}
      transition={transition}
    >
      {/*
       * The hover lives on its own element, inside the one the fall moves.
       * Both want `rotateX` and both want a different curve for it, and a
       * knocked print is mid-fall on a linear tumble while the pointer is still
       * over where it used to be. Two elements is the whole fix: the button
       * owns the fall, this owns the nudge, and neither has to know about the
       * other.
       */}
      <motion.span
        className="absolute inset-0 transform-3d"
        initial={false}
        animate={{
          rotateX: hovered && !thrown ? -5 : 0,
          y: hovered && !thrown ? -3 : 0,
        }}
        transition={
          reduce
            ? { duration: 0 }
            : /*
               * Front-loaded rather than a spring. This is a short move, and a
               * spring spends most of a 5 degree travel on the last fraction of
               * a degree, which reads as the shelf being slow rather than as a
               * small move being small. `book-shelf` makes the same call for
               * the tip on its spines.
               */
              { duration: 0.16, ease: [0.16, 1, 0.3, 1] as const }
        }
      >
        <Picture print={print} />
        <Back />
      </motion.span>
    </motion.button>
  );
}

/**
 * The other face: the back of a photographic print, which is paper and nothing
 * else. It is only ever seen for the part of a fall that is past ninety
 * degrees, so it is one fill and one edge.
 */
function Back() {
  return (
    <span
      aria-hidden="true"
      className="absolute inset-0 rounded-[5px] backface-hidden"
      style={{
        transform: "rotateX(180deg)",
        /*
         * Paper, in shadow. The light in this scene pools above the ledge, and
         * a face that has turned far enough to be seen has turned away from it,
         * so the back of a print is darker than the wall rather than lighter.
         *
         * That is not only physics. The first version was `bg` on a wall that
         * is `bg` at its brightest, and a card vanished the moment it went past
         * ninety degrees: measured at 560ms into a fall, the stage was empty
         * with six prints still inside it. Black at low alpha over the paper,
         * which is the rule for shading a surface here.
         */
        background:
          "linear-gradient(158deg, rgb(0 0 0 / 0.07) 0%, rgb(0 0 0 / 0.17) 100%), var(--color-bg)",
        boxShadow:
          "inset 0 0 0 1px rgb(0 0 0 / 0.14), 0 2px 8px rgb(0 0 0 / 0.16)",
      }}
    />
  );
}

/** the print itself: a mount, the photograph, and the gloss across it */
function Picture({ print }: { print: Print }) {
  return (
    <span
      className="absolute inset-0 overflow-hidden rounded-[5px] bg-bg p-[3px] backface-hidden"
      style={{
        boxShadow:
          "0 1px 2px rgb(0 0 0 / 0.14), 0 6px 14px rgb(0 0 0 / 0.10), inset 0 0 0 1px rgb(0 0 0 / 0.06)",
      }}
    >
      <span
        className="relative block size-full overflow-hidden rounded-[3px]"
        style={{
          background: `radial-gradient(58% 44% at ${print.lightAt}, ${print.light} 0%, transparent 62%), linear-gradient(180deg, ${print.sky} 0%, ${print.sky} 54%, ${print.ground} 54%, ${print.ground} 100%)`,
        }}
      >
        {/* the horizon, which is the one line that makes the two bands a place */}
        <span
          className="absolute inset-x-0 top-[54%] h-px"
          style={{ background: "rgb(0 0 0 / 0.16)" }}
        />
        {/* the sheen on the paper, so a print reads as a surface catching light */}
        <span
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(114deg, rgb(255 255 255 / 0.22) 0%, transparent 34%, transparent 72%, rgb(0 0 0 / 0.12) 100%)",
          }}
        />
      </span>
    </span>
  );
}
