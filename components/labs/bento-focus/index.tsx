"use client";

import {
  animate,
  type MotionValue,
  motion,
  motionValue,
  type Transition,
  useReducedMotion,
  useTransform,
} from "motion/react";
import {
  type KeyboardEvent,
  type PointerEvent,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { cn } from "@/lib/utils";
import { FACETS, type Facet, GRAIN } from "./art";
import { armBento, playLand } from "./bento-sound";
import {
  type Bento,
  bento,
  centre,
  initialOrder,
  lerpRect,
  type Order,
  promote,
  type Rect,
  rects,
  slotAt,
  slotToward,
  swapIn,
  travel,
} from "./layout";

/*
 * Five pictures on a bento grid with one large focus slot. Press a small tile
 * and it grows into the slot, the tile that had it shrinks back into the grid,
 * and the rest re-settle into the small slots, the farther they have to go
 * the later they set off. The focused tile's title and copy rise in as it
 * lands. Press again mid-flight and every tile turns toward its new slot from
 * where it is.
 *
 * Or carry a tile there by hand. The grid previews the arrangement it is
 * heading for as the tile gets near the slot, and a release past half way, or
 * a throw toward the slot, commits it. The focus tile dragged out onto a small
 * slot swaps with the tile there.
 *
 * Every tile is always mounted and only ever moved. Its box is four motion
 * values, `x`, `y`, `width` and `height`, animated rather than scaled, so the
 * corner radius is right on every frame, and a drag writes the same values the
 * spring does. Four more carry a small offset on top, for a hovered tile
 * growing and its neighbours giving way. Nothing renders while the grid moves.
 */

const COUNT = FACETS.length;

/**
 * One spring carries every tile. A press mid-flight starts the new animation
 * from the value and the velocity the old one had reached, so the grid changes
 * course instead of stopping and setting off again, which is what an ease
 * restarted from rest does. A release starts it from the hand's velocity.
 */
const MOVE: Transition = { type: "spring", visualDuration: 0.42, bounce: 0.1 };

/** the longest any tile waits, in seconds, given to the one that goes farthest */
const SPREAD = 0.07;

/** when the focused tile is close enough to its slot for its text to rise */
const LAND = 0.2;
/** when the tile that lost the slot has shrunk enough to take its label back */
const RETURN = 0.3;

/** text leaving goes up and out of its mask on an in-out curve */
const EXIT: Transition = { duration: 0.24, ease: [0.7, 0, 0.16, 1] };
/** text arriving rises into its mask on a strong ease-out */
const RISE: Transition = { duration: 0.55, ease: [0.3, 0.9, 0.1, 1] };

/** a label or a line of text, as a share of its own height, out of its mask */
const BELOW = 110;
const ABOVE = -110;

/** a press becomes a drag past this many pixels */
const SLOP = 6;
/** the time constant the tiles a hand is not holding follow the preview on, s */
const FOLLOW = 0.07;
/** the time constant hover and push offsets ease on, s */
const NUDGE = 0.08;
/** how far the held tile goes before the rest of the grid starts to make room */
const LAG = 0.15;
/** the share of the way at which the preview counts as there */
const REACH = 0.75;
/** a release commits past this share of the way */
const COMMIT = 0.5;
/** or on a throw toward the slot this fast, in px/s, once past this share */
const THROW = 700;
const THROW_MIN = 0.12;
/** the hand's speed, in px/s, at which a carried tile pushes hardest */
const FAST = 1600;

const FOCUS =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-primary/15 focus-visible:ring-offset-2 focus-visible:ring-offset-fill";

const ARROWS: Record<string, [number, number]> = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
};

