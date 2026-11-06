"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  type MouseEvent as ReactMouseEvent,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import {
  ArrowsClockwiseIcon,
  DownloadSimpleIcon,
  FileTextIcon,
  FolderIcon,
  FolderOpenIcon,
  ImageIcon,
  PauseIcon,
  PlayIcon,
  SquaresFourIcon,
  XIcon,
} from "@/components/icons";
import { Tooltip, TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { armSound, done, failed, tuck } from "./download-sound";
import {
  arc,
  bytes,
  duration,
  easeInOut,
  HOST,
  type Kind,
  left,
  OFFERS,
  type Offer,
  of,
  PATH,
  rate,
  unique,
} from "./downloads";

/*
 * ─────────────────────────────────────────────────────────
 * STORYBOARD, one download
 *
 *    0ms   press Download: the transfer starts, a chip of the file lifts
 *          off the press and flies along an arc to the toolbar
 *  620ms   the chip lands: the arrow in the button drops and a ring
 *          starts filling round it, for every download in the batch
 *   ...    the ring is the batch's bytes, so several downloads share it
 *   end    the last one in the batch finishes: the ring closes in
 *          `success`, holds, and fades. A failure holds a `danger` dot
 *          until the list is opened
 * ─────────────────────────────────────────────────────────
 */

/** The window stands on the stage and the address is cut into its bar */
const RAISED =
  "inset 0 1px 0 rgb(255 255 255), inset 0 -1px 0 rgb(0 0 0 / 0.04), 0 1px 2px rgb(0 0 0 / 0.08), 0 6px 12px -4px rgb(0 0 0 / 0.1), 0 20px 36px -14px rgb(0 0 0 / 0.16)";
const WELL =
  "inset 0 1px 3px rgb(0 0 0 / 0.13), inset 0 1px 1px rgb(0 0 0 / 0.05), 0 1px 0 rgb(255 255 255)";
const LIFT = "0 2px 6px rgb(0 0 0 / 0.06), 0 12px 28px -8px rgb(0 0 0 / 0.22)";

/** how long a chip takes to fly from the page to the button, in ms */
const FLIGHT = 620;
/** how long a finished batch shows its closed ring before it fades */
const HOLD = 1400;
/** how long "show in folder" holds its line */
const REVEAL = 1600;

const FOCUS =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-primary/15 focus-visible:ring-offset-2";
const ICON_BUTTON = cn(
  "grid size-7 shrink-0 cursor-pointer place-items-center rounded-md text-text-muted transition-all duration-150 hover:bg-fill hover:text-text-primary active:bg-fill-hover",
  FOCUS,
);

const KIND_ICON: Record<Kind, typeof FileTextIcon> = {
  app: SquaresFourIcon,
  doc: FileTextIcon,
  archive: FolderIcon,
  image: ImageIcon,
};

type Status = "active" | "paused" | "failed" | "done";
type Ring = "idle" | "active" | "done" | "failed";

interface Item {
  id: number;
  name: string;
  kind: Kind;
  size: number;
  status: Status;
}

/** a transfer's moving parts, read and written by the frame loop alone */
interface Sim {
  got: number;
  total: number;
  /** bytes a second at the middle of the wander */
  base: number;
  seed: number;
  t: number;
  /** the rate the time left is worked from, smoothed so it does not jitter */
  smooth: number;
  failAt?: number;
  /** what the status line says now, so it is only written when it changes */
  text: string;
}

interface Flight {
  id: number;
  kind: Kind;
  from: { x: number; y: number };
  to: { x: number; y: number };
  t0: number;
}

export default function DownloadShelf() {
  const reduce = useReducedMotion();
  const reduced = useRef(false);
  reduced.current = !!reduce;

  const [items, setItems] = useState<Item[]>([]);
  const [flights, setFlights] = useState<Flight[]>([]);
  const [open, setOpen] = useState(false);
  const [ring, setRing] = useState<Ring>("idle");
  const [reveal, setReveal] = useState<number | null>(null);
  const [status, setStatus] = useState("");
  const [tip, setTip] = useState(false);

  const itemsRef = useRef(items);
  itemsRef.current = items;
  const flightsRef = useRef(flights);
  flightsRef.current = flights;
  const ringRef = useRef(ring);
  ringRef.current = ring;

  const sims = useRef(new Map<number, Sim>());
  const bars = useRef(new Map<number, HTMLElement>());
  const texts = useRef(new Map<number, HTMLElement>());
  const chips = useRef(new Map<number, HTMLElement>());
  /** the downloads the ring is counting: everything started since it was last empty */
  const batch = useRef(new Set<number>());
  const seq = useRef(0);
  const raf = useRef(0);
  const last = useRef(0);
  const holdTimer = useRef(0);
  const revealTimer = useRef(0);

  const win = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const arrow = useRef<HTMLSpanElement>(null);
  const circle = useRef<SVGCircleElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const viaKey = useRef(false);
  const flaked = useRef(false);

  /** writes the ring, each row's bar and each running row's line from the sims */
  const paint = useCallback(() => {
    let got = 0;
    let total = 0;
    for (const id of batch.current) {
      const s = sims.current.get(id);
      if (!s) continue;
      got += s.got;
      total += s.total;
    }
    const p =
      ringRef.current === "done" ? 1 : total > 0 ? Math.min(1, got / total) : 0;
    if (circle.current) circle.current.style.strokeDashoffset = String(1 - p);

    for (const [id, el] of bars.current) {
      const s = sims.current.get(id);
      if (s) el.style.transform = `scaleX(${s.got / s.total})`;
    }
    for (const [id, el] of texts.current) {
      const s = sims.current.get(id);
      if (!s) continue;
      const paused =
        itemsRef.current.find((i) => i.id === id)?.status === "paused";
      const text = paused
        ? `paused, ${of(s.got, s.total)}`
        : `${of(s.got, s.total)}, ${left((s.total - s.got) / Math.max(1, s.smooth))}`;
      if (text !== s.text || el.textContent !== text) {
        s.text = text;
        el.textContent = text;
      }
    }
  }, []);

  /** a batch with nothing running or paused is over: close the ring, or mark the failure */
  const settle = useCallback((list: Item[]) => {
    const ids = [...batch.current];
    if (ids.length === 0) {
      setRing("idle");
      return;
    }
    const inBatch = list.filter((i) => batch.current.has(i.id));
    if (inBatch.some((i) => i.status === "active" || i.status === "paused"))
      return;
    window.clearTimeout(holdTimer.current);
    if (inBatch.some((i) => i.status === "failed")) {
      setRing("failed");
      return;
    }
    setRing("done");
    holdTimer.current = window.setTimeout(() => {
      batch.current.clear();
      setRing("idle");
    }, HOLD);
  }, []);

  const land = useCallback(() => {
    tuck();
    if (reduced.current) return;
    arrow.current?.animate(
      [
        { transform: "translateY(0)" },
        { transform: "translateY(3px)" },
        { transform: "translateY(0)" },
      ],
      { duration: 280, easing: "cubic-bezier(0.3, 0.7, 0.4, 1)" },
    );
  }, []);

  const step = useCallback(
    (now: number) => {
      raf.current = 0;
      const dt = Math.min(0.05, Math.max(0, (now - last.current) / 1000));
      last.current = now;

      const finished: number[] = [];
      const broke: number[] = [];
      for (const item of itemsRef.current) {
        if (item.status !== "active") continue;
        const s = sims.current.get(item.id);
        if (!s) continue;
        s.t += dt;
        const r = rate(s.base, s.t, s.seed);
        s.got += r * dt;
        s.smooth += (r - s.smooth) * Math.min(1, dt / 0.6);
        if (s.failAt !== undefined && s.got >= s.failAt * s.total) {
          s.got = s.failAt * s.total;
          s.failAt = undefined;
          broke.push(item.id);
        } else if (s.got >= s.total) {
          s.got = s.total;
          finished.push(item.id);
        }
      }

      for (const f of flightsRef.current) {
        const el = chips.current.get(f.id);
        const raw = Math.min(1, (now - f.t0) / FLIGHT);
        if (raw >= 1) continue;
        const t = easeInOut(raw);
        const at = arc(f.from, f.to, t);
        const scale = 1 - 0.55 * t;
        if (el) {
          el.style.transform = `translate(${at.x}px, ${at.y}px) translate(-50%, -50%) scale(${scale})`;
          el.style.opacity = String(raw < 0.82 ? 1 : 1 - (raw - 0.82) / 0.18);
        }
      }
      const landed = flightsRef.current.filter((f) => now - f.t0 >= FLIGHT);
      if (landed.length > 0) {
        for (const _ of landed) land();
        const gone = new Set(landed.map((f) => f.id));
        const rest = flightsRef.current.filter((f) => !gone.has(f.id));
        flightsRef.current = rest;
        setFlights(rest);
      }

      paint();

      if (finished.length > 0 || broke.length > 0) {
        const next = itemsRef.current.map((i) =>
          finished.includes(i.id)
            ? { ...i, status: "done" as const }
            : broke.includes(i.id)
              ? { ...i, status: "failed" as const }
              : i,
        );
        itemsRef.current = next;
        setItems(next);
        const names = (ids: number[]) =>
          next.filter((i) => ids.includes(i.id)).map((i) => i.name);
        if (broke.length > 0) {
          failed();
          setStatus(`${names(broke).join(", ")} failed`);
        } else {
          done();
          setStatus(`${names(finished).join(", ")} finished`);
        }
        settle(next);
      }

      const busy =
        itemsRef.current.some((i) => i.status === "active") ||
        flightsRef.current.length > 0;
      if (busy) raf.current = requestAnimationFrame(step);
    },
    [land, paint, settle],
  );

  const run = useCallback(() => {
    if (raf.current) return;
    last.current = performance.now();
    raf.current = requestAnimationFrame(step);
  }, [step]);

  useEffect(
    () => () => {
      cancelAnimationFrame(raf.current);
      window.clearTimeout(holdTimer.current);
      window.clearTimeout(revealTimer.current);
    },
    [],
  );

  useLayoutEffect(() => {
    paint();
  });

  /** a batch that has closed or failed is replaced by the next download */
  const join = (id: number) => {
    if (ringRef.current === "done" || ringRef.current === "failed") {
      window.clearTimeout(holdTimer.current);
      batch.current.clear();
    }
    batch.current.add(id);
    setRing("active");
  };

  const start = (offer: Offer, from: HTMLElement | null) => {
    armSound();
    const id = ++seq.current;
    const name = unique(
      offer.name,
      itemsRef.current.map((i) => i.name),
    );
    const base = offer.size / duration(offer.size);
    const flaky = offer.failAt !== undefined && !flaked.current;
    if (flaky) flaked.current = true;
    sims.current.set(id, {
      got: 0,
      total: offer.size,
      base,
      seed: id * 1.7,
      t: 0,
      smooth: base,
      // the network drops once, on the first copy of the flaky file
      failAt: flaky ? offer.failAt : undefined,
      text: "",
    });
    const next = [
      {
        id,
        name,
        kind: offer.kind,
        size: offer.size,
        status: "active" as const,
      },
      ...itemsRef.current,
    ];
    itemsRef.current = next;
    setItems(next);
    join(id);
    setStatus(`Downloading ${name}`);

    const box = win.current?.getBoundingClientRect();
    const target = button.current?.getBoundingClientRect();
    if (reduced.current || !from || !box || !target) {
      tuck();
    } else {
      const r = from.getBoundingClientRect();
      const flight: Flight = {
        id,
        kind: offer.kind,
        from: {
          x: r.left + r.width / 2 - box.left,
          y: r.top + r.height / 2 - box.top,
        },
        to: {
          x: target.left + target.width / 2 - box.left,
          y: target.top + target.height / 2 - box.top,
        },
        t0: performance.now(),
      };
      const rest = [...flightsRef.current, flight];
      flightsRef.current = rest;
      setFlights(rest);
    }
    run();
  };

  const setStatusOf = (id: number, s: Status) => {
    const next = itemsRef.current.map((i) =>
      i.id === id ? { ...i, status: s } : i,
    );
    itemsRef.current = next;
    setItems(next);
    return next;
  };

  const pause = (id: number) => {
    setStatusOf(id, "paused");
    const item = itemsRef.current.find((i) => i.id === id);
    if (item) setStatus(`${item.name} paused`);
  };

  const resume = (id: number) => {
    armSound();
    if (!batch.current.has(id)) join(id);
    setStatusOf(id, "active");
    const s = sims.current.get(id);
    if (s) s.smooth = s.base;
    const item = itemsRef.current.find((i) => i.id === id);
    if (item) setStatus(`Downloading ${item.name}`);
    run();
  };

  const remove = (ids: number[]) => {
    for (const id of ids) {
      sims.current.delete(id);
      batch.current.delete(id);
    }
    const next = itemsRef.current.filter((i) => !ids.includes(i.id));
    itemsRef.current = next;
    setItems(next);
    settle(next);
    // the pressed control has gone with its row, so focus stays in the list
    requestAnimationFrame(() => {
      if (document.activeElement === document.body) panel.current?.focus();
    });
  };

  const showInFolder = (id: number) => {
    window.clearTimeout(revealTimer.current);
    setReveal(id);
    revealTimer.current = window.setTimeout(() => setReveal(null), REVEAL);
  };

  const toggle = (e: ReactMouseEvent) => {
    armSound();
    viaKey.current = e.detail === 0;
    setOpen((o) => !o);
  };

  // opening the list is reading the failure, so the dot goes
  useEffect(() => {
    if (open && ringRef.current === "failed") {
      batch.current.clear();
      setRing("idle");
    }
  }, [open]);

  // from the keyboard, focus goes into the list. A mouse moves nothing
  useEffect(() => {
    if (!open || !viaKey.current) return;
    const first = panel.current?.querySelector<HTMLElement>("button");
    first?.focus();
  }, [open]);

  // a press outside closes the list, and so does Escape from anywhere on the page
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => {
      const t = e.target as Node;
      if (panel.current?.contains(t) || button.current?.contains(t)) return;
      setOpen(false);
    };
    const key = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      const inside =
        panel.current?.contains(document.activeElement) ||
        document.activeElement === button.current;
      setOpen(false);
      if (inside) button.current?.focus();
    };
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("pointerdown", away);
      document.removeEventListener("keydown", key);
    };
  }, [open]);

  const active = items.filter((i) => i.status === "active").length;
  const clearable = items.filter(
    (i) => i.status === "done" || i.status === "failed",
  );

  return (
    <div className="flex h-[28rem] w-full min-w-0 flex-col rounded-lg bg-fill p-4 ring-1 ring-stroke ring-inset sm:p-6">
      <TooltipProvider delayDuration={500}>
        <div
          ref={win}
          className="relative flex min-h-0 flex-1 flex-col overflow-clip rounded-xl bg-bg outline outline-stroke"
          style={{ boxShadow: RAISED }}
        >
          <div className="flex h-12 shrink-0 items-center gap-2 border-stroke border-b px-2.5">
            <div
              className="flex h-8 min-w-0 flex-1 items-center rounded-lg bg-fill px-3"
              style={{ boxShadow: WELL }}
            >
              <span className="min-w-0 truncate text-body leading-tight">
                <span className="text-text-primary">{HOST}</span>
                <span className="text-text-muted">{PATH}</span>
              </span>
            </div>
            <Tooltip
              label="Downloads"
              open={tip && !open}
              onOpenChange={setTip}
            >
              <button
                ref={button}
                type="button"
                data-downloads
                aria-label={
                  active > 0 ? `Downloads, ${active} in progress` : "Downloads"
                }
                aria-haspopup="dialog"
                aria-expanded={open}
                onClick={toggle}
                className={cn(
                  "relative grid size-8 shrink-0 cursor-pointer place-items-center rounded-lg text-text-secondary transition-all duration-150 hover:bg-fill hover:text-text-primary active:bg-fill-hover aria-expanded:bg-fill aria-expanded:text-text-primary",
                  FOCUS,
                )}
              >
                <svg
                  aria-hidden="true"
                  viewBox="0 0 32 32"
                  className={cn(
                    "-rotate-90 pointer-events-none absolute inset-0 size-full transition-opacity duration-300",
                    ring === "idle" || ring === "failed"
                      ? "opacity-0"
                      : "opacity-100",
                  )}
                >
                  <circle
                    cx="16"
                    cy="16"
                    r="12.5"
                    fill="none"
                    strokeWidth="2"
                    className="stroke-fill-active"
                  />
                  <circle
                    ref={circle}
                    cx="16"
                    cy="16"
                    r="12.5"
                    fill="none"
                    strokeWidth="2"
                    strokeLinecap="round"
                    pathLength={1}
                    strokeDasharray="1 2"
                    strokeDashoffset={1}
                    className={cn(
                      "transition-[stroke] duration-200",
                      ring === "done"
                        ? "stroke-success"
                        : "stroke-text-primary",
                    )}
                  />
                </svg>
                <span
                  ref={arrow}
                  className={cn(
                    "relative grid place-items-center transition-colors duration-200",
                    ring === "done" && "text-success",
                  )}
                >
                  <DownloadSimpleIcon
                    className={cn(
                      "transition-all duration-200",
                      ring === "idle" || ring === "failed"
                        ? "size-4"
                        : "size-3",
                    )}
                  />
                </span>
                {ring === "failed" && (
                  <span
                    aria-hidden="true"
                    className="absolute top-1 right-1 size-1.5 rounded-full bg-danger ring-2 ring-bg"
                  />
                )}
              </button>
            </Tooltip>
          </div>

          <AnimatePresence>
            {open && (
              <motion.div
                ref={panel}
                role="dialog"
                aria-label="Downloads"
                tabIndex={-1}
                initial={{ opacity: 0, y: -4, scale: 0.98 }}
                animate={{
                  opacity: 1,
                  y: 0,
                  scale: 1,
                  transition: { duration: 0.16, ease: [0.23, 1, 0.32, 1] },
                }}
                exit={{
                  opacity: 0,
                  y: -4,
                  scale: 0.98,
                  transition: { duration: 0.11, ease: "easeIn" },
                }}
                className="absolute top-11 right-2 z-50 flex w-[19rem] max-w-[calc(100%-1rem)] origin-top-right flex-col rounded-xl bg-bg outline outline-stroke focus-visible:outline-stroke"
                style={{ boxShadow: LIFT }}
              >
                <div className="flex items-baseline justify-between px-3.5 pt-3 pb-1.5">
                  <p className="text-action text-text-primary">Downloads</p>
                  {items.length > 0 && (
                    <p className="text-meta text-text-muted">
                      {active > 0
                        ? `${active} in progress`
                        : `${items.length} ${items.length === 1 ? "file" : "files"}`}
                    </p>
                  )}
                </div>
                {items.length === 0 ? (
                  <p className="px-3.5 pt-2 pb-5 text-meta text-text-muted">
                    Files you download appear here.
                  </p>
                ) : (
                  <ul className="flex max-h-60 flex-col overflow-y-auto px-1.5 pb-1.5 [scrollbar-width:thin]">
                    <AnimatePresence initial={false} mode="popLayout">
                      {items.map((item) => (
                        <Row
                          key={item.id}
                          item={item}
                          reveal={reveal === item.id}
                          bar={(el) => {
                            if (el) bars.current.set(item.id, el);
                            else bars.current.delete(item.id);
                          }}
                          text={(el) => {
                            if (el) texts.current.set(item.id, el);
                            else texts.current.delete(item.id);
                          }}
                          onPause={() => pause(item.id)}
                          onResume={() => resume(item.id)}
                          onRemove={() => remove([item.id])}
                          onReveal={() => showInFolder(item.id)}
                        />
                      ))}
                    </AnimatePresence>
                  </ul>
                )}
                {items.length > 0 && (
                  <div className="flex justify-end border-stroke-soft border-t px-2 py-1.5">
                    <button
                      type="button"
                      disabled={clearable.length === 0}
                      onClick={() => remove(clearable.map((i) => i.id))}
                      className={cn(
                        "h-7 cursor-pointer rounded-md px-2.5 text-action text-text-secondary transition-all duration-150 hover:bg-fill hover:text-text-primary active:bg-fill-hover disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent",
                        FOCUS,
                      )}
                    >
                      Clear finished
                    </button>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          <section
            aria-label="Field Notes 2.4"
            className="min-h-0 flex-1 overflow-y-auto px-5 pt-5 pb-6 [scrollbar-width:thin] sm:px-7"
          >
            <Release onDownload={start} />
          </section>

          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 z-[60]"
          >
            {flights.map((f) => {
              const Icon = KIND_ICON[f.kind];
              return (
                <span
                  key={f.id}
                  data-chip
                  ref={(el) => {
                    if (el) chips.current.set(f.id, el);
                    else chips.current.delete(f.id);
                  }}
                  className="absolute top-0 left-0 grid size-9 place-items-center rounded-lg bg-bg text-text-secondary outline outline-stroke"
                  style={{
                    transform: `translate(${f.from.x}px, ${f.from.y}px) translate(-50%, -50%)`,
                    boxShadow: LIFT,
                  }}
                >
                  <Icon className="size-4" />
                </span>
              );
            })}
          </div>
        </div>
      </TooltipProvider>
      <span role="status" className="sr-only">
        {status}
      </span>
    </div>
  );
}

function Row({
  item,
  reveal,
  bar,
  text,
  onPause,
  onResume,
  onRemove,
  onReveal,
}: {
  item: Item;
  reveal: boolean;
  bar: (el: HTMLElement | null) => void;
  text: (el: HTMLElement | null) => void;
  onPause: () => void;
  onResume: () => void;
  onRemove: () => void;
  onReveal: () => void;
}) {
  const Icon = KIND_ICON[item.kind];
  const moving = item.status === "active" || item.status === "paused";
  const line =
    item.status === "failed"
      ? "network error, retry to continue"
      : reveal
        ? "in your downloads folder"
        : `${bytes(item.size)}, done`;

  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, transition: { duration: 0.12 } }}
      transition={{ type: "spring", visualDuration: 0.25, bounce: 0 }}
      data-row={item.name}
      className="flex items-center gap-2.5 rounded-lg px-2 py-2"
    >
      <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-fill text-text-secondary">
        <Icon className="size-4" />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className="truncate text-action text-text-primary leading-tight [text-transform:none]">
          {item.name}
        </p>
        {moving && (
          <span className="relative h-1 overflow-hidden rounded-full bg-fill">
            <span
              ref={bar}
              className={cn(
                "absolute inset-0 origin-left rounded-full",
                item.status === "paused" ? "bg-text-muted" : "bg-text-primary",
              )}
              style={{ transform: "scaleX(0)" }}
            />
          </span>
        )}
        <span
          key={`${item.status}-${reveal}`}
          className={cn(
            "truncate text-meta leading-tight tabular-nums [text-transform:none]",
            item.status === "failed" ? "text-danger" : "text-text-muted",
          )}
        >
          {moving ? <span ref={text} /> : line}
        </span>
      </div>
      <div className="flex shrink-0 items-center">
        {item.status === "active" && (
          <Tooltip label="Pause">
            <button
              type="button"
              aria-label={`Pause ${item.name}`}
              onClick={onPause}
              className={ICON_BUTTON}
            >
              <PauseIcon className="size-3.5" />
            </button>
          </Tooltip>
        )}
        {item.status === "paused" && (
          <Tooltip label="Resume">
            <button
              type="button"
              aria-label={`Resume ${item.name}`}
              onClick={onResume}
              className={ICON_BUTTON}
            >
              <PlayIcon className="size-3.5" />
            </button>
          </Tooltip>
        )}
        {item.status === "failed" && (
          <Tooltip label="Retry">
            <button
              type="button"
              aria-label={`Retry ${item.name}`}
              onClick={onResume}
              className={ICON_BUTTON}
            >
              <ArrowsClockwiseIcon className="size-3.5" />
            </button>
          </Tooltip>
        )}
        {item.status === "done" && (
          <Tooltip label="Show in folder">
            <button
              type="button"
              aria-label={`Show ${item.name} in folder`}
              onClick={onReveal}
              className={ICON_BUTTON}
            >
              <FolderOpenIcon className="size-3.5" />
            </button>
          </Tooltip>
        )}
        <Tooltip label={moving ? "Cancel" : "Remove from list"}>
          <button
            type="button"
            aria-label={`${moving ? "Cancel" : "Remove"} ${item.name}`}
            onClick={onRemove}
            className={ICON_BUTTON}
          >
            <XIcon className="size-3.5" />
          </button>
        </Tooltip>
      </div>
    </motion.li>
  );
}

