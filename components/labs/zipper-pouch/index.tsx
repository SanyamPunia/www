"use client";

import { useReducedMotion } from "motion/react";
import {
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
} from "react";
import {
  CY,
  clipPath,
  holePath,
  narrowest,
  openness,
  POUCH,
  stitchPath,
  TEETH,
  TRACK,
  tapePath,
  tooth,
  toothOf,
  VB_H,
  VB_W,
  X0,
  X1,
} from "./zipper";
import { armZip, knock, rustle, tick } from "./zipper-sound";

/*
 * A pouch with a zipper across its front. Drag the pull tab and the teeth part
 * behind the slider, the pouch opens, and what is inside rises through the gap.
 * A tap on the tab zips it the whole way. `zipper.ts` is the geometry and
 * `zipper-sound.ts` the sound. This file is the drawing, the hand and one loop.
 *
 * **Nothing renders while it moves.** The slider, the tab and the items are
 * refs, and every tooth, both tapes, the hole and the items are written to
 * the nodes from them.
 */

/*
 * The colours are the pouch's own and are scoped here, not tokens: a pine
 * canvas, brass teeth and a dark lining, and the two things inside it.
 */
const FABRIC = "#3d675b";
const TAPE_FILL = "#2b4a41";
const LINING_TOP = "#0e1412";
const LINING_FOOT = "#24302c";
const BRASS_LIGHT = "#ecd07a";
const BRASS = "#c39c3e";
const BRASS_DARK = "#8a6a22";
const TICKET = "#f4ead2";
const TICKET_INK = "#b14a2a";
const PENCIL = "#efb12f";
const PENCIL_EDGE = "#c98e17";
const ERASER = "#ec8e8e";
const FERRULE = "#c6c9cc";

/** the fabric's tooth, `document-pocket`'s grain tile without the CSS wrapper */
const GRAIN =
  "data:image/svg+xml,%3Csvg viewBox='0 0 160 160' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='g'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23g)'/%3E%3C/svg%3E";

/** where the tab hangs from, below the slider's centre, and how long it is */
const PIVOT = 5;
const TAB = 30;

/*
 * The slider follows the hand through a little friction, so the tab leans
 * toward the pull while the hand is moving. A release coasts a short way, since
 * a zipper drags. The tab is a pendulum when nothing holds it, driven by the
 * slider's own acceleration, so it trails a glide and swings when let go.
 */
const FOLLOW = 0.045;
const COAST = 0.09;
const SWING = 120;
const SWING_DAMP = 5;
const LIFT_STIFF = 260;
const LIFT_DAMP = 2 * 0.5 * Math.sqrt(LIFT_STIFF);

/*
 * An item that is out can be taken hold of and pulled, and it gives on a
 * rubber band rather than coming free: furthest upward, since that is out of
 * the pouch, less sideways, and least downward, back into it. Let go, it
 * springs home with a bounce, at a 0.38 damping ratio. A mouse over an item
 * that is out lifts it a little, which is what says it can be taken.
 */
const PULL = { up: 34, side: 20, down: 8 };
const GIVE_STIFF = 300;
const GIVE_DAMP = 2 * 0.38 * Math.sqrt(GIVE_STIFF);
const HOVER_LIFT = 2.5;
/** an item can be held once it has risen this share of the way it can */
const OUT = 0.6;

/** the UIScrollView rubber band, giving a falling share of the hand up to `reach` */
function rubber(over: number, reach: number): number {
  const c = 0.55;
  return (over * reach * c) / (reach + c * Math.abs(over));
}

/** a press that travels less than this is a tap, which zips the whole way */
const SLOP = 4;

/** the pull tab hanging straight down from its pivot, with a hole near its end */
const TAB_PATH = (() => {
  const top = PIVOT - 3.5;
  const end = PIVOT + TAB;
  const hole = `M -2.4 ${end - 10} a 2.4 2.4 0 0 1 4.8 0 L 2.4 ${end - 6} a 2.4 2.4 0 0 1 -4.8 0 Z`;
  return `M -4.5 ${top} Q 0 ${top - 2.5} 4.5 ${top} L 6 ${end - 4} Q 6 ${end} 2 ${end} L -2 ${end} Q -6 ${end} -6 ${end - 4} Z ${hole}`;
})();

interface Item {
  /** the span the item occupies along the track, which decides its rise */
  a: number;
  b: number;
  /** the most it rises, and how much of the opening it takes to get there */
  max: number;
  /** where it leans from when pulled sideways, its place in the pouch's mouth */
  cx: number;
}