interface Values {
  x: MotionValue<number>;
  y: MotionValue<number>;
  w: MotionValue<number>;
  h: MotionValue<number>;
  z: MotionValue<number>;
  label: MotionValue<number>;
  title: MotionValue<number>;
  copy: MotionValue<number>;
  /**
   * The opacity of the focus text. A drag shrinks the focus tile before
   * anything has been committed, so its title and copy fade out as the hand
   * gets near rather than being crammed into a tile they no longer fit.
   */
  fade: MotionValue<number>;
  /** the offset on top of the box, written by the frame loop alone */
  ox: MotionValue<number>;
  oy: MotionValue<number>;
  ow: MotionValue<number>;
  oh: MotionValue<number>;
}

const make = (): Values => ({
  x: motionValue(0),
  y: motionValue(0),
  w: motionValue(0),
  h: motionValue(0),
  z: motionValue(1),
  label: motionValue(0),
  title: motionValue(BELOW),
  copy: motionValue(BELOW),
  fade: motionValue(1),
  ox: motionValue(0),
  oy: motionValue(0),
  ow: motionValue(0),
  oh: motionValue(0),
});

type Nudge = Rect;
const still = (): Nudge => ({ x: 0, y: 0, w: 0, h: 0 });

interface Drag {
  tile: number;
  pointerId: number;
  touch: boolean;
  startX: number;
  startY: number;
  active: boolean;
  /** where the hand holds the tile, as shares of its box */
  grab: { x: number; y: number };
  /** the hand, in stage pixels */
  px: number;
  py: number;
  /** the order the drag started from, which a cancel goes back to */
  from: Order;
  /** the order a release here would commit, and how far toward it the hand is */
  target: Order | null;
  p: number;
}

const rectOf = (v: Values): Rect => ({
  x: v.x.get(),
  y: v.y.get(),
  w: v.w.get(),
  h: v.h.get(),
});

const clamp = (v: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, v));
const smooth = (t: number) => t * t * (3 - 2 * t);

