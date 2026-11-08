"use client";

import { animate, motion, useMotionValue, useTransform } from "motion/react";
import type React from "react";
import { useCallback, useEffect, useLayoutEffect, useRef } from "react";
import { TextMorph } from "torph/react";
import { Tooltip, TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { ShapeKind } from "./canvas";
import {
  ArrowGlyph,
  EllipseGlyph,
  EraserGlyph,
  FilledGlyph,
  LineGlyph,
  MinusGlyph,
  OutlineGlyph,
  PenGlyph,
  PlusGlyph,
  RectGlyph,
  RedoGlyph,
  SelectGlyph,
  ShapesGlyph,
  TextGlyph,
  TrashGlyph,
  UndoGlyph,
} from "./glyphs";

/*
 * The dock: one dark bar that is every tool's toolbar in turn.
 *
 * Every view is mounted the whole time, stacked in the middle of the bar, and
 * only the one on top of the stack shows. A change of view is three things on
 * one frame:
 *
 * - **the bar's width springs** to the new view's own width, so the surface
 *   grows and shrinks round whatever it now holds rather than swapping boxes;
 * - **the old view leaves and the new one arrives** sideways, a few px, with a
 *   blur, in the direction the stack moved;
 * - **anything the two views share flies across.** A button carries
 *   `data-share`, and the same key in the old view is where its copy starts:
 *   pressing Pen sends the pen glyph from its slot in the row to the back chip
 *   of the pen view, and Back sends it home.
 *
 * The flight is a clone of the button laid over the board and driven by WAAPI
 * on a spring sampled into `linear()`, with both real buttons hidden for its
 * length, so React never sees it. It is laid over the board and not the dock,
 * since the dock is centred and moves as the bar widens, which would carry the
 * clone with it and land it short of its target.
 */

export type View =
  | "main"
  | "pen"
  | "shape"
  | "text"
  | "color"
  | "eraser"
  | "confirm";

export type Tool = "select" | "pen" | "shape" | "text" | "eraser";

export interface Settings {
  tool: Tool;
  color: string;
  penW: number;
  shape: ShapeKind;
  fill: boolean;
  textSize: number;
  textWeight: number;
  eraserW: number;
}

/**
 * The ink choices. `ink` is the site's own `text-primary`, and the six hues
 * are scoped here: a pen's colours are the thing it draws with, which is the
 * claim the lab's other scoped sets make. They are not tokens.
 */
export const COLORS: readonly (readonly [string, string])[] = [
  ["ink", "Ink"],
  ["#e5484d", "Red"],
  ["#f76b15", "Orange"],
  ["#ffc53d", "Yellow"],
  ["#30a46c", "Green"],
  ["#0090ff", "Blue"],
  ["#8e4ec6", "Violet"],
];

export const SIZES = [12, 16, 20, 24, 32, 40, 48, 64] as const;

const swatch = (c: string) => (c === "ink" ? "var(--color-text-primary)" : c);

/** a spring, sampled into a CSS `linear()` easing so WAAPI can run it */
function springEasing(k: number, c: number) {
  const out: string[] = [];
  let x = 0;
  let v = 0;
  let t = 0;
  const h = 1 / 240;
  while (t < 2) {
    for (let i = 0; i < 4; i++) {
      const a = -k * (x - 1) - c * v;
      v += a * h;
      x += v * h;
      t += h;
    }
    out.push(x.toFixed(4));
    if (t > 0.2 && Math.abs(x - 1) < 0.0015 && Math.abs(v) < 0.02) break;
  }
  out[out.length - 1] = "1";
  return {
    easing: `linear(0, ${out.join(", ")})`,
    duration: Math.round(t * 1000),
  };
}

const EASE_OUT = "cubic-bezier(0.22, 1, 0.36, 1)";
const GLIDE = { type: "spring", stiffness: 900, damping: 56 } as const;
const WIDTH = { type: "spring", stiffness: 760, damping: 46 } as const;

/** the focus mark on a dark bar, stronger than the declared pattern */
const FOCUS =
  "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-inverse-text/70 focus-visible:outline-solid";

const TB = cn(
  "relative z-1 inline-flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-xl text-inverse-text-secondary transition-colors duration-150 @md:size-11",
  "hover:text-inverse-text active:bg-inverse-text/8 data-[active=true]:text-inverse-text",
  "disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:text-inverse-text-secondary",
  FOCUS,
);
const CHIP = cn(
  TB,
  "bg-inverse-text/12 text-inverse-text hover:bg-inverse-text/16",
);
const GLYPH = "size-5 shrink-0 @md:size-5.5";
const SEP = "mx-1.5 h-5 w-px shrink-0 bg-inverse-text/10";
const PILL = cn(
  "inline-flex h-8 shrink-0 cursor-pointer items-center gap-1.5 rounded-lg px-3 text-action transition-colors duration-150",
  FOCUS,
);

function Tip({
  label,
  keys,
  children,
}: {
  label: string;
  keys?: string;
  children: React.ReactElement;
}) {
  return (
    <Tooltip
      label={
        <>
          <span>{label}</span>
          {keys && <kbd className="font-mono opacity-60">{keys}</kbd>}
        </>
      }
    >
      {children}
    </Tooltip>
  );
}

/**
 * A row of choices with one background that slides to the chosen one, or a
 * ring that does, for the swatches. It jumps rather than slides when its view
 * has just come in, since the view itself is arriving.
 */
function Glide({
  active,
  visible,
  ring = false,
  reduce,
  label,
  children,
}: {
  active: string;
  visible: boolean;
  ring?: boolean;
  reduce: boolean;
  label?: string;
  children: React.ReactNode;
}) {
  const group = useRef<HTMLFieldSetElement>(null);
  const x = useMotionValue(0);
  const w = useMotionValue(0);
  const top = useTransform(w, (v) => `calc(50% - ${v / 2}px)`);
  const shown = useRef(false);
  const ready = useRef(false);

  const sync = useCallback(
    (jump: boolean) => {
      const g = group.current;
      if (!g) return;
      const btn = g.querySelector<HTMLElement>(
        `[data-value="${CSS.escape(active)}"]`,
      );
      if (!btn) return;
      if (jump || !ready.current || reduce) {
        x.jump(btn.offsetLeft);
        w.jump(btn.offsetWidth);
        ready.current = true;
      } else {
        animate(x, btn.offsetLeft, GLIDE);
        animate(w, btn.offsetWidth, GLIDE);
      }
    },
    [active, reduce, w, x],
  );

  useLayoutEffect(() => {
    const arriving = visible && !shown.current;
    shown.current = visible;
    sync(arriving || !visible);
  }, [sync, visible]);

  // a container query can resize the buttons under a still selection
  useEffect(() => {
    const g = group.current;
    if (!g) return;
    const ro = new ResizeObserver(() => sync(true));
    ro.observe(g);
    return () => ro.disconnect();
  }, [sync]);

  return (
    <fieldset
      ref={group}
      aria-label={label}
      className="relative m-0 flex min-w-0 items-center gap-0.5 border-0 p-0"
    >
      {ring ? (
        <motion.span
          aria-hidden="true"
          className="pointer-events-none absolute left-0 z-0 rounded-full ring-[1.5px] ring-inverse-text ring-inset"
          style={{ x, width: w, height: w, top }}
        />
      ) : (
        <motion.span
          aria-hidden="true"
          className="pointer-events-none absolute top-0 left-0 z-0 h-full rounded-xl bg-inverse-text/12"
          style={{ x, width: w }}
        />
      )}
      {children}
    </fieldset>
  );
}

/** a width that is dragged or stepped, with a preview of the stroke it makes */
function Slider({
  label,
  value,
  min,
  max,
  ring,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  /** the eraser previews a hollow ring, the pen a dot */
  ring?: boolean;
  onChange: (v: number) => void;
}) {
  const track = useRef<HTMLSpanElement>(null);
  const dragging = useRef(false);
  const t = (value - min) / (max - min);
  const set = (v: number) =>
    onChange(Math.max(min, Math.min(max, Math.round(v))));
  const fromPointer = (e: React.PointerEvent) => {
    const r = track.current?.getBoundingClientRect();
    if (!r) return;
    set(
      min +
        Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * (max - min),
    );
  };
  const d = ring
    ? Math.max(3, Math.min(18, value / 3.4))
    : Math.max(2, Math.min(18, value));

  return (
    <div
      role="slider"
      tabIndex={0}
      aria-label={label}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={value}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        dragging.current = true;
        fromPointer(e);
      }}
      onPointerMove={(e) => {
        if (dragging.current) fromPointer(e);
      }}
      onPointerUp={() => {
        dragging.current = false;
      }}
      onPointerCancel={() => {
        dragging.current = false;
      }}
      onKeyDown={(e) => {
        const step = e.shiftKey ? 5 : 1;
        const next: Record<string, number> = {
          ArrowRight: value + step,
          ArrowUp: value + step,
          ArrowLeft: value - step,
          ArrowDown: value - step,
          PageUp: value + 5,
          PageDown: value - 5,
          Home: min,
          End: max,
        };
        const v = next[e.key];
        if (v === undefined) return;
        e.preventDefault();
        e.stopPropagation();
        set(v);
      }}
      className={cn(
        "flex h-10 cursor-ew-resize touch-none items-center gap-2.5 rounded-xl pr-1.5 pl-1 @md:h-11",
        FOCUS,
      )}
    >
      <span className="flex size-6 items-center justify-center">
        <b
          className={cn(
            "block rounded-full",
            ring
              ? "ring-[1.5px] ring-inverse-text ring-inset"
              : "bg-inverse-text",
          )}
          style={{ width: d, height: d }}
        />
      </span>
      <span
        ref={track}
        className="relative h-1 w-12 rounded-full bg-inverse-text/12 @md:w-24"
      >
        <span
          className="absolute inset-y-0 left-0 rounded-full bg-inverse-text"
          style={{ width: `${t * 100}%` }}
        />
        <span
          className="-translate-x-1/2 -translate-y-1/2 absolute top-1/2 size-3 rounded-full bg-inverse-text ring-3 ring-inverse-fill"
          style={{ left: `${t * 100}%` }}
        />
      </span>
      <span className="w-[3.2ch] text-right font-mono text-meta text-inverse-text-secondary tabular-nums">
        {value}
      </span>
    </div>
  );
}