function Release({
  onDownload,
}: {
  onDownload: (offer: Offer, from: HTMLElement | null) => void;
}) {
  return (
    <article className="mx-auto flex max-w-[30rem] flex-col gap-3">
      <p className="text-meta text-text-muted">Field Notes</p>
      <h2 className="-mt-1 text-lead text-text-primary leading-tight">
        Version 2.4
      </h2>
      <p className="text-body text-text-secondary">
        A new editor, faster sync and a darker night mode. Every file below is
        free to download.
      </p>
      <ul className="mt-1 flex flex-col">
        {OFFERS.map((offer) => {
          const Icon = KIND_ICON[offer.kind];
          return (
            <li
              key={offer.name}
              className="flex items-center gap-3 border-stroke-soft border-t py-2.5 first:border-t-0"
            >
              <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-fill text-text-secondary">
                <Icon className="size-4" />
              </span>
              <div className="flex min-w-0 flex-1 flex-col">
                <p className="truncate text-action text-text-primary leading-tight [text-transform:none]">
                  {offer.name}
                </p>
                <p className="truncate text-meta text-text-muted leading-tight">
                  <span className="[text-transform:none]">
                    {bytes(offer.size)}
                  </span>
                  , {offer.note}
                </p>
              </div>
              <button
                type="button"
                data-offer={offer.name}
                aria-label={`Download ${offer.name}`}
                onClick={(e) =>
                  onDownload(
                    offer,
                    e.currentTarget.querySelector<HTMLElement>("svg"),
                  )
                }
                className={cn(
                  "inline-flex h-8 shrink-0 cursor-pointer items-center gap-1.5 rounded-full bg-fill px-3 text-action text-text-primary transition-all duration-150 hover:bg-fill-hover active:bg-fill-active",
                  FOCUS,
                )}
              >
                <DownloadSimpleIcon className="size-[0.9em] translate-y-[0.09em]" />
                <span className="max-sm:sr-only">Download</span>
              </button>
            </li>
          );
        })}
      </ul>
    </article>
  );
}