export default function BentoFocus() {
  const reduce = useReducedMotion() ?? false;
  // the loop and the handlers read it outside a render
  const reduceRef = useRef(reduce);
  useEffect(() => {
    reduceRef.current = reduce;
  }, [reduce]);
  const id = useId();
  const stageRef = useRef<HTMLDivElement>(null);
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  const values = useRef<Values[]>(Array.from({ length: COUNT }, make)).current;
  const canvas = useRef({ w: motionValue(0), h: motionValue(0) }).current;

  const [focus, setFocus] = useState(0);
  const [grid, setGrid] = useState<Bento | null>(null);

  // the logical state the tiles and the text are heading for, which a value
  // mid-animation cannot say on its own
  const orderRef = useRef<Order>(initialOrder(COUNT));
  const gridRef = useRef<Bento | null>(null);
  const sizeRef = useRef({ w: 0, h: 0 });
  const labelShown = useRef(FACETS.map((_, i) => i !== 0));
  const detailShown = useRef(FACETS.map((_, i) => i === 0));

  const dragRef = useRef<Drag | null>(null);
  const draggedRef = useRef(false);
  const hoverRef = useRef(-1);
  const nudges = useRef(FACETS.map(still)).current;
  const frame = useRef(0);
  const last = useRef(0);
  const landOff = useRef<(() => void) | null>(null);

  const flying = useCallback(
    () =>
      values.some(
        (v) =>
          v.x.isAnimating() ||
          v.y.isAnimating() ||
          v.w.isAnimating() ||
          v.h.isAnimating(),
      ),
    [values],
  );

  /** the hover mark, written to the node so a pointer crossing renders nothing */
  const setHover = useCallback((tile: number) => {
    if (hoverRef.current === tile) return;
    hoverRef.current = tile;
    buttons.current.forEach((b, i) => {
      if (b) b.dataset.hover = String(i === tile);
    });
  }, []);

  /**
   * Push the tiles near `mover` away from it, by up to `strength` of `PUSH`,
   * falling off over a few gaps between the two boxes' nearest edges.
   */
  const push = useCallback(
    (out: Nudge[], mover: number, strength: number) => {
      const layout = gridRef.current;
      if (!layout || strength <= 0) return;
      const most = clamp(sizeRef.current.w * 0.014, 4, 8);
      const gap = layout.slots[1].x - (layout.slots[0].x + layout.slots[0].w);
      const reach = gap * 2.5;
      const m = rectOf(values[mover]);
      const mc = centre(m);
      values.forEach((v, j) => {
        if (j === mover) return;
        const r = rectOf(v);
        const c = centre(r);
        const dx = Math.max(0, Math.abs(mc.x - c.x) - (m.w + r.w) / 2);
        const dy = Math.max(0, Math.abs(mc.y - c.y) - (m.h + r.h) / 2);
        const fall = clamp(1 - Math.hypot(dx, dy) / reach, 0, 1) ** 2;
        if (fall === 0) return;
        const len = Math.hypot(c.x - mc.x, c.y - mc.y) || 1;
        out[j].x += ((c.x - mc.x) / len) * most * fall * strength;
        out[j].y += ((c.y - mc.y) / len) * most * fall * strength;
      });
    },
    [values],
  );

  const speedOf = useCallback(
    (tile: number) =>
      clamp(
        Math.hypot(values[tile].x.getVelocity(), values[tile].y.getVelocity()) /
          FAST,
        0,
        1,
      ),
    [values],
  );

  /** one frame of a drag: the held tile under the hand, the rest previewing */
  const stepDrag = useCallback(
    (d: Drag, dt: number, layout: Bento) => {
      const from = rects(layout, d.from);
      const me = values[d.tile];
      const w = me.w.get();
      const h = me.h.get();
      const hand = {
        x: d.px - d.grab.x * w + w / 2,
        y: d.py - d.grab.y * h + h / 2,
      };

      // a small tile heads for the focus slot. The focus tile heads for the
      // small slot nearest it, and the tile there for the focus slot
      let target: Order;
      if (d.from[0] !== d.tile) target = promote(d.from, d.tile);
      else {
        let slot = 1;
        let best = Number.POSITIVE_INFINITY;
        for (let s = 1; s < layout.slots.length; s++) {
          const c = centre(layout.slots[s]);
          const dist = Math.hypot(c.x - hand.x, c.y - hand.y);
          if (dist < best) {
            best = dist;
            slot = s;
          }
        }
        target = swapIn(d.from, slot);
      }
      const to = rects(layout, target);
      const home = centre(from[d.tile]);
      const dest = centre(to[d.tile]);
      const span = Math.hypot(dest.x - home.x, dest.y - home.y) || 1;
      const left = Math.hypot(dest.x - hand.x, dest.y - hand.y);
      const p = clamp((span - left) / (span * REACH), 0, 1);
      d.target = target;
      d.p = p;

      // the held tile answers at once and the rest wait for the hand to be on
      // its way. The tile giving up the focus slot waits for the second half,
      // so the held tile slides in over it rather than into a hole it left
      const e = smooth(p);
      const rest = smooth(clamp((p - LAG) / (1 - LAG), 0, 1));
      const yielding = d.from[0] !== d.tile ? d.from[0] : -1;
      const late = smooth(clamp((p - 0.5) / 0.5, 0, 1));
      values[d.from[0]].fade.set(1 - clamp(p / 0.45, 0, 1));
      const k = reduceRef.current ? 1 : 1 - Math.exp(-dt / FOLLOW);
      const want = lerpRect(from[d.tile], to[d.tile], e);
      const nw = w + (want.w - w) * k;
      const nh = h + (want.h - h) * k;
      const { w: sw, h: sh } = sizeRef.current;
      me.w.set(nw);
      me.h.set(nh);
      me.x.set(clamp(d.px - d.grab.x * nw, -nw / 2, sw - nw / 2));
      me.y.set(clamp(d.py - d.grab.y * nh, -nh / 2, sh - nh / 2));

      values.forEach((v, i) => {
        if (i === d.tile) return;
        const r = lerpRect(from[i], to[i], i === yielding ? late : rest);
        v.x.set(v.x.get() + (r.x - v.x.get()) * k);
        v.y.set(v.y.get() + (r.y - v.y.get()) * k);
        v.w.set(v.w.get() + (r.w - v.w.get()) * k);
        v.h.set(v.h.get() + (r.h - v.h.get()) * k);
      });
    },
    [values],
  );

  /**
   * The one loop. It runs a drag, eases the offsets toward whatever the
   * pointer and the flights ask for, and stops once a drag is over, nothing is
   * flying and every offset has landed.
   */
  const tick = useCallback(
    function step(now: number) {
      const layout = gridRef.current;
      if (!layout) {
        frame.current = 0;
        return;
      }
      const dt = last.current
        ? Math.min(0.05, (now - last.current) / 1000)
        : 1 / 60;
      last.current = now;

      const d = dragRef.current;
      const carrying = d?.active === true;
      if (carrying) stepDrag(d, dt, layout);
      const flight = !carrying && flying();

      const want = FACETS.map(still);
      if (!reduceRef.current) {
        if (carrying) push(want, d.tile, 0.6 + 0.4 * speedOf(d.tile));
        else if (flight)
          push(want, orderRef.current[0], speedOf(orderRef.current[0]));
        else if (hoverRef.current >= 0) {
          const g = clamp(sizeRef.current.w * 0.009, 2.5, 5);
          want[hoverRef.current] = { x: -g, y: -g, w: g * 2, h: g * 2 };
          push(want, hoverRef.current, 0.5);
        }
      }

      const k = reduceRef.current ? 1 : 1 - Math.exp(-dt / NUDGE);
      let moving = carrying || flight;
      values.forEach((v, i) => {
        const n = nudges[i];
        const t = want[i];
        for (const key of ["x", "y", "w", "h"] as const) {
          n[key] += (t[key] - n[key]) * k;
          if (Math.abs(t[key] - n[key]) > 0.05) moving = true;
          else n[key] = t[key];
        }
        v.ox.set(n.x);
        v.oy.set(n.y);
        v.ow.set(n.w);
        v.oh.set(n.h);
      });

      if (moving) frame.current = requestAnimationFrame(step);
      else {
        frame.current = 0;
        last.current = 0;
      }
    },
    [flying, nudges, push, speedOf, stepDrag, values],
  );

  const run = useCallback(() => {
    if (!frame.current) frame.current = requestAnimationFrame(tick);
  }, [tick]);

  useEffect(() => () => cancelAnimationFrame(frame.current), []);

  /** put every tile in its slot with no travel: first paint and a resize */
  const settle = useCallback(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const { width, height } = stage.getBoundingClientRect();
    if (width === 0 || height === 0) return;
    dragRef.current = null;
    stage.dataset.carry = "false";
    const next = bento(width, height);
    const at = rects(next, orderRef.current);
    values.forEach((v, i) => {
      v.x.jump(at[i].x);
      v.y.jump(at[i].y);
      v.w.jump(at[i].w);
      v.h.jump(at[i].h);
    });
    canvas.w.jump(next.slots[0].w);
    canvas.h.jump(next.slots[0].h);
    sizeRef.current = { w: width, h: height };
    gridRef.current = next;
    setGrid(next);
  }, [canvas, values]);

  useLayoutEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    values.forEach((v, i) => {
      v.label.jump(i === 0 ? BELOW : 0);
      v.title.jump(i === 0 ? 0 : BELOW);
      v.copy.jump(i === 0 ? 0 : BELOW);
      v.z.jump(1);
    });
    settle();
    // a corrected measurement is set, not animated, `gooey-chips`'s rule
    const observer = new ResizeObserver(settle);
    observer.observe(stage);
    return () => observer.disconnect();
  }, [settle, values]);

  /**
   * Send every tile to its slot under `next`. `stagger` is a press, where the
   * tiles still at rest set off in order of distance. A release passes false,
   * since every tile is already moving and a delay would hold it in mid-air.
   * `lead` is the tile that paints over everything on the way.
   */
  const go = useCallback(
    (next: Order, stagger: boolean, lead = next[0]) => {
      const layout = gridRef.current;
      if (!layout) return;
      const prev = orderRef.current[0];
      const focusTile = next[0];
      orderRef.current = next;
      setFocus(focusTile);
      setHover(-1);

      const targets = rects(layout, next);
      const moves = values.map((v, i) => travel(rectOf(v), targets[i]));
      const far = Math.max(1, ...moves.filter((_, i) => i !== focusTile));

      const send = (
        mv: MotionValue<number>,
        to: number | number[],
        t: Transition,
      ) => {
        if (reduceRef.current) {
          mv.jump(Array.isArray(to) ? to[to.length - 1] : to);
          return;
        }
        animate(mv, to, t);
      };

      values.forEach((v, i) => {
        // the lead paints over everything and the tile leaving the slot over
        // the rest, so the two that cross the grid are never under a third
        v.z.set(i === lead ? 3 : i === focusTile || i === prev ? 2 : 1);

        const moving = v.x.isAnimating() || v.w.isAnimating();
        const delay =
          stagger && i !== focusTile && !moving ? (moves[i] / far) * SPREAD : 0;
        const to = targets[i];
        const t: Transition = { ...MOVE, delay };
        send(v.x, to.x, t);
        send(v.y, to.y, t);
        send(v.w, to.w, t);
        send(v.h, to.h, t);

        const wantLabel = i !== focusTile;
        if (labelShown.current[i] !== wantLabel) {
          labelShown.current[i] = wantLabel;
          if (wantLabel) {
            send(v.label, [BELOW, 0], {
              ...RISE,
              delay: i === prev ? RETURN : 0,
            });
          } else {
            send(v.label, ABOVE, EXIT);
          }
        }

        const wantDetail = i === focusTile;
        // text a drag faded comes back, after it has left its mask if it is
        // leaving, so it never flashes up on the way out
        if (v.fade.get() < 1) {
          const leaving = detailShown.current[i] && !wantDetail;
          send(v.fade, 1, { duration: 0.2, delay: leaving ? 0.3 : 0 });
        }
        if (detailShown.current[i] !== wantDetail) {
          detailShown.current[i] = wantDetail;
          if (wantDetail) {
            send(v.title, [BELOW, 0], { ...RISE, duration: 0.6, delay: LAND });
            send(v.copy, [BELOW, 0], { ...RISE, delay: LAND + 0.06 });
          } else {
            send(v.title, ABOVE, EXIT);
            send(v.copy, ABOVE, { ...EXIT, delay: 0.025 });
          }
        }
      });

      // the thump is heard when the tile reaches the slot, which is sooner
      // after a short throw than after a press from across the grid
      landOff.current?.();
      landOff.current = null;
      if (focusTile !== prev) {
        if (reduceRef.current) playLand();
        else {
          const v = values[focusTile];
          const to = targets[focusTile];
          const check = () => {
            if (
              Math.abs(v.w.get() - to.w) < 1.5 &&
              Math.abs(v.x.get() - to.x) < 1.5 &&
              Math.abs(v.y.get() - to.y) < 1.5
            ) {
              landOff.current?.();
              landOff.current = null;
              playLand();
            }
          };
          const offs = [v.x.on("change", check), v.w.on("change", check)];
          landOff.current = () => {
            for (const off of offs) off();
          };
        }
      }
      run();
    },
    [run, setHover, values],
  );

  useEffect(() => () => landOff.current?.(), []);

  const select = useCallback(
    (tile: number) => {
      // a drag ends in a click on the tile it started on
      if (draggedRef.current) {
        draggedRef.current = false;
        return;
      }
      if (orderRef.current[0] === tile) return;
      go(promote(orderRef.current, tile), true);
    },
    [go],
  );

  const stagePoint = useCallback((clientX: number, clientY: number) => {
    const r = stageRef.current?.getBoundingClientRect();
    return r ? { x: clientX - r.left, y: clientY - r.top } : null;
  }, []);

  const startDrag = useCallback(
    (tile: number, e: PointerEvent<HTMLButtonElement>) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      armBento();
      draggedRef.current = false;
      const at = stagePoint(e.clientX, e.clientY);
      if (!at) return;
      const box = rectOf(values[tile]);
      dragRef.current = {
        tile,
        pointerId: e.pointerId,
        touch: e.pointerType === "touch",
        startX: e.clientX,
        startY: e.clientY,
        active: false,
        grab: {
          x: clamp((at.x - box.x) / box.w, 0, 1),
          y: clamp((at.y - box.y) / box.h, 0, 1),
        },
        px: at.x,
        py: at.y,
        from: orderRef.current,
        target: null,
        p: 0,
      };
    },
    [stagePoint, values],
  );

  /** end a drag: commit on a release past half way or a throw, else go home */
  const release = useCallback(
    (commit: boolean) => {
      const d = dragRef.current;
      dragRef.current = null;
      if (stageRef.current) stageRef.current.dataset.carry = "false";
      if (!d?.active) return;
      let take = commit && d.target !== null && d.p >= COMMIT;
      const layout = gridRef.current;
      if (commit && !take && d.target && d.p > THROW_MIN && layout) {
        const me = values[d.tile];
        const box = centre(rectOf(me));
        const dest = centre(rects(layout, d.target)[d.tile]);
        const len = Math.hypot(dest.x - box.x, dest.y - box.y) || 1;
        const toward =
          (me.x.getVelocity() * (dest.x - box.x) +
            me.y.getVelocity() * (dest.y - box.y)) /
          len;
        take = toward > THROW;
      }
      go(take && d.target ? d.target : d.from, false, d.tile);
    },
    [go, values],
  );

  // the drag is heard on the window, so a hand that runs off the tile or the
  // stage is still the hand carrying it, on nib's rules
  useEffect(() => {
    const move = (e: globalThis.PointerEvent) => {
      const d = dragRef.current;
      if (!d || e.pointerId !== d.pointerId) return;
      if (e.pointerType === "mouse" && e.buttons === 0) {
        release(true);
        return;
      }
      if (!d.active) {
        const dx = e.clientX - d.startX;
        const dy = e.clientY - d.startY;
        if (Math.hypot(dx, dy) < SLOP) return;
        // a finger that sets off vertically is scrolling the page
        if (d.touch && Math.abs(dy) > Math.abs(dx)) {
          dragRef.current = null;
          return;
        }
        d.active = true;
        draggedRef.current = true;
        for (const v of values) {
          v.x.stop();
          v.y.stop();
          v.w.stop();
          v.h.stop();
        }
        values.forEach((v, i) => {
          v.z.set(i === d.tile ? 4 : 1);
        });
        landOff.current?.();
        landOff.current = null;
        setHover(-1);
        if (stageRef.current) stageRef.current.dataset.carry = "true";
      }
      const at = stagePoint(e.clientX, e.clientY);
      if (!at) return;
      d.px = at.x;
      d.py = at.y;
      run();
    };
    const up = (e: globalThis.PointerEvent) => {
      const d = dragRef.current;
      if (d && e.pointerId === d.pointerId) release(true);
    };
    const cancel = (e: globalThis.PointerEvent) => {
      const d = dragRef.current;
      if (d && e.pointerId === d.pointerId) release(false);
    };
    const blur = () => release(false);
    const key = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape" && dragRef.current?.active) release(false);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", cancel);
    window.addEventListener("blur", blur);
    window.addEventListener("keydown", key);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", cancel);
      window.removeEventListener("blur", blur);
      window.removeEventListener("keydown", key);
    };
  }, [release, run, setHover, stagePoint, values]);

  // hover is hit tested against the resting slots, on the stage node, since the
  // stage is a region the pointer passes through and not a control
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const over = (e: globalThis.PointerEvent) => {
      if (e.pointerType !== "mouse" && e.pointerType !== "pen") return;
      const layout = gridRef.current;
      if (!layout || dragRef.current?.active) return;
      // a tile that flies in under a still pointer was not hovered, so the
      // hover waits for the pointer to move once the grid has settled
      if (flying()) {
        setHover(-1);
        return;
      }
      const at = stagePoint(e.clientX, e.clientY);
      if (!at) return;
      const slot = slotAt(layout, at.x, at.y);
      setHover(slot > 0 ? orderRef.current[slot] : -1);
      run();
    };
    const leave = () => {
      setHover(-1);
      run();
    };
    stage.addEventListener("pointermove", over);
    stage.addEventListener("pointerleave", leave);
    return () => {
      stage.removeEventListener("pointermove", over);
      stage.removeEventListener("pointerleave", leave);
    };
  }, [flying, run, setHover, stagePoint]);

  /** the arrow keys walk the grid by position, Enter and Space press */
  const onKey = useCallback(
    (tile: number, e: KeyboardEvent<HTMLButtonElement>) => {
      if (e.key === "Enter" || e.key === " ") {
        armBento();
        return;
      }
      const dir = ARROWS[e.key];
      const layout = gridRef.current;
      if (!dir || !layout) return;
      e.preventDefault();
      const slot = slotToward(
        layout,
        orderRef.current.indexOf(tile),
        dir[0],
        dir[1],
      );
      if (slot >= 0) buttons.current[orderRef.current[slot]]?.focus();
    },
    [],
  );

  return (
    <div
      ref={stageRef}
      data-carry="false"
      className="@container relative aspect-8/5 min-h-78 w-full select-none overflow-hidden rounded-lg bg-fill ring-1 ring-stroke ring-inset data-[carry=true]:cursor-grabbing data-[carry=true]:[&_*]:cursor-grabbing"
    >
      {grid ? (
        <fieldset className="contents" aria-label="Five sports, one in focus">
          {FACETS.map((facet, i) => (
            <Tile
              key={facet.id}
              facet={facet}
              values={values[i]}
              canvas={canvas}
              focused={focus === i}
              grid={grid}
              copyId={`${id}-copy-${i}`}
              buttonRef={(node) => {
                buttons.current[i] = node;
              }}
              onSelect={() => select(i)}
              onPointerDown={(e) => startDrag(i, e)}
              onKeyDown={(e) => onKey(i, e)}
            />
          ))}
        </fieldset>
      ) : null}
      <p className="sr-only" aria-live="polite">
        {FACETS[focus].title} in focus
      </p>
    </div>
  );
}

