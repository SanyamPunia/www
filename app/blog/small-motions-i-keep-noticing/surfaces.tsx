"use client";

import {
  AnimatePresence,
  animate,
  motion,
  useMotionValue,
  useReducedMotion,
  useTransform,
} from "motion/react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  Cycle,
  Frame,
  KNOB,
  Pill,
  RAISED,
  WELL,
} from "@/components/blogs/frame";
import {
  ChatIcon,
  CheckIcon,
  EnvelopeIcon,
  NoteIcon,
} from "@/components/icons";
import { cn } from "@/lib/utils";

/*
 * The demos for the surfaces in the post: the checked item that waits, the
 * caret that glides and the page that steps back behind a sheet.
 */

/* -------------------------------------------------------------- reminders */

type Leave = "waits" | "leaves at once";
const LEAVES = ["waits", "leaves at once"] as const;

const TASKS = [
  "Book the dentist",
  "Return the library books",
  "Call about the boiler",
  "Buy coffee filters",
] as const;

/** the one curve rows come and go on */
const ROW = { duration: 0.24, ease: [0.32, 0.72, 0, 1] } as const;

/** how long a checked item stays before it leaves */
const WAIT = 1500;

/**
 * A checked item fills its circle and stays for a moment, so the reader sees
 * which one they checked and can take it back. Switch the mode to see the
 * same list remove a row on the press.
 */
export function RemindersDemo() {
  const [leave, setLeave] = useState<Leave>("waits");
  const [rows, setRows] = useState(() =>
    TASKS.map((text, id) => ({ id, text, done: false })),
  );
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  useEffect(() => {
    const map = timers.current;
    return () => {
      for (const t of map.values()) clearTimeout(t);
    };
  }, []);

  const drop = (id: number) => {
    timers.current.delete(id);
    setRows((rs) => rs.filter((r) => r.id !== id));
  };

  const toggle = (id: number) => {
    const row = rows.find((r) => r.id === id);
    if (!row) return;
    if (row.done) {
      clearTimeout(timers.current.get(id));
      timers.current.delete(id);
      setRows((rs) => rs.map((r) => (r.id === id ? { ...r, done: false } : r)));
      return;
    }
    if (leave === "leaves at once") {
      drop(id);
      return;
    }
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, done: true } : r)));
    timers.current.set(
      id,
      setTimeout(() => drop(id), WAIT),
    );
  };

  const restore = () => {
    for (const t of timers.current.values()) clearTimeout(t);
    timers.current.clear();
    setRows(TASKS.map((text, id) => ({ id, text, done: false })));
  };

  return (
    <Frame
      hint="Check a task. Switch the mode to compare."
      controls={
        <>
          <Cycle
            value={leave}
            options={LEAVES}
            onChange={setLeave}
            label="Checked items"
          />
          <Pill
            onClick={restore}
            disabled={
              rows.length === TASKS.length && rows.every((r) => !r.done)
            }
          >
            Restore
          </Pill>
        </>
      }
      className="items-center"
    >
      <div
        className={cn(
          "flex w-full max-w-90 flex-col gap-2 rounded-lg p-5",
          RAISED,
        )}
      >
        <div className="flex items-center justify-between border-stroke border-b pb-3">
          <span className="text-body text-text-primary">Today</span>
          {/* the count sits in a slot cut into the card */}
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-meta text-text-secondary tabular-nums",
              WELL,
            )}
          >
            {rows.filter((r) => !r.done).length} left
          </span>
        </div>
        <ul className="flex flex-col">
          <AnimatePresence initial={false}>
            {rows.map((r, i) => (
              <motion.li
                key={r.id}
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={ROW}
                /* the line goes on the row's index, not on :first-child: a row that
                   is leaving stays in the list until its exit ends, so the new
                   first row kept a line under the header's own */
                className={cn(
                  "overflow-hidden border-stroke-soft",
                  i > 0 && "border-t",
                )}
              >
                {/* a real checkbox, visually hidden inside its label, so the
                  browser owns the checked state and the keyboard */}
                <label className="group/task relative flex h-12 cursor-pointer items-center gap-3">
                  <input
                    type="checkbox"
                    checked={r.done}
                    onChange={() => toggle(r.id)}
                    className="peer sr-only"
                  />
                  <span
                    aria-hidden="true"
                    className={cn(
                      "grid size-5.5 shrink-0 place-items-center rounded-full transition-[background-color,box-shadow] duration-200 peer-focus-visible:ring-2 peer-focus-visible:ring-text-primary/15 peer-focus-visible:ring-offset-2",
                      /* empty, the circle is cut into the card. Checked, it is
                         a lit ball sitting in that cut */
                      r.done
                        ? KNOB
                        : "bg-fill shadow-[inset_0_1px_2px_rgb(0_0_0/0.16),inset_0_0_0_1.5px_var(--color-stroke-strong),0_1px_0_rgb(255_255_255/0.9)] group-hover/task:shadow-[inset_0_1px_2px_rgb(0_0_0/0.16),inset_0_0_0_1.5px_var(--color-text-muted),0_1px_0_rgb(255_255_255/0.9)]",
                    )}
                  >
                    <motion.span
                      initial={false}
                      animate={{
                        scale: r.done ? 1 : 0.4,
                        opacity: r.done ? 1 : 0,
                      }}
                      transition={{
                        type: "spring",
                        visualDuration: 0.2,
                        bounce: 0.3,
                      }}
                      className="grid place-items-center"
                    >
                      <CheckIcon className="size-3" style={{ color: "#fff" }} />
                    </motion.span>
                  </span>
                  <span
                    className={cn(
                      "text-body transition-colors duration-200",
                      r.done ? "text-text-muted" : "text-text-primary",
                    )}
                  >
                    {r.text}
                  </span>
                </label>
              </motion.li>
            ))}
            {/* the empty state grows on the same curve the last row shrinks
                on, so the two heights sum to one row and the card holds still */}
            {rows.length === 0 ? (
              <motion.li
                key="empty"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={ROW}
                className="overflow-hidden"
              >
                <span className="grid h-12 place-items-center text-body text-text-muted">
                  All done
                </span>
              </motion.li>
            ) : null}
          </AnimatePresence>
        </ul>
      </div>
    </Frame>
  );
}

