"use client";

import { animate, useMotionValue, useReducedMotion } from "motion/react";
import {
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { TextMorph } from "torph/react";
import { cn } from "@/lib/utils";
import {
  advance,
  GROW_H,
  GROW_W,
  growOf,
  inkBox,
  LID_CENTRE,
  lidAngle,
  RESET_MS,
  SLIP,
  TAP_MS,
  TICKS,
  tickOf,
  tossOf,
} from "./hold";
import { armHold, buzz, latch, nudge, thump, tick, unwind } from "./hold-sound";
import { HINGE, Trash } from "./trash";

/*
 * A delete button you hold, and nothing else on the stage. `hold.ts` is the
 * numbers, `hold-sound.ts` the ratchet, `trash.tsx` the bin with a lid on a
 * hinge. This file is the gesture and the loop.
 *
 * **The fill is a drop of ink that spreads from the press.** It is a red copy
 * of the button over the button, clipped to a pill that grows out of the
 * finger, so the label turns white exactly where the ink is and nowhere else.
 *
 * **Nothing renders while a hand is down.** The fill, the lid and the button's
 * size are written to the DOM from one frame loop and a few motion values.
 * React hears about a hold when it ends in a tap and when it completes.
 *
 * **Five motions, and each answers one moment.** The button swells as the hold
 * builds and squashes back when it lands. The lid lifts and rattles through the
 * hold, then flies off on the landing, spins and drops back onto the bin. The
 * ink spreads from the press and, on the reset, drains back into it.
 */

type Hint = "none" | "hold" | "again";

interface Model {
  p: number;
  held: boolean;
  /** the button has fired and holds its red until it resets */
  done: boolean;
  /** where the press landed, 0 to 1 across the button */
  origin: number;
  /** 1 for a hand, faster for the screen reader's second press */
  rate: number;
  pointer: number;
  pressAt: number;
  /** the button's box at the press, for the slip test */
  rect: DOMRect | null;
  tick: number;
  raf: number;
  last: number;
  t: number;
  /** the button's resting size, measured whenever it is not grown */
  w0: number;
  h0: number;
  /** how many holds have landed, so every other toss is a double flip */
  count: number;
  /** a key is the hand, so its release is the lift */
  key: boolean;
  keyUpAt: number;
  /** when the screen reader's first press armed the second */
  armedAt: number;
}

export default function HoldConfirm() {
  const button = useRef<HTMLButtonElement>(null);
  const overlay = useRef<HTMLSpanElement>(null);
  const pulse = useRef<HTMLSpanElement>(null);
  const lidBase = useRef<SVGGElement>(null);
  const lidInk = useRef<SVGGElement>(null);
  const timers = useRef<number[]>([]);
  const hintTimer = useRef(0);

  const reduceValue = useReducedMotion() ?? false;
  const reduce = useRef(reduceValue);
  reduce.current = reduceValue;

  const model = useRef<Model>({
    p: 0,
    held: false,
    done: false,
    origin: 0.5,
    rate: 1,
    pointer: -1,
    pressAt: 0,
    rect: null,
    tick: 0,
    raf: 0,
    last: 0,
    t: 0,
    w0: 0,
    h0: 0,
    count: 0,
    key: false,
    keyUpAt: 0,
    armedAt: 0,
  });

  const [done, setDone] = useState(false);
  const [hint, setHint] = useState<Hint>("none");
  const [message, setMessage] = useState("");

  /** how far the lid is open on its hinge, in degrees */
  const lid = useMotionValue(0);
  /** the toss: the lid's offset in the 24 unit box, and its spin */
  const lidX = useMotionValue(0);
  const lidY = useMotionValue(0);
  const spin = useMotionValue(0);
  /** how much the button has grown, 0 at rest and 1 at a full hold */
  const grow = useMotionValue(0);

  const later = useCallback((fn: () => void, ms: number) => {
    timers.current.push(window.setTimeout(fn, ms));
  }, []);

  /*
   * Both bins read one transform, so the white one and the red one under it
   * can never disagree about where the lid is. A tossed lid leaves the pill,
   * and the red bin under the ink is what draws it out there, since the ink's
   * copy is clipped to the pill: the lid turns red as it crosses the edge.
   */
  useEffect(() => {
    const write = () => {
      const turn = `translate(${lidX.get()} ${lidY.get()}) rotate(${spin.get()} ${LID_CENTRE}) rotate(${-lid.get()} ${HINGE})`;
      lidBase.current?.setAttribute("transform", turn);
      lidInk.current?.setAttribute("transform", turn);
    };
    const off = [lid, lidX, lidY, spin].map((v) => v.on("change", write));
    return () => {
      for (const f of off) f();
    };
  }, [lid, lidX, lidY, spin]);

  const paint = useCallback(() => {
    const s = model.current;
    const el = overlay.current;
    const b = button.current;
    if (!el || !b || s.w0 === 0) return;
    const box = inkBox(s.p, s.origin, b.offsetWidth, b.offsetHeight);
    el.style.clipPath =
      s.p <= 0
        ? "inset(50% 50% 50% 50%)"
        : `inset(${box.top}px ${box.right}px ${box.bottom}px ${box.left}px round 999px)`;
    if (!s.done) lid.set(reduce.current ? 0 : lidAngle(s.p, s.t));
  }, [lid]);

  useEffect(() => {
    const el = button.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      if (grow.get() !== 0) return;
      model.current.w0 = el.offsetWidth;
      model.current.h0 = el.offsetHeight;
      paint();
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [grow, paint]);

  /*
   * The button's size, written from one value. Width and height in px rather
   * than a scale, so the label never resamples, and back to the stylesheet's
   * own size at rest. The ink's clip is read off the box just written, so the
   * two can never be a frame apart.
   */
  useEffect(
    () =>
      grow.on("change", (g) => {
        const s = model.current;
        const el = button.current;
        if (!el || s.w0 === 0) return;
        if (g === 0) {
          el.style.width = "";
          el.style.height = "";
        } else {
          el.style.width = `${s.w0 + GROW_W * g}px`;
          el.style.height = `${s.h0 + GROW_H * g}px`;
        }
        paint();
      }),
    [grow, paint],
  );

  /* ----------------------------------------------------------- the commit */

  const commit = useCallback(() => {
    const s = model.current;
    s.held = false;
    s.done = true;
    s.p = 1;
    s.rate = 1;
    cancelAnimationFrame(s.raf);
    s.raf = 0;
    s.last = 0;
    paint();
    setDone(true);
    setHint("none");
    setMessage("Deleted.");
    latch();
    buzz([16, 40, 24]);

    const r = reduce.current;
    if (r) {
      lid.set(0);
      grow.set(0);
      thump();
    } else {
      // the button lets go of its swell and squashes past its own size
      animate(grow, 0, { type: "spring", stiffness: 620, damping: 13 });

      const ring = pulse.current;
      const b = button.current;
      if (ring && b) {
        // grown by the same 10px on every side, so a wide pill does not
        // balloon sideways while its height barely moves
        const w = b.offsetWidth;
        const h = b.offsetHeight;
        ring.animate(
          [
            { opacity: 0.45, transform: "scale(1, 1)" },
            {
              opacity: 0,
              transform: `scale(${(w + 20) / w}, ${(h + 20) / h})`,
            },
          ],
          { duration: 520, easing: "cubic-bezier(0.23, 1, 0.32, 1)" },
        );
      }

      // the lid is kicked off, spins, and drops back onto the bin
      s.count += 1;
      const toss = tossOf(s.origin, s.count);
      const air = 0.54;
      animate(lid, 0, { duration: 0.12, ease: "easeOut" });
      animate(lidY, [0, -toss.height, 0, -5, 0], {
        duration: air / 0.8,
        times: [0, 0.44, 0.8, 0.9, 1],
        ease: ["easeOut", "easeIn", "easeOut", "easeIn"],
      });
      animate(lidX, [0, toss.drift, 0], {
        duration: air,
        times: [0, 0.44, 1],
        ease: ["easeOut", "easeIn"],
      });
      animate(spin, [0, toss.turns * 360], {
        duration: air,
        ease: [0.3, 0.55, 0.4, 1],
      }).then(() => spin.set(0));
      // it lands with a clack and rocks once on the rim
      later(() => {
        thump();
        buzz(12);
        animate(lid, [0, 7, 0], { duration: 0.22, ease: "easeOut" });
      }, air * 1000);
    }

    // nothing real was deleted, so the button puts itself back: the ink drains
    // back into the point it came out of, the same drop run backwards
    later(() => {
      setDone(false);
      setMessage("");
      const finish = () => {
        s.done = false;
        s.p = 0;
        paint();
      };
      if (r) {
        finish();
        return;
      }
      unwind(0.6);
      animate(1, 0, {
        duration: 0.42,
        ease: [0.65, 0, 0.35, 1],
        onUpdate: (v) => {
          s.p = v;
          paint();
        },
        onComplete: finish,
      });
    }, RESET_MS);
  }, [grow, later, lid, lidX, lidY, paint, spin]);

  /* -------------------------------------------------------------- the loop */

  const frame = useCallback(
    (now: number) => {
      const s = model.current;
      const dt = s.last ? Math.min(0.05, (now - s.last) / 1000) : 0;
      s.last = now;
      s.t += dt;
      s.p = advance(s.p, s.held, dt * s.rate);
      if (!s.held && reduce.current) s.p = 0;
      if (!reduce.current) grow.set(growOf(s.p));

      const k = tickOf(s.p);
      if (s.held && k > s.tick && k < TICKS) {
        tick(s.p);
        buzz(6);
      }
      // a drain walks the ratchet back down, so a press that catches it
      // ticks again from wherever the fill is
      s.tick = k;
      paint();

      if (s.held && s.p >= 1) {
        commit();
        return;
      }
      if (s.held || s.p > 0) s.raf = requestAnimationFrame(frame);
      else {
        s.raf = 0;
        s.last = 0;
      }
    },
    [commit, grow, paint],
  );

  const kick = useCallback(() => {
    const s = model.current;
    if (!s.raf) s.raf = requestAnimationFrame(frame);
  }, [frame]);

  /* ----------------------------------------------------------- the gesture */

  const showHint = useCallback((which: Hint) => {
    setHint(which);
    clearTimeout(hintTimer.current);
    hintTimer.current = window.setTimeout(
      () => setHint("none"),
      which === "again" ? 4000 : 1600,
    );
  }, []);

  const start = useCallback(
    (origin: number, pointer: number) => {
      const s = model.current;
      if (s.done || s.held) return;
      s.held = true;
      s.origin = origin;
      s.pointer = pointer;
      s.pressAt = performance.now();
      s.tick = tickOf(s.p);
      s.rate = 1;
      setHint("none");
      lid.stop();
      armHold();
      kick();
    },
    [kick, lid],
  );

  const release = useCallback(
    (why: "lift" | "slip" | "cancel") => {
      const s = model.current;
      if (!s.held) return;
      s.held = false;
      s.pointer = -1;
      s.key = false;
      if (s.p >= 1) return;
      const tapped = why === "lift" && performance.now() - s.pressAt < TAP_MS;
      if (tapped) {
        showHint("hold");
        nudge();
        buzz([8, 60, 8]);
        if (!reduce.current) {
          button.current?.animate(
            [
              { transform: "translateX(0)" },
              { transform: "translateX(-4px)" },
              { transform: "translateX(4px)" },
              { transform: "translateX(-3px)" },
              { transform: "translateX(2px)" },
              { transform: "translateX(0)" },
            ],
            { duration: 320, easing: "ease-out" },
          );
        }
      } else if (s.p > 0.05) unwind(s.p);
      kick();
    },
    [kick, showHint],
  );

  const onPointerDown = (e: PointerEvent<HTMLButtonElement>) => {
    if (!e.isPrimary || e.button !== 0 || model.current.held) return;
    const el = e.currentTarget;
    el.setPointerCapture(e.pointerId);
    const rect = el.getBoundingClientRect();
    model.current.rect = rect;
    const origin = (e.clientX - rect.left) / rect.width;
    start(Math.min(1, Math.max(0, origin)), e.pointerId);
  };

  const onPointerMove = (e: PointerEvent<HTMLButtonElement>) => {
    const s = model.current;
    if (!s.held || e.pointerId !== s.pointer || !s.rect) return;
    const r = s.rect;
    const off =
      e.clientX < r.left - SLIP ||
      e.clientX > r.right + SLIP ||
      e.clientY < r.top - SLIP ||
      e.clientY > r.bottom + SLIP;
    if (off) release("slip");
  };

  const onPointerEnd = (e: PointerEvent<HTMLButtonElement>) => {
    if (e.pointerId !== model.current.pointer) return;
    release(e.type === "pointerup" ? "lift" : "cancel");
  };

  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    const s = model.current;
    if (e.key === "Escape" && s.held) {
      e.preventDefault();
      release("cancel");
      return;
    }
    if (e.key !== " " && e.key !== "Enter") return;
    // the default would be a click, which this button answers on its own
    e.preventDefault();
    if (e.repeat || s.held) return;
    s.key = true;
    s.rect = null;
    start(0.5, -1);
  };

  const onKeyUp = (e: KeyboardEvent<HTMLButtonElement>) => {
    const s = model.current;
    if ((e.key !== " " && e.key !== "Enter") || !s.key) return;
    e.preventDefault();
    s.keyUpAt = performance.now();
    release("lift");
  };

  /**
   * A screen reader's click carries no pointer and cannot be held, so it gets
   * the other honest answer to a destructive action: a second press inside
   * four seconds. That press fills the bar quickly rather than skipping it, so
   * a sighted helper watching sees the same thing happen.
   */
  const onClick = (e: MouseEvent<HTMLButtonElement>) => {
    const s = model.current;
    if (s.done || e.detail !== 0) return;
    const now = performance.now();
    if (now - s.keyUpAt < 80) return;
    if (s.armedAt && now - s.armedAt < 4000) {
      s.armedAt = 0;
      start(0.5, -1);
      s.rate = 4;
      return;
    }
    s.armedAt = now;
    showHint("again");
    setMessage("Press again to delete.");
  };

  /* ------------------------------------------------------------- the edges */

  useEffect(() => {
    const onBlur = () => release("cancel");
    // a mouse hold may not have focus, so Escape is heard on the window
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape" && model.current.held) release("cancel");
    };
    const onVisible = () => {
      if (document.hidden) release("cancel");
    };
    window.addEventListener("blur", onBlur);
    window.addEventListener("keydown", onKey);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [release]);

  useEffect(() => {
    const s = model.current;
    const t = timers;
    return () => {
      cancelAnimationFrame(s.raf);
      t.current.forEach(clearTimeout);
      clearTimeout(hintTimer.current);
    };
  }, []);

  /* ---------------------------------------------------------------- render */

  const label = done
    ? "Deleted"
    : hint === "hold"
      ? "Press and hold"
      : hint === "again"
        ? "Press again to delete"
        : "Hold to delete";

  const row = (lidRef: typeof lidBase) => (
    <>
      <Trash lidRef={lidRef} className="size-5" />
      <span className="whitespace-nowrap text-action">
        <TextMorph duration={200} ease="cubic-bezier(0.4, 0, 0.2, 1)">
          {label}
        </TextMorph>
      </span>
    </>
  );

  return (
    <div className="relative flex aspect-8/5 min-h-78 w-full select-none items-center justify-center overflow-hidden rounded-lg bg-fill">
      <div className="relative">
        <span
          ref={pulse}
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 rounded-full border-2 border-danger opacity-0"
        />
        <button
          ref={button}
          type="button"
          aria-label="Delete"
          aria-describedby="hold-confirm-help"
          aria-disabled={done || undefined}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerEnd}
          onPointerCancel={onPointerEnd}
          onLostPointerCapture={onPointerEnd}
          onKeyDown={onKeyDown}
          onKeyUp={onKeyUp}
          onClick={onClick}
          onBlur={() => release("cancel")}
          onContextMenu={(e) => e.preventDefault()}
          className={cn(
            "relative flex h-12 w-60 touch-none items-center justify-center gap-2 rounded-full bg-bg text-danger transition-colors duration-200 [-webkit-touch-callout:none]",
            "shadow-[0_1px_2px_rgb(0_0_0/0.05),0_6px_16px_-8px_rgb(0_0_0/0.14)]",
            "hover:bg-surface",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-primary/15 focus-visible:ring-offset-2 focus-visible:ring-offset-fill",
            done ? "cursor-default" : "cursor-pointer",
          )}
        >
          {row(lidBase)}
          {/* the ink: the same row in white on red, clipped by the loop */}
          <span
            ref={overlay}
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 flex items-center justify-center gap-2 rounded-full bg-danger text-bg shadow-[inset_0_1px_0_rgb(255_255_255/0.18)]"
            style={{ clipPath: "inset(50% 50% 50% 50%)" }}
          >
            {row(lidInk)}
          </span>
        </button>
      </div>

      <p id="hold-confirm-help" className="sr-only">
        Press and hold for about a second. With a screen reader, activate it
        twice.
      </p>
      <span aria-live="polite" className="sr-only">
        {message}
      </span>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 rounded-lg ring-1 ring-stroke ring-inset"
      />
    </div>
  );
}
