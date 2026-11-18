"use client";

import gsap from "gsap";
import {
  AnimatePresence,
  animate,
  motion,
  type Transition,
  useMotionValue,
  useReducedMotion,
  useSpring,
} from "motion/react";
import {
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { ArrowCounterClockwiseIcon } from "@/components/icons";
import { Tooltip, TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { Card } from "./card";
import { deal, PACK } from "./cards";
import {
  BACK_RISE,
  bodyClip,
  CH,
  CRIMP,
  CW,
  capClip,
  FINISH,
  fanOf,
  frontOf,
  H,
  jagOf,
  liftOf,
  linePath,
  mouthClip,
  mouthEdge,
  type Side,
  sidePath,
  spans,
  TEAR,
  W,
  yAt,
} from "./pack";
import {
  createStrip,
  type Fleck,
  FRAME,
  PERSPECTIVE,
  type Strip,
  spray,
  stepFlecks,
} from "./strip";
import { CRINKLE, GRAIN, GRAIN_SOFT } from "./texture";

/*
 * A sealed pack of five cards. Drag across the top and the strip tears along
 * its perforation from the edge you started at, lifting as you pull. Let go
 * early and the strip drops back with the tear where you left it. Pull it past
 * most of the way and it comes off, the cards rise out of the pack, the pack
 * drops away and the cards fan out face down. Tap one to turn it over.
 *
 * `pack.ts` is the geometry and the tear, `strip.ts` the strip drawn in WebGL,
 * `cards.ts` what the pack holds and `card.tsx` one card. This file is the
 * hand and the order things happen in.
 */

type Phase = "sealed" | "open" | "fan";

/**
 * The stage the scene is drawn for, the wide figure's 864 by 540 less what the
 * fan does not need. A smaller stage scales the whole scene down by whichever
 * side runs out first, since the cards rising out of the pack need nearly all
 * of the height and the fan most of the width.
 */
const DESIGN_H = 540;
const DESIGN_W = 640;

/** where the pack sits while the cards rise out of it, and where it falls to */
const PACK_RISE = 70;
/**
 * The empty pack sinks a little, shrinks and fades as the cards fan. It used
 * to fall 440px, out through the stage's bottom edge, where it was cut.
 */
const PACK_GONE = PACK_RISE + 24;
const PACK_GONE_SCALE = 0.92;

/** where the cards sit inside the sealed pack, tops just under the back's edge */
const CARDS_IN = TEAR - H / 2 + CH / 2 - 6;

/** and how far they come out: tops 26px under the stage's edge */
const CARDS_OUT = 26 + CH / 2 - DESIGN_H / 2;

/**
 * The key light's resting place, in pack px, up and to the left, until a
 * pointer moves it. The DOM skin's glow and streak and the strip's shader
 * both start from it, so the strip and the body agree before anything moves.
 */
const LIGHT = [70, 90] as const;

/** how near the strip may come to the stage's clipped edge, in px */
const EDGE = 12;

/** how far below its place on the pack the tossed strip lands */
const LANDING = 150;

/**
 * How the sealed pack rests, in degrees: turned toward the key light, up and
 * to the left, and laid back a little, so it reads as an object in space and
 * not a picture of one. It squares up to the eye once the strip comes off,
 * so the cards rise straight out of it.
 */
const REST = { x: 7, y: -13 };

/** how far the sealed pack tips toward the pointer, in degrees */
const PACK_TIP = { x: 7, y: 10 };

const EASE_OUT = [0.23, 1, 0.32, 1] as const;

/*
 * The reveal is one continuous movement per card, at the author's request.
 *
 * It used to be two animations: the cards rose and stopped, then a second
 * animation fanned them. However the timing was tuned, each card braked to a
 * stop at the top of its rise and set off again in a new direction, and the
 * seam showed. Now each card has one journey, keyframed from inside the pack
 * through the top of its rise into its place in the fan:
 *
 * - y rises on a curve that arrives at the top with no speed, and falls into
 *   the fan on one that leaves it with none, so the speed never jumps.
 * - x is a single tween that starts slowly, so the card leaves the pack
 *   straight and drifts out to its place without a corner.
 * - the turn, the depth and the light hold at rest through the rise and
 *   ease in from there, from rest.
 *
 * The front card leads and the rest follow on gaps that shrink. The pack's
 * sink, shrink and fade are one keyframed movement on the same clock. The
 * phase changes along the way only switch stacking and interactivity, and
 * never retarget a card mid-flight.
 */
const JOURNEY = 1.8;
const LEAVE = [0, 0.07, 0.12, 0.16, 0.19];
/** where the turn, the depth and the light start to come in */
const TURN_AT = 0.3;
/** how many keyframes a journey is sampled into */
const STEPS = 36;
type Bezier = [number, number, number, number];
const SETTLE: Bezier = [0.5, 0, 0.3, 1];

/**
 * A journey's progress at time `t`, both 0 to 1: it starts from rest and
 * arrives at rest, gathers speed once and sheds it once. A little quicker
 * off the mark than it is to settle, since the cards are pulled out and
 * then laid down.
 */
function progress(t: number): number {
  const u = t ** 0.85;
  return u < 0.5 ? 4 * u ** 3 : 1 - (-2 * u + 2) ** 3 / 2;
}

/** a value that holds until `from` and then eases in, from rest, by `t` */
function late(t: number, from: number): number {
  const u = Math.min(1, Math.max(0, (t - from) / (1 - from)));
  return u * u * (3 - 2 * u);
}
/** the cards come above the pack once it has faded, halfway through */
const ABOVE_AT = 0.5;
const SETTLED_AT = JOURNEY + LEAVE[LEAVE.length - 1] + 0.02;

/**
 * A card's place in the deck, 0 on top. The middle card is the top of the
 * deck, then its neighbours, left before right, then the outer pair. It sets
 * the stacking, which order the cards leave in and how high each rises, and
 * it is the same in the pack and in the fan. The stacking used to follow the
 * deal while the cards were in flight and switch to middle-on-top once the
 * fan settled, and the cards visibly swapped over at the end.
 */
function rankOf(i: number, n: number): number {
  const k = i - (n - 1) / 2;
  return Math.abs(k) * 2 - (k < 0 ? 1 : 0);
}

/** where each tooth of the perforation sits, as a share of the width */
const TOOTH_STEP = 1 / 26;

/** a pack, from sealed to fanned. A new pack is a new `Scene`. */
function Scene({
  seed,
  width,
  height,
  scale,
  reduce,
  focusOnMount,
  onOpened,
}: {
  seed: number;
  /** the stage's width in the scene's own pixels */
  width: number;
  /** and its height */
  height: number;
  scale: number;
  reduce: boolean;
  focusOnMount: boolean;
  onOpened: () => void;
}) {
  const jag = useMemo(() => jagOf(seed), [seed]);
  const hand = useMemo(() => deal(seed), [seed]);
  const body = useMemo(() => bodyClip(jag), [jag]);

  const [phase, setPhase] = useState<Phase>("sealed");
  const [above, setAbove] = useState(false);
  const [hovered, setHovered] = useState<number | null>(null);
  const [flipped, setFlipped] = useState<boolean[]>(() =>
    hand.map(() => false),
  );
  const [holding, setHolding] = useState(false);
  const [flat, setFlat] = useState(false);

  const front = useRef<HTMLDivElement>(null);
  const handle = useRef<HTMLButtonElement>(null);
  const cardsRef = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const edge = useRef<SVGPathElement>(null);
  const flatStrip = useRef<HTMLDivElement>(null);

  /*
   * The tear, as plain numbers that nothing renders. A drag writes them, gsap
   * tweens them, and one frame loop hands them to the strip's shader. `p` is
   * how far the tear has run, `lift` how far the hand has the strip up, and
   * the rest is the strip in flight once it is free.
   */
  const tear = useRef({
    p: 0,
    lift: 0,
    x: 0,
    y: 0,
    tumble: 0,
    o: 1,
    bow: 1,
  });
  // the key light, up and to the left, until a pointer moves it
  const light = useRef<[number, number]>([LIGHT[0], LIGHT[1]]);
  const flecks = useRef<Fleck[]>([]);
  const strip = useRef<Strip | null>(null);
  const raf = useRef(0);
  const last = useRef(0);
  const side = useRef<Side>("left");
  const grip = useRef<{ x: number; y: number; p: number } | null>(null);
  const done = useRef(false);
  const viaKey = useRef(false);
  const timeline = useRef<gsap.core.Timeline | null>(null);

  // the sealed pack tips toward the pointer, the way a held pack is turned
  // to catch the light, and jolts a little at each tooth the tear passes
  const tipX = useSpring(REST.x, { stiffness: 220, damping: 20 });
  const tipY = useSpring(REST.y, { stiffness: 220, damping: 20 });
  const jolt = useMotionValue(0);

  const frame = useCallback(() => {
    raf.current = 0;
    const now = performance.now() / 1000;
    const dt = Math.min(0.05, Math.max(0, now - last.current));
    last.current = now;
    stepFlecks(flecks.current, dt);

    const t = tear.current;
    const f = frontOf(side.current, t.p);
    const dir = side.current === "left" ? 1 : -1;
    const ease = Math.min(1, t.lift / 48);
    const pivotY = yAt(jag, f);
    // the strip lifts mostly in the pack's plane, the way a hand pulls it up
    // and away, and bows a little toward the eye as it does. A tight curl
    // rolled it into a tube that read as a dark sliver from the front
    // a free strip has nothing holding its bow, so `bow` relaxes it flat
    // as it is tossed
    const curl = 0.12 + ease * 0.5 * t.bow;
    const reach = t.p * W;
    // the strip turns up only as far as keeps it inside the stage, which is
    // clipped. Its highest point is the outer top corner, `reach` out along
    // the strip and `pivotY` above the line it turns about, so turned by a
    // that corner rises `reach sin a + pivotY cos a` above the line. The
    // stage has `room` above it, less what the perspective adds: the bow
    // brings the far end toward the eye, and the shader draws it larger
    // about the pack's centre by `PERSPECTIVE / (PERSPECTIVE - z)`
    const wanted = ((t.lift * 0.95) / 180) * Math.PI;
    const near = reach * Math.sin(curl);
    const grow = (PERSPECTIVE / (PERSPECTIVE - near) - 1) * (height / 2);
    // and the flip turns the bowed end about the strip's length, which
    // swings it up by its depth times the sine of the flip
    const swing = near * Math.abs(Math.sin(t.tumble));
    const room = (height - H) / 2 + pivotY + t.y - EDGE - grow - swing;
    const span = Math.hypot(reach, pivotY);
    const lean = Math.atan2(pivotY, reach);
    const cap =
      room >= span ? wanted : Math.asin(Math.max(-1, room / span)) - lean;
    const turn = Math.max(0, Math.min(wanted, cap));
    strip.current?.draw(
      {
        front: f,
        dir,
        pivot: [f, pivotY],
        curl,
        radius: 34 + t.p * 30,
        turn,
        tumble: t.tumble,
        free: t.p >= 1,
        fly: [t.x, t.y],
        opacity: t.o,
        light: light.current,
      },
      flecks.current,
    );
    edge.current?.setAttribute(
      "d",
      linePath(jag, ...spans(side.current, t.p).torn),
    );
    if (flatStrip.current) flatStrip.current.style.opacity = `${t.o}`;

    if (flecks.current.length || gsap.isTweening(t) || grip.current) {
      raf.current = requestAnimationFrame(frame);
    }
  }, [height, jag]);

  const wake = useCallback(() => {
    if (raf.current) return;
    last.current = performance.now() / 1000;
    raf.current = requestAnimationFrame(frame);
  }, [frame]);

  useEffect(() => {
    const c = canvas.current;
    if (!c) return;
    const made = createStrip(c, jag, () => wake());
    strip.current = made;
    if (!made) setFlat(true);
    const t = tear.current;
    return () => {
      cancelAnimationFrame(raf.current);
      raf.current = 0;
      gsap.killTweensOf(t);
      timeline.current?.kill();
      made?.destroy();
      strip.current = null;
    };
  }, [jag, wake]);

  useEffect(() => {
    strip.current?.resize(Math.min(2, window.devicePixelRatio || 1) * scale);
    wake();
  }, [scale, wake]);

  useEffect(() => {
    if (focusOnMount) handle.current?.focus();
  }, [focusOnMount]);

  const fanned = useCallback(() => {
    setPhase("fan");
    onOpened();
    if (viaKey.current) {
      window.setTimeout(() => {
        cardsRef.current?.querySelector<HTMLButtonElement>("button")?.focus();
      }, 0);
    }
  }, [onOpened]);

  /**
   * The strip comes away in the hand: the last of the tear runs out, the strip
   * is thrown up and away, turning over on itself as it falls, and the cards
   * come out behind it. One timeline, so the order is written down once.
   */
  const finish = useCallback(() => {
    if (done.current) return;
    done.current = true;
    grip.current = null;
    setHolding(false);
    const t = tear.current;
    gsap.killTweensOf(t);
    // the hand squares the pack up to the eye, so the cards rise straight
    tipX.set(0);
    tipY.set(0);

    if (reduce) {
      gsap.to(t, { p: 1, o: 0, duration: 0.15, onUpdate: wake });
      setAbove(true);
      fanned();
      return;
    }

    const away = side.current === "left" ? 1 : -1;
    // the strip's outer end starts on the pack's edge, so it can travel as far
    // as the gap between the pack and the stage's side
    const toss = Math.max(40, (width - W) / 2 - EDGE * 3);
    // on a stage too narrow for the strip to land clear of the pack, it fades
    // as it comes down rather than landing on the pack's face
    const clear = toss >= W + EDGE;
    const f = frontOf(side.current, t.p);
    spray(flecks.current, f, yAt(jag, f), away, 14);
    timeline.current = gsap
      .timeline({ onUpdate: wake })
      .to(t, { p: 1, duration: 0.12, ease: "power2.out" }, 0)
      .to(t, { bow: 0, duration: 0.25, ease: "power2.out" }, 0.12)
      // the strip is tossed aside rather than thrown off the stage, which is
      // clipped: a short hop, a flip onto its silver back, and it lands flat
      // on the table beside the pack, as far out as the stage has room for
      .to(t, { lift: 8, duration: 0.7, ease: "power2.inOut" }, 0.12)
      .to(t, { x: away * toss, duration: 0.75, ease: "power2.out" }, 0.12)
      .to(t, { y: -26, duration: 0.24, ease: "power2.out" }, 0.12)
      .to(t, { y: LANDING, duration: 0.5, ease: "power2.in" }, 0.36)
      .to(
        t,
        { tumble: away * Math.PI, duration: 0.74, ease: "power1.inOut" },
        0.12,
      )
      .to(t, { o: clear ? 1 : 0, duration: 0.3 }, 0.55)
      .call(() => setPhase("open"), [], 0.3)
      .call(() => setAbove(true), [], 0.3 + JOURNEY * ABOVE_AT)
      .call(fanned, [], 0.3 + SETTLED_AT);
    animate(jolt, [away * 1.6, 0], {
      type: "spring",
      stiffness: 500,
      damping: 9,
    });
  }, [fanned, jag, jolt, reduce, tipX, tipY, wake, width]);

  /** pack-local coordinates of a pointer */
  const local = (e: ReactPointerEvent) => {
    const b = front.current?.getBoundingClientRect();
    if (!b) return { x: 0, y: 0 };
    return { x: (e.clientX - b.left) / scale, y: (e.clientY - b.top) / scale };
  };

  const down = (e: ReactPointerEvent<HTMLButtonElement>) => {
    if (done.current || e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const at = local(e);
    const t = tear.current;
    // the edge nearer the hand is where the tear starts, and once it has
    // started it keeps going from there
    if (t.p === 0) side.current = at.x < W / 2 ? "left" : "right";
    grip.current = { ...at, p: t.p };
    gsap.killTweensOf(t);
    tipX.set(REST.x);
    tipY.set(REST.y);
    setHolding(true);
    wake();
  };

  const move = (e: ReactPointerEvent<HTMLButtonElement>) => {
    const g = grip.current;
    if (!g || done.current) return;
    const at = local(e);
    const t = tear.current;
    const dir = side.current === "left" ? 1 : -1;
    // a tear only runs one way, so a hand moving back leaves it where it got to
    const next = Math.min(
      1,
      Math.max(t.p, g.p + (dir * (at.x - g.x)) / (W * 0.92)),
    );
    // each tooth the tear passes throws a few flecks and jolts the pack
    const teeth = Math.floor(next / TOOTH_STEP) - Math.floor(t.p / TOOTH_STEP);
    if (teeth > 0 && !reduce) {
      const f = frontOf(side.current, next);
      spray(flecks.current, f, yAt(jag, f), dir, Math.min(6, teeth * 2));
      animate(jolt, [dir * 0.5 * (0.6 + Math.random() * 0.8), 0], {
        type: "spring",
        stiffness: 700,
        damping: 14,
      });
    }
    t.p = next;
    t.lift = liftOf(next, g.y - at.y);
    light.current = [at.x, at.y];
    wake();
    if (next >= 1) finish();
  };

  const up = () => {
    if (!grip.current || done.current) return;
    grip.current = null;
    setHolding(false);
    const t = tear.current;
    if (t.p >= FINISH) {
      finish();
      return;
    }
    // the strip drops back onto the pack, and the tear stays where it got to
    gsap.to(t, {
      lift: 0,
      duration: reduce ? 0.01 : 0.7,
      ease: "elastic.out(1, 0.5)",
      onUpdate: wake,
    });
  };

  const key = (e: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (done.current || (e.key !== "Enter" && e.key !== " ")) return;
    e.preventDefault();
    viaKey.current = true;
    if (reduce) {
      finish();
      return;
    }
    const t = tear.current;
    if (t.p === 0) side.current = "left";
    gsap.to(t, {
      p: 1,
      lift: 30,
      duration: 0.55,
      ease: "power1.inOut",
      onUpdate: () => {
        const f = frontOf(side.current, t.p);
        if (Math.random() < 0.35) spray(flecks.current, f, yAt(jag, f), 1, 1);
        wake();
      },
      onComplete: finish,
    });
  };

  // the light follows the pointer, written to the node and handed to the
  // strip's shader, so it never renders, and the pack tips toward it while
  // nothing holds it
  const shine = (e: ReactMouseEvent<HTMLDivElement>) => {
    const node = front.current;
    if (!node) return;
    const b = node.getBoundingClientRect();
    const u = (e.clientX - b.left) / b.width;
    const v = (e.clientY - b.top) / b.height;
    node.style.setProperty("--gx", `${u * W}px`);
    node.style.setProperty("--gy", `${v * H}px`);
    light.current = [u * W, v * H];
    wake();
    if (reduce || grip.current || done.current) return;
    tipX.set(REST.x + (0.5 - v) * PACK_TIP.x * 2);
    tipY.set(REST.y + (u - 0.5) * PACK_TIP.y * 2);
  };

  const unshine = () => {
    if (done.current) return;
    tipX.set(REST.x);
    tipY.set(REST.y);
  };

  const flip = useCallback((i: number) => {
    setFlipped((f) => f.map((v, j) => (j === i ? !v : v)));
  }, []);

  const opened = phase !== "sealed";
  // the pack's whole exit as one movement on the cards' clock: it sinks as
  // they rise, and shrinks and fades once they are clear of it
  const packTarget = !opened
    ? { y: 0, scale: 1, opacity: 1 }
    : reduce
      ? { y: 0, scale: 1, opacity: 0 }
      : {
          y: [0, PACK_RISE, PACK_GONE],
          scale: [1, 1, PACK_GONE_SCALE],
          opacity: [1, 1, 0],
        };
  const packMove = reduce
    ? { duration: 0.2 }
    : {
        duration: JOURNEY * 0.62,
        times: [0, 0.55, 1],
        ease: [SETTLE, SETTLE],
      };
  const packStyle = {
    left: `calc(50% - ${W / 2}px)`,
    top: `calc(50% - ${H / 2}px)`,
    width: W,
    height: H,
    rotateX: tipX,
    rotateY: tipY,
    rotate: jolt,
    transformPerspective: 1200,
  };

  const n = hand.length;

  // each card's whole journey, worked out once per pack and stage width, so
  // a render along the way hands motion the same keyframes and never
  // restarts a card in flight
  const journeys = useMemo(
    () =>
      hand.map((_, i) => {
        const k = i - (n - 1) / 2;
        const order = rankOf(i, n);
        const fan = fanOf(i, n, width);
        const end = {
          ...fan,
          // a card further back fades toward the stage, as in
          // `specimen-stack`, and each catches the room's light, up and to
          // the left, where its own turn in the fan puts it
          "--dim": Math.abs(k) * 0.12,
          "--gx": 28 - k * 8,
          "--gy": 14,
          "--ga": 0.4,
          opacity: 1,
        };
        const rest = {
          x: 0,
          y: CARDS_IN - i * 1.5,
          z: 0,
          rotate: 0,
          rotateX: 0,
          rotateY: 0,
          "--dim": 0,
          "--gx": 50,
          "--gy": 30,
          "--ga": 0,
          opacity: reduce ? 0 : 1,
        };
        // the card travels one curve, up out of the pack and over into its
        // place, a quadratic whose top is the rise's peak: the front card
        // rises furthest, each one behind it 6px less. One progress drives
        // the whole curve and everything else, so the card gathers speed
        // once and sheds it once, and nothing on it starts or stops apart
        const peak = CARDS_OUT + order * 6;
        const lift = 2 * peak - (rest.y + fan.y) / 2;
        const curve = (u: number) => ({
          x: 2 * u * (1 - u) * fan.x * 0.25 + u * u * fan.x,
          y: (1 - u) ** 2 * rest.y + 2 * u * (1 - u) * lift + u * u * fan.y,
        });
        const times = Array.from({ length: STEPS + 1 }, (_, f) => f / STEPS);
        const points = times.map((t) => curve(progress(t)));
        const turn = (to: number, from = 0) =>
          times.map((t) => from + (to - from) * late(t, TURN_AT));
        const path = {
          x: points.map((q) => q.x),
          y: points.map((q) => q.y),
          z: turn(fan.z),
          rotate: turn(fan.rotate),
          rotateX: turn(fan.rotateX),
          rotateY: turn(fan.rotateY),
          "--dim": turn(end["--dim"]),
          "--gx": turn(end["--gx"], 50),
          "--gy": turn(end["--gy"], 30),
          "--ga": turn(end["--ga"]),
          opacity: 1,
        };
        const delay = LEAVE[order] ?? 0;
        // the keyframes are already eased, so they are joined straight
        const move: Transition = {
          duration: JOURNEY,
          delay,
          times,
          ease: "linear",
        };
        return { rest, path, end, move };
      }),
    [hand, n, reduce, width],
  );

  return (
    <>
      {/* the pack's shadow on the stage, which stays on the floor as the
          pack drops and fades with it */}
      <motion.div
        aria-hidden="true"
        className="pointer-events-none absolute"
        style={{
          left: `calc(50% - ${W * 0.6 - 26}px)`,
          top: `calc(50% + ${H / 2 - 30}px)`,
          width: W * 1.25,
          height: 64,
          backgroundImage:
            "radial-gradient(closest-side, rgb(0 0 0 / 0.2), rgb(0 0 0 / 0))",
        }}
        initial={false}
        animate={packTarget}
        transition={packMove}
      />
      {/* and the dark line where it meets the table */}
      <motion.div
        aria-hidden="true"
        className="pointer-events-none absolute"
        style={{
          left: `calc(50% - ${W * 0.47 - 6}px)`,
          top: `calc(50% + ${H / 2 - 7}px)`,
          width: W * 0.94,
          height: 14,
          backgroundImage:
            "radial-gradient(closest-side, rgb(0 0 0 / 0.34), rgb(0 0 0 / 0))",
        }}
        initial={false}
        animate={{ opacity: opened ? 0 : 1 }}
        transition={{ duration: 0.3 }}
      />

      {/* the fan's shadow on the stage, so the cards rest over something */}
      <motion.div
        aria-hidden="true"
        className="pointer-events-none absolute"
        style={{
          left: `calc(50% - ${Math.min(width, 640) * 0.42 - 20}px)`,
          top: `calc(50% + ${CH / 2}px)`,
          width: Math.min(width, 640) * 0.84,
          height: 70,
          backgroundImage:
            "radial-gradient(closest-side, rgb(0 0 0 / 0.16), rgb(0 0 0 / 0))",
        }}
        initial={false}
        animate={{ opacity: opened ? 1 : 0 }}
        transition={{
          duration: reduce ? 0.2 : JOURNEY * 0.5,
          delay: reduce ? 0 : JOURNEY * 0.5,
        }}
      />

      {/* the inside of the pack, seen through the tear and behind the cards */}
      <motion.div
        aria-hidden="true"
        className="pointer-events-none absolute"
        style={packStyle}
        initial={false}
        animate={packTarget}
        transition={packMove}
      >
        {/* the back panel's inside face, from its torn edge down: bare film,
            lit at the edge and dark further into the pack. It used to fill
            the whole strip's area, serrated top and all, which read as a
            grey block left standing behind the strip */}
        <div
          className="absolute inset-0"
          style={{
            clipPath: mouthClip(jag),
            backgroundImage: `${GRAIN_SOFT}, linear-gradient(90deg, rgb(0 0 0 / 0.25), transparent 20%, transparent 80%, rgb(0 0 0 / 0.25)), linear-gradient(180deg, ${PACK.inside} ${TEAR - BACK_RISE}px, ${PACK.insideShade} ${TEAR + 6}px, ${PACK.insideDeep} ${TEAR + 40}px)`,
            backgroundSize: "240px 240px, 100% 100%, 100% 100%",
            backgroundBlendMode: "overlay, normal, normal",
          }}
        />
        <svg
          aria-hidden="true"
          className="absolute inset-0 overflow-visible"
          width={W}
          height={H}
        >
          <path
            d={mouthEdge(jag)}
            fill="none"
            stroke="#fff"
            strokeOpacity="0.7"
            strokeWidth="1"
            strokeLinejoin="round"
          />
        </svg>
      </motion.div>

      <div
        ref={cardsRef}
        // not `transform-3d`: a preserved 3D context sorts this box, which is
        // at z 0, in front of the cards set back behind it, and it took their
        // clicks. Flattened, the perspective still applies and `zIndex` orders
        // the cards. Once they fan they come above the pack, which fades
        // where it is, so they are never seen through it
        className={cn("pointer-events-none absolute inset-0", above && "z-10")}
        style={{ perspective: 1400, perspectiveOrigin: "50% 40%" }}
      >
        {hand.map((card, i) => {
          const fan = fanOf(i, n, width);
          const journey = journeys[i];
          const target =
            phase === "sealed"
              ? journey.rest
              : phase === "open" && !reduce
                ? journey.path
                : journey.end;
          const transition =
            phase === "sealed"
              ? { duration: 0 }
              : phase === "open" && !reduce
                ? journey.move
                : reduce
                  ? { duration: 0, opacity: { duration: 0.2 } }
                  : // the journey has ended here, so this only carries a
                    // hover back to rest
                    { duration: 0.25, ease: EASE_OUT };
          return (
            <motion.div
              key={card.study.name}
              className="pointer-events-auto absolute"
              style={{
                left: `calc(50% - ${CW / 2}px)`,
                top: `calc(50% - ${CH / 2}px)`,
                // one stacking order from the pack to the fan, the middle
                // card on top, so nothing swaps as the fan settles. A card
                // under the pointer comes to the front
                zIndex: hovered === i ? 20 : 10 - rankOf(i, n),
              }}
              initial={false}
              animate={target}
              transition={transition}
              onHoverStart={() => phase === "fan" && setHovered(i)}
              onHoverEnd={() => setHovered((h) => (h === i ? null : h))}
              whileHover={
                phase === "fan" && !reduce
                  ? {
                      y: fan.y - 18,
                      z: fan.z + 40,
                      "--dim": 0,
                      transition: { duration: 0.25, ease: EASE_OUT },
                    }
                  : undefined
              }
            >
              <Card
                card={card}
                index={i}
                flipped={flipped[i]}
                interactive={phase === "fan"}
                reduce={reduce}
                onFlip={flip}
              />
            </motion.div>
          );
        })}
      </div>

      {/* the pack's face: the body, the torn edge, and the strip */}
      <motion.div
        ref={front}
        // once the cards fan, the empty pack fades where it is, over them,
        // so it lets the pointer through to the cards
        className={cn(
          "absolute [filter:drop-shadow(1px_2px_2px_rgb(0_0_0/0.22))_drop-shadow(14px_24px_26px_rgb(0_0_0/0.22))]",
          opened && "pointer-events-none",
        )}
        style={packStyle}
        initial={false}
        animate={packTarget}
        transition={packMove}
        onPointerMove={shine}
        onPointerLeave={unshine}
      >
        <div className="absolute inset-0" style={{ clipPath: body }}>
          <Skin />
        </div>
        {/* where the strip has come away, the torn edge of the body */}
        <svg
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 overflow-visible"
          width={W}
          height={H}
        >
          <path
            ref={edge}
            fill="none"
            stroke={PACK.inside}
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          {/* the rim, where the film turns over the fill: lit on the side
              toward the key light and shaded on the far side. Drawn along
              the drawn-in sides, since an inset shadow on the skin is cut
              off by the body's clip */}
          <path
            d={sidePath(false)}
            fill="none"
            stroke="rgb(255 255 255 / 0.42)"
            strokeWidth="1.4"
          />
          <path
            d={sidePath(true)}
            fill="none"
            stroke="rgb(0 0 0 / 0.35)"
            strokeWidth="1.4"
          />
        </svg>
        {/* the strip, in WebGL, on a canvas that reaches past the pack so
            the strip stays on it in flight */}
        <canvas
          ref={canvas}
          className="pointer-events-none absolute"
          style={{
            left: FRAME.x,
            top: FRAME.y,
            width: FRAME.w,
            height: FRAME.h,
          }}
        />
        {flat ? (
          <div
            ref={flatStrip}
            aria-hidden="true"
            className="pointer-events-none absolute inset-0"
            style={{ clipPath: capClip(jag, 0, W) }}
          >
            <Skin />
          </div>
        ) : null}

        <button
          ref={handle}
          type="button"
          aria-label="Tear open the pack"
          tabIndex={phase === "sealed" ? 0 : -1}
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={up}
          onPointerCancel={up}
          onKeyDown={key}
          className={cn(
            "absolute inset-x-0 top-0 touch-none rounded-sm",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-primary/15 focus-visible:ring-offset-2 focus-visible:ring-offset-fill",
            phase === "sealed"
              ? holding
                ? "cursor-grabbing"
                : "cursor-grab"
              : "pointer-events-none",
          )}
          style={{ height: TEAR + 18 }}
        />
      </motion.div>
    </>
  );
}

/** the heat seal's ridges, each a lit face and a shaded one */
const RIDGES =
  "repeating-linear-gradient(90deg, rgb(255 255 255 / 0.22) 0 1px, rgb(0 0 0 / 0.28) 1px 2px, transparent 2px 4px)";

/** type stamped into foil: lit along its top edge and shaded under it */
const EMBOSS = "0 1px 0 rgb(0 0 0 / 0.45), 0 -1px 0 rgb(255 255 255 / 0.12)";

/**
 * The printed foil, drawn once per piece so each piece can be cut from it.
 * Every length is px at the pack's design size.
 *
 * It is built in the order light builds it on a real wrapper. The print, then
 * the pillow a filled pack makes, lit down the middle and falling off toward
 * both edges and the foot. Then the film's creases and grain, the two seals
 * with their ridges and the pinch they pull into the foil beside them, and
 * last the light: a broad glow and a hard streak, both placed by the pointer,
 * since a metallised film throws back a sharp highlight that a printed card
 * does not.
 */
function Skin() {
  return (
    <div
      className="absolute inset-0 overflow-hidden"
      style={{
        backgroundImage: `linear-gradient(170deg, ${PACK.from}, ${PACK.to})`,
        color: "#fff",
      }}
    >
      <div
        className="absolute inset-0"
        style={{
          backgroundImage:
            "linear-gradient(90deg, rgb(0 0 0 / 0.3), rgb(255 255 255 / 0.14) 5%, rgb(255 255 255 / 0.16) 22%, rgb(255 255 255 / 0.06) 48%, rgb(0 0 0 / 0.08) 72%, rgb(0 0 0 / 0.26) 90%, rgb(0 0 0 / 0.5)), linear-gradient(180deg, rgb(255 255 255 / 0.1), rgb(0 0 0 / 0.26))",
        }}
      />
      <div
        className="absolute inset-0 opacity-60 mix-blend-soft-light"
        style={{ backgroundImage: CRINKLE, backgroundSize: "320px 320px" }}
      />
      <div
        className="absolute inset-0 opacity-30 mix-blend-overlay"
        style={{ backgroundImage: GRAIN, backgroundSize: "240px 240px" }}
      />

      {/* the seals, and the shadow each one pinches into the foil beside it */}
      <div
        className="absolute inset-x-0 top-0"
        style={{
          height: CRIMP + 12,
          backgroundImage: `${RIDGES}, linear-gradient(180deg, transparent ${CRIMP}px, rgb(0 0 0 / 0.32) ${CRIMP}px, rgb(255 255 255 / 0.06) ${CRIMP + 3}px, transparent ${CRIMP + 12}px)`,
          backgroundSize: `100% ${CRIMP}px, 100% 100%`,
          backgroundRepeat: "no-repeat",
        }}
      />
      <div
        className="absolute inset-x-0 bottom-0"
        style={{
          height: CRIMP + 12,
          backgroundImage: `${RIDGES}, linear-gradient(0deg, transparent ${CRIMP}px, rgb(0 0 0 / 0.36) ${CRIMP}px, rgb(255 255 255 / 0.05) ${CRIMP + 3}px, transparent ${CRIMP + 12}px)`,
          backgroundSize: `100% ${CRIMP}px, 100% 100%`,
          backgroundPosition: "bottom, bottom",
          backgroundRepeat: "no-repeat",
        }}
      />
      <Pinches />

      <div
        className="absolute inset-x-0 flex flex-col items-center"
        style={{ top: TEAR + 36 }}
      >
        <div
          className="grid size-[96px] rotate-45 place-items-center rounded-[18px] border border-white/35"
          style={{
            boxShadow:
              "0 1px 0 rgb(0 0 0 / 0.35), inset 0 1px 0 rgb(0 0 0 / 0.3)",
          }}
        >
          <div className="grid size-[60px] place-items-center rounded-[12px] border border-white/25">
            <div
              className="size-[24px] rounded-[6px]"
              style={{
                backgroundImage:
                  "linear-gradient(135deg, rgb(255 255 255 / 0.7), rgb(255 255 255 / 0.25))",
                boxShadow: "0 1px 1px rgb(0 0 0 / 0.35)",
              }}
            />
          </div>
        </div>
        <span
          className="mt-[36px] font-medium text-[22px] leading-none tracking-[-0.02em]"
          style={{ textShadow: EMBOSS }}
        >
          field studies
        </span>
        <span
          className="mt-[8px] font-mono text-[11px] tracking-[0.04em] opacity-60"
          style={{ textShadow: EMBOSS }}
        >
          series one
        </span>
      </div>
      <span
        className="absolute inset-x-0 text-center font-mono text-[11px] tracking-[0.04em] opacity-60"
        style={{ bottom: CRIMP + 18, textShadow: EMBOSS }}
      >
        5 cards
      </span>

      {/* the light, placed by the pointer: a broad glow and a hard streak */}
      <div
        className="absolute inset-0 mix-blend-soft-light"
        style={{
          backgroundImage: `radial-gradient(circle 170px at var(--gx, ${LIGHT[0]}px) var(--gy, ${LIGHT[1]}px), rgb(255 255 255 / 0.75), transparent 70%)`,
        }}
      />
      <div
        className="absolute inset-0 mix-blend-screen"
        style={{
          backgroundImage: `linear-gradient(100deg, transparent calc(var(--gx, ${LIGHT[0]}px) - 40px), rgb(255 255 255 / 0.1) calc(var(--gx, ${LIGHT[0]}px) - 14px), rgb(255 255 255 / 0.4) calc(var(--gx, ${LIGHT[0]}px) - 2px), rgb(255 255 255 / 0.4) calc(var(--gx, ${LIGHT[0]}px) + 2px), rgb(255 255 255 / 0.1) calc(var(--gx, ${LIGHT[0]}px) + 12px), transparent calc(var(--gx, ${LIGHT[0]}px) + 34px)), linear-gradient(100deg, transparent calc(var(--gx, ${LIGHT[0]}px) + 50px), rgb(255 255 255 / 0.16) calc(var(--gx, ${LIGHT[0]}px) + 58px), transparent calc(var(--gx, ${LIGHT[0]}px) + 68px))`,
        }}
      />
    </div>
  );
}

/**
 * The creases a heat seal pulls into the foil at each corner, where the flat
 * seal meets the filled body. Each is a shaded line with a lit one beside it,
 * which is what a fold looks like under a light from above.
 */
function Pinches() {
  // the folds start under the perforation, where the strip no longer
  // covers them, rather than at the seal and cut off by the strip
  const top = TEAR + 4;
  const foot = H - CRIMP - 2;
  const folds = [
    `M6 ${top} Q 16 ${top + 22} 30 ${top + 46}`,
    `M18 ${top} Q 24 ${top + 12} 34 ${top + 22}`,
    `M${W - 6} ${top} Q ${W - 16} ${top + 22} ${W - 30} ${top + 46}`,
    `M${W - 18} ${top} Q ${W - 24} ${top + 12} ${W - 34} ${top + 22}`,
    `M6 ${foot} Q 16 ${foot - 22} 30 ${foot - 46}`,
    `M18 ${foot} Q 24 ${foot - 12} 34 ${foot - 22}`,
    `M${W - 6} ${foot} Q ${W - 16} ${foot - 22} ${W - 30} ${foot - 46}`,
    `M${W - 18} ${foot} Q ${W - 24} ${foot - 12} ${W - 34} ${foot - 22}`,
  ];
  return (
    <svg
      aria-hidden="true"
      className="absolute inset-0"
      width={W}
      height={H}
      fill="none"
      strokeLinecap="round"
    >
      {folds.map((d) => (
        <g key={d}>
          <path d={d} stroke="rgb(0 0 0 / 0.2)" strokeWidth="2" />
          <path
            d={d}
            stroke="rgb(255 255 255 / 0.1)"
            strokeWidth="1"
            transform="translate(1.5 0)"
          />
        </g>
      ))}
    </svg>
  );
}

export default function CardPack() {
  const reduce = useReducedMotion() ?? false;
  const stage = useRef<HTMLDivElement>(null);
  const [seed, setSeed] = useState(1);
  const [opened, setOpened] = useState(false);
  const [size, setSize] = useState({ w: 864, h: DESIGN_H });
  const [focusNext, setFocusNext] = useState(false);

  useEffect(() => {
    const node = stage.current;
    if (!node) return;
    const read = () => setSize({ w: node.clientWidth, h: node.clientHeight });
    read();
    const observer = new ResizeObserver(read);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const opening = useCallback(() => setOpened(true), []);
  const scale = Math.min(1, size.h / DESIGN_H, size.w / DESIGN_W);

  const next = (e: ReactMouseEvent<HTMLButtonElement>) => {
    // a click from the keyboard has no pointer, and the new pack takes focus
    setFocusNext(e.detail === 0);
    setOpened(false);
    setSeed((s) => s + 1);
  };

  return (
    <div
      ref={stage}
      className="relative aspect-8/5 min-h-112 w-full select-none overflow-hidden rounded-lg bg-fill ring-1 ring-stroke ring-inset"
    >
      <AnimatePresence initial={false}>
        <motion.div
          key={seed}
          className="absolute inset-0"
          initial={{ opacity: 0, y: 16 }}
          animate={{
            opacity: 1,
            y: 0,
            transition: { duration: 0.35, delay: 0.1, ease: EASE_OUT },
          }}
          exit={{
            opacity: 0,
            y: -10,
            transition: { duration: 0.18, ease: [0.4, 0, 1, 1] },
          }}
        >
          <div
            className="absolute inset-0"
            style={{ transform: `scale(${scale})` }}
          >
            <Scene
              seed={seed}
              width={size.w / scale}
              height={size.h / scale}
              scale={scale}
              reduce={reduce}
              focusOnMount={focusNext}
              onOpened={opening}
            />
          </div>
        </motion.div>
      </AnimatePresence>

      <AnimatePresence initial={false}>
        {opened ? (
          <motion.div
            key="next"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="absolute top-3 right-3"
          >
            <TooltipProvider delayDuration={200}>
              <Tooltip label="New pack">
                <button
                  type="button"
                  onClick={next}
                  aria-label="New pack"
                  className={cn(
                    "inline-flex size-8 cursor-pointer items-center justify-center rounded-full bg-fill-hover text-text-secondary transition-all duration-200 active:scale-[0.98]",
                    // one step up from the site's order, since it sits on a
                    // `fill` ground where `bg-fill` would be invisible
                    "hover:bg-fill-active hover:text-text-primary",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-primary/15 focus-visible:ring-offset-2 focus-visible:ring-offset-fill",
                  )}
                >
                  <ArrowCounterClockwiseIcon
                    aria-hidden="true"
                    className="size-4"
                  />
                </button>
              </Tooltip>
            </TooltipProvider>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