/* ------------------------------------------------------------------ caret */

type Caret = "glides" | "jumps";
const CARETS = ["glides", "jumps"] as const;

const START = "Click anywhere in this line, or type into it.";

/**
 * A text field whose native caret is transparent and whose drawn caret
 * travels to where the native one would be. An input has no `Range` into its
 * text, so the caret is measured: the text before the selection, in the
 * field's own computed font and casing, less how far the field has scrolled.
 */
export function CaretDemo() {
  const reduce = useReducedMotion();
  const [mode, setMode] = useState<Caret>("glides");
  const [visible, setVisible] = useState(false);
  const field = useRef<HTMLInputElement>(null);
  const blink = useRef<HTMLSpanElement>(null);
  const canvas = useRef<CanvasRenderingContext2D | null>(null);
  const x = useMotionValue(0);
  const placed = useRef(false);
  const glide = mode === "glides" && !reduce;

  useEffect(() => {
    const el = field.current;
    if (!el) return;

    /* a press that focuses the field: the field reports its old caret on
       focus and the clicked one only after, so nothing is placed until the
       press ends, and then it lands with no glide */
    let arriving = false;
    const measure = () => {
      if (arriving || document.activeElement !== el) return;
      const start = el.selectionStart ?? 0;
      const end = el.selectionEnd ?? 0;
      setVisible(start === end);
      if (start !== end) return;
      const cs = getComputedStyle(el);
      if (!canvas.current)
        canvas.current = document.createElement("canvas").getContext("2d");
      const ctx = canvas.current;
      if (!ctx) return;
      ctx.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
      ctx.letterSpacing =
        cs.letterSpacing === "normal" ? "0px" : cs.letterSpacing;
      let before = el.value.slice(0, start);
      if (cs.textTransform === "lowercase") before = before.toLowerCase();
      const target =
        Number.parseFloat(cs.paddingLeft) +
        ctx.measureText(before).width -
        el.scrollLeft;
      if (placed.current && glide) {
        animate(x, target, { type: "spring", visualDuration: 0.13, bounce: 0 });
      } else {
        x.jump(target);
      }
      placed.current = true;
      /* a caret that just moved is solid, then starts to blink */
      const b = blink.current;
      if (b) {
        b.style.animation = "none";
        void b.offsetWidth;
        b.style.animation = "";
      }
    };

    const hide = () => {
      setVisible(false);
      placed.current = false;
    };

    const press = () => {
      if (document.activeElement === el) return;
      arriving = true;
      const land = () => {
        arriving = false;
        placed.current = false;
        measure();
      };
      window.addEventListener("pointerup", land, { once: true });
      window.addEventListener("pointercancel", land, { once: true });
    };

    document.addEventListener("selectionchange", measure);
    el.addEventListener("input", measure);
    el.addEventListener("focus", measure);
    el.addEventListener("scroll", measure);
    el.addEventListener("blur", hide);
    el.addEventListener("pointerdown", press);
    return () => {
      document.removeEventListener("selectionchange", measure);
      el.removeEventListener("input", measure);
      el.removeEventListener("focus", measure);
      el.removeEventListener("scroll", measure);
      el.removeEventListener("blur", hide);
      el.removeEventListener("pointerdown", press);
    };
  }, [glide, x]);

  return (
    <Frame
      hint="Click around the line. Switch the mode to compare."
      controls={
        <Cycle value={mode} options={CARETS} onChange={setMode} label="Caret" />
      }
      className="items-center"
    >
      <div className="relative w-full max-w-110">
        <input
          ref={field}
          defaultValue={START}
          aria-label="Text field"
          spellCheck={false}
          className={cn(
            "h-14 w-full rounded-lg px-5 text-body text-text-primary caret-transparent transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-primary/15",
            RAISED,
          )}
        />
        <motion.span
          aria-hidden="true"
          style={{ x }}
          className={cn(
            "pointer-events-none absolute top-1/2 left-0 -mt-3 h-6 w-0.5",
            visible ? "opacity-100" : "opacity-0",
          )}
        >
          <span
            ref={blink}
            className="block size-full rounded-full bg-text-primary animate-[caret-blink_1.1s_ease-in-out_0.5s_infinite]"
          />
        </motion.span>
      </div>
    </Frame>
  );
}

