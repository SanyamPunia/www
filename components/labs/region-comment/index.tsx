"use client";

import { CheckIcon, TrashIcon } from "@phosphor-icons/react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { FOCUS } from "@/components/lab/controls";
import { Tooltip, TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  COMPOSER_H,
  PILL_H,
  type Placed,
  placeComposer,
  placePill,
  type Rect,
} from "./place";
import { Scene } from "./scene";

/*
 * A poster under review. Drag across it to mark a region, and a composer comes
 * up under the box to say what should change there. Post it and the box keeps
 * its colour and carries the comment as a pill, so the poster ends up covered
 * in the notes a reviewer left on it.
 *
 * **The composer answers the box, not the page.** It lands under the box's
 * left edge and travels a few pixels away from the box as it fades in, so it
 * reads as coming out of the thing it is about. A pill that is pressed opens
 * the same composer in the same place, and the pill steps aside while it is
 * open.
 */

/**
 * One colour per comment, cycling. Scoped to this experiment and not tokens:
 * the hue is what ties a box to its pill and to its composer's post button, so
 * it carries meaning rather than decorating. Every one clears 4.5:1 under the
 * pill's white text.
 */
const HUES = ["#3a63d8", "#c43f36", "#1f7a50", "#6c45c4", "#95590a"] as const;

/** one whole dash plus its gap, which the `ants` keyframe also moves by */
const DASH = "6 5";
const RADIUS = 14;
/** a click with no drag drops a box this size around the point */
const DROP = { w: 0.22, h: 0.3 };
/** a drag smaller than this on either side is a slip rather than a region */
const MIN_PX = 14;

/** 200ms on the strongest ease-out in the lab, so the first frames carry it */
const ENTER = { duration: 0.2, ease: [0.23, 1, 0.32, 1] } as const;
const LEAVE = { duration: 0.12, ease: [0.4, 0, 1, 1] } as const;

const LIFT = [
  "0 1px 2px rgb(0 0 0 / 0.06)",
  "0 8px 16px -6px rgb(0 0 0 / 0.1)",
  "0 20px 40px -16px rgb(0 0 0 / 0.14)",
].join(", ");

interface Note {
  id: number;
  hue: number;
  rect: Rect;
  text: string;
}

interface Editing {
  note: Note;
  /** a box that was just drawn and has no comment yet */
  fresh: boolean;
}

const within = (v: number, max: number) => Math.min(Math.max(v, 0), max);

