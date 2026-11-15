"use client";

import {
  AnimatePresence,
  animate,
  type MotionValue,
  motion,
  useMotionValue,
  useReducedMotion,
} from "motion/react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { CaretLeftIcon, CaretRightIcon } from "@/components/icons";
import { cn } from "@/lib/utils";
import { HISTORY } from "./history";
import {
  DETENT,
  DISARM,
  DISC,
  discRect,
  GAP,
  give,
  HOLD,
  isTail,
  LAND,
  LINGER,
  listFor,
  mix,
  NUDGE,
  OVERSHOOT,
  PAD,
  PULL,
  panelRect,
  ROW,
  type Side,
  TRICKLE,
} from "./scrub";
import { armSound, buzz, detent, swish, tick } from "./scrub-sound";

/**
 * Glass, for the disc and the panel floating over the page they may leave: a bright edge and a top highlight drawn inside, a faint dark hairline
 * so the edge still reads on the light ground, and the lift under it
 */
const GLASS_EDGE =
  "inset 0 1px 0 color-mix(in srgb, var(--color-bg) 90%, transparent), inset 0 0 0 1px color-mix(in srgb, var(--color-bg) 35%, transparent), 0 0 0 1px rgb(0 0 0 / 0.06), 0 1px 2px rgb(0 0 0 / 0.06), 0 8px 20px -6px rgb(0 0 0 / 0.14), 0 24px 40px -18px rgb(0 0 0 / 0.18)";
/** a sheen from the top, thin enough for what is behind to show through */
const GLASS_FILL =
  "linear-gradient(180deg, color-mix(in srgb, var(--color-bg) 58%, transparent), color-mix(in srgb, var(--color-bg) 30%, transparent))";
/** light from above the ground, so the stage reads as a surface with depth */
const SHEEN =
  "radial-gradient(120% 70% at 50% 0%, var(--color-bg), transparent 70%)";
/** the page's icon stands on the ground and casts a shadow in its own hue */
const tileShadow = (hue: string) =>
  `inset 0 1px 0 var(--color-bg), 0 1px 2px rgb(0 0 0 / 0.06), 0 10px 24px -10px ${hue}80, 0 28px 48px -20px ${hue}66`;
/** firm enough that a row lands without wobbling past the highlight */
const SNAP = { type: "spring", stiffness: 620, damping: 42 } as const;
const OPEN = { type: "spring", stiffness: 380, damping: 32 } as const;
const ARM = { type: "spring", stiffness: 700, damping: 22 } as const;
/** a press becomes a pull past this many px, if it is mostly sideways */
const SLOP = 6;
/** sideways travel back against the pull that closes an open panel */
const RETREAT = 40;

const FOCUS =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-primary/15 focus-visible:ring-offset-2";

type Phase = "pull" | "armed" | "panel" | "closing";
type Input = "wheel" | "pointer" | "keys";

interface Gesture {
  side: Side;
  /** the history index of the panel's first row, and how many rows */
  from: number;
  count: number;
  /** the selected row, in the panel's own order */
  sel: number;
  phase: Phase;
  /** sideways travel toward the page */
  raw: number;
  /** mostly vertical travel while armed */
  rise: number;
  /** the size of each wheel event, to read a momentum tail by */
  sizes: number[];
  /** sideways travel back against the pull, once the panel is open */
  retreat: number;
  /** whether the panel has been scrubbed since it opened */
  moved: boolean;
  /** vertical travel toward the next row */
  acc: number;
  /**
   * The input that opened it, and the only one that may move or commit it.
   * A drag that outlived its own gesture, or a wheel run under a held mouse,
   * otherwise drove a gesture it never started
   */
  by: Input;
}