/* ------------------------------------------------------------------ sheet */

/*
 * The phone's photos and its share targets. The hues are scoped here: a photo's
 * colours are the photo, and an app's tile colour is what names it at a glance.
 */
const PHOTOS = [
  "linear-gradient(160deg, #fbd38d, #f6895a)",
  "linear-gradient(200deg, #9ad0f5, #3f7fc1)",
  "linear-gradient(170deg, #c7e6b4, #5c9a5a)",
  "radial-gradient(circle at 30% 30%, #ffe8a3, #e0884a 70%)",
  "linear-gradient(180deg, #2c3e66, #8a6fb0)",
  "linear-gradient(150deg, #f2c6d6, #c4607e)",
  "linear-gradient(190deg, #b8e2df, #3e8f8a)",
  "linear-gradient(160deg, #e9dcc6, #a3825a)",
  "linear-gradient(170deg, #ffcf6e, #d9534f)",
] as const;

const TARGETS = [
  { name: "Messages", tile: "#2e9e4f", Icon: ChatIcon },
  { name: "Mail", tile: "#2f6fd6", Icon: EnvelopeIcon },
  { name: "Notes", tile: "#c98a12", Icon: NoteIcon },
] as const;

/** how long a chosen target shows its tick before the sheet leaves */
const SEND_HOLD = 520;

/**
 * Closing is a tween, not the opening spring. A spring released from rest
 * crawls off the mark and then drops away, which read as the sheet hesitating
 * and then vanishing. This curve leaves at once and settles into place.
 */
const SHEET_CLOSE = { duration: 0.42, ease: [0.32, 0.72, 0, 1] } as const;

const SHEET_SPRING = {
  type: "spring",
  visualDuration: 0.38,
  bounce: 0.08,
} as const;

/**
 * A sheet over a page. The page scales back, rounds its corners and dims by
 * how far the sheet is open, read off the sheet's own position, so dragging
 * the sheet down brings the page forward at every point of the drag.
 */