export default function RegionComment() {
  const stage = useRef<HTMLDivElement>(null);
  const draft = useRef<HTMLDivElement>(null);
  const field = useRef<HTMLTextAreaElement>(null);

  const [size, setSize] = useState({ w: 0, h: 0 });
  const [notes, setNotes] = useState<Note[]>([]);
  const [editing, setEditing] = useState<Editing | null>(null);
  const [text, setText] = useState("");
  /** a saved comment's delete takes two presses, and this is the first */
  const [armed, setArmed] = useState(false);
  /** the pill under the pointer, whose box steps up to say which one it is */
  const [hot, setHot] = useState<number | null>(null);

  const nextId = useRef(1);
  const nextHue = useRef(0);
  const drag = useRef<{
    x0: number;
    y0: number;
    rect: DOMRect;
    moved: boolean;
    /** this press closed a composer, so a plain click drops nothing */
    dismissed: boolean;
  } | null>(null);
  /** a pill to hand focus to once it has mounted, after a keyboard close */
  const chase = useRef<number | null>(null);

  const trimmed = text.trim();
  const dirty = editing
    ? editing.fresh
      ? trimmed.length > 0
      : trimmed !== editing.note.text
    : false;
  const canPost = trimmed.length > 0 && dirty;

  useEffect(() => {
    const node = stage.current;
    if (!node) return;
    const observer = new ResizeObserver(([entry]) => {
      setSize({ w: entry.contentRect.width, h: entry.contentRect.height });
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: the pill to chase mounts on the commit that closes the composer, so this runs after each one
  useEffect(() => {
    if (chase.current === null) return;
    const id = chase.current;
    chase.current = null;
    const pill = stage.current?.querySelector<HTMLElement>(
      `[data-pill="${id}"]`,
    );
    if (!pill) return;
    /*
     * Focus lands on the pill so a keyboard reader keeps their place, but the
     * focus mark stays off until they move. Right after a post the mark only
     * says where the composer went, which the pill arriving already says, and
     * it read as a stray border. `data-quiet` clears on blur, so tabbing back
     * to the pill shows the mark as usual.
     */
    pill.dataset.quiet = "true";
    pill.focus({ preventScroll: true });
  }, [editing, notes]);

  const open = (note: Note, fresh: boolean) => {
    setEditing({ note, fresh });
    setText(note.text);
    setArmed(false);
  };

  const openFresh = (rect: Rect) =>
    open(
      {
        id: nextId.current++,
        hue: nextHue.current % HUES.length,
        rect,
        text: "",
      },
      true,
    );

  const close = (viaKey: boolean) => {
    if (!editing) return;
    if (viaKey && !editing.fresh) chase.current = editing.note.id;
    setEditing(null);
    setArmed(false);
  };

  const post = (viaKey: boolean) => {
    if (!editing || !canPost) return;
    const { note, fresh } = editing;
    if (fresh) {
      setNotes((all) => [...all, { ...note, text: trimmed }]);
      nextHue.current += 1;
    } else {
      setNotes((all) =>
        all.map((n) => (n.id === note.id ? { ...n, text: trimmed } : n)),
      );
    }
    if (viaKey) chase.current = note.id;
    setEditing(null);
    setArmed(false);
  };

  const trash = () => {
    if (!editing) return;
    if (editing.fresh) return close(false);
    if (!armed) return setArmed(true);
    const id = editing.note.id;
    setNotes((all) => all.filter((n) => n.id !== id));
    setHot(null);
    setEditing(null);
    setArmed(false);
  };

  /*
   * **A composer holding unsaved words does not close on a stray press.** The
   * press goes to the field instead, so a reader who reaches for the poster
   * mid-sentence loses nothing. A clean composer closes, and the same press
   * starts the next box.
   */
  const guard = () => {
    if (editing && dirty) {
      field.current?.focus({ preventScroll: true });
      return true;
    }
    return false;
  };

  /*
   * The stage's listeners are bound to the node rather than written as JSX
   * props, the call `document-pocket` and `stamp-collection` make: it is a
   * surface the pointer draws on, with no honest interactive role to carry.
   * They read the latest render through a ref, so they are bound once.
   */
  const live = useRef({ guard, openFresh, editing, size });
  live.current = { guard, openFresh, editing, size };

  useEffect(() => {
    const node = stage.current;
    const box = draft.current;
    if (!node || !box) return;

    const point = (e: PointerEvent, r: DOMRect) => ({
      x: Math.min(Math.max(e.clientX - r.left, 0), r.width),
      y: Math.min(Math.max(e.clientY - r.top, 0), r.height),
    });

    const down = (e: PointerEvent) => {
      if (e.button !== 0) return;
      if ((e.target as Element).closest("[data-ui]")) return;
      // no selection anchors on the prose below, and no focus moves
      e.preventDefault();
      const { guard, editing } = live.current;
      if (guard()) return;

      const rect = node.getBoundingClientRect();
      const { x, y } = point(e, rect);
      drag.current = {
        x0: x,
        y0: y,
        rect,
        moved: false,
        dismissed: editing !== null,
      };
      node.setPointerCapture(e.pointerId);
      node.dataset.drawing = "true";
      box.style.setProperty("--ink", HUES[nextHue.current % HUES.length]);
      if (editing) setEditing(null);
    };

    const move = (e: PointerEvent) => {
      const d = drag.current;
      if (!d) return;
      const { x, y } = point(e, d.rect);
      if (!d.moved && Math.hypot(x - d.x0, y - d.y0) < 4) return;
      d.moved = true;
      // written to the node, so a drag renders nothing
      const W = d.rect.width;
      const H = d.rect.height;
      box.style.display = "block";
      box.style.left = `${(Math.min(x, d.x0) / W) * 100}%`;
      box.style.top = `${(Math.min(y, d.y0) / H) * 100}%`;
      box.style.width = `${(Math.abs(x - d.x0) / W) * 100}%`;
      box.style.height = `${(Math.abs(y - d.y0) / H) * 100}%`;
    };

    const end = (e: PointerEvent, commit: boolean) => {
      const d = drag.current;
      if (!d) return;
      drag.current = null;
      box.style.display = "none";
      delete node.dataset.drawing;
      if (node.hasPointerCapture(e.pointerId))
        node.releasePointerCapture(e.pointerId);
      if (!commit) return;

      const W = d.rect.width;
      const H = d.rect.height;
      const { x, y } = point(e, d.rect);

      if (d.moved) {
        const w = Math.abs(x - d.x0);
        const h = Math.abs(y - d.y0);
        if (w < MIN_PX || h < MIN_PX) return;
        live.current.openFresh({
          x: Math.min(x, d.x0) / W,
          y: Math.min(y, d.y0) / H,
          w: w / W,
          h: h / H,
        });
        return;
      }

      // a click that only dismissed a composer drops nothing on top of that
      if (d.dismissed) return;
      live.current.openFresh({
        x: within(x / W - DROP.w / 2, 1 - DROP.w),
        y: within(y / H - DROP.h / 2, 1 - DROP.h),
        w: DROP.w,
        h: DROP.h,
      });
    };

    const up = (e: PointerEvent) => end(e, true);
    const cancel = (e: PointerEvent) => end(e, false);

    node.addEventListener("pointerdown", down);
    node.addEventListener("pointermove", move);
    node.addEventListener("pointerup", up);
    node.addEventListener("pointercancel", cancel);
    return () => {
      node.removeEventListener("pointerdown", down);
      node.removeEventListener("pointermove", move);
      node.removeEventListener("pointerup", up);
      node.removeEventListener("pointercancel", cancel);
    };
  }, []);

  const W = size.w;
  const H = size.h;
  const ready = W > 0 && H > 0;
  const openId = editing?.note.id ?? null;

  const boxes = editing?.fresh ? [...notes, editing.note] : notes;

  return (
    <TooltipProvider delayDuration={200}>
      <div
        ref={stage}
        className={cn(
          "relative aspect-8/5 w-full touch-none select-none overflow-hidden rounded-lg",
          // a crosshair says the surface is drawn on, which a pointer does not
          "cursor-crosshair",
        )}
      >
        <Scene />

        {ready &&
          boxes.map((note) => (
            <Box
              key={note.id}
              note={note}
              active={note.id === openId}
              hot={note.id === hot}
            />
          ))}

        <div
          ref={draft}
          aria-hidden="true"
          className="pointer-events-none absolute hidden"
          style={{
            backgroundColor: "color-mix(in srgb, var(--ink) 14%, transparent)",
          }}
        >
          <Dashes color="var(--ink)" marching={false} />
        </div>

        {/*
         * No presence on the pills. A pill only unmounts when its composer opens
         * in its place, and an exit fade left a ghost pill showing through the
         * composer while that faded in over it.
         */}
        {ready &&
          notes
            .filter((n) => n.id !== openId)
            .map((note) => (
              <Pill
                key={note.id}
                note={note}
                place={placePill(note.rect, W, H)}
                onOpen={() => {
                  if (!guard()) open(note, false);
                }}
                onHot={(on) => setHot(on ? note.id : null)}
              />
            ))}

        {ready && (
          <AnimatePresence>
            {editing && (
              <Composer
                key={editing.note.id}
                field={field}
                hue={HUES[editing.note.hue]}
                place={placeComposer(editing.note.rect, W, H)}
                text={text}
                fresh={editing.fresh}
                armed={armed}
                canPost={canPost}
                onText={(v) => {
                  setText(v);
                  setArmed(false);
                }}
                onPost={post}
                onClose={close}
                onTrash={trash}
              />
            )}
          </AnimatePresence>
        )}

        {/*
         * The keyboard's way to mark a region: a box dropped in the middle of the
         * poster with its composer open. Hidden until it has focus, since a
         * pointer has the whole poster to draw on.
         */}
        <button
          type="button"
          data-ui
          onClick={() => {
            if (!guard()) openFresh({ x: 0.39, y: 0.35, w: DROP.w, h: DROP.h });
          }}
          className={cn(
            "sr-only focus-visible:not-sr-only focus-visible:absolute focus-visible:top-3 focus-visible:left-3 focus-visible:z-30",
            "cursor-pointer rounded-full bg-bg px-3 py-1.5 text-action text-text-primary",
            FOCUS,
          )}
        >
          Mark a region
        </button>
      </div>
    </TooltipProvider>
  );
}

function Dashes({ color, marching }: { color: string; marching: boolean }) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      className="absolute inset-0 size-full overflow-visible"
    >
      {/*
       * A dashed CSS border spaces its dashes to fit each side, so no two boxes
       * match. An SVG rect with no viewBox is one unit a pixel, and the dash is
       * the same on every box at every size.
       */}
      <rect
        width="100%"
        height="100%"
        fill="none"
        stroke={color}
        strokeWidth="1.6"
        strokeDasharray={DASH}
        className={cn(
          marching && "motion-safe:animate-[ants_0.6s_linear_infinite]",
        )}
      />
    </svg>
  );
}

function Box({
  note,
  active,
  hot,
}: {
  note: Note;
  active: boolean;
  hot: boolean;
}) {
  const ink = HUES[note.hue];
  const { x, y, w, h } = note.rect;
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute transition-[background-color] duration-150"
      style={{
        left: `${x * 100}%`,
        top: `${y * 100}%`,
        width: `${w * 100}%`,
        height: `${h * 100}%`,
        backgroundColor: `color-mix(in srgb, ${ink} ${active || hot ? 22 : 12}%, transparent)`,
      }}
    >
      <Dashes color={ink} marching={active} />
    </div>
  );
}

function Pill({
  note,
  place,
  onOpen,
  onHot,
}: {
  note: Note;
  place: ReturnType<typeof placePill>;
  onOpen: () => void;
  onHot: (on: boolean) => void;
}) {
  return (
    <motion.button
      type="button"
      data-ui
      data-pill={note.id}
      aria-label={`Edit comment: ${note.text}`}
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0, transition: { ...ENTER, delay: 0.06 } }}
      onClick={onOpen}
      onPointerEnter={() => onHot(true)}
      onPointerLeave={() => onHot(false)}
      onFocus={() => onHot(true)}
      onBlur={(e) => {
        delete e.currentTarget.dataset.quiet;
        onHot(false);
      }}
      className={cn(
        "absolute z-10 flex cursor-pointer items-center rounded-full px-3 text-meta leading-none",
        "transition-[filter] duration-150 hover:brightness-110",
        /*
         * An outline in the pill's own hue with a clear gap, never the site's
         * ring. That ring paints its 2px offset in white, which over a poster
         * reads as a white border stuck to the pill, and it is what a reader
         * saw on every keyboard post, since focus lands on the new pill.
         */
        "outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-solid",
        "data-[quiet=true]:outline-none",
      )}
      style={{
        outlineColor: HUES[note.hue],
        left: place.left,
        top: place.top,
        height: PILL_H,
        maxWidth: place.maxWidth,
        backgroundColor: HUES[note.hue],
        // theme-constant fill, so the ink is pinned rather than a token
        color: "#fff",
      }}
    >
      <span className="truncate">{note.text}</span>
    </motion.button>
  );
}

