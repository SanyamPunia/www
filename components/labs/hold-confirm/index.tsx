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
import {
  ArrowCounterClockwiseIcon,
  ArrowUUpLeftIcon,
  FileTextIcon,
  SpeakerHighIcon,
  SpeakerSlashIcon,
} from "@/components/icons";
import { Tooltip, TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  advance,
  FLIGHT_MS,
  flight,
  inkBox,
  LID_OPEN,
  lidAngle,
  SLIP,
  TAP_MS,
  TICKS,
  tickOf,
  UNDO_S,
} from "./hold";
import {
  armHold,
  buzz,
  latch,
  nudge,
  restore,
  settle,
  thump,
  tick,
  unwind,
} from "./hold-sound";
import { HINGE, Trash } from "./trash";

/*
 * A delete button you hold. `hold.ts` is the numbers, `hold-sound.ts` the
 * ratchet, `trash.tsx` the bin with a lid on a hinge. This file is the
 * gesture, the loop and the five phases.
 *
 * **The fill is a drop of ink that spreads from the press.** It is a red copy
 * of the button over the button, clipped to a pill that grows out of the
 * finger, so the label turns white exactly where the ink is and nowhere else.
 * Timing a colour change on the label could never land on the ink's edge.
 *
 * **Nothing renders while a hand is down.** The fill, the lid and the ratchet
 * are written to the DOM from one frame loop. React hears about a hold twice,
 * when it ends early with a tap and when it completes.
 */

type Phase = "idle" | "committing" | "undo" | "restoring" | "gone";
type Hint = "none" | "hold" | "again";

const FILE = "q3-report.pdf";

interface Model {
  p: number;
  held: boolean;
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
  w: number;
  h: number;
  /** a key is the hand, so its release is the lift */
  key: boolean;
  keyUpAt: number;
  /** when the screen reader's first press armed the second */
  armedAt: number;
  sound: boolean;
}

/** a crossfade between two states that occupy one place */
const SWAP =
  "transition-[opacity,filter,translate] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)]";

