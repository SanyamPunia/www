"use client";

import {
  type AnimationPlaybackControls,
  animate,
  type MotionValue,
  motion,
  useInView,
  useMotionValue,
  useMotionValueEvent,
  useReducedMotion,
  useTransform,
} from "motion/react";
import type {
  CSSProperties,
  KeyboardEvent,
  PointerEvent as ReactPointerEvent,
} from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowCounterClockwiseIcon } from "@/components/icons";
import { Tooltip, TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  COPIES,
  COUNT,
  centre,
  DEPTH,
  DOME_H,
  DOME_R,
  FOCUS_Y,
  LAYERS,
  MESH_H,
  NECK,
  OFFSET,
  PERSPECTIVE,
  PITCH,
  PIVOT_Y,
  RING_R,
  RING_X,
  RING_Y,
  SCREEN_H,
  SCREEN_R,
  SCREEN_TOP,
  SCREEN_W,
  STAGE_H,
  STAGE_W,
  seat,
  TILT,
  VISIBLE,
  wrap,
} from "./pose";
import { SCREENS } from "./screens";

/*
 * Five home hubs round a table like a council, a screen on a dome each, every
 * screen facing out from the table's centre. The view looks down onto the
 * table, so the hub in the front seat faces the reader. It opens with one hub
 * alone in the middle of the table, side on, which turns to face the reader
 * and then takes the front seat while the others take theirs. Drag, press a
 * hub or use the dots, and the table turns to bring that hub to the front.
 *
 * **The dome is drawn flat and turned back to face the camera.** It is a solid
 * of revolution, so it looks the same from every yaw, and a billboard is
 * exact for it. Only the screen is a real 3D slab. That is what keeps the
 * scene to a few planes per hub rather than a modelled dome.
 *
 * **The billboard sits on the dome's axis and the screen hinges in front of
 * it**, so a screen turned far enough to pass behind the axis is hidden by the
 * dome image where the real dome would hide it. Measured off the side view:
 * the screen's far edge goes behind the axis at the same place it goes behind
 * the dome.
 */

/** the dome and the screen's finish, per hub: silver, blush and cream */
const FINISH = [
  { body: "#eef0f2", edge: "#d9dce0", shade: "#aeb2b8" },
  { body: "#f2ddd8", edge: "#e3c7c0", shade: "#bf9f97" },
  { body: "#eef0f2", edge: "#d9dce0", shade: "#aeb2b8" },
  { body: "#f1ece3", edge: "#ddd5c7", shade: "#b9ae9d" },
  { body: "#eef0f2", edge: "#d9dce0", shade: "#aeb2b8" },
] as const;

/** the item every hub opens on, the clock, which is the reference's middle */
const START = 2;
/** design px of drag per seat, about the front seat's travel to the next one */
const SLOT = 145;
const SLOP = 6;
/**
 * How far the opening's hub is turned: a true profile, facing left. The slab's
 * layers paint nothing exactly edge on, so its two side faces carry it here.
 */
const SIDE = -90;
/** how long it holds in profile before it turns, in seconds */
const HOLD = 0.7;
/** how long the turn takes, and the scene's zoom at either end of it */
const TURN = 2.4;
const ZOOM_FROM = 0.82;
const ZOOM_TURNED = 1.45;
/** how long the council takes to spread, while the zoom eases back to 1 */
const SPREAD = 1.6;

const SPRING = { type: "spring", stiffness: 170, damping: 24 } as const;

const mod = (n: number, m: number) => ((n % m) + m) % m;

interface HubProps {
  copy: number;
  p: MotionValue<number>;
  fan: MotionValue<number>;
  turn: MotionValue<number>;
  intro: MotionValue<number>;
  nod: MotionValue<number>;
}