function Composer({
  field,
  hue,
  place,
  text,
  fresh,
  armed,
  canPost,
  onText,
  onPost,
  onClose,
  onTrash,
}: {
  field: React.RefObject<HTMLTextAreaElement | null>;
  hue: string;
  place: Placed;
  text: string;
  fresh: boolean;
  armed: boolean;
  canPost: boolean;
  onText: (value: string) => void;
  onPost: (viaKey: boolean) => void;
  onClose: (viaKey: boolean) => void;
  onTrash: () => void;
}) {
  // travels away from the box it belongs to, so it reads as coming out of it
  const from = place.side === "above" ? 6 : -6;

  useEffect(() => {
    field.current?.focus({ preventScroll: true });
    // the caret goes to the end of a comment being edited, not its start
    const n = field.current?.value.length ?? 0;
    field.current?.setSelectionRange(n, n);
  }, [field]);

  const trashLabel = fresh
    ? "Discard"
    : armed
      ? "Press again to delete"
      : "Delete comment";

  return (
    <motion.div
      data-ui
      initial={{ opacity: 0, y: from }}
      animate={{ opacity: 1, y: 0, transition: ENTER }}
      exit={{ opacity: 0, y: from * 0.66, transition: LEAVE }}
      className={cn(
        "absolute z-20 flex cursor-auto flex-col bg-bg p-3",
        "outline-1 outline-stroke outline-solid transition-[outline-color] duration-200 focus-within:outline-stroke-strong",
      )}
      style={{
        left: place.left,
        top: place.top,
        width: place.width,
        height: COMPOSER_H,
        borderRadius: RADIUS,
        // inline, so the edge is an outline rather than a ring the shadow replaces
        boxShadow: LIFT,
      }}
    >
      <textarea
        ref={field}
        value={text}
        onChange={(e) => onText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault();
            onPost(true);
          } else if (e.key === "Escape") {
            e.preventDefault();
            onClose(true);
          }
        }}
        placeholder="Leave a comment"
        aria-label="Comment on this region"
        rows={2}
        className={cn(
          "min-h-0 w-full flex-1 resize-none bg-transparent text-body text-text-primary",
          "placeholder:text-body placeholder:text-text-muted",
          // the card's own edge steps up while this has focus, which is always
          // while the composer is open, so the field draws no ring of its own
          "outline-none transition-all duration-200",
        )}
      />
      <div className="flex items-center gap-1.5">
        <kbd className="mr-auto font-mono text-meta text-text-muted">
          enter to post
        </kbd>
        <Tooltip label={trashLabel}>
          <button
            type="button"
            aria-label={trashLabel}
            onClick={onTrash}
            className={cn(
              "flex size-8 cursor-pointer items-center justify-center rounded-full transition-all duration-150",
              armed
                ? "bg-danger hover:bg-danger/90"
                : "text-text-secondary hover:bg-fill hover:text-text-primary active:bg-fill-hover",
              FOCUS,
            )}
            style={armed ? { color: "#fff" } : undefined}
          >
            <TrashIcon aria-hidden="true" className="size-4" />
          </button>
        </Tooltip>
        <Tooltip label="Post (Enter)">
          <button
            type="button"
            aria-label="Post comment"
            disabled={!canPost}
            onClick={() => onPost(false)}
            className={cn(
              "flex size-8 cursor-pointer items-center justify-center rounded-full transition-all duration-150",
              "hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:brightness-100",
              FOCUS,
            )}
            style={{ backgroundColor: hue, color: "#fff" }}
          >
            <CheckIcon aria-hidden="true" className="size-4" />
          </button>
        </Tooltip>
      </div>
    </motion.div>
  );
}