const ITEMS: Item[] = [
  { a: 120, b: 200, max: 46, cx: 160 },
  { a: 234, b: 252, max: 60, cx: 243 },
];

export default function ZipperPouch() {
  const svg = useRef<SVGSVGElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const control = useRef<HTMLDivElement>(null);
  const hole = useRef<SVGPathElement>(null);
  const clip = useRef<SVGPathElement>(null);
  const tapes = useRef<(SVGPathElement | null)[]>([]);
  const stitches = useRef<(SVGPathElement | null)[]>([]);
  const teeth = useRef<(SVGUseElement | null)[][]>([[], []]);
  const slider = useRef<SVGGElement>(null);
  const tab = useRef<SVGGElement>(null);
  const tabShadow = useRef<SVGGElement>(null);
  const items = useRef<(SVGGElement | null)[]>([]);
  const shades = useRef<(SVGElement | null)[]>([]);

  const s = useRef(X0);
  const target = useRef(X0);
  const speed = useRef(0);
  const accel = useRef(0);
  const coast = useRef(0);
  const glide = useRef<{
    from: number;
    to: number;
    at: number;
    dur: number;
  } | null>(null);
  const theta = useRef(0);
  const omega = useRef(0);
  const rise = useRef(ITEMS.map(() => ({ y: 0, v: 0 })));
  /** how far a hand has pulled each item, and its spring back */
  const give = useRef(ITEMS.map(() => ({ x: 0, y: 0, vx: 0, vy: 0 })));
  const hold = useRef<{ k: number; id: number; x: number; y: number } | null>(
    null,
  );
  const hovered = useRef(-1);
  const hand = useRef({ x: X0, y: CY + PIVOT + TAB });
  const grip = useRef<{
    id: number;
    cx: number;
    cy: number;
    dx: number;
    moved: boolean;
  } | null>(null);
  const lastTooth = useRef(0);
  const atEnd = useRef<-1 | 0 | 1>(-1);
  const buzzed = useRef(0);
  const armed = useRef(false);
  const frame = useRef(0);
  const clock = useRef(0);
  const reduceValue = useReducedMotion() ?? false;
  const reduce = useRef(reduceValue);
  reduce.current = reduceValue;

  /* -------------------------------------------------------------- drawing */

  const paint = useCallback(() => {
    const at = s.current;
    hole.current?.setAttribute("d", holePath(at));
    clip.current?.setAttribute("d", clipPath(at));
    ([-1, 1] as const).forEach((side, k) => {
      tapes.current[k]?.setAttribute("d", tapePath(side, at));
      stitches.current[k]?.setAttribute("d", stitchPath(side, at));
      const row = teeth.current[k];
      for (let i = 0; i < TEETH; i++) {
        const t = tooth(side, i, at);
        row[i]?.setAttribute(
          "transform",
          `translate(${t.x.toFixed(2)} ${t.y.toFixed(2)}) rotate(${t.a.toFixed(2)})`,
        );
      }
    });
    slider.current?.setAttribute(
      "transform",
      `translate(${at.toFixed(2)} ${CY})`,
    );
    const deg = (-theta.current * 180) / Math.PI;
    tab.current?.setAttribute(
      "transform",
      `rotate(${deg.toFixed(2)} 0 ${PIVOT})`,
    );
    tabShadow.current?.setAttribute(
      "transform",
      `translate(1.4 2.6) rotate(${deg.toFixed(2)} 0 ${PIVOT})`,
    );
    ITEMS.forEach((item, k) => {
      const y = rise.current[k].y;
      const g = give.current[k];
      const el = items.current[k];
      // a sideways pull leans the item from where it sits in the pouch's mouth
      const lean = (g.x * 0.45).toFixed(2);
      el?.setAttribute(
        "transform",
        `translate(${g.x.toFixed(2)} ${(g.y - y).toFixed(2)}) rotate(${lean} ${item.cx} ${CY + 20})`,
      );
      const out = String(y >= item.max * OUT);
      if (el && el.dataset.out !== out) el.dataset.out = out;
      // an item deep in the pouch is in its shadow and comes into the light as it rises
      shades.current[k]?.setAttribute(
        "opacity",
        (0.55 * (1 - Math.min(1, (y - g.y) / (item.max * 0.7)))).toFixed(3),
      );
    });
    const pct = Math.round(openness(at) * 100);
    const c = control.current;
    if (c) {
      c.setAttribute("aria-valuenow", String(pct));
      c.setAttribute(
        "aria-valuetext",
        pct <= 0 ? "Closed" : pct >= 100 ? "Open" : `${pct} percent open`,
      );
    }
  }, []);

  /* ---------------------------------------------------------------- sound */

  /** a buzz on a phone with a motor, once a press has allowed it */
  const buzz = useCallback((ms: number, gap: number) => {
    if (!armed.current) return;
    const t = performance.now();
    if (t - buzzed.current < gap) return;
    buzzed.current = t;
    navigator.vibrate?.(ms);
  }, []);

  /** every tooth the slider crosses is heard, and a sewn end is a knock */
  const listen = useCallback(
    (moved: number) => {
      const n = toothOf(s.current);
      if (n !== lastTooth.current) {
        lastTooth.current = n;
        tick(Math.abs(moved), moved > 0);
        buzz(2, 40);
      }
      const end: -1 | 0 | 1 =
        s.current <= X0 + 0.01 ? -1 : s.current >= X1 - 0.01 ? 1 : 0;
      if (end !== 0 && end !== atEnd.current && Math.abs(moved) > 20) {
        knock();
        buzz(10, 0);
      }
      atEnd.current = end;
    },
    [buzz],
  );

  /* --------------------------------------------------------------- motion */

  /** a held item let go, which springs home from wherever the hand left it */
  const release = useCallback(() => {
    hold.current = null;
    if (stage.current) stage.current.dataset.carry = "false";
  }, []);

  const loop = useCallback(
    function step(now: number) {
      frame.current = 0;
      const dt = Math.max(0, Math.min(0.032, (now - clock.current) / 1000));
      clock.current = now;
      if (dt === 0) {
        frame.current = requestAnimationFrame(step);
        return;
      }
      const was = s.current;
      const g = glide.current;
      if (grip.current?.moved) {
        s.current +=
          (target.current - s.current) * (1 - Math.exp(-dt / FOLLOW));
      } else if (g) {
        const u = Math.min(1, (now - g.at) / 1000 / g.dur);
        const e = 0.5 - Math.cos(Math.PI * u) / 2;
        s.current = g.from + (g.to - g.from) * e;
        if (u >= 1) glide.current = null;
      } else if (coast.current) {
        s.current += coast.current * dt;
        coast.current *= Math.exp(-dt / COAST);
        if (Math.abs(coast.current) < 4) coast.current = 0;
      }
      if (s.current <= X0 || s.current >= X1) {
        s.current = Math.max(X0, Math.min(X1, s.current));
        coast.current = 0;
      }
      const v = (s.current - was) / dt;
      const raw = Math.max(-4000, Math.min(4000, (v - speed.current) / dt));
      accel.current += (raw - accel.current) * 0.35;
      speed.current = v;
      listen(v);

      // the tab points at the hand that holds it, and is a pendulum otherwise
      if (grip.current?.moved) {
        const h = hand.current;
        const aim = Math.atan2(h.x - s.current, h.y - (CY + PIVOT));
        const clamped = Math.max(-2.6, Math.min(2.6, aim));
        const prev = theta.current;
        theta.current += (clamped - prev) * (1 - Math.exp(-dt / 0.035));
        omega.current = (theta.current - prev) / dt;
      } else {
        const alpha =
          -SWING * Math.sin(theta.current) -
          (accel.current / TAB) * Math.cos(theta.current) -
          SWING_DAMP * omega.current;
        omega.current += alpha * dt;
        theta.current += omega.current * dt;
        theta.current = Math.max(-2.6, Math.min(2.6, theta.current));
      }

      // an item rises only as far as the opening over it lets it
      let settled = true;
      ITEMS.forEach((item, k) => {
        const r = rise.current[k];
        const want = Math.max(
          0,
          Math.min(item.max, narrowest(item.a, item.b, s.current) * 1.25 - 6),
        );
        r.v += (LIFT_STIFF * (want - r.y) - LIFT_DAMP * r.v) * dt;
        r.y += r.v * dt;
        // a closing zipper pushes an item down with it, so it never lags above the
        // teeth, and the few units of room left are what an arriving item bobs in
        if (r.y > want + 4) {
          r.y = want + 4;
          r.v = Math.min(0, r.v);
        }
        if (r.y < 0) {
          r.y = 0;
          r.v = 0;
        }
        if (Math.abs(want - r.y) > 0.05 || Math.abs(r.v) > 0.5) settled = false;
        // an item that is no longer out cannot stay in a hand
        if (hold.current?.k === k && r.y < item.max * OUT) release();
        if (hold.current?.k === k) return;
        // a pulled item springs home, and one under a mouse lifts a little
        const gv = give.current[k];
        const lift =
          hovered.current === k && r.y >= item.max * OUT ? -HOVER_LIFT : 0;
        gv.vx += (-GIVE_STIFF * gv.x - GIVE_DAMP * gv.vx) * dt;
        gv.x += gv.vx * dt;
        gv.vy += (GIVE_STIFF * (lift - gv.y) - GIVE_DAMP * gv.vy) * dt;
        gv.y += gv.vy * dt;
        if (
          Math.abs(gv.x) > 0.02 ||
          Math.abs(gv.y - lift) > 0.02 ||
          Math.abs(gv.vx) + Math.abs(gv.vy) > 0.3
        )
          settled = false;
      });

      paint();
      // a hand holding still needs no frames, and its next move asks for them
      const held = grip.current?.moved ?? false;
      const quiet =
        (held ? Math.abs(target.current - s.current) < 0.02 : true) &&
        !glide.current &&
        !coast.current &&
        Math.abs(omega.current) < 0.02 &&
        (held || Math.abs(theta.current) < 0.004) &&
        settled;
      if (quiet) {
        speed.current = 0;
        accel.current = 0;
        if (!held) {
          theta.current = 0;
          omega.current = 0;
        }
        ITEMS.forEach((_, k) => {
          if (hold.current?.k === k) return;
          const gv = give.current[k];
          gv.vx = 0;
          gv.vy = 0;
        });
        paint();
        return;
      }
      frame.current = requestAnimationFrame(step);
    },
    [paint, listen, release],
  );

  /** under reduced motion everything lands where it is going in one step */
  const settle = useCallback(() => {
    const g = glide.current;
    if (g) {
      const was = s.current;
      s.current = g.to;
      glide.current = null;
      listen(s.current - was > 0 ? 400 : -400);
    }
    coast.current = 0;
    if (!grip.current?.moved) {
      theta.current = 0;
      omega.current = 0;
    }
    ITEMS.forEach((item, k) => {
      rise.current[k].y = Math.max(
        0,
        Math.min(item.max, narrowest(item.a, item.b, s.current) * 1.25 - 6),
      );
      rise.current[k].v = 0;
      if (hold.current?.k === k && rise.current[k].y < item.max * OUT)
        release();
      if (hold.current?.k !== k) {
        const gv = give.current[k];
        gv.x = 0;
        gv.y = 0;
        gv.vx = 0;
        gv.vy = 0;
      }
    });
    paint();
  }, [paint, listen, release]);

  const run = useCallback(() => {
    if (reduce.current) {
      settle();
      return;
    }
    if (frame.current) return;
    clock.current = performance.now();
    frame.current = requestAnimationFrame(loop);
  }, [loop, settle]);

  /** zip to a place on the track, at a zipper's pace */
  const zipTo = useCallback(
    (to: number) => {
      const end = Math.max(X0, Math.min(X1, to));
      const far = Math.abs(end - s.current);
      if (far < 0.5) return;
      coast.current = 0;
      glide.current = {
        from: s.current,
        to: end,
        at: performance.now(),
        dur: 0.18 + (0.55 * far) / TRACK,
      };
      run();
    },
    [run],
  );

  /* ------------------------------------------------------------- the hand */

  const toBox = (clientX: number, clientY: number) => {
    const el = svg.current;
    const m = el?.getScreenCTM();
    if (!el || !m) return { x: 0, y: 0 };
    const p = new DOMPoint(clientX, clientY).matrixTransform(m.inverse());
    return { x: p.x, y: p.y };
  };

  const arm = () => {
    armed.current = true;
    armZip();
  };

  const onDown = (e: ReactPointerEvent<SVGRectElement>) => {
    if (grip.current || hold.current || e.button !== 0) return;
    arm();
    e.currentTarget.setPointerCapture(e.pointerId);
    const p = toBox(e.clientX, e.clientY);
    hand.current = p;
    // a hand on a gliding or coasting slider catches it where it is
    glide.current = null;
    coast.current = 0;
    target.current = s.current;
    grip.current = {
      id: e.pointerId,
      cx: e.clientX,
      cy: e.clientY,
      dx: p.x - s.current,
      moved: false,
    };
  };

  const onMove = (e: ReactPointerEvent<SVGRectElement>) => {
    const g = grip.current;
    if (!g || g.id !== e.pointerId) return;
    if (!g.moved) {
      if (Math.hypot(e.clientX - g.cx, e.clientY - g.cy) < SLOP) return;
      g.moved = true;
      if (stage.current) stage.current.dataset.carry = "true";
    }
    const p = toBox(e.clientX, e.clientY);
    hand.current = p;
    target.current = Math.max(X0, Math.min(X1, p.x - g.dx));
    if (reduce.current) {
      const was = s.current;
      s.current = target.current;
      listen((s.current - was) * 60);
      theta.current = Math.max(
        -2.6,
        Math.min(2.6, Math.atan2(p.x - s.current, p.y - (CY + PIVOT))),
      );
      paint();
      return;
    }
    run();
  };

  const onUp = (e: ReactPointerEvent<SVGRectElement>) => {
    const g = grip.current;
    if (!g || g.id !== e.pointerId) return;
    grip.current = null;
    if (stage.current) stage.current.dataset.carry = "false";
    if (!g.moved) {
      // a tap zips the whole way, open from the first half and shut from the second
      zipTo(openness(s.current) < 0.5 ? X1 : X0);
      return;
    }
    if (!reduce.current)
      coast.current = Math.max(-700, Math.min(700, speed.current));
    run();
  };

  /* ------------------------------------------------------------ the items */

  const isOut = (k: number) => rise.current[k].y >= ITEMS[k].max * OUT;

  const onItemDown = (k: number) => (e: ReactPointerEvent<SVGGElement>) => {
    if (grip.current || hold.current || e.button !== 0 || !isOut(k)) return;
    arm();
    e.currentTarget.setPointerCapture(e.pointerId);
    const p = toBox(e.clientX, e.clientY);
    const g = give.current[k];
    // a hand on an item still springing back catches it where it is
    hold.current = { k, id: e.pointerId, x: p.x - g.x, y: p.y - g.y };
    g.vx = 0;
    g.vy = 0;
    if (stage.current) stage.current.dataset.carry = "true";
    rustle();
    buzz(6, 0);
    run();
  };

  const onItemMove = (k: number) => (e: ReactPointerEvent<SVGGElement>) => {
    const h = hold.current;
    if (!h || h.k !== k || h.id !== e.pointerId) return;
    const p = toBox(e.clientX, e.clientY);
    const dx = p.x - h.x;
    const dy = p.y - h.y;
    const g = give.current[k];
    g.x = rubber(dx, PULL.side);
    g.y = dy < 0 ? -rubber(-dy, PULL.up) : rubber(dy, PULL.down);
    if (reduce.current) paint();
    else run();
  };

  const onItemUp = (k: number) => (e: ReactPointerEvent<SVGGElement>) => {
    const h = hold.current;
    if (!h || h.k !== k || h.id !== e.pointerId) return;
    release();
    if (reduce.current) {
      const g = give.current[k];
      g.x = 0;
      g.y = 0;
      paint();
      return;
    }
    run();
  };

  const onItemEnter = (k: number) => (e: ReactPointerEvent<SVGGElement>) => {
    if (e.pointerType !== "mouse" && e.pointerType !== "pen") return;
    hovered.current = k;
    if (!reduce.current) run();
  };

  const onItemLeave = (k: number) => () => {
    if (hovered.current === k) hovered.current = -1;
    if (!reduce.current) run();
  };

  /** the handlers an item takes, so both are wired the same way */
  const handlers = (k: number) => ({
    onPointerDown: onItemDown(k),
    onPointerMove: onItemMove(k),
    onPointerUp: onItemUp(k),
    onPointerCancel: onItemUp(k),
    onPointerEnter: onItemEnter(k),
    onPointerLeave: onItemLeave(k),
  });

  /* ---------------------------------------------------------- the keyboard */

  const onKey = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    const by: Record<string, number> = {
      ArrowRight: TRACK / 20,
      ArrowUp: TRACK / 20,
      ArrowLeft: -TRACK / 20,
      ArrowDown: -TRACK / 20,
      PageUp: TRACK / 4,
      PageDown: -TRACK / 4,
    };
    let to: number | null = null;
    if (e.key in by) to = s.current + by[e.key];
    else if (e.key === "Home") to = X0;
    else if (e.key === "End") to = X1;
    else if (e.key === "Enter" || e.key === " ")
      to = openness(s.current) < 0.5 ? X1 : X0;
    if (to === null) return;
    e.preventDefault();
    arm();
    zipTo(to);
  };

  /*
   * `touch-action` on an SVG shape is not honoured, so a finger on the tab or on
   * an item that is out scrolled the page and the browser cancelled the drag.
   * A touch that starts on one of those is kept from the page here, and one
   * anywhere else on the drawing still scrolls.
   */
  useEffect(() => {
    const el = svg.current;
    if (!el) return;
    const onTouch = (e: TouchEvent) => {
      const t = e.target as Element | null;
      if (t?.closest('[data-grip], [data-out="true"]')) e.preventDefault();
    };
    el.addEventListener("touchstart", onTouch, { passive: false });
    return () => el.removeEventListener("touchstart", onTouch);
  }, []);

  useLayoutEffect(() => {
    paint();
  }, [paint]);

  useEffect(() => {
    const f = frame;
    return () => cancelAnimationFrame(f.current);
  }, []);

  /* --------------------------------------------------------------- render */

  const pct = (n: number, of: number) => `${(n / of) * 100}%`;

  return (
    <div
      ref={stage}
      className="relative flex aspect-8/5 min-h-78 w-full select-none items-center justify-center overflow-hidden rounded-lg bg-fill data-[carry=true]:cursor-grabbing data-[carry=true]:[&_*]:cursor-grabbing"
    >
      <div className="relative aspect-8/5 max-h-full w-full">
        <svg
          ref={svg}
          viewBox={`0 0 ${VB_W} ${VB_H}`}
          aria-hidden="true"
          focusable="false"
          className="absolute inset-0 size-full overflow-visible"
        >
          <defs>
            <pattern
              id="zp-grain"
              width={64}
              height={64}
              patternUnits="userSpaceOnUse"
            >
              <image href={GRAIN} width={64} height={64} />
            </pattern>
            <linearGradient id="zp-shade" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#fff" stopOpacity="0.1" />
              <stop offset="0.45" stopColor="#fff" stopOpacity="0" />
              <stop offset="1" stopColor="#000" stopOpacity="0.16" />
            </linearGradient>
            <linearGradient
              id="zp-lining"
              x1="0"
              y1={CY - 24}
              x2="0"
              y2={CY + 34}
              gradientUnits="userSpaceOnUse"
            >
              <stop offset="0" stopColor={LINING_TOP} />
              <stop offset="1" stopColor={LINING_FOOT} />
            </linearGradient>
            <linearGradient id="zp-brass" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor={BRASS_LIGHT} />
              <stop offset="0.55" stopColor={BRASS} />
              <stop offset="1" stopColor={BRASS_DARK} />
            </linearGradient>
            <filter id="zp-soft" x="-20%" y="-200%" width="140%" height="500%">
              <feGaussianBlur stdDeviation="6" />
            </filter>
            <clipPath id="zp-pouch">
              <rect
                x={POUCH.x}
                y={POUCH.y}
                width={POUCH.w}
                height={POUCH.h}
                rx={POUCH.r}
              />
            </clipPath>
            <clipPath id="zp-out">
              <path ref={clip} />
            </clipPath>
            {/* one tooth, a small brass block with a lit edge */}
            <g id="zp-tooth">
              <rect
                x={-1.7}
                y={-3}
                width={3.4}
                height={6}
                rx={1}
                fill={BRASS}
              />
              <rect
                x={-1.7}
                y={-3}
                width={1.1}
                height={6}
                rx={0.5}
                fill={BRASS_LIGHT}
                opacity={0.8}
              />
            </g>
          </defs>

          {/* the pouch's shadow on the table, a soft pool and a contact line */}
          <ellipse
            cx={200}
            cy={POUCH.y + POUCH.h + 2}
            rx={POUCH.w * 0.47}
            ry={7}
            fill="#000"
            opacity={0.22}
            filter="url(#zp-soft)"
          />

          {/* the front panel: canvas, a light from above, grain and a stitched edge */}
          <g clipPath="url(#zp-pouch)">
            <rect
              x={POUCH.x}
              y={POUCH.y}
              width={POUCH.w}
              height={POUCH.h}
              fill={FABRIC}
            />
            <rect
              x={POUCH.x}
              y={POUCH.y}
              width={POUCH.w}
              height={POUCH.h}
              fill="url(#zp-grain)"
              opacity={0.32}
              style={{ mixBlendMode: "overlay" }}
            />
            <rect
              x={POUCH.x}
              y={POUCH.y}
              width={POUCH.w}
              height={POUCH.h}
              fill="url(#zp-shade)"
            />
            <path ref={hole} fill="url(#zp-lining)" />
          </g>
          <rect
            x={POUCH.x + 8}
            y={POUCH.y + 8}
            width={POUCH.w - 16}
            height={POUCH.h - 16}
            rx={POUCH.r - 8}
            fill="none"
            stroke="#fff"
            strokeOpacity={0.3}
            strokeWidth={0.9}
            strokeDasharray="3 2.6"
          />
          <rect
            x={POUCH.x + 0.5}
            y={POUCH.y + 0.5}
            width={POUCH.w - 1}
            height={POUCH.h - 1}
            rx={POUCH.r}
            fill="none"
            stroke="#000"
            strokeOpacity={0.18}
          />

          {/* the top tape and its teeth, behind anything rising out */}
          <Tape
            pathRef={(el) => {
              tapes.current[0] = el;
            }}
            stitchRef={(el) => {
              stitches.current[0] = el;
            }}
          />
          <Row
            teethRef={(i, el) => {
              teeth.current[0][i] = el;
            }}
          />

          {/* what is inside, shown only above the bottom lip */}
          <g clipPath="url(#zp-out)">
            <g
              ref={(el) => {
                items.current[0] = el;
              }}
              data-out="false"
              className="touch-none data-[out=true]:cursor-grab"
              {...handlers(0)}
            >
              <g transform={`rotate(-5 160 ${CY + 57})`}>
                <rect
                  x={120}
                  y={CY + 9}
                  width={80}
                  height={96}
                  rx={3}
                  fill={TICKET}
                />
                <rect
                  x={120}
                  y={CY + 9}
                  width={80}
                  height={9}
                  rx={3}
                  fill={TICKET_INK}
                />
                <rect
                  x={120}
                  y={CY + 14}
                  width={80}
                  height={4}
                  fill={TICKET_INK}
                />
                <line
                  x1={178}
                  y1={CY + 20}
                  x2={178}
                  y2={CY + 100}
                  stroke={TICKET_INK}
                  strokeOpacity={0.45}
                  strokeWidth={0.8}
                  strokeDasharray="1.6 1.8"
                />
                <text
                  x={126}
                  y={CY + 30}
                  fontSize={8.5}
                  fontWeight={600}
                  fill={TICKET_INK}
                  style={{ letterSpacing: "0.04em" }}
                >
                  admit one
                </text>
                <text
                  x={126}
                  y={CY + 40}
                  fontSize={5.5}
                  fill={TICKET_INK}
                  fillOpacity={0.75}
                >
                  no. 0042
                </text>
                <rect
                  ref={(el) => {
                    shades.current[0] = el;
                  }}
                  x={120}
                  y={CY + 9}
                  width={80}
                  height={96}
                  rx={3}
                  fill="#000"
                  opacity={0.55}
                />
              </g>
            </g>
            <g
              ref={(el) => {
                items.current[1] = el;
              }}
              data-out="false"
              className="touch-none data-[out=true]:cursor-grab"
              {...handlers(1)}
            >
              <g transform={`rotate(8 243 ${CY + 68})`}>
                <rect
                  x={238}
                  y={CY + 9}
                  width={10}
                  height={9}
                  rx={2.4}
                  fill={ERASER}
                />
                <rect
                  x={237.5}
                  y={CY + 16}
                  width={11}
                  height={7}
                  fill={FERRULE}
                />
                <line
                  x1={237.5}
                  y1={CY + 19.5}
                  x2={248.5}
                  y2={CY + 19.5}
                  stroke="#000"
                  strokeOpacity={0.18}
                  strokeWidth={0.6}
                />
                <rect
                  x={238}
                  y={CY + 23}
                  width={10}
                  height={130}
                  fill={PENCIL}
                />
                <rect
                  x={241.6}
                  y={CY + 23}
                  width={2.8}
                  height={130}
                  fill={PENCIL_EDGE}
                  opacity={0.6}
                />
                <rect
                  ref={(el) => {
                    shades.current[1] = el;
                  }}
                  x={237.5}
                  y={CY + 9}
                  width={11}
                  height={144}
                  rx={2}
                  fill="#000"
                  opacity={0.55}
                />
              </g>
            </g>
          </g>

          {/* the bottom tape and its teeth, in front of the items */}
          <Tape
            pathRef={(el) => {
              tapes.current[1] = el;
            }}
            stitchRef={(el) => {
              stitches.current[1] = el;
            }}
          />
          <Row
            teethRef={(i, el) => {
              teeth.current[1][i] = el;
            }}
          />

          {/* the stops at the two sewn ends */}
          {[X0 - 3, X1 + 3].map((x) => (
            <rect
              key={x}
              x={x - 1.6}
              y={CY - 4.5}
              width={3.2}
              height={9}
              rx={1}
              fill="url(#zp-brass)"
            />
          ))}

          {/* the slider and the tab hanging from it */}
          <g ref={slider} transform={`translate(${X0} ${CY})`}>
            <g ref={tabShadow} opacity={0.22}>
              <path d={TAB_PATH} fill="#000" fillRule="evenodd" />
            </g>
            <path
              d="M -12 -6.5 Q -12 -8 -10.5 -8 L 6 -8 Q 9 -8 9.5 -5 L 10 5 Q 9.5 8 6 8 L -10.5 8 Q -12 8 -12 6.5 Z"
              fill="url(#zp-brass)"
              stroke={BRASS_DARK}
              strokeWidth={0.6}
            />
            <path
              d="M -10 -6 L 6 -6"
              stroke={BRASS_LIGHT}
              strokeWidth={1}
              strokeLinecap="round"
              opacity={0.9}
            />
            <circle cx={0} cy={PIVOT} r={2.6} fill={BRASS_DARK} />
            <g ref={tab}>
              <path
                d={TAB_PATH}
                fill="url(#zp-brass)"
                fillRule="evenodd"
                stroke={BRASS_DARK}
                strokeWidth={0.6}
              />
              <path
                d={`M -3.6 ${PIVOT + 5} L -3.6 ${PIVOT + TAB - 12}`}
                stroke={BRASS_LIGHT}
                strokeWidth={1}
                strokeLinecap="round"
                opacity={0.8}
              />
            </g>
            <circle cx={0} cy={PIVOT} r={1.3} fill={BRASS_LIGHT} />
            {/* the hand's target: the slider and the tab at rest, larger than both */}
            <rect
              x={-18}
              y={-14}
              width={36}
              height={TAB + PIVOT + 22}
              fill="transparent"
              data-grip=""
              className="cursor-grab touch-none"
              onPointerDown={onDown}
              onPointerMove={onMove}
              onPointerUp={onUp}
              onPointerCancel={onUp}
            />
          </g>
        </svg>

        {/* the keyboard's slider, over the track, drawing nothing but its focus */}
        <div
          ref={control}
          role="slider"
          tabIndex={0}
          aria-label="Zipper"
          aria-describedby="zp-about"
          aria-orientation="horizontal"
          aria-valuemin={0}
          aria-valuemax={100}
          // the first value, which `paint` then keeps current on the node
          aria-valuenow={0}
          onKeyDown={onKey}
          className="pointer-events-none absolute rounded-full outline-offset-2 focus-visible:outline-2 focus-visible:outline-inverse-text"
          style={{
            left: pct(X0 - 16, VB_W),
            top: pct(CY - 16, VB_H),
            width: pct(TRACK + 32, VB_W),
            height: pct(32, VB_H),
          }}
        />
        <p id="zp-about" className="sr-only">
          A pouch with a ticket and a pencil inside. Enter zips it the whole
          way.
        </p>
      </div>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 rounded-lg ring-1 ring-stroke ring-inset"
      />
    </div>
  );
}

function Tape({
  pathRef,
  stitchRef,
}: {
  pathRef: (el: SVGPathElement | null) => void;
  stitchRef: (el: SVGPathElement | null) => void;
}) {
  return (
    <>
      <path ref={pathRef} fill={TAPE_FILL} />
      <path
        ref={stitchRef}
        fill="none"
        stroke="#fff"
        strokeOpacity={0.28}
        strokeWidth={0.8}
        strokeDasharray="2.4 2"
      />
    </>
  );
}

function Row({
  teethRef,
}: {
  teethRef: (i: number, el: SVGUseElement | null) => void;
}) {
  return (
    <g>
      {Array.from({ length: TEETH }, (_, i) => (
        <use
          // biome-ignore lint/suspicious/noArrayIndexKey: a tooth is its place on the tape
          key={i}
          ref={(el) => teethRef(i, el)}
          href="#zp-tooth"
        />
      ))}
    </g>
  );
}