function Hub({ copy, p, fan, turn, intro, nod }: HubProps) {
  const hub = copy % COUNT;
  const finish = FINISH[hub];
  const { Screen } = SCREENS[hub];

  const root = useTransform(
    [p, fan, turn, intro],
    ([pv, fv, tv, iv]: number[]) => {
      const q = seat(wrap(copy, pv), fv, iv);
      // round the table to the seat, already facing out from its centre
      return `rotateY(${q.angle}deg) translateZ(${q.r}px) rotateY(${tv}deg) scale3d(${q.s}, ${q.s}, ${q.s})`;
    },
  );
  /* the dome turns back by exactly what the hub and the view turned, so it
     faces the camera. It pivots on its foot, so it stays standing on the table */
  const billboard = useTransform(
    [p, fan, turn, intro],
    ([pv, fv, tv, iv]: number[]) => {
      const q = seat(wrap(copy, pv), fv, iv);
      return `rotateY(${-(q.angle + tv)}deg) rotateX(${PITCH}deg)`;
    },
  );
  /* the glass catches a band of light that slides as the screen turns */
  const glare = useTransform(
    [p, fan, turn, intro],
    ([pv, fv, tv, iv]: number[]) => {
      const q = seat(wrap(copy, pv), fv, iv);
      return `${50 - (q.angle + tv) * 1.4}% 0%`;
    },
  );
  /* the slab's two side faces show only near profile, where the layers are
     seen edge on and paint nothing. Nearer the front they would stand out
     square past the screen's rounded corners */
  const sides = useTransform(
    [p, fan, turn, intro],
    ([pv, fv, tv, iv]: number[]) => {
      const yaw = Math.abs(seat(wrap(copy, pv), fv, iv).angle + tv);
      return Math.min(1, Math.max(0, (yaw - 58) / 22));
    },
  );
  const hinge = useTransform([p, nod], ([pv, nv]: number[]) => {
    const near = Math.max(0, 1 - Math.abs(wrap(copy, pv)));
    return `translateZ(${OFFSET}px) rotateX(${TILT + nv * near}deg)`;
  });
  const visibility = useTransform([p, intro], ([pv, iv]: number[]) => {
    const o = Math.abs(wrap(copy, pv));
    return o > VISIBLE || (iv <= 0 && o > 0.5) ? "hidden" : "visible";
  });

  const pivot = PIVOT_Y - SCREEN_TOP;

  return (
    <motion.div
      data-hub={copy}
      className="group/hub pointer-events-auto absolute size-0 cursor-pointer"
      style={{
        transformStyle: "preserve-3d",
        transform: root,
        visibility,
      }}
    >
      {/* the contact shadow lies on the table, and a round one needs no
          turning back */}
      <span
        className="absolute rounded-full"
        style={{
          left: -DOME_R * 1.4,
          top: -DOME_R * 1.4,
          width: DOME_R * 2.8,
          height: DOME_R * 2.8,
          transform: "translateY(-0.5px) rotateX(90deg)",
          background:
            "radial-gradient(closest-side, rgba(0,0,0,0.2), rgba(0,0,0,0.08) 60%, transparent)",
        }}
      />
      <motion.div
        className="absolute"
        style={{
          left: -DOME_R,
          top: -DOME_H,
          width: DOME_R * 2,
          height: DOME_H,
          transformOrigin: "50% 100%",
          transform: billboard,
        }}
      >
        <span
          className="absolute inset-0"
          style={{
            borderRadius: `${DOME_R}px ${DOME_R}px 5px 5px / ${DOME_R}px ${DOME_R}px 5px 5px`,
            background: `radial-gradient(55% 40% at 36% 16%, rgba(255,255,255,0.95), transparent 70%), linear-gradient(90deg, ${finish.shade}, ${finish.body} 30%, ${finish.body} 52%, ${finish.edge} 78%, ${finish.shade})`,
          }}
        />
        <span
          className="absolute inset-x-0 bottom-0"
          style={{
            height: MESH_H,
            borderRadius: "0 0 5px 5px",
            background: `radial-gradient(circle, rgba(45,45,50,0.5) 0.6px, transparent 1.1px) 0 0 / 3px 3px, linear-gradient(90deg, rgba(0,0,0,0.28), transparent 35%, transparent 55%, rgba(0,0,0,0.3)), ${finish.body}`,
            boxShadow: "inset 0 1px rgba(255,255,255,0.7)",
          }}
        />
      </motion.div>

      <motion.div
        className="absolute"
        style={{
          left: -SCREEN_W / 2,
          top: SCREEN_TOP,
          width: SCREEN_W,
          height: SCREEN_H,
          transformStyle: "preserve-3d",
          transformOrigin: `${SCREEN_W / 2}px ${pivot}px 0px`,
          transform: hinge,
        }}
      >
        <span
          className="absolute"
          style={{
            left: SCREEN_W / 2 - NECK / 2,
            top: pivot - 6,
            width: NECK,
            height: 12,
            borderRadius: 3,
            transform: `translateZ(${-DEPTH - NECK / 2}px) rotateY(90deg)`,
            background:
              "linear-gradient(#f6f7f8, #c4c8cd 45%, #8d9298 70%, #d4d7db)",
          }}
        />
        {[0, SCREEN_W].map((x) => (
          <motion.span
            key={x}
            className="absolute"
            style={{
              left: x - DEPTH / 2,
              top: 0,
              width: DEPTH,
              height: SCREEN_H,
              borderRadius: DEPTH / 2,
              transform: `translateZ(${-DEPTH / 2}px) rotateY(90deg)`,
              background: `linear-gradient(90deg, ${finish.shade}, ${finish.body} 45%, ${finish.edge})`,
              opacity: sides,
            }}
          />
        ))}
        {Array.from({ length: LAYERS }, (_, i) => {
          const z = -DEPTH + (i * DEPTH) / LAYERS;
          // the middle of the edge is darker, so the thickness reads as a curve
          const mid = 1 - Math.abs(i / (LAYERS - 1) - 0.5) * 2;
          return (
            <span
              // biome-ignore lint/suspicious/noArrayIndexKey: a fixed stack of layers
              key={i}
              className="absolute inset-0"
              style={{
                borderRadius: SCREEN_R,
                transform: `translateZ(${z}px)`,
                background:
                  i === 0
                    ? `linear-gradient(135deg, ${finish.body}, ${finish.shade})`
                    : mid > 0.5
                      ? finish.shade
                      : finish.edge,
              }}
            />
          );
        })}
        <span
          className="absolute inset-0 overflow-hidden"
          style={{ borderRadius: SCREEN_R, background: finish.body }}
        >
          <span
            className="absolute inset-[2px] bg-[#0a0a0b]"
            style={{ borderRadius: SCREEN_R - 2 }}
          >
            <span className="absolute top-[2.5px] left-1/2 size-[3px] -translate-x-1/2 rounded-full bg-[#2a2a2e]" />
            <span
              className="absolute inset-[6px] overflow-hidden"
              style={{ borderRadius: SCREEN_R - 7 }}
            >
              <Screen />
              <motion.span
                className="absolute inset-0 opacity-80 transition-opacity duration-200 group-data-[hover=true]/hub:opacity-100"
                style={{
                  backgroundImage:
                    "linear-gradient(115deg, transparent 38%, rgba(255,255,255,0.14) 47%, rgba(255,255,255,0.05) 53%, transparent 60%)",
                  backgroundSize: "300% 100%",
                  backgroundPosition: glare,
                }}
              />
              <span className="absolute inset-0 bg-white opacity-0 transition-opacity duration-200 group-data-[hover=true]/hub:opacity-[0.06]" />
            </span>
          </span>
        </span>
      </motion.div>
    </motion.div>
  );
}