function Swatches({
  color,
  visible,
  reduce,
  onPick,
  label,
}: {
  color: string;
  visible: boolean;
  reduce: boolean;
  onPick: (c: string) => void;
  label: string;
}) {
  return (
    <Glide active={color} visible={visible} ring reduce={reduce} label={label}>
      {COLORS.map(([c, name]) => (
        <button
          key={c}
          type="button"
          aria-pressed={color === c}
          aria-label={name}
          data-value={c}
          onClick={() => onPick(c)}
          className={cn(
            "relative z-1 inline-flex h-10 w-6 shrink-0 cursor-pointer items-center justify-center rounded-full @md:h-11 @md:w-8",
            FOCUS,
          )}
        >
          <i
            className="block size-4 rounded-full ring-1 ring-inverse-text/22 ring-inset @md:size-5"
            style={{ background: swatch(c) }}
          />
        </button>
      ))}
    </Glide>
  );
}

function Dot({ color }: { color: string }) {
  return (
    <span
      className="block size-4 rounded-full ring-1 ring-inverse-text/22 ring-inset"
      style={{ background: swatch(color) }}
    />
  );
}

export function Toolbar({
  view,
  dir,
  settings: s,
  canUndo,
  canRedo,
  editing,
  reduce,
  onTool,
  onBack,
  onOpen,
  onSet,
  onColor,
  onStep,
  onUndo,
  onRedo,
  onAskClear,
  onClear,
}: {
  view: View;
  /** 1 when the stack grew, -1 when it shrank, so a view slides the right way */
  dir: number;
  settings: Settings;
  canUndo: boolean;
  canRedo: boolean;
  editing: boolean;
  reduce: boolean;
  onTool: (t: Tool) => void;
  onBack: () => void;
  onOpen: (v: View) => void;
  onSet: (patch: Partial<Settings>) => void;
  onColor: (c: string) => void;
  onStep: (d: number) => void;
  onUndo: () => void;
  onRedo: () => void;
  onAskClear: () => void;
  onClear: () => void;
}) {
  const dock = useRef<HTMLDivElement>(null);
  const views = useRef<Partial<Record<View, HTMLDivElement | null>>>({});
  const barW = useMotionValue(0);
  const target = useRef(0);
  const prev = useRef<View>(view);
  const ghosts = useRef<Animation[]>([]);
  const fly = useRef(springEasing(640, 44));

  const fit = useCallback(
    (w: number, jump: boolean) => {
      target.current = w;
      if (jump) barW.jump(w);
      else animate(barW, w, WIDTH);
    },
    [barW],
  );

  // first width once the font has landed, and the dock's rise on arrival
  const rose = useRef(false);
  useEffect(() => {
    if (rose.current) return;
    rose.current = true;
    let alive = true;
    const el = views.current.main;
    for (const v of Object.values(views.current)) {
      if (v && v !== el) v.inert = true;
    }
    document.fonts.ready.then(() => {
      if (!alive || !el) return;
      fit(el.offsetWidth, true);
      if (!reduce && dock.current) {
        const rise = springEasing(480, 34);
        dock.current.animate(
          [
            { transform: "translateY(28px) scale(0.96)", opacity: 0 },
            { transform: "none", opacity: 1 },
          ],
          {
            duration: rise.duration,
            easing: rise.easing,
            delay: 60,
            fill: "backwards",
          },
        );
      }
    });
    return () => {
      alive = false;
    };
  }, [fit, reduce]);

  // a container query can resize the view on show, so the bar follows it
  useEffect(() => {
    const el = views.current[view];
    if (!el) return;
    const ro = new ResizeObserver(() => {
      if (Math.abs(el.offsetWidth - target.current) > 0.5)
        fit(el.offsetWidth, true);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [fit, view]);

  const flyAcross = useCallback(
    (src: HTMLElement, dst: HTMLElement, a: DOMRect, b: DOMRect) => {
      const bar = dock.current;
      const host = bar?.closest<HTMLElement>("[data-board]");
      if (!bar || !host) return;
      const d = host.getBoundingClientRect();
      const chipBg = getComputedStyle(
        bar.querySelector<HTMLElement>("[data-chip]") ?? bar,
      ).backgroundColor;
      const isChip = (el: HTMLElement) => el.hasAttribute("data-chip");
      const look = (el: HTMLElement) => {
        const cs = getComputedStyle(el);
        const filled = el.dataset.active === "true" || isChip(el);
        return { bg: filled ? chipBg : cs.backgroundColor, color: cs.color };
      };
      const from = look(src);
      const to = look(dst);
      const tpl = isChip(dst) || !isChip(src) ? dst : src;
      const g = tpl.cloneNode(true) as HTMLElement;
      for (const k of ["data-share", "data-chip", "data-active", "id"]) {
        g.removeAttribute(k);
      }
      g.setAttribute("aria-hidden", "true");
      g.tabIndex = -1;
      Object.assign(g.style, {
        position: "absolute",
        left: "0",
        top: "0",
        margin: "0",
        zIndex: "50",
        pointerEvents: "none",
        overflow: "hidden",
        width: `${b.width}px`,
        height: `${b.height}px`,
      });
      host.append(g);

      // the chosen tool's background is the row's glider, not the button
      const glider =
        dst.dataset.active === "true"
          ? dst.parentElement?.querySelector<HTMLElement>(":scope > span")
          : null;
      dst.style.visibility = "hidden";
      src.style.visibility = "hidden";
      if (glider) glider.style.visibility = "hidden";

      const ax = a.left - d.left;
      const ay = a.top - d.top;
      const bx = b.left - d.left;
      const by = b.top - d.top;
      const geo = g.animate(
        [
          {
            transform: `translate(${ax}px, ${ay}px)`,
            width: `${a.width}px`,
            height: `${a.height}px`,
          },
          {
            transform: `translate(${bx}px, ${by}px)`,
            width: `${b.width}px`,
            height: `${b.height}px`,
          },
        ],
        {
          duration: fly.current.duration,
          easing: fly.current.easing,
          fill: "forwards",
        },
      );
      g.animate(
        [
          { backgroundColor: from.bg, color: from.color },
          { backgroundColor: to.bg, color: to.color },
        ],
        { duration: 160, easing: "ease-out", fill: "forwards" },
      );
      const done = () => {
        dst.style.visibility = "";
        src.style.visibility = "";
        if (glider) glider.style.visibility = "";
        g.remove();
      };
      geo.onfinish = done;
      geo.oncancel = done;
      ghosts.current.push(geo);
    },
    [],
  );

  // React has already shown the new view and hidden the old one, before this
  // paint, so this is where the morph is started from the two of them
  useLayoutEffect(() => {
    const from = prev.current;
    prev.current = view;
    if (from === view) return;
    const oldV = views.current[from];
    const newV = views.current[view];
    if (!oldV || !newV) return;

    for (const a of ghosts.current) a.finish();
    ghosts.current = [];

    const active = document.activeElement;
    const hadFocus =
      active instanceof HTMLElement &&
      oldV.contains(active) &&
      active.matches(":focus-visible");
    const oldOpacity = getComputedStyle(oldV).opacity;
    for (const a of oldV.getAnimations()) a.cancel();
    for (const a of newV.getAnimations()) a.cancel();
    oldV.inert = true;
    newV.inert = false;

    const pairs = [...newV.querySelectorAll<HTMLElement>("[data-share]")]
      .map((dst) => {
        const src = oldV.querySelector<HTMLElement>(
          `[data-share="${dst.dataset.share}"]`,
        );
        return src ? ([src, dst] as const) : null;
      })
      .filter((p): p is readonly [HTMLElement, HTMLElement] => p !== null)
      .map(([src, dst]) => ({
        src,
        dst,
        a: src.getBoundingClientRect(),
        b: dst.getBoundingClientRect(),
      }));

    fit(newV.offsetWidth, reduce);

    if (!reduce) {
      const shift = 10 * dir;
      oldV.animate(
        [
          { opacity: oldOpacity, transform: "none", filter: "blur(0px)" },
          {
            opacity: 0,
            transform: `translateX(${-shift}px) scale(0.97)`,
            filter: "blur(2px)",
          },
        ],
        { duration: 110, easing: "cubic-bezier(0.4, 0, 1, 1)" },
      );
      newV.animate(
        [
          {
            opacity: 0,
            transform: `translateX(${shift}px) scale(0.97)`,
            filter: "blur(2px)",
          },
          { opacity: 1, transform: "none", filter: "blur(0px)" },
        ],
        { duration: 220, delay: 25, easing: EASE_OUT, fill: "backwards" },
      );
      for (const p of pairs) flyAcross(p.src, p.dst, p.a, p.b);
    }

    if (hadFocus) {
      newV
        .querySelector<HTMLElement>("button:not(:disabled), [tabindex='0']")
        ?.focus({ preventScroll: true });
    }
  }, [dir, fit, flyAcross, reduce, view]);

  const on = (v: View) => view === v;
  const viewClass = cn(
    "-translate-x-1/2 -translate-y-1/2 pointer-events-none absolute top-1/2 left-1/2 flex w-max items-center gap-0.5 whitespace-nowrap px-2 opacity-0",
    "data-[on=true]:pointer-events-auto data-[on=true]:opacity-100",
  );
  const register = (v: View) => (el: HTMLDivElement | null) => {
    views.current[v] = el;
  };

  const back = (share: string, label: string, glyph: React.ReactNode) => (
    <button
      type="button"
      data-chip=""
      data-share={share}
      aria-label={label}
      onClick={onBack}
      className={CHIP}
    >
      {glyph}
    </button>
  );

  const tool = (
    t: Tool,
    name: string,
    keys: string,
    glyph: React.ReactNode,
  ) => (
    <Tip key={t} label={name} keys={keys}>
      <button
        type="button"
        data-value={t}
        data-share={`tool-${t}`}
        data-active={s.tool === t}
        aria-pressed={s.tool === t}
        aria-label={name}
        onClick={() => onTool(t)}
        className={TB}
      >
        {glyph}
      </button>
    </Tip>
  );

  const choice = (
    value: string,
    name: string,
    active: boolean,
    onClick: () => void,
    glyph: React.ReactNode,
  ) => (
    <Tip key={value} label={name}>
      <button
        type="button"
        aria-pressed={active}
        aria-label={name}
        data-value={value}
        data-active={active}
        onClick={onClick}
        className={TB}
      >
        {glyph}
      </button>
    </Tip>
  );

  const colorButton = (
    <Tip label="Color">
      <button
        type="button"
        data-share="color"
        aria-label="Choose color"
        onClick={() => onOpen("color")}
        className={TB}
      >
        <Dot color={s.color} />
      </button>
    </Tip>
  );

  return (
    <TooltipProvider delayDuration={400}>
      <div
        ref={dock}
        className="relative select-none"
        // the text editor keeps its focus while the bar restyles it
        onPointerDown={(e) => {
          if (editing) e.preventDefault();
        }}
      >
        <motion.div
          role="toolbar"
          aria-label="Drawing tools"
          className="relative h-16 overflow-hidden rounded-[1.25rem] bg-inverse-fill"
          style={{
            width: barW,
            // shading on a dark surface is light, not palette
            boxShadow:
              "inset 0 1px 0 rgb(255 255 255 / 0.07), inset 0 0 0 1px rgb(255 255 255 / 0.04), 0 0 0 1px rgb(0 0 0 / 0.08), 0 2px 4px rgb(0 0 0 / 0.08), 0 12px 28px -8px rgb(0 0 0 / 0.3), 0 28px 56px -16px rgb(0 0 0 / 0.24)",
          }}
        >
          <div
            ref={register("main")}
            data-on={on("main")}
            className={viewClass}
          >
            <Glide active={s.tool} visible={on("main")} reduce={reduce}>
              {tool("select", "Select", "V", <SelectGlyph className={GLYPH} />)}
              {tool("pen", "Pen", "P", <PenGlyph className={GLYPH} />)}
              {tool("shape", "Shapes", "S", <ShapesGlyph className={GLYPH} />)}
              {tool("text", "Text", "T", <TextGlyph className={GLYPH} />)}
              {tool("eraser", "Eraser", "E", <EraserGlyph className={GLYPH} />)}
            </Glide>
            <span className={SEP} />
            <Tip label="Undo" keys="⌘Z">
              <button
                type="button"
                aria-label="Undo"
                disabled={!canUndo}
                onClick={onUndo}
                className={TB}
              >
                <UndoGlyph className={GLYPH} />
              </button>
            </Tip>
            <Tip label="Redo" keys="⇧⌘Z">
              <button
                type="button"
                aria-label="Redo"
                disabled={!canRedo}
                onClick={onRedo}
                className={TB}
              >
                <RedoGlyph className={GLYPH} />
              </button>
            </Tip>
          </div>

          <div ref={register("pen")} data-on={on("pen")} className={viewClass}>
            {back("tool-pen", "Back to tools", <PenGlyph className={GLYPH} />)}
            <span className={SEP} />
            <Swatches
              color={s.color}
              visible={on("pen")}
              reduce={reduce}
              onPick={onColor}
              label="Ink color"
            />
            <span className={SEP} />
            <Slider
              label="Stroke width"
              value={s.penW}
              min={1}
              max={24}
              onChange={(penW) => onSet({ penW })}
            />
          </div>

          <div
            ref={register("shape")}
            data-on={on("shape")}
            className={viewClass}
          >
            {back(
              "tool-shape",
              "Back to tools",
              <ShapesGlyph className={GLYPH} />,
            )}
            <span className={SEP} />
            <Glide
              active={s.shape}
              visible={on("shape")}
              reduce={reduce}
              label="Shape"
            >
              {choice(
                "rect",
                "Rectangle",
                s.shape === "rect",
                () => onSet({ shape: "rect" }),
                <RectGlyph className={GLYPH} />,
              )}
              {choice(
                "ellipse",
                "Ellipse",
                s.shape === "ellipse",
                () => onSet({ shape: "ellipse" }),
                <EllipseGlyph className={GLYPH} />,
              )}
              {choice(
                "line",
                "Line",
                s.shape === "line",
                () => onSet({ shape: "line" }),
                <LineGlyph className={GLYPH} />,
              )}
              {choice(
                "arrow",
                "Arrow",
                s.shape === "arrow",
                () => onSet({ shape: "arrow" }),
                <ArrowGlyph className={GLYPH} />,
              )}
            </Glide>
            <span className={SEP} />
            <Glide
              active={s.fill ? "1" : "0"}
              visible={on("shape")}
              reduce={reduce}
              label="Fill"
            >
              {choice(
                "0",
                "Outline",
                !s.fill,
                () => onSet({ fill: false }),
                <OutlineGlyph className={GLYPH} />,
              )}
              {choice(
                "1",
                "Filled",
                s.fill,
                () => onSet({ fill: true }),
                <FilledGlyph className={GLYPH} />,
              )}
            </Glide>
            <span className={SEP} />
            {colorButton}
          </div>

          <div
            ref={register("text")}
            data-on={on("text")}
            className={viewClass}
          >
            {back(
              "tool-text",
              "Back to tools",
              <TextGlyph className={GLYPH} />,
            )}
            <span className={SEP} />
            <fieldset
              aria-label="Font size"
              className="m-0 flex min-w-0 items-center border-0 p-0"
            >
              <button
                type="button"
                aria-label="Smaller"
                disabled={s.textSize <= SIZES[0]}
                onClick={() => onStep(-1)}
                className={cn(TB, "w-8 @md:w-8")}
              >
                <MinusGlyph className={GLYPH} />
              </button>
              <span className="w-[2.6ch] text-center font-mono text-action text-inverse-text tabular-nums">
                <TextMorph duration={200} ease={EASE_OUT}>
                  {String(s.textSize)}
                </TextMorph>
              </span>
              <button
                type="button"
                aria-label="Larger"
                disabled={s.textSize >= SIZES[SIZES.length - 1]}
                onClick={() => onStep(1)}
                className={cn(TB, "w-8 @md:w-8")}
              >
                <PlusGlyph className={GLYPH} />
              </button>
            </fieldset>
            <span className={SEP} />
            <Glide
              active={String(s.textWeight)}
              visible={on("text")}
              reduce={reduce}
              label="Weight"
            >
              {[
                [400, "Regular"],
                [650, "Bold"],
              ].map(([w, name]) => (
                <button
                  key={w}
                  type="button"
                  aria-pressed={s.textWeight === w}
                  aria-label={String(name)}
                  data-value={String(w)}
                  data-active={s.textWeight === w}
                  onClick={() => onSet({ textWeight: Number(w) })}
                  className={cn(TB, "w-auto px-2.5 text-body @md:w-auto")}
                  // `button { text-transform: inherit }` is unlayered and beats
                  // a utility, and "aa" is not a specimen of anything
                  style={{ fontWeight: Number(w), textTransform: "none" }}
                >
                  Aa
                </button>
              ))}
            </Glide>
            <span className={SEP} />
            {colorButton}
          </div>

          <div
            ref={register("color")}
            data-on={on("color")}
            className={viewClass}
          >
            <button
              type="button"
              data-chip=""
              data-share="color"
              aria-label="Back"
              onClick={onBack}
              className={CHIP}
            >
              <Dot color={s.color} />
            </button>
            <span className={SEP} />
            <Swatches
              color={s.color}
              visible={on("color")}
              reduce={reduce}
              onPick={onColor}
              label="Color"
            />
          </div>

          <div
            ref={register("eraser")}
            data-on={on("eraser")}
            className={viewClass}
          >
            {back(
              "tool-eraser",
              "Back to tools",
              <EraserGlyph className={GLYPH} />,
            )}
            <span className={SEP} />
            <Slider
              label="Eraser size"
              value={s.eraserW}
              min={8}
              max={64}
              ring
              onChange={(eraserW) => onSet({ eraserW })}
            />
            <span className={SEP} />
            <button
              type="button"
              data-share="clear"
              onClick={onAskClear}
              className={cn(
                PILL,
                "bg-inverse-text/8 text-inverse-text hover:bg-inverse-text/12",
              )}
            >
              <TrashGlyph className="size-4 shrink-0" />
              Clear
            </button>
          </div>

          <div
            ref={register("confirm")}
            data-on={on("confirm")}
            className={viewClass}
          >
            <span className="px-2 text-action text-inverse-text">
              Clear the whole canvas?
            </span>
            <button
              type="button"
              onClick={onBack}
              className={cn(
                PILL,
                "text-inverse-text-secondary hover:bg-inverse-text/6 hover:text-inverse-text",
              )}
            >
              Cancel
            </button>
            <button
              type="button"
              data-share="clear"
              onClick={onClear}
              className={cn(PILL, "bg-danger hover:bg-danger/90")}
              // a theme-constant fill pins its text colour
              style={{ color: "#fff" }}
            >
              <TrashGlyph className="size-4 shrink-0" />
              Clear
            </button>
          </div>
        </motion.div>
      </div>
    </TooltipProvider>
  );
}