export default function HoldConfirm() {
  const stage = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const overlay = useRef<HTMLSpanElement>(null);
  const pulse = useRef<HTMLSpanElement>(null);
  const tile = useRef<HTMLDivElement>(null);
  const ghost = useRef<HTMLDivElement>(null);
  const bin = useRef<SVGSVGElement>(null);
  const lidBase = useRef<SVGGElement>(null);
  const lidInk = useRef<SVGGElement>(null);
  const ring = useRef<SVGCircleElement>(null);
  const countdown = useRef<Animation | null>(null);
  const timers = useRef<number[]>([]);
  const hintTimer = useRef(0);
  /*
   * The undo's clock stops while it is being looked at, the way Sonner pauses
   * a toast, and while the tab is hidden. `hover` is cleared when the clock
   * starts and only a fresh `pointerenter` sets it: the hand that held the
   * button is already on the card, and a clock that never moved would read as
   * broken.
   */
  const pause = useRef({ hover: false, hidden: false });

  const reduceValue = useReducedMotion() ?? false;
  const reduce = useRef(reduceValue);
  reduce.current = reduceValue;

  const model = useRef<Model>({
    p: 0,
    held: false,
    origin: 0.5,
    rate: 1,
    pointer: -1,
    pressAt: 0,
    rect: null,
    tick: 0,
    raf: 0,
    last: 0,
    t: 0,
    w: 0,
    h: 0,
    key: false,
    keyUpAt: 0,
    armedAt: 0,
    sound: true,
  });
  const phaseRef = useRef<Phase>("idle");

  const [phase, setPhaseState] = useState<Phase>("idle");
  const [home, setHome] = useState(true);
  /*
   * The row's words change a beat after the file leaves it, so the file does
   * not take off over the text that announces it has gone. `home` is the
   * tile, `vacant` is the words.
   */
  const [vacant, setVacant] = useState(false);
  const [hint, setHint] = useState<Hint>("none");
  const [loud, setLoud] = useState(true);
  const [message, setMessage] = useState("");

  const lid = useMotionValue(0);

  const setPhase = useCallback((next: Phase) => {
    phaseRef.current = next;
    setPhaseState(next);
  }, []);

  const later = useCallback((fn: () => void, ms: number) => {
    timers.current.push(window.setTimeout(fn, ms));
  }, []);

  // both copies of the lid read one value, so the white bin and the red bin
  // under it can never disagree about how open they are
  useEffect(
    () =>
      lid.on("change", (v) => {
        const turn = `rotate(${-v} ${HINGE})`;
        lidBase.current?.setAttribute("transform", turn);
        lidInk.current?.setAttribute("transform", turn);
      }),
    [lid],
  );

  /* ---------------------------------------------------------------- paint */

  const paint = useCallback(() => {
    const s = model.current;
    const el = overlay.current;
    if (!el || s.w === 0) return;
    const box = inkBox(s.p, s.origin, s.w, s.h);
    el.style.clipPath =
      s.p <= 0
        ? "inset(50% 50% 50% 50%)"
        : `inset(${box.top}px ${box.right}px ${box.bottom}px ${box.left}px round 999px)`;
    if (phaseRef.current === "idle") {
      lid.set(reduce.current ? 0 : lidAngle(s.p, s.t));
    }
  }, [lid]);

  useEffect(() => {
    const el = button.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      model.current.w = el.offsetWidth;
      model.current.h = el.offsetHeight;
      paint();
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [paint]);

  /* ---------------------------------------------------------- the commit */

  /** send the ghost between the row and the bin, and wait for it to land */
  const fly = useCallback(async (out: boolean) => {
    const g = ghost.current;
    const st = stage.current?.getBoundingClientRect();
    const a = tile.current?.getBoundingClientRect();
    const b = bin.current?.getBoundingClientRect();
    if (!g || !st || !a || !b) return;
    const row = {
      x: a.left - st.left + a.width / 2,
      y: a.top - st.top + a.height / 2,
    };
    // the bin's mouth, a little above its middle, which is where a file goes
    const mouth = {
      x: b.left - st.left + b.width / 2,
      y: b.top - st.top + b.height * 0.4,
    };
    const end = b.width / a.width;
    const frames = out
      ? flight(mouth, row, a.width, end, true)
      : flight(row, mouth, a.width, end, false);
    g.style.width = `${a.width}px`;
    g.style.height = `${a.height}px`;
    g.style.display = "grid";
    const run = g.animate(frames, {
      duration: FLIGHT_MS,
      easing: "linear",
      fill: "forwards",
    });
    try {
      await run.finished;
    } catch {
      // cancelled by an unmount, and the ghost goes with it
    }
    g.style.display = "none";
    run.cancel();
  }, []);

  const expire = useCallback(() => {
    countdown.current = null;
    setPhase("gone");
    setMessage(`${FILE} was deleted for good.`);
  }, [setPhase]);

  const syncPause = useCallback(() => {
    const run = countdown.current;
    if (!run) return;
    const { hover, hidden } = pause.current;
    if (hover || hidden) run.pause();
    else if (run.playState === "paused") run.play();
  }, []);

  /** the undo's clock, drawn as a ring that drains, and paused while looked at */
  const startCountdown = useCallback(() => {
    const el = ring.current;
    if (!el) return;
    countdown.current?.cancel();
    const run = el.animate([{ strokeDashoffset: 0 }, { strokeDashoffset: 1 }], {
      duration: UNDO_S * 1000,
      easing: "linear",
      fill: "forwards",
    });
    countdown.current = run;
    pause.current.hover = false;
    syncPause();
    run.finished.then(
      () => {
        if (countdown.current === run) expire();
      },
      () => undefined,
    );
  }, [expire, syncPause]);

  const commit = useCallback(async () => {
    const s = model.current;
    s.held = false;
    s.p = 1;
    s.rate = 1;
    cancelAnimationFrame(s.raf);
    s.raf = 0;
    s.last = 0;
    paint();
    setPhase("committing");
    setHint("none");
    setMessage(`Deleting ${FILE}.`);
    if (s.sound) latch();
    buzz([16, 40, 24]);

    const r = reduce.current;
    const ring = pulse.current;
    if (ring && !r && s.w > 0) {
      // grown by the same 10px on every side, so a wide pill does not
      // balloon sideways while its height barely moves
      ring.animate(
        [
          { opacity: 0.45, transform: "scale(1, 1)" },
          {
            opacity: 0,
            transform: `scale(${(s.w + 20) / s.w}, ${(s.h + 20) / s.h})`,
          },
        ],
        { duration: 520, easing: "cubic-bezier(0.23, 1, 0.32, 1)" },
      );
    }

    if (r) {
      setHome(false);
      setVacant(true);
      lid.set(0);
    } else {
      // the lid stays wide for the file, then slams once it is in
      lid.stop();
      animate(lid, LID_OPEN + 4, { duration: 0.12, ease: "easeOut" });
      setHome(false);
      later(() => setVacant(true), 260);
      await fly(false);
      animate(lid, [lid.get(), 0, 7, 0], {
        duration: 0.34,
        times: [0, 0.38, 0.62, 1],
        ease: ["easeIn", "easeOut", "easeIn"],
      });
    }
    if (s.sound) thump();
    buzz(14);

    setPhase("undo");
    setMessage(`${FILE} moved to trash. Undo is available for 5 seconds.`);
    startCountdown();
    // the ink fades with the overlay, and is put back to nothing after
    later(() => {
      s.p = 0;
      paint();
    }, 260);
  }, [fly, later, lid, paint, setPhase, startCountdown]);

  const bringBack = useCallback(async () => {
    const from = phaseRef.current;
    if (from !== "undo" && from !== "gone") return;
    countdown.current?.cancel();
    countdown.current = null;
    setPhase("restoring");
    const s = model.current;
    if (s.sound) restore();
    if (reduce.current) {
      setHome(true);
      setVacant(false);
      setPhase("idle");
      setMessage(`${FILE} restored.`);
      return;
    }
    // the bin comes back into view first, so the file has somewhere to leave
    await new Promise((r) => later(() => r(null), 140));
    animate(lid, LID_OPEN, { duration: 0.16, ease: [0.23, 1, 0.32, 1] });
    await fly(true);
    setHome(true);
    setVacant(false);
    if (s.sound) settle();
    animate(lid, 0, { duration: 0.24, ease: [0.23, 1, 0.32, 1] });
    setPhase("idle");
    setMessage(`${FILE} restored.`);
  }, [fly, later, lid, setPhase]);

  /* ------------------------------------------------------------- the loop */

  const frame = useCallback(
    (now: number) => {
      const s = model.current;
      const dt = s.last ? Math.min(0.05, (now - s.last) / 1000) : 0;
      s.last = now;
      s.t += dt;
      s.p = advance(s.p, s.held, dt * s.rate);
      if (!s.held && reduce.current) s.p = 0;

      const k = tickOf(s.p);
      if (s.held && k > s.tick && k < TICKS) {
        if (s.sound) tick(s.p);
        buzz(6);
      }
      // a drain walks the ratchet back down, so a press that catches it
      // ticks again from wherever the fill is
      s.tick = k;
      paint();

      if (s.held && s.p >= 1) {
        void commit();
        return;
      }
      if (s.held || s.p > 0) s.raf = requestAnimationFrame(frame);
      else {
        s.raf = 0;
        s.last = 0;
      }
    },
    [commit, paint],
  );

  const kick = useCallback(() => {
    const s = model.current;
    if (!s.raf) s.raf = requestAnimationFrame(frame);
  }, [frame]);

  /* --------------------------------------------------------- the gesture */

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
      if (phaseRef.current !== "idle" || s.held) return;
      s.held = true;
      s.origin = origin;
      s.pointer = pointer;
      s.pressAt = performance.now();
      s.tick = tickOf(s.p);
      s.rate = 1;
      setHint("none");
      lid.stop();
      if (s.sound) armHold();
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
        if (s.sound) nudge();
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
      } else if (s.p > 0.05 && s.sound) unwind(s.p);
      kick();
    },
    [kick, showHint],
  );

  const onPointerDown = (e: PointerEvent<HTMLButtonElement>) => {
    if (phaseRef.current !== "idle") return;
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
    if (phaseRef.current !== "idle") return;
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
    const p = phaseRef.current;
    if (p === "undo" || p === "gone") {
      void bringBack();
      return;
    }
    const s = model.current;
    if (p !== "idle" || e.detail !== 0) return;
    if (performance.now() - s.keyUpAt < 80) return;
    const now = performance.now();
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

  /* ------------------------------------------------------- the edges */

  useEffect(() => {
    const onBlur = () => release("cancel");
    // a mouse hold may not have focus, so Escape is heard on the window
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape" && model.current.held) release("cancel");
    };
    window.addEventListener("keydown", onKey);
    const onVisible = () => {
      pause.current.hidden = document.hidden;
      syncPause();
      if (document.hidden) release("cancel");
    };
    window.addEventListener("blur", onBlur);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [release, syncPause]);

  useEffect(() => {
    const s = model.current;
    const t = timers;
    return () => {
      cancelAnimationFrame(s.raf);
      countdown.current?.cancel();
      t.current.forEach(clearTimeout);
      clearTimeout(hintTimer.current);
    };
  }, []);

  const toggleSound = () => {
    const s = model.current;
    s.sound = !s.sound;
    setLoud(s.sound);
    if (s.sound) armHold();
  };

  /* ------------------------------------------------------------- render */

  const label =
    phase === "committing"
      ? "Deleted"
      : hint === "hold"
        ? "Press and hold"
        : hint === "again"
          ? "Press again to delete"
          : "Hold to delete";
  const showIdle =
    phase === "idle" || phase === "committing" || phase === "restoring";
  const inkOn = phase === "idle" || phase === "committing";
  const busy = phase === "committing" || phase === "restoring";
  const soundLabel = loud ? "Turn the sound off" : "Turn the sound on";

  const shown = "opacity-100 blur-none";
  const hidden = "opacity-0 blur-[2px]";

  const idleContent = (lidRef: typeof lidBase, svgRef?: typeof bin) => (
    <>
      <Trash lidRef={lidRef} svgRef={svgRef} className="size-4" />
      <span className="whitespace-nowrap text-action">
        <TextMorph duration={200} ease="cubic-bezier(0.4, 0, 0.2, 1)">
          {label}
        </TextMorph>
      </span>
    </>
  );

  return (
    <TooltipProvider delayDuration={200}>
      <div
        ref={stage}
        className="relative flex aspect-8/5 min-h-78 w-full select-none items-center justify-center overflow-hidden rounded-lg bg-fill"
      >
        <div
          className="flex w-[min(20rem,calc(100%-2rem))] flex-col gap-3 rounded-[1.8rem] bg-bg p-3"
          style={{
            boxShadow:
              "0 1px 2px rgba(0,0,0,0.04), 0 14px 36px -14px rgba(0,0,0,0.16)",
          }}
          onPointerEnter={(e) => {
            if (e.pointerType !== "mouse") return;
            pause.current.hover = true;
            syncPause();
          }}
          onPointerLeave={() => {
            pause.current.hover = false;
            syncPause();
          }}
        >
          {/* the row: the file, and the empty slot it leaves */}
          <div className="flex items-center gap-3 px-1.5 pt-1.5">
            <div ref={tile} className="relative size-10 shrink-0">
              <div
                className={cn(
                  "absolute inset-0 grid place-items-center rounded-lg bg-fill text-text-secondary transition-opacity duration-150",
                  home ? "opacity-100" : "opacity-0",
                )}
              >
                <FileTextIcon className="size-5" />
              </div>
              <div
                className={cn(
                  "absolute inset-0 rounded-lg border border-stroke-strong border-dashed transition-opacity duration-200",
                  home ? "opacity-0" : "opacity-100",
                )}
              />
            </div>
            <div className="grid min-w-0 flex-1">
              <div
                className={cn(
                  "col-start-1 row-start-1 flex min-w-0 flex-col",
                  SWAP,
                  vacant ? cn(hidden, "motion-safe:-translate-y-0.5") : shown,
                )}
              >
                <span className="truncate text-body text-text-primary normal-case">
                  {FILE}
                </span>
                <span className="flex items-center gap-1.5 text-meta text-text-muted normal-case">
                  <span>2.4 MB</span>
                  <span
                    aria-hidden="true"
                    className="inline-block size-1 shrink-0 rounded-full bg-stroke-strong"
                  />
                  <span>edited 2h ago</span>
                </span>
              </div>
              <div
                className={cn(
                  "col-start-1 row-start-1 flex min-w-0 flex-col",
                  SWAP,
                  vacant ? shown : cn(hidden, "motion-safe:translate-y-0.5"),
                )}
              >
                <span className="text-body text-text-secondary">
                  {phase === "gone" ? "Deleted" : "Moved to trash"}
                </span>
                <span className="text-meta text-text-muted">
                  {phase === "gone"
                    ? "Nothing left to undo"
                    : "Undo within 5 seconds"}
                </span>
              </div>
            </div>
          </div>

          {/* the button, and the ring it throws when it lets go */}
          <div className="relative">
            <span
              ref={pulse}
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 rounded-full border-2 border-danger opacity-0"
            />
            <button
              ref={button}
              type="button"
              aria-label={
                phase === "undo"
                  ? `Undo deleting ${FILE}`
                  : phase === "gone"
                    ? `Restore ${FILE}`
                    : `Delete ${FILE}`
              }
              aria-describedby={
                phase === "idle" ? "hold-confirm-help" : undefined
              }
              aria-disabled={busy || undefined}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerEnd}
              onPointerCancel={onPointerEnd}
              onLostPointerCapture={onPointerEnd}
              onKeyDown={onKeyDown}
              onKeyUp={onKeyUp}
              onClick={onClick}
              onContextMenu={(e) => e.preventDefault()}
              onBlur={() => release("cancel")}
              className={cn(
                "relative block h-12 w-full touch-none rounded-full transition-colors duration-200 [-webkit-touch-callout:none]",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-primary/15 focus-visible:ring-offset-2",
                busy ? "cursor-default" : "cursor-pointer",
                showIdle
                  ? "bg-danger/10 text-danger hover:bg-danger/15"
                  : "bg-fill text-text-primary hover:bg-fill-hover active:bg-fill-active active:duration-0",
              )}
            >
              {/* idle: the bin and the instruction */}
              <span
                className={cn(
                  "absolute inset-0 flex items-center justify-center gap-2",
                  SWAP,
                  showIdle ? shown : hidden,
                )}
              >
                {idleContent(lidBase, bin)}
              </span>

              {/* the ink: the same row in white on red, clipped by the loop */}
              <span
                ref={overlay}
                aria-hidden="true"
                className={cn(
                  "pointer-events-none absolute inset-0 flex items-center justify-center gap-2 rounded-full bg-danger text-bg shadow-[inset_0_1px_0_rgb(255_255_255/0.18)] transition-opacity duration-200",
                  inkOn ? "opacity-100" : "opacity-0",
                )}
                style={{ clipPath: "inset(50% 50% 50% 50%)" }}
              >
                {idleContent(lidInk)}
              </span>

              {/* undo, with its clock */}
              <span
                className={cn(
                  "absolute inset-0 flex items-center justify-center gap-2",
                  SWAP,
                  phase === "undo" ? shown : hidden,
                )}
              >
                <ArrowUUpLeftIcon className="size-4" />
                <span className="text-action">Undo</span>
                <svg
                  viewBox="0 0 20 20"
                  aria-hidden="true"
                  className="size-3.5 -rotate-90"
                >
                  <circle
                    cx="10"
                    cy="10"
                    r="7.5"
                    fill="none"
                    strokeWidth="2.5"
                    className="stroke-stroke-strong"
                  />
                  <circle
                    ref={ring}
                    cx="10"
                    cy="10"
                    r="7.5"
                    fill="none"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    pathLength={1}
                    strokeDasharray="1 1"
                    className="stroke-text-secondary"
                  />
                </svg>
              </span>

              {/* gone: the demo's way back */}
              <span
                className={cn(
                  "absolute inset-0 flex items-center justify-center gap-2",
                  SWAP,
                  phase === "gone" ? shown : hidden,
                )}
              >
                <ArrowCounterClockwiseIcon className="size-4" />
                <span className="text-action">Restore</span>
              </span>
            </button>
          </div>
        </div>

        {/* the file in the air between the row and the bin */}
        <div
          ref={ghost}
          aria-hidden="true"
          className="pointer-events-none absolute top-0 left-0 z-20 hidden place-items-center rounded-lg bg-fill text-text-secondary shadow-[0_6px_14px_-6px_rgb(0_0_0/0.25)]"
        >
          <FileTextIcon className="size-5" />
        </div>

        <div className="absolute top-3 right-3">
          <Tooltip label={soundLabel}>
            <button
              type="button"
              aria-label={soundLabel}
              aria-pressed={loud}
              onClick={toggleSound}
              className={cn(
                "inline-flex size-7 cursor-pointer items-center justify-center rounded-full bg-fill-hover text-text-secondary transition-colors duration-200",
                // one step up from the site's order, since it sits on `fill`
                "hover:bg-fill-active hover:text-text-primary active:bg-stroke-strong active:duration-0",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-primary/15 focus-visible:ring-offset-2 focus-visible:ring-offset-fill",
              )}
            >
              {loud ? (
                <SpeakerHighIcon className="size-3.5 shrink-0" />
              ) : (
                <SpeakerSlashIcon className="size-3.5 shrink-0" />
              )}
            </button>
          </Tooltip>
        </div>

        <p id="hold-confirm-help" className="sr-only">
          Press and hold for about a second to delete. With a screen reader,
          activate it twice.
        </p>
        <span aria-live="polite" className="sr-only">
          {message}
        </span>
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 rounded-lg ring-1 ring-stroke ring-inset"
        />
      </div>
    </TooltipProvider>
  );
}