export default function HomeHub() {
  const reduce = useReducedMotion() ?? false;
  const stageRef = useRef<HTMLDivElement>(null);
  const inView = useInView(stageRef, { once: true, amount: 0.4 });
  const [fit, setFit] = useState(1);
  const fitRef = useRef(1);
  const [active, setActive] = useState(START);
  const activeRef = useRef(START);

  const p = useMotionValue(START);
  const fan = useMotionValue(0);
  const turn = useMotionValue(SIDE);
  const intro = useMotionValue(0);
  const nod = useMotionValue(0);
  const zoom = useMotionValue(1);

  const travel = useRef<AnimationPlaybackControls | null>(null);
  const opening = useRef<AnimationPlaybackControls[]>([]);
  const gesture = useRef<{
    id: number;
    x: number;
    p0: number;
    moved: boolean;
  } | null>(null);
  const hovered = useRef<HTMLElement | null>(null);
  const reduceRef = useRef(reduce);
  reduceRef.current = reduce;

  useEffect(() => {
    const node = stageRef.current;
    if (!node) return;
    const observer = new ResizeObserver(([entry]) => {
      const next = entry.contentRect.width / STAGE_W;
      fitRef.current = next;
      setFit(next);
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useMotionValueEvent(p, "change", (v) => {
    const next = mod(Math.round(v), COUNT);
    if (next !== activeRef.current) {
      activeRef.current = next;
      setActive(next);
    }
  });

  const go = useCallback(
    (target: number, velocity = 0) => {
      travel.current?.stop();
      if (reduceRef.current) {
        p.set(target);
        return;
      }
      travel.current = animate(p, target, { ...SPRING, velocity });
    },
    [p],
  );

  const open = useCallback(() => {
    for (const control of opening.current) control.stop();
    if (reduceRef.current) {
      turn.set(0);
      fan.set(1);
      intro.set(1);
      zoom.set(1);
      return;
    }
    // `jump`, never `set`: a set from the finished arc back to the stack reads
    // as a huge velocity, and the fan's spring then starts from it and swings
    // every hub through the middle before it fans
    turn.jump(SIDE);
    fan.jump(0);
    intro.jump(0);
    zoom.jump(ZOOM_FROM);
    /*
     * The reference's opening. One hub, small and in profile, holds a beat,
     * then turns to face the reader while the view closes in on it. Just
     * before it faces front, the others appear stacked behind it, and the
     * view eases back out as they fan out to their seats.
     */
    const turning = {
      delay: HOLD,
      duration: TURN,
      ease: [0.45, 0, 0.25, 1] as const,
    };
    const spreading = { delay: HOLD + TURN - 0.2 };
    opening.current = [
      animate(turn, 0, turning),
      animate(zoom, ZOOM_TURNED, turning),
      // the others slide out from behind it rather than appearing
      animate(intro, 1, {
        delay: HOLD + TURN * 0.6,
        duration: 0.8,
        ease: [0.32, 0.72, 0, 1],
      }),
      animate(fan, 1, {
        ...spreading,
        type: "spring",
        visualDuration: SPREAD,
        bounce: 0,
      }),
      animate(zoom, 1, {
        ...spreading,
        duration: SPREAD,
        ease: [0.32, 0.72, 0, 1],
      }),
    ];
  }, [fan, intro, turn, zoom]);

  /* it opens once, the first time it is on screen, and lands at once under
     reduced motion */
  useEffect(() => {
    if (reduce) {
      for (const control of opening.current) control.stop();
      turn.set(0);
      fan.set(1);
      intro.set(1);
      zoom.set(1);
      return;
    }
    if (inView) open();
  }, [inView, reduce, open, fan, intro, turn, zoom]);

  const setHover = (node: HTMLElement | null) => {
    if (hovered.current === node) return;
    if (hovered.current) hovered.current.dataset.hover = "false";
    hovered.current = node;
    if (node) node.dataset.hover = "true";
  };

  const hubAt = (target: EventTarget | null) =>
    target instanceof Element
      ? target.closest<HTMLElement>("[data-hub]")
      : null;

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    if ((e.target as Element).closest("[data-control]")) return;
    travel.current?.stop();
    gesture.current = {
      id: e.pointerId,
      x: e.clientX,
      p0: p.get(),
      moved: false,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const g = gesture.current;
    if (!g || g.id !== e.pointerId) {
      if (e.pointerType !== "touch") setHover(hubAt(e.target));
      return;
    }
    const dx = e.clientX - g.x;
    if (!g.moved && Math.abs(dx) > SLOP) {
      g.moved = true;
      e.currentTarget.dataset.carry = "true";
      setHover(null);
    }
    // a drag right carries the front seat right
    if (g.moved) p.set(g.p0 - dx / (SLOT * fitRef.current));
  };

  const end = (e: ReactPointerEvent<HTMLDivElement>, cancelled: boolean) => {
    const g = gesture.current;
    if (!g || g.id !== e.pointerId) return;
    gesture.current = null;
    e.currentTarget.dataset.carry = "false";
    if (g.moved) {
      const now = p.get();
      const v = cancelled ? 0 : p.getVelocity();
      const home = Math.round(now);
      const thrown = Math.round(now + v * 0.18);
      go(Math.max(home - 2, Math.min(home + 2, thrown)), v);
      return;
    }
    if (cancelled) return;
    const hub = hubAt(document.elementFromPoint(e.clientX, e.clientY));
    if (!hub) return;
    const o = wrap(Number(hub.dataset.hub), p.get());
    if (Math.abs(o) < 0.5) {
      // the middle hub nods at a press, the way a screen on a hinge gives
      if (reduceRef.current) return;
      animate(nod, [0, -9, 2, 0], {
        duration: 0.6,
        times: [0, 0.35, 0.7, 1],
        ease: "easeOut",
      });
      return;
    }
    go(p.get() + o);
  };

  /* a sideways swipe on a trackpad turns the arc and lands on a slot after */
  useEffect(() => {
    const node = stageRef.current;
    if (!node) return;
    let settle: ReturnType<typeof setTimeout> | null = null;
    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;
      e.preventDefault();
      travel.current?.stop();
      p.set(p.get() + e.deltaX / (SLOT * fitRef.current * 2));
      if (settle) clearTimeout(settle);
      settle = setTimeout(() => go(Math.round(p.get())), 140);
    };
    node.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      node.removeEventListener("wheel", onWheel);
      if (settle) clearTimeout(settle);
    };
  }, [p, go]);

  const dots = useRef<(HTMLButtonElement | null)[]>([]);

  const pick = (item: number) => go(centre(item, p.get()));

  const onDotsKey = (e: KeyboardEvent<HTMLFieldSetElement>) => {
    const step = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const next = mod(activeRef.current + step, COUNT);
    go(Math.round(p.get()) + step);
    dots.current[next]?.focus();
  };

  return (
    <div
      ref={stageRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={(e) => end(e, false)}
      onPointerCancel={(e) => end(e, true)}
      onPointerLeave={() => setHover(null)}
      className={cn(
        "relative aspect-8/5 w-full touch-pan-y select-none overflow-hidden rounded-lg bg-fill ring-1 ring-stroke ring-inset",
        "data-[carry=true]:cursor-grabbing data-[carry=true]:[&_*]:cursor-grabbing",
      )}
    >
      <div
        className="absolute top-0 left-0 origin-top-left"
        style={{
          width: STAGE_W,
          height: STAGE_H,
          transform: `scale(${fit})`,
        }}
      >
        {/* The scene is a plane at z 0 in its own 3D context, so it is hit
            tested above every hub standing behind that plane and would take
            their presses. It passes the pointer through and the hubs take it
            back. */}
        {/* the opening's zoom, held still on the front hub's screen */}
        <motion.div
          className="pointer-events-none absolute inset-0"
          style={{
            scale: zoom,
            transformOrigin: `${RING_X}px ${FOCUS_Y}px`,
          }}
        >
          <div
            className="pointer-events-none absolute inset-0"
            style={
              {
                perspective: PERSPECTIVE,
                perspectiveOrigin: `50% ${FOCUS_Y}px`,
                transformStyle: "preserve-3d",
              } as CSSProperties
            }
          >
            {/* the table's centre: every seat is a turn about it, so
              tilting this one point tilts every hub */}
            <div
              className="absolute size-0"
              style={{
                left: RING_X,
                top: RING_Y,
                transformStyle: "preserve-3d",
                transform: `translateZ(${-RING_R}px) rotateX(${-PITCH}deg)`,
              }}
            >
              {Array.from({ length: COPIES }, (_, copy) => (
                <Hub
                  // biome-ignore lint/suspicious/noArrayIndexKey: the copies are fixed
                  key={copy}
                  copy={copy}
                  p={p}
                  fan={fan}
                  turn={turn}
                  intro={intro}
                  nod={nod}
                />
              ))}
            </div>
          </div>
        </motion.div>
      </div>

      <fieldset
        aria-label="Screens"
        data-control
        onKeyDown={onDotsKey}
        className="absolute inset-x-0 bottom-2.5 m-0 flex min-w-0 justify-center border-0 p-0"
      >
        {SCREENS.map((screen, i) => (
          <button
            key={screen.name}
            ref={(node) => {
              dots.current[i] = node;
            }}
            type="button"
            tabIndex={i === active ? 0 : -1}
            aria-label={screen.name}
            aria-current={i === active}
            onClick={() => pick(i)}
            className="group/dot flex h-6 cursor-pointer items-center px-1 focus-visible:outline-none"
          >
            <span
              className={cn(
                "block h-1.5 rounded-full transition-all duration-200",
                "group-focus-visible/dot:ring-2 group-focus-visible/dot:ring-text-primary/15 group-focus-visible/dot:ring-offset-2 group-focus-visible/dot:ring-offset-fill",
                i === active
                  ? "w-5 bg-text-primary"
                  : "w-1.5 bg-stroke-strong group-hover/dot:bg-text-muted",
              )}
            />
          </button>
        ))}
      </fieldset>

      <div data-control className="absolute top-3 right-3">
        <TooltipProvider delayDuration={200}>
          <Tooltip label="Replay the reveal">
            <button
              type="button"
              onClick={open}
              aria-label="Replay the reveal"
              className={cn(
                "inline-flex size-8 cursor-pointer items-center justify-center rounded-full bg-fill-hover text-text-secondary transition-colors duration-200",
                // one step up from the site's order, since it sits on a
                // `fill` ground where `bg-fill` would be invisible
                "hover:bg-fill-active hover:text-text-primary active:bg-stroke-strong active:duration-0",
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
      </div>

      <p className="sr-only" aria-live="polite">
        {SCREENS[active].name} in front
      </p>
    </div>
  );
}
