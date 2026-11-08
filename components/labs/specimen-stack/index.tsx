"use client";

import { useReducedMotion } from "motion/react";
import type React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { CaretLeftIcon, CaretRightIcon } from "@/components/icons";
import { Tooltip, TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { CARD, Card } from "./card";
import { formulaText, pad, SPECIMENS } from "./specimens";

/*
 * A fan of specimen cards. Drag sideways, use the arrows or the wheel, and the
 * fan slides under a fixed centre. Press the card in front and it lifts out of
 * the fan and turns over to its data sheet. Press it again to turn it back,
 * and Escape or a press anywhere else puts it back.
 *
 * `specimens.ts` is the data and `card.tsx` one card. This file is the fan:
 * every card's pose is a function of one position, `pos`, and three springs
 * carry the rest: the lift, the flip, and a pointer tilt per card. One frame
 * loop writes a transform and five custom properties per card and stops once
 * everything has settled, so nothing renders while the fan moves.
 */

const N = SPECIMENS.length;

/** substeps per frame, so a stiff spring stays stable at a long frame */
const SUB = 4;

interface S {
  x: number;
  v: number;
}

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

function spring(s: S, target: number, k: number, c: number, dt: number) {
  const a = k * (target - s.x) - c * s.v;
  s.v += a * dt;
  s.x += s.v * dt;
}

const still = (s: S, target: number, e = 0.002) =>
  Math.abs(s.x - target) < e && Math.abs(s.v) < e * 10;

export default function SpecimenStack() {
  const reduce = useReducedMotion() === true;
  const root = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const cardEls = useRef<(HTMLButtonElement | null)[]>([]);
  const nameEl = useRef<HTMLSpanElement>(null);
  const [active, setActive] = useState(0);
  const [sel, setSel] = useState(-1);
  const [said, setSaid] = useState("");

  // everything the loop and the gestures read, kept out of React
  const live = useRef({
    raf: 0,
    last: 0,
    seen: false,
    reduce: false,
    w: 0,
    h: 0,
    /** the card's width on screen, in px */
    W: CARD.w as number,
    pos: { x: 0, v: 0 } as S,
    target: 0,
    dragging: false,
    sel: -1,
    lift: { x: 0, v: 0 } as S,
    liftT: 0,
    flip: { x: 0, v: 0 } as S,
    flipT: 0,
    active: 0,
    pointer: { x: 0, y: 0, inside: false },
    introAt: 0,
    intro: SPECIMENS.map(() => ({ x: 0, v: 0 }) as S),
    introT: SPECIMENS.map(() => 0),
    tx: SPECIMENS.map(() => ({ x: 0, v: 0 }) as S),
    ty: SPECIMENS.map(() => ({ x: 0, v: 0 }) as S),
    down: null as null | {
      x: number;
      pos: number;
      card: number;
      moved: boolean;
    },
    lastX: 0,
    lastT: 0,
    dragV: 0,
    wheel: 0,
    wheelLock: 0,
    /** set by a key press, so the click a button synthesises is not counted */
    keyed: false,
  });

  const announce = useCallback((i: number) => {
    const s = SPECIMENS[i];
    if (s) setSaid(`${s.name}, ${i + 1} of ${N}`);
  }, []);

  const tick = useCallback(
    function frame(now: number) {
      const l = live.current;
      l.raf = 0;
      const stageEl = stage.current;
      if (!stageEl || !l.seen) return;
      const dt = Math.min(0.05, Math.max(0, (now - l.last) / 1000));
      l.last = now;
      const h = dt / SUB;
      const R = l.reduce;

      for (let s = 0; s < SUB; s++) {
        if (!l.dragging) spring(l.pos, l.target, 190, 23, h);
        spring(l.lift, l.liftT, 260, 26, h);
        spring(l.flip, l.flipT, 150, 17, h);
      }
      if (R) {
        if (!l.dragging) {
          l.pos.x = l.target;
          l.pos.v = 0;
        }
        l.lift = { x: l.liftT, v: 0 };
        l.flip = { x: l.flipT, v: 0 };
      }
      // a card that has come all the way back down is no longer inspected
      if (
        l.sel >= 0 &&
        l.liftT === 0 &&
        Math.abs(l.lift.x) < 0.004 &&
        Math.abs(l.flip.x) < 0.5
      ) {
        l.sel = -1;
        l.lift = { x: 0, v: 0 };
        l.flip = { x: 0, v: 0 };
        setSel(-1);
      }

      const pos = l.pos.x;
      const a = clamp(Math.round(pos), 0, N - 1);
      if (a !== l.active) {
        l.active = a;
        setActive(a);
        announce(a);
        // the name under the fan rises in, while its text is swapped under
        // the first faded frames
        if (!R) {
          nameEl.current?.animate(
            [
              { transform: "translateY(8px)", opacity: 0, filter: "blur(4px)" },
              { transform: "none", opacity: 1, filter: "blur(0px)" },
            ],
            { duration: 280, easing: "cubic-bezier(0.2, 0.8, 0.2, 1)" },
          );
        }
      }

      const { w, h: sh, W } = l;
      const k = W / CARD.w;
      const H = W * (CARD.h / CARD.w);
      const cx = w / 2;
      const cy = sh * 0.44;
      const L = clamp(l.lift.x, -0.2, 1.3);
      const lean = clamp(l.pos.v * -3.5, -14, 14);
      // room above and below for the spring's overshoot and the nav row, or
      // an inspected card rises to the stage's top edge
      const maxScale = Math.min(1.28, (sh - 140) / H, (w - 32) / W);
      const focus = l.sel >= 0 ? l.sel : l.active;
      let moving =
        !still(l.pos, l.target) ||
        !still(l.lift, l.liftT) ||
        !still(l.flip, l.flipT, 0.05) ||
        l.dragging;

      for (let i = 0; i < N; i++) {
        const el = cardEls.current[i];
        const I = l.intro[i];
        const tx = l.tx[i];
        const ty = l.ty[i];
        if (!el || !I || !tx || !ty) continue;

        if (now - l.introAt - i * 70 > 0) l.introT[i] = 1;
        const iT = l.introT[i] ?? 0;
        for (let s = 0; s < SUB; s++) spring(I, iT, 120, 16, h);
        if (R) {
          I.x = iT;
          I.v = 0;
        }
        // a card still waiting for its turn to rise keeps the loop alive, or
        // the loop sees every spring at rest before the first is due and stops
        if (!still(I, iT) || (l.introAt && iT === 0)) moving = true;

        const d = i - pos;
        const ad = Math.abs(d);
        let x = (W * 0.55 * d) / (1 + 0.25 * ad);
        let y = ad ** 1.4 * W * 0.04;
        let z = -ad * 70 * k;
        let rz = d * 4.5;
        let ry = (-d * 10) / (1 + 0.3 * ad) + lean;
        let sc = 1 - Math.min(ad, 4) * 0.035;
        let op = clamp(4.2 - ad, 0, 1);
        let dim = Math.min(ad * 0.1, 0.45);
        let zi = 100 - Math.round(ad * 10);

        const isSel = i === l.sel;
        if (l.sel >= 0) {
          const Lc = clamp(L, 0, 1);
          if (isSel) {
            x = lerp(x, 0, L);
            y = lerp(y, -H * 0.02, L);
            z += L * 180 * k;
            rz = lerp(rz, 0, L);
            ry = lerp(ry, 0, Lc);
            sc = lerp(sc, maxScale / (1 + 180 / 1400), Lc);
            dim = lerp(dim, 0, Lc);
            zi = 1000;
          } else {
            y += L * H * 0.22;
            z -= L * 120 * k;
            dim = lerp(dim, 0.6, Lc);
            op *= 1 - Lc * 0.35;
          }
        }

        // the intro: each card rises in from below the stage, turned a little
        y += (1 - I.x) * sh * 0.75;
        rz += (1 - I.x) * (i - N / 2) * 7;
        op *= clamp(I.x * 1.6, 0, 1);

        // the card in front leans toward a hovering pointer, and an inspected
        // card toward the pointer anywhere on the stage
        let tnx = 0;
        let tny = 0;
        if (i === focus && !l.dragging && !R && l.pointer.inside) {
          const px = cx + x;
          const py = cy + y;
          if (l.sel >= 0) {
            tnx = clamp((l.pointer.x - px) / (w * 0.45), -1, 1);
            tny = clamp((l.pointer.y - py) / (sh * 0.45), -1, 1);
          } else {
            const nx = (l.pointer.x - px) / (W * sc * 0.5);
            const ny = (l.pointer.y - py) / (H * sc * 0.5);
            if (Math.abs(nx) < 1.15 && Math.abs(ny) < 1.15) {
              tnx = clamp(nx, -1, 1);
              tny = clamp(ny, -1, 1);
            }
          }
        }
        for (let s = 0; s < SUB; s++) {
          spring(tx, tnx, 170, 18, h);
          spring(ty, tny, 170, 18, h);
        }
        if (!still(tx, tnx) || !still(ty, tny)) moving = true;

        const tilt = isSel ? 1 : 0.85;
        const rX = -ty.x * 13 * tilt;
        const rY = tx.x * 16 * tilt;
        const mag = Math.min(1, Math.hypot(tx.x, ty.x));

        el.style.transform = `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, ${z.toFixed(2)}px) rotateZ(${rz.toFixed(3)}deg) rotateX(${rX.toFixed(3)}deg) rotateY(${(ry + rY + (isSel ? l.flip.x : 0)).toFixed(3)}deg) scale(${(sc * k).toFixed(4)})`;
        el.style.zIndex = String(zi);
        el.style.opacity = op.toFixed(3);
        el.style.visibility = op < 0.01 ? "hidden" : "visible";
        el.style.setProperty("--gx", (50 + tx.x * 42).toFixed(1));
        el.style.setProperty("--gy", (50 + ty.x * 42).toFixed(1));
        el.style.setProperty("--ga", (0.12 + mag * 0.75).toFixed(3));
        el.style.setProperty("--l", isSel ? clamp(L, 0, 1).toFixed(3) : "0");
        el.style.setProperty("--dim", dim.toFixed(3));
      }

      if (moving) l.raf = requestAnimationFrame(frame);
    },
    [announce],
  );

  const kick = useCallback(() => {
    const l = live.current;
    if (l.raf || !l.seen) return;
    l.last = performance.now();
    l.raf = requestAnimationFrame(tick);
  }, [tick]);

  const close = useCallback(() => {
    const l = live.current;
    if (l.sel < 0) return;
    l.liftT = 0;
    l.flipT = 0;
    announce(l.active);
    kick();
  }, [announce, kick]);

  const go = useCallback(
    (i: number) => {
      const l = live.current;
      if (l.sel >= 0) close();
      l.target = clamp(i, 0, N - 1);
      kick();
    },
    [close, kick],
  );

  const open = useCallback(
    (i: number) => {
      const l = live.current;
      const s = SPECIMENS[i];
      if (!s) return;
      l.target = i;
      l.sel = i;
      l.liftT = 1;
      l.flipT = 180;
      setSel(i);
      setSaid(
        `${s.name}. ${formulaText(s.formula)}. Mohs hardness ${s.mohs.join(" to ")}. ${s.system}, ${s.luster.toLowerCase()} luster, from ${s.locality}. ${s.note}`,
      );
      kick();
    },
    [kick],
  );

  const flipOver = useCallback(() => {
    const l = live.current;
    l.flipT = l.flipT > 90 ? 0 : 180;
    kick();
  }, [kick]);

  /** what a press on card `i` means, the same from a pointer and a key */
  const press = useCallback(
    (i: number) => {
      const l = live.current;
      if (l.sel === i && l.liftT) flipOver();
      else if (l.sel >= 0 && l.liftT) close();
      else if (i === l.active && Math.abs(l.pos.x - i) < 0.3) open(i);
      else go(i);
    },
    [close, flipOver, go, open],
  );

  useEffect(() => {
    live.current.reduce = reduce;
    kick();
  }, [kick, reduce]);

  // the card's size from the stage's, and the intro once it is first seen
  useEffect(() => {
    const node = stage.current;
    if (!node) return;
    const l = live.current;
    const size = () => {
      l.w = node.clientWidth;
      l.h = node.clientHeight;
      l.W = Math.round(
        Math.max(110, Math.min(250, l.w * 0.46, (l.h - 140) / 1.5)),
      );
      // the perspective scales with the card, so the fan looks the same at
      // every size
      node.style.perspective = `${Math.round(1400 * (l.W / CARD.w))}px`;
      kick();
    };
    size();
    const ro = new ResizeObserver(size);
    ro.observe(node);
    const io = new IntersectionObserver(([entry]) => {
      const was = l.seen;
      l.seen = entry?.isIntersecting ?? false;
      if (l.seen && !was && !l.introAt) l.introAt = performance.now() + 180;
      if (l.seen) kick();
    });
    io.observe(node);
    return () => {
      ro.disconnect();
      io.disconnect();
      cancelAnimationFrame(l.raf);
      l.raf = 0;
    };
  }, [kick]);

  // keyboard focus follows the card in front
  useEffect(() => {
    const el = document.activeElement;
    if (
      el instanceof HTMLElement &&
      el.dataset.card !== undefined &&
      root.current?.contains(el)
    ) {
      cardEls.current[active]?.focus({ preventScroll: true });
    }
  }, [active]);

  // The keys are the demo's while the pointer is over it or the focus is in
  // it, and the page's everywhere else.
  useEffect(() => {
    const l = live.current;
    const onKey = (e: KeyboardEvent) => {
      const r = root.current;
      if (!r || (!l.pointer.inside && !r.contains(document.activeElement)))
        return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const onNav =
        document.activeElement instanceof HTMLElement &&
        document.activeElement.dataset.nav !== undefined;
      if (e.key === "ArrowRight") {
        e.preventDefault();
        go(l.target + 1);
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        go(l.target - 1);
      } else if (e.key === "Home") {
        e.preventDefault();
        go(0);
      } else if (e.key === "End") {
        e.preventDefault();
        go(N - 1);
      } else if ((e.key === "Enter" || e.key === " ") && !onNav) {
        e.preventDefault();
        l.keyed = true;
        setTimeout(() => {
          l.keyed = false;
        }, 0);
        if (l.liftT) flipOver();
        else open(l.target);
      } else if (e.key === "Escape") {
        close();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [close, flipOver, go, open]);

  // a sideways wheel browses, and a vertical one is left to the page
  useEffect(() => {
    const node = stage.current;
    if (!node) return;
    const l = live.current;
    const wheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;
      e.preventDefault();
      if (l.liftT) return;
      l.wheel += e.deltaX;
      const now = performance.now();
      if (Math.abs(l.wheel) > 36 && now > l.wheelLock) {
        go(l.target + Math.sign(l.wheel));
        l.wheel = 0;
        l.wheelLock = now + 120;
      }
    };
    node.addEventListener("wheel", wheel, { passive: false });
    return () => node.removeEventListener("wheel", wheel);
  }, [go]);

  const local = (e: { clientX: number; clientY: number }) => {
    const r = stage.current?.getBoundingClientRect();
    return r ? { x: e.clientX - r.left, y: e.clientY - r.top } : { x: 0, y: 0 };
  };

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    const l = live.current;
    const t = e.target as HTMLElement;
    if (t.closest("[data-nav]")) return;
    const card = t.closest<HTMLElement>("[data-card]");
    l.down = {
      x: e.clientX,
      pos: l.pos.x,
      card: card ? Number(card.dataset.card) : -1,
      moved: false,
    };
    l.lastX = e.clientX;
    l.lastT = performance.now();
    l.dragV = 0;
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const l = live.current;
    if (e.pointerType !== "touch") {
      const p = local(e);
      l.pointer.x = p.x;
      l.pointer.y = p.y;
      l.pointer.inside = true;
      kick();
    }
    const d = l.down;
    if (!d) return;
    const dx = e.clientX - d.x;
    if (!d.moved && Math.abs(dx) > 6 && l.sel < 0) {
      d.moved = true;
      l.dragging = true;
      stage.current?.setAttribute("data-carry", "true");
    }
    if (!l.dragging) return;
    const step = l.W * 0.55;
    let p = d.pos - dx / step;
    // past either end the fan gives a little and springs back
    if (p < 0) p = -((-p) ** 0.7) * 0.5;
    if (p > N - 1) p = N - 1 + (p - (N - 1)) ** 0.7 * 0.5;
    const now = performance.now();
    const dt = Math.max(1, now - l.lastT) / 1000;
    const v = -(e.clientX - l.lastX) / step / dt;
    l.dragV = lerp(l.dragV, v, 0.35);
    l.lastX = e.clientX;
    l.lastT = now;
    l.pos.v = l.dragV;
    l.pos.x = p;
    kick();
  };

  const onPointerEnd = (e: React.PointerEvent<HTMLDivElement>) => {
    const l = live.current;
    const d = l.down;
    if (!d) return;
    if (l.dragging) {
      // a throw lands where its momentum would carry it
      const v = clamp(l.dragV, -14, 14);
      l.target = clamp(Math.round(l.pos.x + v * 0.22), 0, N - 1);
      l.pos.v = v;
    } else if (e.type === "pointerup") {
      if (d.card >= 0) press(d.card);
      else if (l.liftT) close();
    }
    l.dragging = false;
    stage.current?.removeAttribute("data-carry");
    l.down = null;
    kick();
  };

  const s = SPECIMENS[active] ?? SPECIMENS[0];
  const NAV = cn(
    "inline-flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-full bg-fill-hover text-text-secondary transition-colors duration-200",
    // one step up from the site's order, since it sits on a `fill` ground
    "hover:bg-fill-active hover:text-text-primary active:bg-stroke-strong active:duration-0",
    "disabled:cursor-not-allowed disabled:opacity-50",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-primary/15 focus-visible:ring-offset-2 focus-visible:ring-offset-fill",
  );

  return (
    <div ref={root} className="w-full min-w-0">
      <div
        ref={stage}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
        onPointerLeave={(e) => {
          if (e.pointerType === "touch") return;
          live.current.pointer.inside = false;
          kick();
        }}
        className={cn(
          "relative isolate aspect-8/5 min-h-112 w-full cursor-grab touch-pan-y select-none overflow-hidden rounded-lg bg-fill [perspective-origin:50%_42%]",
          "data-[carry=true]:cursor-grabbing data-[carry=true]:[&_*]:cursor-grabbing",
        )}
      >
        {/* the fan, centred a little above the middle so the caption has room */}
        {SPECIMENS.map((sp, i) => (
          <button
            key={sp.img}
            ref={(el) => {
              cardEls.current[i] = el;
            }}
            type="button"
            data-card={i}
            tabIndex={i === active ? 0 : -1}
            aria-label={`${sp.name}, card ${i + 1} of ${N}`}
            onClick={(e) => {
              // a click with no pointer and no key behind it is an assistive
              // technology's
              if (e.detail !== 0 || live.current.keyed) return;
              press(i);
            }}
            className={cn(
              "absolute top-[44%] left-1/2 block cursor-pointer border-0 bg-transparent p-0 [transform-style:preserve-3d]",
              "rounded-[18px] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-text-primary focus-visible:outline-solid",
            )}
            style={{
              width: CARD.w,
              height: CARD.h,
              marginLeft: -CARD.w / 2,
              marginTop: -CARD.h / 2,
              visibility: "hidden",
            }}
          >
            <Card s={sp} index={i} inspected={sel === i} />
          </button>
        ))}

        <TooltipProvider delayDuration={200}>
          <div className="absolute inset-x-0 bottom-5 flex items-center justify-center gap-3.5">
            <Tooltip label="Previous (←)">
              <button
                type="button"
                data-nav=""
                aria-label="Previous card"
                disabled={active === 0}
                onClick={() => go(live.current.target - 1)}
                className={NAV}
              >
                <CaretLeftIcon aria-hidden="true" className="size-4 shrink-0" />
              </button>
            </Tooltip>
            <div
              aria-hidden="true"
              className="flex min-w-36 flex-col items-center gap-0.5 overflow-hidden text-center"
            >
              <span ref={nameEl} className="text-body text-text-primary">
                {s?.name}
              </span>
              <span className="font-mono text-meta text-text-muted tabular-nums">
                {pad(active + 1)} / {pad(N)}
              </span>
            </div>
            <Tooltip label="Next (→)">
              <button
                type="button"
                data-nav=""
                aria-label="Next card"
                disabled={active === N - 1}
                onClick={() => go(live.current.target + 1)}
                className={NAV}
              >
                <CaretRightIcon
                  aria-hidden="true"
                  className="size-4 shrink-0"
                />
              </button>
            </Tooltip>
          </div>
        </TooltipProvider>

        <span aria-live="polite" className="sr-only">
          {said}
        </span>
      </div>
    </div>
  );
}
