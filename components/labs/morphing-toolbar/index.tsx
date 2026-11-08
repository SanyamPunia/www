"use client";

import { useReducedMotion } from "motion/react";
import type React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import {
  bbox,
  cloneAll,
  constrain,
  draw,
  fontOf,
  hits,
  hitTest,
  inBox,
  lineHeight,
  move,
  type Obj,
  type Point,
} from "./canvas";
import { type Settings, SIZES, type Tool, Toolbar, type View } from "./toolbar";

/*
 * A board to sketch on, with one dark toolbar that turns into whichever tool's
 * options are needed. Pick a tool and the bar morphs into its options, with the
 * tool's own glyph flying across to become the way back. Escape steps back.
 *
 * `canvas.ts` is what is drawn and how to hit it, `toolbar.tsx` the dock and
 * its morph, `glyphs.tsx` the toolbar's line glyphs. This file is the board:
 * the gesture for each tool, the text editor, history and the keys.
 */

const OPTIONS = new Set<Tool>(["pen", "shape", "text", "eraser"]);
const KEYS: Record<string, Tool> = {
  v: "select",
  p: "pen",
  s: "shape",
  t: "text",
  e: "eraser",
};

interface Edit {
  x: number;
  y: number;
  value: string;
}

export default function MorphingToolbar() {
  const reduce = useReducedMotion() === true;
  const stage = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const editor = useRef<HTMLTextAreaElement>(null);

  const [s, setS] = useState<Settings>({
    tool: "pen",
    color: "ink",
    penW: 4,
    shape: "rect",
    fill: false,
    textSize: 24,
    textWeight: 400,
    eraserW: 24,
  });
  const [nav, setNav] = useState<{ stack: View[]; dir: number }>({
    stack: ["main"],
    dir: 0,
  });
  const [hist, setHist] = useState({ canUndo: false, canRedo: false });
  const [empty, setEmpty] = useState(true);
  const [edit, setEdit] = useState<Edit | null>(null);

  // everything the gestures and the paint read, kept out of React
  const live = useRef({
    s,
    objects: [] as Obj[],
    history: [[]] as Obj[][],
    index: 0,
    sel: null as Obj | null,
    cur: null as Obj | null,
    drag: null as { last: Point; moved: boolean } | null,
    erasing: false,
    erased: false,
    hover: null as Point | null,
    inside: false,
    editing: null as Obj | null,
    /** the open run of text, mirrored here so a commit can never run twice */
    edit: null as Edit | null,
    queued: 0,
    w: 0,
    h: 0,
    dpr: 1,
    ink: "#1a1a1a",
    muted: "#9b9b9b",
    family: "Inter, system-ui, sans-serif",
  });
  live.current.s = s;

  const view = nav.stack[nav.stack.length - 1] ?? "main";

  const paint = useCallback(() => {
    const l = live.current;
    l.queued = 0;
    const c = canvas.current;
    const ctx = c?.getContext("2d");
    if (!c || !ctx) return;
    const ink = (col: string) => (col === "ink" ? l.ink : col);
    ctx.setTransform(l.dpr, 0, 0, l.dpr, 0, 0);
    ctx.clearRect(0, 0, l.w, l.h);
    ctx.setLineDash([]);
    for (const o of l.objects) draw(ctx, o, ink, l.family);
    if (l.sel && l.objects.includes(l.sel)) {
      const b = bbox(l.sel);
      const pad = 7;
      ctx.save();
      ctx.strokeStyle = l.muted;
      ctx.lineWidth = 1.25;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.roundRect(b.x - pad, b.y - pad, b.w + pad * 2, b.h + pad * 2, 6);
      ctx.stroke();
      ctx.restore();
    }
    // the eraser's reach, drawn where it would land
    if (l.s.tool === "eraser" && l.hover) {
      ctx.save();
      ctx.lineWidth = 1.25;
      ctx.strokeStyle = l.ink;
      ctx.globalAlpha = 0.55;
      ctx.beginPath();
      ctx.arc(l.hover.x, l.hover.y, l.s.eraserW / 2, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = l.erasing ? 0.08 : 0.04;
      ctx.fillStyle = l.ink;
      ctx.fill();
      ctx.restore();
    }
    setEmpty(l.objects.length === 0);
  }, []);

  const request = useCallback(() => {
    const l = live.current;
    if (!l.queued) l.queued = requestAnimationFrame(paint);
  }, [paint]);

  const syncHistory = useCallback(() => {
    const l = live.current;
    setHist({ canUndo: l.index > 0, canRedo: l.index < l.history.length - 1 });
  }, []);

  const commit = useCallback(() => {
    const l = live.current;
    l.history = l.history.slice(0, l.index + 1);
    l.history.push(cloneAll(l.objects));
    l.index++;
    if (l.history.length > 100) {
      l.history.shift();
      l.index--;
    }
    syncHistory();
  }, [syncHistory]);

  const undo = useCallback(() => {
    const l = live.current;
    if (l.index === 0) return;
    l.index--;
    l.objects = cloneAll(l.history[l.index] ?? []);
    l.sel = null;
    syncHistory();
    request();
  }, [request, syncHistory]);

  const redo = useCallback(() => {
    const l = live.current;
    if (l.index >= l.history.length - 1) return;
    l.index++;
    l.objects = cloneAll(l.history[l.index] ?? []);
    l.sel = null;
    syncHistory();
    request();
  }, [request, syncHistory]);

  const go = useCallback((stack: View[]) => {
    setNav((n) => ({
      stack,
      dir: Math.sign(stack.length - n.stack.length),
    }));
  }, []);

  const measure = useCallback((text: string, size: number, weight: number) => {
    const l = live.current;
    const ctx = canvas.current?.getContext("2d");
    if (!ctx) return 0;
    ctx.font = fontOf(size, weight, l.family);
    return Math.max(
      ...text.split("\n").map((line) => ctx.measureText(line).width),
    );
  }, []);

  const openEdit = useCallback((e: Edit | null) => {
    live.current.edit = e;
    setEdit(e);
  }, []);

  const commitEditor = useCallback(() => {
    const l = live.current;
    const e = l.edit;
    if (!e) return;
    const text = (editor.current?.value ?? e.value).replace(/\s+$/, "");
    if (text) {
      l.objects.push({
        type: "text",
        color: l.s.color,
        x: e.x,
        y: e.y,
        text,
        size: l.s.textSize,
        weight: l.s.textWeight,
        width: measure(text, l.s.textSize, l.s.textWeight),
      });
      commit();
    } else if (l.editing) {
      commit();
    }
    l.editing = null;
    openEdit(null);
    request();
  }, [commit, measure, openEdit, request]);

  const cancelEditor = useCallback(() => {
    const l = live.current;
    if (!l.edit) return;
    if (l.editing) l.objects.push(l.editing);
    l.editing = null;
    openEdit(null);
    request();
  }, [openEdit, request]);

  const openEditor = useCallback(
    (p: Point) => {
      const l = live.current;
      const hit = [...l.objects]
        .reverse()
        .find((o) => o.type === "text" && inBox(p, bbox(o), 4));
      if (hit && hit.type === "text") {
        l.editing = hit;
        l.objects = l.objects.filter((o) => o !== hit);
        setS((v) => ({
          ...v,
          textSize: hit.size,
          textWeight: hit.weight,
          color: hit.color,
        }));
        openEdit({ x: hit.x, y: hit.y, value: hit.text });
      } else {
        l.editing = null;
        openEdit({ x: p.x, y: p.y - lineHeight(l.s.textSize) / 2, value: "" });
      }
      request();
    },
    [openEdit, request],
  );

  const pickTool = useCallback(
    (t: Tool) => {
      const l = live.current;
      if (l.edit && t !== "text") commitEditor();
      l.sel = null;
      setS((v) => ({ ...v, tool: t }));
      go(OPTIONS.has(t) ? ["main", t as View] : ["main"]);
      request();
    },
    [commitEditor, go, request],
  );

  const back = useCallback(() => {
    setNav((n) =>
      n.stack.length > 1 ? { stack: n.stack.slice(0, -1), dir: -1 } : n,
    );
  }, []);

  // a colour picked from its own view goes back once the ring has landed
  const pickColor = useCallback(
    (color: string) => {
      setS((v) => ({ ...v, color }));
      if (view === "color") {
        setTimeout(() => {
          setNav((n) =>
            n.stack[n.stack.length - 1] === "color"
              ? { stack: n.stack.slice(0, -1), dir: -1 }
              : n,
          );
        }, 260);
      }
    },
    [view],
  );

  const step = useCallback((d: number) => {
    setS((v) => {
      const i = SIZES.indexOf(v.textSize as (typeof SIZES)[number]);
      const n = Math.max(0, Math.min(SIZES.length - 1, i + d));
      return { ...v, textSize: SIZES[n] ?? v.textSize };
    });
  }, []);

  const askClear = useCallback(() => {
    if (live.current.objects.length === 0) return;
    go([...nav.stack, "confirm"]);
  }, [go, nav.stack]);

  const clear = useCallback(() => {
    const l = live.current;
    l.objects = [];
    l.sel = null;
    commit();
    go(["main", "eraser"]);
    request();
  }, [commit, go, request]);

  // the canvas follows the stage, and the tokens it paints in are read once
  useEffect(() => {
    const node = stage.current;
    const c = canvas.current;
    if (!node || !c) return;
    const l = live.current;
    const root = getComputedStyle(document.documentElement);
    l.ink = root.getPropertyValue("--color-text-primary").trim() || l.ink;
    l.muted = root.getPropertyValue("--color-text-muted").trim() || l.muted;
    l.family = getComputedStyle(node).fontFamily || l.family;
    const size = () => {
      l.dpr = Math.min(2, window.devicePixelRatio || 1);
      l.w = node.clientWidth;
      l.h = node.clientHeight;
      c.width = Math.round(l.w * l.dpr);
      c.height = Math.round(l.h * l.dpr);
      paint();
    };
    size();
    const ro = new ResizeObserver(size);
    ro.observe(node);
    return () => {
      ro.disconnect();
      cancelAnimationFrame(l.queued);
      l.queued = 0;
    };
  }, [paint]);

  // the editor takes focus once it is on the page
  useEffect(() => {
    if (edit) requestAnimationFrame(() => editor.current?.focus());
  }, [edit]);

  // The keys are the demo's while the pointer is over it or the focus is in it,
  // and the page's everywhere else.
  useEffect(() => {
    const l = live.current;
    const onKey = (e: KeyboardEvent) => {
      const node = stage.current;
      if (!node) return;
      if (!l.inside && !node.contains(document.activeElement)) return;
      const t = e.target;
      if (t instanceof HTMLElement && t.closest("textarea, [role='slider']"))
        return;
      const mod = e.metaKey || e.ctrlKey;
      const k = e.key.toLowerCase();
      if (mod && k === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
        return;
      }
      if (mod && k === "y") {
        e.preventDefault();
        redo();
        return;
      }
      if (mod || e.altKey) return;
      if (e.key === "Escape") {
        l.sel = null;
        request();
        back();
        return;
      }
      if ((e.key === "Delete" || e.key === "Backspace") && l.sel) {
        e.preventDefault();
        l.objects = l.objects.filter((o) => o !== l.sel);
        l.sel = null;
        commit();
        request();
        return;
      }
      const tool = KEYS[k];
      if (tool) pickTool(tool);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [back, commit, pickTool, redo, request, undo]);

  const at = (e: { clientX: number; clientY: number }): Point => {
    const r = canvas.current?.getBoundingClientRect();
    return r ? { x: e.clientX - r.left, y: e.clientY - r.top } : { x: 0, y: 0 };
  };

  const eraseAt = (p: Point) => {
    const l = live.current;
    const before = l.objects.length;
    l.objects = l.objects.filter((o) => !hits(o, p, l.s.eraserW / 2));
    if (l.objects.length !== before) l.erased = true;
  };

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.button !== 0) return;
    const l = live.current;
    const p = at(e);
    // a press while a run of text is open only puts it down
    if (l.edit) {
      e.preventDefault();
      commitEditor();
      return;
    }
    e.currentTarget.setPointerCapture(e.pointerId);
    switch (l.s.tool) {
      case "pen":
        l.cur = { type: "pen", color: l.s.color, w: l.s.penW, pts: [p] };
        l.objects.push(l.cur);
        break;
      case "shape":
        l.cur = {
          type: l.s.shape,
          color: l.s.color,
          fill: l.s.fill,
          w: 2.5,
          x0: p.x,
          y0: p.y,
          x1: p.x,
          y1: p.y,
        };
        l.objects.push(l.cur);
        break;
      case "eraser":
        l.erasing = true;
        l.erased = false;
        eraseAt(p);
        break;
      case "select":
        l.sel = hitTest(l.objects, p);
        l.drag = l.sel ? { last: p, moved: false } : null;
        break;
      case "text":
        e.preventDefault();
        openEditor(p);
        break;
    }
    request();
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const l = live.current;
    const p = at(e);
    l.hover = p;
    const cur = l.cur;
    if (cur?.type === "pen") {
      const native = e.nativeEvent;
      const list = native.getCoalescedEvents?.() ?? [];
      for (const ev of list.length ? list : [native]) {
        const q = at(ev);
        const last = cur.pts[cur.pts.length - 1];
        if (!last || Math.hypot(q.x - last.x, q.y - last.y) > 1.2)
          cur.pts.push(q);
      }
    } else if (cur && cur.type !== "text") {
      cur.x1 = p.x;
      cur.y1 = p.y;
      constrain(cur, e.shiftKey);
    } else if (l.erasing) {
      eraseAt(p);
    } else if (l.drag && l.sel) {
      move(l.sel, p.x - l.drag.last.x, p.y - l.drag.last.y);
      l.drag.last = p;
      l.drag.moved = true;
    } else if (l.s.tool === "select" && canvas.current) {
      canvas.current.style.cursor = hitTest(l.objects, p) ? "move" : "default";
    }
    request();
  };

  const onPointerEnd = () => {
    const l = live.current;
    const cur = l.cur;
    if (cur) {
      const tiny =
        cur.type !== "pen" &&
        cur.type !== "text" &&
        Math.hypot(cur.x1 - cur.x0, cur.y1 - cur.y0) < 3;
      if (tiny) l.objects.pop();
      else commit();
      l.cur = null;
    }
    if (l.erasing) {
      l.erasing = false;
      if (l.erased) commit();
    }
    if (l.drag) {
      if (l.drag.moved) commit();
      l.drag = null;
    }
    request();
  };

  const cursor = {
    select: "default",
    pen: "crosshair",
    shape: "crosshair",
    text: "text",
    eraser: "none",
  }[s.tool];

  // the editor is sized to its own text, measured in the canvas's font
  const editW = edit
    ? Math.max(measure(edit.value || " ", s.textSize, s.textWeight) + 4, 8)
    : 0;

  return (
    <div
      ref={stage}
      data-board=""
      onPointerEnter={() => {
        live.current.inside = true;
      }}
      onPointerLeave={() => {
        live.current.inside = false;
      }}
      className="@container relative isolate aspect-8/5 min-h-78 w-full min-w-0 select-none overflow-hidden rounded-lg bg-fill"
      style={{
        backgroundImage:
          "radial-gradient(var(--color-stroke-strong) 1px, transparent 1.6px)",
        backgroundSize: "19.2px 19.2px",
        backgroundPosition: "9.6px 9.6px",
      }}
    >
      <canvas
        ref={canvas}
        aria-label="Drawing board"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
        onPointerLeave={() => {
          live.current.hover = null;
          request();
        }}
        className="absolute inset-0 block size-full touch-none"
        style={{ cursor }}
      />

      <p
        aria-hidden={!empty || edit !== null}
        className={cn(
          "pointer-events-none absolute inset-x-4 top-[40%] text-center text-body text-text-muted transition-opacity duration-200",
          empty && !edit ? "opacity-100" : "opacity-0",
        )}
      >
        Pick a tool below and start sketching
      </p>

      {edit && (
        <textarea
          ref={editor}
          aria-label="Text"
          spellCheck={false}
          defaultValue={edit.value}
          onChange={(e) => {
            const value = e.currentTarget.value;
            const v = live.current.edit;
            if (v) openEdit({ ...v, value });
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.preventDefault();
              e.stopPropagation();
              cancelEditor();
            } else if (
              e.key === "Enter" &&
              !e.shiftKey &&
              !e.nativeEvent.isComposing
            ) {
              e.preventDefault();
              commitEditor();
            }
          }}
          onBlur={commitEditor}
          className="absolute m-0 resize-none overflow-hidden whitespace-pre rounded-xs border-0 bg-transparent p-0 caret-text-primary outline-[1.5px] outline-text-muted outline-offset-[6px] outline-dashed"
          style={{
            left: edit.x,
            top: edit.y,
            width: editW,
            height: edit.value.split("\n").length * lineHeight(s.textSize),
            fontSize: s.textSize,
            fontWeight: s.textWeight,
            lineHeight: `${lineHeight(s.textSize)}px`,
            color: s.color === "ink" ? "var(--color-text-primary)" : s.color,
            // what is typed is drawn on the canvas in its own casing
            textTransform: "none",
          }}
        />
      )}

      <div className="-translate-x-1/2 absolute bottom-5 left-1/2">
        <Toolbar
          view={view}
          dir={nav.dir}
          settings={s}
          canUndo={hist.canUndo}
          canRedo={hist.canRedo}
          editing={edit !== null}
          reduce={reduce}
          onTool={pickTool}
          onBack={back}
          onOpen={(v) => go([...nav.stack, v])}
          onSet={(patch) => {
            setS((v) => ({ ...v, ...patch }));
            // the eraser's ring reads its size, so a change repaints
            request();
          }}
          onColor={pickColor}
          onStep={step}
          onUndo={undo}
          onRedo={redo}
          onAskClear={askClear}
          onClear={clear}
        />
      </div>
    </div>
  );
}
