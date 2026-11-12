"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import type React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowCounterClockwiseIcon, XIcon } from "@/components/icons";
import { Tooltip, TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { CARD, Card } from "./card";
import { NOTIFICATIONS } from "./notifications";

/*
 * A group of notifications that behaves the way iOS's does. Closed, it is the
 * front card with two narrower cards peeking out under it. A tap opens it into
 * a list under a header with "Show less" and a clear control. Swipe a card
 * left and it fades as it goes, and past the threshold it slides on and is
 * gone. Clearing the group sinks every card back and fades it, from the bottom
 * up.
 *
 * `card.tsx` is one card. This file is the group: every card's pose is a
 * function of its index, whether the group is open, and how far it has been
 * swiped, and a spring per property carries it there. One frame loop writes a
 * transform and two custom properties per card and stops once everything has
 * settled.
 */

/** substeps per frame, so a stiff spring stays stable at a long frame */
const SUB = 4;

/** the gap between cards in an open group, and the header's height, in design px */
const GAP = 8;
const HEAD = 32;

/** how far each of the two peeking cards shows under the front one */
const PEEK = 9;
const PEEK_SCALE = [1, 0.94, 0.88];

/** the tallest the open group gets, which sets the card's scale */
const TALL = HEAD + GAP + NOTIFICATIONS.length * (CARD.h + GAP) - GAP;

/** the clear control's width once it reads "Clear", in design px */
const CLEAR_W = 58;

interface S {
  x: number;
  v: number;
}

interface Pose {
  x: S;
  y: S;
  sc: S;
  shade: S;
  op: S;
  /** when the card is due to rise in, in `performance.now()` time */
  introAt: number;
  exit: null | Exit;
}

/**
 * A card on its way out. A swipe carries on left and fades. A clear holds its
 * place, sinks back and fades, and the group only closes up once every card
 * has gone, so nothing reflows under a clear that is still running.
 */
interface Exit {
  kind: "swipe" | "clear";
  at: number;
  x: S;
  y: S;
  sc: S;
  op: S;
  tx: number;
  ty: number;
  tsc: number;
}

interface Drag {
  id: string;
  pointer: number;
  startX: number;
  startY: number;
  offset: number;
  axis: null | "x" | "y";
  vx: number;
  lastX: number;
  lastT: number;
}

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const s0 = (x = 0): S => ({ x, v: 0 });

/** a spring by stiffness and damping ratio */
function spring(s: S, target: number, k: number, zeta: number, dt: number) {
  const a = k * (target - s.x) - 2 * zeta * Math.sqrt(k) * s.v;
  s.v += a * dt;
  s.x += s.v * dt;
}

const still = (s: S, target: number, e = 0.05) =>
  Math.abs(s.x - target) < e && Math.abs(s.v) < e * 10;

const freshIds = (gen: number) => NOTIFICATIONS.map((_, n) => `${gen}-${n}`);
const indexOf = (id: string) => Number(id.split("-")[1]);
const domId = (id: string) => `notification-stack-${id}`;
const nameOf = (id: string | undefined) =>
  id ? (NOTIFICATIONS[indexOf(id)]?.name ?? "") : "";

/** where card `i` of `n` sits, its scale and its shade, in design px */
function slot(i: number, n: number, open: boolean) {
  if (open) {
    // the open list hangs from a fixed top edge, the one a full group has, so
    // a card that leaves only pulls the cards under it up, as iOS does,
    // rather than re-centring the whole list
    const top = -TALL / 2 + HEAD + GAP;
    return { y: top + i * (CARD.h + GAP) + CARD.h / 2, sc: 1, shade: 0, op: 1 };
  }
  // a closed group is the front card and two peeking under it, centred as one
  const peeks = Math.min(n - 1, 2);
  const front = -(peeks * PEEK) / 2;
  const s = PEEK_SCALE[Math.min(i, 2)] ?? 1;
  const y = front + (CARD.h / 2) * (1 - s) + Math.min(i, 2) * PEEK;
  return {
    y,
    sc: s,
    shade: i === 0 ? 0 : i === 1 ? 0.35 : 0.6,
    op: i < 3 ? 1 : 0,
  };
}

/** how far a card pulled left has faded, from 1 at rest to 0.25 */
const fadeOf = (x: number, k: number) =>
  1 - clamp(-x / (CARD.w * k * 0.8), 0, 1) * 0.75;

/** the header's centre in an open group, in design px, fixed with the list's top */
const HEAD_Y = -TALL / 2 + HEAD / 2;

export default function NotificationStack() {
  const reduce = useReducedMotion() === true;
  const stage = useRef<HTMLDivElement>(null);
  const stack = useRef<HTMLDivElement>(null);
  const header = useRef<HTMLDivElement>(null);
  const cardEls = useRef(new Map<string, HTMLDivElement>());
  const [ids, setIds] = useState(() => freshIds(0));
  const [open, setOpenState] = useState(false);
  const [armed, setArmed] = useState(false);
  const [said, setSaid] = useState("");

  // everything the loop and the gestures read, kept out of React
  const live = useRef({
    raf: 0,
    last: 0,
    seen: false,
    reduce: false,
    w: 0,
    h: 0,
    /** the card's scale against its design size */
    k: 1,
    gen: 0,
    order: freshIds(0),
    poses: new Map<string, Pose>(),
    open: false,
    /** a clear-all is running, so the header goes and nothing reflows */
    clearing: false,
    /** swiped cards still fading out, already out of `order` and the layout */
    leaving: [] as string[],
    head: s0(),
    focused: 0,
    focusVisible: false,
    drag: null as Drag | null,
  });

  const tick = useCallback(function frame(now: number) {
    const l = live.current;
    l.raf = 0;
    if (!l.seen) return;
    const dt = Math.min(0.032, Math.max(0.001, (now - l.last) / 1000));
    l.last = now;
    const h = dt / SUB;
    const R = l.reduce;
    const { k, drag } = l;
    const n = l.order.length;
    let moving = !!drag;
    const clearGone: string[] = [];

    /** draws a card on its way out, and says whether it has faded */
    const drawExit = (el: HTMLDivElement, e: Exit) => {
      if (now >= e.at) {
        // a swipe keeps the speed it was let go at, a clear eases out
        const [kx, ko] = e.kind === "swipe" ? [260, 300] : [200, 160];
        for (let j = 0; j < SUB; j++) {
          spring(e.x, e.tx, kx, 1, h);
          spring(e.y, e.ty, 200, 1, h);
          spring(e.sc, e.tsc, 200, 1, h);
          spring(e.op, 0, ko, 1, h);
        }
        if (R) e.op.x = 0;
      }
      el.style.transform = `translate3d(${e.x.x.toFixed(2)}px, ${(e.y.x * k).toFixed(2)}px, 0) scale(${(e.sc.x * k).toFixed(4)})`;
      el.style.opacity = clamp(e.op.x, 0, 1).toFixed(3);
      el.style.pointerEvents = "none";
      const faded = e.op.x < 0.02;
      if (faded) el.style.visibility = "hidden";
      return faded;
    };

    // a swiped card fades out where it was let go, on top of the cards
    // closing up under it, and leaves the DOM once it has
    const leftGone: string[] = [];
    for (const id of l.leaving) {
      const el = cardEls.current.get(id);
      const e = l.poses.get(id)?.exit;
      if (!el || !e || drawExit(el, e)) leftGone.push(id);
      else moving = true;
    }

    l.order.forEach((id, i) => {
      const el = cardEls.current.get(id);
      if (!el) {
        moving = true;
        return;
      }
      const t = slot(i, n, l.open);
      let p = l.poses.get(id);
      if (!p) {
        p = {
          x: s0(),
          y: s0(t.y + 18),
          sc: s0(t.sc),
          shade: s0(t.shade),
          op: s0(0),
          introAt: now + i * 50,
          exit: null,
        };
        l.poses.set(id, p);
      }

      if (p.exit) {
        if (drawExit(el, p.exit)) clearGone.push(id);
        else moving = true;
        return;
      }

      const held = drag?.id === id && drag.axis === "x";
      const tx = held ? drag.offset : 0;
      const iT = now >= p.introAt ? t.op : 0;
      const ty = t.y + (iT === 0 && p.op.x < 0.5 ? 18 : 0);

      for (let j = 0; j < SUB; j++) {
        if (!held) spring(p.x, tx, 380, 0.92, h);
        spring(p.y, ty, 300, 0.9, h);
        spring(p.sc, t.sc, 300, 0.9, h);
        spring(p.shade, t.shade, 300, 1, h);
        spring(p.op, iT, 300, 1, h);
      }
      if (held) p.x = { x: tx, v: drag.vx };
      if (R) {
        p.x = s0(tx);
        p.y = s0(ty);
        p.sc = s0(t.sc);
        p.shade = s0(t.shade);
        p.op = s0(iT);
      }

      if (
        now < p.introAt ||
        !still(p.x, tx, 0.1) ||
        !still(p.y, ty) ||
        !still(p.sc, t.sc, 0.0005) ||
        !still(p.shade, t.shade, 0.002) ||
        !still(p.op, iT, 0.002)
      ) {
        moving = true;
      }

      const hidden = !l.open && i > 2;
      el.style.transform = `translate3d(${p.x.x.toFixed(2)}px, ${(p.y.x * k).toFixed(2)}px, 0) scale(${(p.sc.x * k).toFixed(4)})`;
      // a card pulled left fades with the pull
      el.style.opacity = clamp(p.op.x * fadeOf(p.x.x, k), 0, 1).toFixed(3);
      el.style.visibility = p.op.x > 0.005 ? "visible" : "hidden";
      el.style.zIndex = String(100 - i);
      el.style.setProperty("--shade", clamp(p.shade.x, 0, 1).toFixed(3));
      // closed, only the front card takes a press, and it opens the group
      el.style.pointerEvents = l.open || i === 0 ? "auto" : "none";
      el.dataset.focus = String(l.focused === i && l.focusVisible);
      el.setAttribute("aria-hidden", String(hidden));
      el.setAttribute("aria-selected", String(l.focused === i));
    });

    // the header rides above the open list and fades with it
    const hd = header.current;
    if (hd) {
      const hT = l.open && n > 1 && !l.clearing ? 1 : 0;
      for (let j = 0; j < SUB; j++) spring(l.head, hT, 300, 1, h);
      if (R) l.head = s0(hT);
      if (!still(l.head, hT, 0.002)) moving = true;
      hd.style.transform = `translate3d(0, ${((HEAD_Y + (1 - l.head.x) * 12) * k).toFixed(2)}px, 0) scale(${k.toFixed(4)})`;
      hd.style.opacity = clamp(l.head.x, 0, 1).toFixed(3);
      hd.style.visibility = l.head.x > 0.005 ? "visible" : "hidden";
    }

    if (leftGone.length) {
      l.leaving = l.leaving.filter((id) => !leftGone.includes(id));
      for (const id of leftGone) l.poses.delete(id);
      setIds((prev) => prev.filter((id) => !leftGone.includes(id)));
    }

    // a clear waits for the last card, so the list never closes up under it
    if (l.clearing && n > 0 && clearGone.length === n) {
      const all = l.order;
      l.clearing = false;
      l.order = [];
      for (const id of all) l.poses.delete(id);
      l.focused = 0;
      l.open = false;
      setOpenState(false);
      setIds((prev) => prev.filter((id) => !all.includes(id)));
      moving = true;
    }

    const active = l.order[l.focused];
    if (active) {
      stack.current?.setAttribute("aria-activedescendant", domId(active));
    } else stack.current?.removeAttribute("aria-activedescendant");

    if (moving) l.raf = requestAnimationFrame(frame);
  }, []);

  const kick = useCallback(() => {
    const l = live.current;
    if (l.raf || !l.seen) return;
    l.last = performance.now();
    l.raf = requestAnimationFrame(tick);
  }, [tick]);

  const setOpen = useCallback(
    (v: boolean) => {
      const l = live.current;
      if (v && l.order.length < 2) return;
      l.open = v;
      setOpenState(v);
      setArmed(false);
      setSaid(v ? `${l.order.length} notifications, open` : "Group closed");
      kick();
    },
    [kick],
  );

  /** a swipe: the card carries on left from where it is and fades */
  const dismiss = useCallback(
    (id: string | undefined, vx = -900) => {
      const l = live.current;
      const p = id ? l.poses.get(id) : undefined;
      if (!id || !p || p.exit) return;
      const v = Math.min(vx, -600);
      p.exit = {
        kind: "swipe",
        at: performance.now(),
        x: { x: p.x.x, v },
        y: s0(p.y.x),
        sc: s0(p.sc.x),
        op: s0(p.op.x * fadeOf(p.x.x, l.k)),
        tx: p.x.x - 140 * l.k,
        ty: p.y.x,
        tsc: p.sc.x,
      };
      // out of the layout now, so the cards under it close up while it fades
      // rather than after
      l.order = l.order.filter((o) => o !== id);
      l.leaving = [...l.leaving, id];
      l.focused = clamp(l.focused, 0, Math.max(0, l.order.length - 1));
      // a group of one is not a group, so iOS closes it
      if (l.order.length <= 1 && l.open) {
        l.open = false;
        setOpenState(false);
      }
      setSaid(
        l.order.length
          ? `${nameOf(id)} cleared, ${l.order.length} left`
          : "No notifications",
      );
      kick();
    },
    [kick],
  );

  /**
   * A clear: every card sinks back where it is and fades, from the bottom of
   * the list up, so the list reads as emptying toward its header. The header
   * fades with it.
   */
  const clearAll = useCallback(() => {
    const l = live.current;
    const now = performance.now();
    const n = l.order.length;
    l.clearing = true;
    l.order.forEach((id, i) => {
      const p = l.poses.get(id);
      if (!p || p.exit) return;
      p.exit = {
        kind: "clear",
        at: now + (n - 1 - i) * 40,
        x: s0(p.x.x),
        y: s0(p.y.x),
        sc: s0(p.sc.x),
        op: s0(p.op.x),
        tx: p.x.x,
        ty: p.y.x - 10,
        tsc: p.sc.x * 0.92,
      };
    });
    setArmed(false);
    setSaid("All notifications cleared");
    kick();
  }, [kick]);

  const reset = useCallback(() => {
    const l = live.current;
    l.gen += 1;
    l.order = freshIds(l.gen);
    l.poses.clear();
    l.focused = 0;
    l.open = false;
    l.clearing = false;
    l.leaving = [];
    setOpenState(false);
    setArmed(false);
    setIds(l.order);
    setSaid(`${l.order.length} notifications`);
  }, []);

  useEffect(() => {
    live.current.reduce = reduce;
    kick();
  }, [kick, reduce]);

  // a new set of cards mounts its nodes, and the loop picks them up
  useEffect(() => {
    if (ids.length) kick();
  }, [ids, kick]);

  // the card's scale from the stage's size, and the intro once it is seen
  useEffect(() => {
    const node = stage.current;
    if (!node) return;
    const l = live.current;
    const size = () => {
      l.w = node.clientWidth;
      l.h = node.clientHeight;
      l.k = Math.min(1, (l.w - 32) / CARD.w, (l.h - 24) / TALL);
      kick();
    };
    size();
    const ro = new ResizeObserver(size);
    ro.observe(node);
    const io = new IntersectionObserver(([entry]) => {
      const was = l.seen;
      l.seen = entry?.isIntersecting ?? false;
      if (l.seen && !was) {
        // cards waiting for their first sight rise in from now
        const now = performance.now();
        l.order.forEach((id, i) => {
          const p = l.poses.get(id);
          if (p && p.op.x < 0.1) p.introAt = now + i * 50;
        });
        kick();
      }
    });
    io.observe(node);
    return () => {
      ro.disconnect();
      io.disconnect();
      cancelAnimationFrame(l.raf);
      l.raf = 0;
    };
  }, [kick]);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    const l = live.current;
    const target = e.target as HTMLElement;
    if (target.closest("button")) return;
    const card = target.closest<HTMLElement>("[data-id]");
    const id = card?.dataset.id;
    if (!id || l.poses.get(id)?.exit) {
      // a press on the bare stage takes back an armed clear
      setArmed(false);
      return;
    }
    l.focused = l.order.indexOf(id);
    l.drag = {
      id,
      pointer: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      offset: 0,
      axis: null,
      vx: 0,
      lastX: e.clientX,
      lastT: performance.now(),
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const l = live.current;
    const d = l.drag;
    if (!d || d.pointer !== e.pointerId) return;
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    if (!d.axis && Math.hypot(dx, dy) > 6) {
      d.axis = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
      if (d.axis === "x") stage.current?.setAttribute("data-carry", "true");
    }
    if (d.axis !== "x") return;
    const now = performance.now();
    const dt = Math.max(0.008, (now - d.lastT) / 1000);
    d.vx = (e.clientX - d.lastX) / dt;
    d.lastX = e.clientX;
    d.lastT = now;
    // a card pulled right of its place gives a little and no more
    d.offset = dx > 0 ? dx * 0.2 : dx;
    kick();
  };

  const release = (e: React.PointerEvent<HTMLDivElement>) => {
    const l = live.current;
    const d = l.drag;
    if (!d || d.pointer !== e.pointerId) return;
    l.drag = null;
    stage.current?.removeAttribute("data-carry");
    if (d.axis === null) {
      if (e.type !== "pointerup") return;
      // a tap opens a closed group
      if (!l.open) setOpen(true);
      return;
    }
    if (d.axis !== "x") return;
    const p = l.poses.get(d.id);
    if (p) p.x = { x: d.offset, v: d.vx };
    // a hand that stopped before letting go throws nothing
    const vx = performance.now() - d.lastT < 60 ? d.vx : 0;
    const pulled = -d.offset;
    // past a third of the card, or a flick left, and it goes. Anything less
    // springs back and its fade comes back with it
    if (pulled > CARD.w * l.k * 0.35 || (vx < -600 && pulled > 16)) {
      dismiss(d.id, vx);
    }
    kick();
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const l = live.current;
    l.focusVisible = true;
    const n = l.order.length;
    if (e.key.toLowerCase() === "r" && !e.metaKey && !e.ctrlKey) {
      e.preventDefault();
      reset();
      return;
    }
    if (!n) return;
    const announce = () =>
      setSaid(`${nameOf(l.order[l.focused])}, ${l.focused + 1} of ${n}`);
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!l.open && n > 1) setOpen(true);
      l.focused = clamp(l.focused + (e.key === "ArrowDown" ? 1 : -1), 0, n - 1);
      announce();
      kick();
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (!l.open) setOpen(true);
    } else if (e.key === "Delete" || e.key === "Backspace") {
      e.preventDefault();
      dismiss(l.order[l.focused]);
    } else if (e.key === "Escape") {
      if (l.open) setOpen(false);
    }
  };

  const onFocus = (e: React.FocusEvent<HTMLDivElement>) => {
    live.current.focusVisible = e.currentTarget.matches(":focus-visible");
    kick();
  };

  const onBlur = () => {
    live.current.focusVisible = false;
    kick();
  };

  const n = ids.length;

  // one step up from the site's fill order, since they sit on a `fill` stage
  const PILL = cn(
    "inline-flex h-[30px] cursor-pointer items-center justify-center rounded-full bg-fill-active font-medium text-[13px] text-text-primary transition-colors duration-150",
    "hover:bg-stroke-strong active:bg-text-muted/40",
    "focus-visible:outline-2 focus-visible:outline-text-primary/40 focus-visible:outline-offset-2 focus-visible:outline-solid",
  );

  return (
    <div
      ref={stage}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={release}
      onPointerCancel={release}
      className={cn(
        "relative isolate h-180 w-full touch-pan-y select-none overflow-hidden rounded-lg bg-fill ring-1 ring-stroke ring-inset",
        "data-[carry=true]:cursor-grabbing data-[carry=true]:[&_*]:cursor-grabbing",
      )}
    >
      {/* the group's header, laid out at the card's design width and scaled
          with it, so it lines up with the cards under it */}
      <div
        ref={header}
        inert={!open}
        className="absolute top-1/2 left-1/2 z-[200] flex items-center justify-between normal-case"
        style={{
          width: CARD.w,
          height: HEAD,
          marginLeft: -CARD.w / 2,
          marginTop: -HEAD / 2,
          visibility: "hidden",
        }}
      >
        <span className="pl-[4px] font-semibold text-[20px] text-text-primary">
          Notifications
        </span>
        <span className="flex items-center gap-[8px]">
          <button
            type="button"
            onClick={() => setOpen(false)}
            className={cn(PILL, "px-[12px]")}
          >
            Show less
          </button>
          {/* iOS's own confirm: the × grows into "Clear", and a second press
              clears the group. The width is tweened rather than run through
              `layout`: a layout animation resizes with a scale, which scales
              the label with it, and this header also sits inside a `scale(k)`
              the loop writes, which Motion's projection cannot see */}
          <motion.button
            type="button"
            aria-label={armed ? "Confirm clear all" : "Clear all notifications"}
            onClick={() => (armed ? clearAll() : setArmed(true))}
            initial={false}
            animate={{ width: armed ? CLEAR_W : HEAD - 2 }}
            transition={
              reduce
                ? { duration: 0 }
                : { type: "spring", duration: 0.3, bounce: 0 }
            }
            className={cn(PILL, "relative overflow-hidden")}
          >
            <AnimatePresence initial={false}>
              {armed ? (
                <motion.span
                  key="clear"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  className="absolute inset-0 grid place-items-center whitespace-nowrap"
                >
                  Clear
                </motion.span>
              ) : (
                <motion.span
                  key="x"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  className="absolute inset-0 grid place-items-center"
                >
                  <XIcon aria-hidden="true" className="size-[13px]" />
                </motion.span>
              )}
            </AnimatePresence>
          </motion.button>
        </span>
      </div>

      {/* a listbox, so the group is one tab stop and the arrow keys move the
          highlight through `aria-activedescendant`, written by the loop */}
      <div
        ref={stack}
        role="listbox"
        aria-label="Notifications. Enter opens the group, arrow keys move, Delete clears a notification."
        tabIndex={0}
        onKeyDown={onKeyDown}
        onFocus={onFocus}
        onBlur={onBlur}
        className="pointer-events-none absolute inset-0 rounded-lg outline-none"
      >
        {ids.map((id) => {
          const nt = NOTIFICATIONS[indexOf(id)];
          if (!nt) return null;
          return (
            <div
              key={id}
              ref={(el) => {
                if (el) cardEls.current.set(id, el);
                else cardEls.current.delete(id);
              }}
              id={domId(id)}
              role="option"
              aria-selected={false}
              tabIndex={-1}
              data-id={id}
              aria-label={`${nt.name}, ${nt.title}. ${nt.body}`}
              className={cn(
                "absolute top-1/2 left-1/2 cursor-pointer",
                "data-[focus=true]:outline-2 data-[focus=true]:outline-text-primary/40 data-[focus=true]:outline-offset-4 data-[focus=true]:outline-solid",
              )}
              style={{
                width: CARD.w,
                height: CARD.h,
                marginLeft: -CARD.w / 2,
                marginTop: -CARD.h / 2,
                borderRadius: CARD.r,
                visibility: "hidden",
              }}
            >
              <Card n={nt} />
            </div>
          );
        })}
      </div>

      {/* it arrives after the last card has faded, rising a little into the
          space the group left, so a clear ends on it rather than cutting to it */}
      <AnimatePresence>
        {n === 0 && (
          <motion.p
            key="empty"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, transition: { duration: 0.12 } }}
            transition={
              reduce
                ? { duration: 0 }
                : { duration: 0.32, ease: [0.23, 1, 0.32, 1], delay: 0.06 }
            }
            className="pointer-events-none absolute inset-0 grid place-items-center text-meta text-text-muted"
          >
            No notifications
          </motion.p>
        )}
      </AnimatePresence>

      {n < NOTIFICATIONS.length && (
        <TooltipProvider delayDuration={200}>
          <Tooltip label="Bring them back (R)">
            <button
              type="button"
              aria-label="Bring the notifications back"
              onClick={reset}
              className={cn(
                "absolute top-3 right-3 z-[300] inline-flex size-8 cursor-pointer items-center justify-center rounded-full bg-fill-hover text-text-secondary transition-colors duration-200",
                // one step up from the site's order, since it sits on `fill`
                "hover:bg-fill-active hover:text-text-primary active:bg-stroke-strong active:duration-0",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-primary/15 focus-visible:ring-offset-2 focus-visible:ring-offset-fill",
              )}
            >
              <ArrowCounterClockwiseIcon
                aria-hidden="true"
                className="size-4 shrink-0"
              />
            </button>
          </Tooltip>
        </TooltipProvider>
      )}

      <span aria-live="polite" className="sr-only">
        {said}
      </span>
    </div>
  );
}