export function SheetDemo() {
  const reduce = useReducedMotion();
  const [open, setOpen] = useState(false);
  const [height, setHeight] = useState(0);
  const [sent, setSent] = useState<string | null>(null);
  const send = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(send.current), []);
  const sheet = useRef<HTMLDivElement>(null);
  const opener = useRef<HTMLButtonElement>(null);
  const done = useRef<HTMLButtonElement>(null);
  const y = useMotionValue(2000);
  const p = useMotionValue(0);
  const scale = useTransform(p, [0, 1], [1, 0.92]);
  const radius = useTransform(p, [0, 1], [0, 16]);
  const lift = useTransform(p, [0, 1], [0, 10]);
  const scrim = useTransform(p, [0, 1], [0, 0.28]);

  useLayoutEffect(() => {
    const el = sheet.current;
    if (!el) return;
    const measure = () => {
      const h = el.offsetHeight;
      setHeight(h);
      /* park a closed sheet below the screen, but never over a sheet that is
         on its way there: this runs when `open` flips, and jumping here cut
         every close off on its first frame */
      if (!open && !y.isAnimating()) y.jump(h);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [open, y]);

  useEffect(() => {
    if (!height) return;
    const update = (v: number) =>
      p.set(1 - Math.max(0, Math.min(1, v / height)));
    update(y.get());
    return y.on("change", update);
  }, [height, p, y]);

  const go = (next: boolean, keyboard = false) => {
    clearTimeout(send.current);
    if (next) setSent(null);
    setOpen(next);
    animate(
      y,
      next ? 0 : height,
      reduce ? { duration: 0 } : next ? SHEET_SPRING : SHEET_CLOSE,
    );
    if (keyboard)
      requestAnimationFrame(() => (next ? done : opener).current?.focus());
  };

  useEffect(() => {
    if (!open) return;
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") go(false, true);
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  });

  return (
    <Frame hint="Open the sheet, then drag it down." className="items-center">
      <div className="rounded-[2.25rem] bg-inverse-bg p-1.5 shadow-[0_18px_40px_-16px_rgb(0_0_0/0.4)]">
        <div className="relative h-100 w-60 overflow-clip rounded-[1.9rem] bg-inverse-bg">
          <motion.div
            style={{ scale, borderRadius: radius, y: lift }}
            className="absolute inset-0 origin-top overflow-clip bg-bg"
          >
            <div className="flex flex-col gap-4 px-5 pt-10">
              <span className="text-body text-text-primary">Photos</span>
              <div className="grid grid-cols-3 gap-1.5">
                {PHOTOS.map((bg, i) => (
                  <span
                    // biome-ignore lint/suspicious/noArrayIndexKey: a fixed grid of drawn photos
                    key={i}
                    className="aspect-square rounded-md shadow-[inset_0_0_0_1px_rgb(0_0_0/0.06)]"
                    style={{ background: bg }}
                  />
                ))}
              </div>
              <button
                ref={opener}
                type="button"
                onClick={(e) => go(true, e.detail === 0)}
                className="h-10 cursor-pointer pb-[0.16em] rounded-full bg-text-primary text-body text-bg transition-colors duration-150 hover:bg-text-primary/85 active:bg-text-primary/75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-primary/15 focus-visible:ring-offset-2"
              >
                Share
              </button>
            </div>
            <motion.div
              aria-hidden="true"
              style={{ opacity: scrim }}
              className="pointer-events-none absolute inset-0 bg-black"
            />
          </motion.div>
          <motion.div
            ref={sheet}
            inert={!open}
            drag="y"
            dragConstraints={{ top: 0, bottom: height }}
            dragElastic={{ top: 0.06, bottom: 0 }}
            dragMomentum={false}
            onDragEnd={(_, info) => {
              const shut = y.get() > height * 0.3 || info.velocity.y > 500;
              go(!shut);
            }}
            style={{ y }}
            className="absolute inset-x-0 bottom-0 flex h-[72%] cursor-grab touch-none flex-col rounded-t-[1.4rem] bg-bg px-5 pb-5 shadow-[0_-8px_24px_-12px_rgb(0_0_0/0.3)] active:cursor-grabbing"
          >
            <span
              aria-hidden="true"
              className="mx-auto mt-2 mb-4 h-1.5 w-10 rounded-full bg-stroke-strong"
            />
            <span className="mb-4 text-body text-text-primary">
              Share 3 photos
            </span>
            <div className="-mx-2 flex flex-col">
              {TARGETS.map(({ name, tile, Icon }) => (
                <button
                  key={name}
                  type="button"
                  disabled={sent !== null}
                  onClick={(e) => {
                    const keyboard = e.detail === 0;
                    setSent(name);
                    /* the row confirms first, then the sheet leaves on its
                       own curve, so sending reads as one gesture finishing */
                    send.current = setTimeout(
                      () => go(false, keyboard),
                      reduce ? 0 : SEND_HOLD,
                    );
                  }}
                  className={cn(
                    "flex h-11 cursor-pointer items-center gap-3 rounded-md px-2 text-left transition-colors duration-150 hover:bg-fill active:bg-fill-hover active:duration-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-primary/15 disabled:cursor-default",
                    sent === name && "bg-fill",
                  )}
                >
                  <span
                    className="grid size-8 shrink-0 place-items-center rounded-md shadow-[inset_0_0_0_1px_rgb(0_0_0/0.06)]"
                    style={{ background: tile, color: "#fff" }}
                  >
                    <Icon aria-hidden="true" className="size-4" />
                  </span>
                  <span className="flex-1 pb-[0.16em] text-body text-text-primary">
                    {name}
                  </span>
                  <AnimatePresence>
                    {sent === name ? (
                      <motion.span
                        initial={{ scale: 0.4, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{
                          type: "spring",
                          visualDuration: 0.22,
                          bounce: 0.35,
                        }}
                        className="grid size-5 place-items-center rounded-full bg-text-primary"
                      >
                        <CheckIcon
                          aria-hidden="true"
                          className="size-3 text-bg"
                        />
                      </motion.span>
                    ) : null}
                  </AnimatePresence>
                </button>
              ))}
            </div>
            <span aria-live="polite" className="sr-only">
              {sent ? `Sent to ${sent}` : ""}
            </span>
            <button
              ref={done}
              type="button"
              onClick={(e) => go(false, e.detail === 0)}
              className="mt-auto h-10 cursor-pointer pb-[0.16em] rounded-full bg-fill text-body text-text-primary transition-colors duration-150 hover:bg-fill-hover active:bg-fill-active focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-primary/15"
            >
              Done
            </button>
          </motion.div>
        </div>
      </div>
    </Frame>
  );
}