interface View {
  side: Side;
  from: number;
  count: number;
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

export default function HistoryScrub() {
  const reduce = useReducedMotion();
  const stage = useRef<HTMLDivElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const rows = useRef<HTMLDivElement>(null);
  const chevron = useRef<HTMLDivElement>(null);
  const highlight = useRef<HTMLDivElement>(null);
  const paintRef = useRef<() => void>(() => {});

  const [index, setIndex] = useState<number>(HISTORY.length - 1);
  const [view, setView] = useState<View | null>(null);
  const [sel, setSel] = useState(0);
  const [armed, setArmed] = useState(false);
  const [said, setSaid] = useState("");
  const [dir, setDir] = useState<Side>("back");
  const indexRef = useRef(index);

  const pull = useMotionValue(0);
  const arm = useMotionValue(0);
  const open = useMotionValue(0);
  const pos = useMotionValue(0);
  const off = useMotionValue(0);
  const close = useMotionValue(0);
  const fade = useMotionValue(0);

  useEffect(() => {
    const el = stage.current;
    if (!el) return;
    let width = el.clientWidth || 1;
    let cy = (el.clientHeight || 1) / 2;
    let g: Gesture | null = null;
    let landing: { stop: () => void } | null = null;
    let holding = 0;

    const to = (
      mv: MotionValue<number>,
      v: number,
      spring: object,
      done?: () => void,
    ) => {
      if (reduce) {
        mv.stop();
        mv.set(v);
        done?.();
        return;
      }
      animate(mv, v, { ...spring, onComplete: done });
    };

    const paint = () => {
      const b = box.current;
      if (!g || !b) return;
      const disc = discRect(pull.get(), g.side, width, cy);
      const panel = panelRect(
        g.count,
        pos.get() - off.get(),
        g.side,
        width,
        cy,
      );
      const o = open.get();
      const c = close.get();
      const r = mix(disc, panel, o);
      // a dismissal shrinks and fades on one value, the fade done at 60% of
      // it, so the shrink is felt and never seen to finish
      const d = fade.get();
      const shown = clamp01(pull.get() * 3) * (1 - c) * (1 - clamp01(d / 0.6));
      const scale =
        (1 + 0.08 * arm.get() * (1 - o)) * (1 - 0.08 * c) * (1 - 0.12 * d);
      b.style.transform = `translate(${r.x}px, ${r.y}px) scale(${scale})`;
      b.style.width = `${r.w}px`;
      b.style.height = `${r.h}px`;
      b.style.borderRadius = `${r.r}px`;
      b.style.opacity = `${shown}`;
      b.style.filter = c > 0 ? `blur(${c * 4}px)` : "";

      const list = rows.current;
      if (list) {
        list.style.opacity = `${clamp01((o - 0.3) / 0.6)}`;
        list.style.filter = o < 1 ? `blur(${(1 - o) * 8}px)` : "";
      }
      const h = highlight.current;
      if (h) {
        // the box's 1px border moves its content box down by one
        h.style.transform = `translateY(${cy - ROW / 2 - r.y - 1}px)`;
        h.style.opacity = `${clamp01((o - 0.5) * 2)}`;
      }
      const ch = chevron.current;
      if (ch) {
        ch.style.transform = `translate(${disc.x}px, ${disc.y}px) scale(${scale})`;
        ch.style.opacity = `${shown * clamp01(1 - o * 2.5)}`;
      }
    };
    paintRef.current = paint;
    const unsubs = [pull, arm, open, pos, off, close, fade].map((mv) =>
      mv.on("change", paint),
    );

    const ro = new ResizeObserver(() => {
      width = el.clientWidth || 1;
      cy = (el.clientHeight || 1) / 2;
      paint();
    });
    ro.observe(el);

    const clear = () => {
      g = null;
      landing?.stop();
      landing = null;
      window.clearTimeout(holding);
      for (const mv of [pull, arm, open, pos, off, close, fade]) {
        mv.stop();
        mv.set(0);
      }
      setView(null);
      setArmed(false);
    };

    const start = (side: Side, by: Input): Gesture | null => {
      // a gesture still closing gives way, so swipes can follow each other
      if (g && g.phase !== "closing") return null;
      const list = listFor(HISTORY.length, indexRef.current, side);
      if (list.count === 0) return null;
      clear();
      const next: Gesture = {
        side,
        from: list.from,
        count: list.count,
        sel: list.start,
        phase: "pull",
        raw: 0,
        rise: 0,
        sizes: [],
        retreat: 0,
        moved: false,
        acc: 0,
        by,
      };
      g = next;
      pos.set(list.start);
      setSel(list.start);
      setView({ side, from: list.from, count: list.count });
      return next;
    };

    const say = (s: string) => setSaid(s);

    const cancelLand = () => {
      landing?.stop();
      landing = null;
    };

    /** the detent: the arrow clicks and brightens, and lets go a little lower */
    const armUp = (on: boolean) => {
      if (!g) return;
      g.phase = on ? "armed" : "pull";
      setArmed(on);
      to(arm, on ? 1 : 0, ARM);
      detent(on);
      if (on) buzz(10);
    };

    /**
     * The armed arrow opens into the panel, on the page one step away. Only a
     * hold or a move up or down does this: a plain swipe goes back with the
     * arrow alone, as in any browser, and never flashes the whole history
     */
    const openPanel = () => {
      if (g?.phase !== "armed") return;
      window.clearTimeout(holding);
      g.phase = "panel";
      to(open, 1, OPEN);
      const e = HISTORY[g.from + g.sel];
      if (e) say(`${e.title}, ${g.sel + 1} of ${g.count}`);
    };

    /** sideways travel toward the page, in px, from a wheel or a drag */
    const moveX = (px: number) => {
      if (!g || (g.phase !== "pull" && g.phase !== "armed")) return;
      g.raw = Math.max(0, g.raw + px);
      const p = Math.min(1, g.raw / PULL);
      pull.set(p);
      if (g.phase === "pull" && p >= 1) armUp(true);
      else if (g.phase === "armed" && p < DISARM) armUp(false);
    };

    /** vertical travel on an armed arrow, from an event mostly up or down */
    const riseArmed = (px: number, py: number) => {
      if (g?.phase !== "armed" || Math.abs(py) <= Math.abs(px)) return;
      g.rise += Math.abs(py);
      if (g.rise > NUDGE) openPanel();
    };

    /**
     * Sideways travel in an open panel, `px` toward the page and `py` the
     * same event's vertical travel. Moving back against the pull closes the
     * panel without going anywhere. Only a mostly sideways move counts, and
     * moving toward the page takes it back, so the sideways wobble of a
     * vertical scrub never adds up to a dismissal
     */
    const backOff = (px: number, py: number) => {
      if (g?.phase !== "panel" || Math.abs(px) <= Math.abs(py)) return;
      g.retreat = Math.max(0, g.retreat - px);
      if (g.retreat >= RETREAT) dismiss();
    };

    /**
     * Put the highlight on row `next`, with the list drawn `shown` rows off it.
     * The spring starts from wherever the list was drawn, so a snap never jumps
     */
    const land = (next: number, shown: number) => {
      if (!g) return;
      const drawn = pos.get() - off.get();
      g.sel = next;
      off.set(shown);
      pos.set(drawn + shown);
      to(pos, next, SNAP);
      tick();
      buzz(4);
      setSel(next);
      const e = HISTORY[g.from + next];
      if (e) say(`${e.title}, ${next + 1} of ${g.count}`);
    };

    /** one row from the keyboard, with no travel carried */
    const step = (by: number) => {
      if (!g) return;
      const next = g.sel + by;
      if (next < 0 || next >= g.count) return;
      g.acc = 0;
      land(next, 0);
    };

    /** vertical travel in px, positive when the list moves down */
    const moveY = (px: number) => {
      if (g?.phase !== "panel") return;
      g.moved = true;
      g.acc += px;
      // the list moving down brings the row above onto the highlight. A fast
      // push can cover more than one row in a single event, and passes each
      let next = g.sel;
      while (Math.abs(g.acc) >= DETENT) {
        const toward = g.acc > 0 ? -1 : 1;
        if (next + toward < 0 || next + toward >= g.count) break;
        next += toward;
        g.acc += toward * DETENT;
      }
      // against an end the travel is capped at half a row's push, so turning
      // back answers at once instead of first unwinding all that was pushed
      const toward = g.acc > 0 ? -1 : 1;
      const edge = next + toward < 0 || next + toward >= g.count;
      if (edge) g.acc = Math.max(-DETENT / 2, Math.min(DETENT / 2, g.acc));
      const shown = give(g.acc, edge);
      if (next !== g.sel) land(next, shown);
      else off.set(shown);
    };

    const navigate = (target: number) => {
      if (!g) return;
      g.phase = "closing";
      cancelLand();
      setDir(target < indexRef.current ? "back" : "forward");
      indexRef.current = target;
      setIndex(target);
      swish();
      buzz(8);
      const e = HISTORY[target];
      if (e) say(`On ${e.title}`);
      if (reduce) {
        clear();
        return;
      }
      const mine = g;
      animate(close, 1, { duration: 0.22, ease: [0.23, 1, 0.32, 1] }).then(
        () => {
          if (g === mine) clear();
        },
      );
    };

    /**
     * Close without going anywhere. An open panel shrinks a little and fades
     * where it is, and an arrow that never opened slides back behind its edge
     */
    const dismiss = () => {
      if (!g || g.phase === "closing") return;
      cancelLand();
      window.clearTimeout(holding);
      const wasOpen = g.phase === "panel";
      g.phase = "closing";
      say("");
      if (reduce) {
        clear();
        return;
      }
      // a swipe that follows may already own the stage by the time this ends
      const mine = g;
      const done = () => {
        if (g === mine) clear();
      };
      if (wasOpen) {
        animate(fade, 1, { duration: 0.26, ease: "easeOut" }).then(done);
        return;
      }
      to(arm, 0, ARM);
      to(pull, 0, OPEN, done);
    };

    /** the fingers leave the trackpad, or the press lets go */
    const lift = () => {
      if (!g) return;
      if (g.phase === "pull") dismiss();
      else if (g.phase === "armed")
        navigate(
          g.side === "back" ? indexRef.current - 1 : indexRef.current + 1,
        );
      else if (g.phase === "panel") navigate(g.from + g.sel);
    };

    /** commit where the hand left the panel, once it has stayed still */
    const scheduleLand = () => {
      cancelLand();
      const t = window.setTimeout(lift, g?.moved ? LAND : LINGER);
      landing = { stop: () => window.clearTimeout(t) };
    };

    /*
     * A trackpad swipe is wheel events with no start and no end, and no lift.
     * The first event of a run picks its axis. A run ends when its own timer
     * fires, as in `swipe-back`, and a quiet panel then commits where it is,
     * since resting fingers and lifted ones send the same nothing
     */
    let run: {
      axis: "x" | "y";
      timer: number;
      done: boolean;
      /** the sideways direction of the last swipe, and the last event's size */
      dir: number;
      last: number;
    } | null = null;

    const quiet = () => {
      if (!g) return;
      if (g.phase === "pull") dismiss();
      // an armed arrow that goes quiet with no tail is a hand holding still.
      // It may have lifted slowly instead, so the panel still commits on its
      // own, one page back, if nothing moves
      else if (g.phase === "armed") {
        openPanel();
        scheduleLand();
      }
      // the list stays where the hand left it inside its row. Only passing a
      // row snaps, so a rest against an end does not spring back to centre
      else if (g.phase === "panel") scheduleLand();
    };

    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey) return;
      const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? width : 1;
      const dx = e.deltaX * unit;
      const dy = e.deltaY * unit;
      // in an open panel only scrubbing and backing off mean anything. A
      // lift's trickle, and the swipe still running on toward the page after
      // the detent, leave the run to go quiet and the panel to commit
      if (g?.by === "wheel" && g.phase === "panel") {
        const toward = g.side === "back" ? -dx : dx;
        const sideways = Math.abs(dx) > Math.abs(dy);
        if (Math.hypot(dx, dy) < TRICKLE || (sideways && toward >= 0)) {
          e.preventDefault();
          return;
        }
      }
      // an armed arrow ignores the trickle too, so a slow lift reads as quiet
      if (
        g?.by === "wheel" &&
        g.phase === "armed" &&
        Math.hypot(dx, dy) < TRICKLE
      ) {
        e.preventDefault();
        return;
      }
      const sideways = Math.abs(dx) > Math.abs(dy);
      const free = (!g || g.phase === "closing") && !ptr;
      if (!run || run.done) {
        run = {
          axis: sideways ? "x" : "y",
          timer: 0,
          done: false,
          dir: Math.sign(dx),
          last: Math.abs(dx),
        };
        // fingers moving right report a negative delta, which is back
        if (free && sideways) start(dx < 0 ? "back" : "forward", "wheel");
      } else if (free && sideways && Math.abs(dx) > 4) {
        // the next swipe can land before the last one's run goes quiet. It
        // starts one if it turns round or speeds up, which a tail never does
        const turned = Math.sign(dx) !== run.dir;
        const pushed = Math.abs(dx) > run.last * 1.25 + 1;
        if (turned || pushed) {
          run.axis = "x";
          run.dir = Math.sign(dx);
          start(dx < 0 ? "back" : "forward", "wheel");
        }
      }
      const r = run;
      r.last = Math.abs(dx);
      window.clearTimeout(r.timer);
      r.timer = window.setTimeout(() => {
        r.done = true;
        if (g?.by === "wheel") quiet();
      }, GAP);
      if (!g && r.axis === "y") return;
      e.preventDefault();
      if (g?.by !== "wheel") return;
      cancelLand();
      g.sizes.push(Math.hypot(dx, dy));
      if (g.sizes.length > 12) g.sizes.shift();
      if (g.phase === "pull" || g.phase === "armed") {
        moveX(g.side === "back" ? -dx : dx);
        riseArmed(dx, dy);
        // a momentum tail well past the arm is a swipe that lifted: back a
        // page at once, with the arrow alone
        if (g.phase === "armed" && g.raw - PULL >= OVERSHOOT && isTail(g.sizes))
          lift();
      } else if (g.phase === "panel") {
        backOff(g.side === "back" ? -dx : dx, dy);
        moveY(-dy);
      }
    };

    /*
     * A mouse or a finger presses and drags: sideways to pull, then up and
     * down to scrub. It has a real release, so nothing here guesses a lift
     */
    let ptr: {
      id: number;
      x: number;
      y: number;
      lx: number;
      ly: number;
      started: boolean;
    } | null = null;

    /** let go of the press, and of its capture if the page still holds it */
    const release = () => {
      const p = ptr;
      ptr = null;
      if (p && el.hasPointerCapture(p.id)) el.releasePointerCapture(p.id);
    };

    /** end whatever is in progress without going anywhere */
    const abort = () => {
      release();
      dismiss();
    };

    const onDown = (e: PointerEvent) => {
      if (e.button !== 0 || g || ptr) return;
      armSound();
      // captured from the press, so a release outside the stage still lands
      // here and no press is left behind half started
      el.setPointerCapture(e.pointerId);
      ptr = {
        id: e.pointerId,
        x: e.clientX,
        y: e.clientY,
        lx: e.clientX,
        ly: e.clientY,
        started: false,
      };
    };
    const onMove = (e: PointerEvent) => {
      const p = ptr;
      if (!p || e.pointerId !== p.id) return;
      const dx = e.clientX - p.lx;
      const dy = e.clientY - p.ly;
      p.lx = e.clientX;
      p.ly = e.clientY;
      if (!p.started) {
        const tx = e.clientX - p.x;
        const ty = e.clientY - p.y;
        if (Math.hypot(tx, ty) < SLOP) return;
        if (
          Math.abs(tx) < Math.abs(ty) * 1.2 ||
          !start(tx > 0 ? "back" : "forward", "pointer")
        ) {
          release();
          return;
        }
        p.started = true;
        moveX(Math.abs(tx));
        return;
      }
      if (g?.by !== "pointer") return;
      if (g.phase === "pull" || g.phase === "armed") {
        moveX(g.side === "back" ? dx : -dx);
        riseArmed(dx, dy);
        // a drag that holds still on the armed arrow opens the panel
        window.clearTimeout(holding);
        if (g.phase === "armed") holding = window.setTimeout(openPanel, HOLD);
      } else if (g.phase === "panel") {
        backOff(g.side === "back" ? dx : -dx, dy);
        moveY(dy);
      }
    };
    const onUp = (e: PointerEvent) => {
      if (!ptr || e.pointerId !== ptr.id) return;
      release();
      if (g?.by !== "pointer") return;
      // the panel closes from where the hand left it, rather than sliding
      // back to its row while it fades
      lift();
    };
    // a cancel, a lost capture or a menu ends the drag with nowhere to go
    const onCancel = (e: PointerEvent) => {
      if (!ptr || e.pointerId !== ptr.id) return;
      abort();
    };
    const onMenu = (e: MouseEvent) => {
      if (!ptr) return;
      e.preventDefault();
      abort();
    };
    // a finger sliding up and down after the pull scrubs, not the page
    const onTouchMove = (e: TouchEvent) => {
      if (ptr?.started) e.preventDefault();
    };

    /*
     * The keyboard is the same gesture: Alt and an arrow open the panel, the
     * held Alt stands in for the resting fingers, and letting go commits
     */
    const onKey = (e: KeyboardEvent) => {
      armSound();
      if (e.key === "Escape" && (g || ptr)) {
        e.preventDefault();
        abort();
        return;
      }
      if (
        !g &&
        !ptr &&
        e.altKey &&
        (e.key === "ArrowLeft" || e.key === "ArrowRight")
      ) {
        e.preventDefault();
        const gk = start(e.key === "ArrowLeft" ? "back" : "forward", "keys");
        if (!gk) return;
        gk.raw = PULL;
        to(pull, 1, OPEN);
        armUp(true);
        openPanel();
        return;
      }
      if (g?.by !== "keys" || g.phase !== "panel") return;
      if (e.key === "ArrowUp" || e.key === "ArrowDown") {
        e.preventDefault();
        cancelLand();
        step(e.key === "ArrowUp" ? -1 : 1);
      } else if (e.key === "Enter") {
        e.preventDefault();
        lift();
      } else if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        e.preventDefault();
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === "Alt" && g?.by === "keys" && g.phase === "panel") lift();
    };
    const onBlur = () => {
      if (g?.by === "keys") dismiss();
    };
    // leaving the window or the tab mid-gesture drops it, so no drag is held
    // past a release the page never saw and no rest commits out of sight
    const onHide = () => {
      if (document.visibilityState === "hidden") abort();
    };