function Tile({
  facet,
  values,
  canvas,
  focused,
  grid,
  copyId,
  buttonRef,
  onSelect,
  onPointerDown,
  onKeyDown,
}: {
  facet: Facet;
  values: Values;
  canvas: { w: MotionValue<number>; h: MotionValue<number> };
  focused: boolean;
  grid: Bento;
  copyId: string;
  buttonRef: (node: HTMLButtonElement | null) => void;
  onSelect: () => void;
  onPointerDown: (e: PointerEvent<HTMLButtonElement>) => void;
  onKeyDown: (e: KeyboardEvent<HTMLButtonElement>) => void;
}) {
  const x = useTransform([values.x, values.ox], ([a, b]: number[]) => a + b);
  const y = useTransform([values.y, values.oy], ([a, b]: number[]) => a + b);
  const w = useTransform([values.w, values.ow], ([a, b]: number[]) => a + b);
  const h = useTransform([values.h, values.oh], ([a, b]: number[]) => a + b);
  // the tile is a window onto a picture laid out at the focus slot's size,
  // slid so the focal point holds its place relative to the tile
  const picX = useTransform(
    [w, canvas.w],
    ([tw, cw]: number[]) => facet.focal.x * (tw - cw),
  );
  const picY = useTransform(
    [h, canvas.h],
    ([th, ch]: number[]) => facet.focal.y * (th - ch),
  );
  const labelY = useTransform(values.label, (v) => `${v}%`);
  const titleY = useTransform(values.title, (v) => `${v}%`);
  const copyY = useTransform(values.copy, (v) => `${v}%`);
  const { inset, radius, slots } = grid;

  return (
    <motion.button
      ref={buttonRef}
      type="button"
      data-hover="false"
      aria-pressed={focused}
      aria-label={facet.title}
      aria-describedby={focused ? copyId : undefined}
      onClick={onSelect}
      onPointerDown={onPointerDown}
      onKeyDown={onKeyDown}
      className={cn(
        "group absolute top-0 left-0 touch-pan-y overflow-hidden bg-fill-active text-left",
        focused ? "cursor-grab" : "cursor-pointer",
        FOCUS,
      )}
      style={{
        x,
        y,
        width: w,
        height: h,
        zIndex: values.z,
        borderRadius: radius,
      }}
    >
      <motion.span
        aria-hidden="true"
        className="pointer-events-none absolute top-0 left-0 overflow-hidden"
        style={{
          width: slots[0].w,
          height: slots[0].h,
          x: picX,
          y: picY,
          background: facet.ground,
        }}
      >
        {/* larger than the picture so its edge never shows while it drifts */}
        <span
          className="absolute -inset-1/4 motion-safe:animate-[bento-drift_18s_ease-in-out_infinite_alternate]"
          style={{
            background: facet.mesh,
            animationDuration: `${facet.drift}s`,
            animationDelay: `-${facet.drift / 2}s`,
          }}
        />
        <span
          className="absolute inset-0"
          style={{ background: facet.motif }}
        />
        <span
          className="absolute inset-0"
          style={{ background: facet.detail }}
        />
        {facet.trace ? (
          <span
            className="absolute inset-0"
            style={{
              background: facet.trace.background,
              maskImage: facet.trace.mask,
              maskComposite: "intersect",
              WebkitMaskImage: facet.trace.mask,
              WebkitMaskComposite: "source-in",
            }}
          />
        ) : null}
      </motion.span>
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-40 mix-blend-overlay"
        style={{ backgroundImage: GRAIN, backgroundSize: "160px 160px" }}
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 h-3/5 bg-linear-to-t from-black/55 to-transparent"
      />
      <span
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute inset-0 bg-black opacity-0 transition-opacity duration-200",
          !focused &&
            "group-data-[hover=true]:opacity-10 group-active:opacity-20 group-active:duration-0",
        )}
      />

      {/* type here is printing on a picture, so it is sized as a share of the
          stage rather than from the type scale, `foil-card`'s standing */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute block overflow-hidden"
        style={{ left: inset, bottom: inset }}
      >
        <motion.span
          className="block whitespace-nowrap text-[clamp(0.625rem,2.1cqw,0.75rem)] text-inverse-text leading-[1.35]"
          style={{ y: labelY }}
        >
          {facet.title}
        </motion.span>
      </span>

      {/* laid out at the focus slot's width whatever size the tile is, so it
          never reflows while the box grows round it, and the tile's own clip
          hides it while the tile is small */}
      <motion.span
        aria-hidden={!focused}
        className="pointer-events-none absolute flex flex-col gap-[0.6em]"
        style={{
          left: inset,
          bottom: inset,
          width: slots[0].w - inset * 2,
          opacity: values.fade,
        }}
      >
        <span className="block overflow-hidden">
          <motion.span
            className="block text-[clamp(1.25rem,5.6cqw,2.25rem)] text-inverse-text leading-[1.1] tracking-tight"
            style={{ y: titleY }}
          >
            {facet.title}
          </motion.span>
        </span>
        <span className="block overflow-hidden">
          <motion.span
            id={copyId}
            className="block text-[clamp(0.625rem,2.25cqw,0.8125rem)] text-inverse-text/85 leading-[1.45]"
            style={{ y: copyY }}
          >
            {facet.copy}
          </motion.span>
        </span>
      </motion.span>
    </motion.button>
  );
}