    el.addEventListener("wheel", onWheel, { passive: false });
    el.addEventListener("pointerdown", onDown);
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerup", onUp);
    el.addEventListener("pointercancel", onCancel);
    el.addEventListener("lostpointercapture", onCancel);
    el.addEventListener("contextmenu", onMenu);
    window.addEventListener("blur", abort);
    document.addEventListener("visibilitychange", onHide);
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("keydown", onKey);
    el.addEventListener("keyup", onKeyUp);
    el.addEventListener("blur", onBlur);
    return () => {
      for (const u of unsubs) u();
      ro.disconnect();
      if (run) window.clearTimeout(run.timer);
      window.clearTimeout(holding);
      landing?.stop();
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("pointerdown", onDown);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerup", onUp);
      el.removeEventListener("pointercancel", onCancel);
      el.removeEventListener("lostpointercapture", onCancel);
      el.removeEventListener("contextmenu", onMenu);
      window.removeEventListener("blur", abort);
      document.removeEventListener("visibilitychange", onHide);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("keydown", onKey);
      el.removeEventListener("keyup", onKeyUp);
      el.removeEventListener("blur", onBlur);
    };
  }, [reduce, pull, arm, open, pos, off, close, fade]);

  // the box mounts with the gesture, so its first frame is painted here
  useLayoutEffect(() => {
    if (view) paintRef.current();
  }, [view]);

  const page = HISTORY[index];
  const Caret = view?.side === "forward" ? CaretRightIcon : CaretLeftIcon;
  const shift = dir === "back" ? -12 : 12;

  return (
    <div
      ref={stage}
      role="application"
      // biome-ignore lint/a11y/noNoninteractiveTabindex: the stage takes the gesture's keys itself, the way a canvas does, and `application` tells a reader to pass them through
      tabIndex={0}
      aria-roledescription="history"
      aria-label="History. Swipe sideways with two fingers, or drag, then move up and down to pick a page. Alt and an arrow key open it from the keyboard."
      className={cn(
        "relative h-140 w-full cursor-grab touch-pan-y select-none overflow-hidden overscroll-x-none rounded-lg bg-surface active:cursor-grabbing [-webkit-touch-callout:none]",
        FOCUS,
      )}
    >
      {/* the page's own light: a wash of its hue behind the icon, crossfading
          with the page, over a sheen from the top of the ground */}
      <div
        aria-hidden="true"
        className="absolute inset-0"
        style={{ backgroundImage: SHEEN }}
      />
      <AnimatePresence initial={false}>
        {page && (
          <motion.div
            key={index}
            aria-hidden="true"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduce ? 0 : 0.4, ease: "easeOut" }}
            className="absolute inset-0"
            style={{
              backgroundImage: `radial-gradient(70% 60% at 50% 46%, ${page.hue}21, transparent 78%)`,
            }}
          />
        )}
      </AnimatePresence>

      <div className="absolute inset-0 grid place-items-center">
        <AnimatePresence initial={false} mode="popLayout">
          {page && (
            <motion.div
              key={index}
              initial={reduce ? { opacity: 0 } : { opacity: 0, x: shift }}
              animate={{ opacity: 1, x: 0 }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, x: -shift }}
              transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
              className="flex flex-col items-center gap-4"
            >
              <span
                className="grid size-18 place-items-center rounded-2xl border border-stroke bg-bg"
                style={{ boxShadow: tileShadow(page.hue) }}
              >
                <page.Mark className="size-8" />
              </span>
              <span className="flex flex-col items-center gap-0.5">
                <span className="text-lead text-text-primary">
                  {page.title}
                </span>
                <span className="text-meta text-text-muted">{page.host}</span>
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div
        aria-hidden="true"
        className="absolute inset-x-0 bottom-6 flex items-center justify-center gap-1.5"
      >
        {HISTORY.map((entry, i) => (
          <span
            key={entry.title}
            className={cn(
              "size-1.5 rounded-full transition-colors duration-200",
              i === index ? "bg-text-primary" : "bg-stroke-strong",
            )}
          />
        ))}
      </div>

      {view && (
        <>
          <div
            ref={box}
            aria-hidden="true"
            // the 1px edge is part of the panel arithmetic, so it stays and is
            // drawn by the glass's own inset edge instead of a stroke
            className="absolute top-0 left-0 overflow-hidden border border-transparent backdrop-blur-md backdrop-saturate-150 will-change-transform"
            style={{
              boxShadow: GLASS_EDGE,
              backgroundImage: GLASS_FILL,
              width: DISC,
              height: DISC,
            }}
          >
            {/* the rows and the highlight take their px sizes from `scrub.ts`,
                since the panel is placed by that arithmetic and `--spacing`
                is not 4px on this site */}
            <div
              ref={highlight}
              className="absolute top-0 overflow-hidden rounded-lg bg-text-primary/6"
              style={{ left: PAD, right: PAD, height: ROW }}
            ></div>
            <div
              ref={rows}
              className="absolute"
              style={{ top: PAD, left: PAD, right: PAD }}
            >
              {HISTORY.slice(view.from, view.from + view.count).map(
                (entry, i) => (
                  <div
                    key={entry.title}
                    style={{ height: ROW }}
                    className={cn(
                      "relative flex items-center gap-2.5 px-2 text-action transition-colors duration-150",
                      i === sel ? "text-text-primary" : "text-text-secondary",
                    )}
                  >
                    <span className="grid size-6 shrink-0 place-items-center rounded-md border border-stroke-soft bg-bg">
                      <entry.Mark className="size-3.5" />
                    </span>
                    <span className="truncate">{entry.title}</span>
                  </div>
                ),
              )}
            </div>
          </div>
          <div
            ref={chevron}
            aria-hidden="true"
            className={cn(
              "pointer-events-none absolute top-0 left-0 grid place-items-center transition-colors duration-150",
              armed ? "text-text-primary" : "text-text-muted",
            )}
            style={{ width: DISC, height: DISC }}
          >
            <Caret className="size-5" />
          </div>
        </>
      )}

      <span aria-live="polite" className="sr-only">
        {said}
      </span>
    </div>
  );
}
