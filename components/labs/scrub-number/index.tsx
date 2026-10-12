"use client";

import {
  ArrowsHorizontalIcon,
  SpeakerHighIcon,
  SpeakerSlashIcon,
} from "@phosphor-icons/react";
import {
  type AnimationPlaybackControls,
  animate,
  type MotionValue,
  motion,
  useMotionValue,
  useReducedMotion,
  useTransform,
} from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { FOCUS } from "@/components/lab/controls";
import { Tooltip, TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { type AutoState, Field, type Panel } from "./field";
import {
  autoTrack,
  DEFAULTS,
  detentsFor,
  format,
  formatDelta,
  type Key,
  refsOf,
  SPEC,
  SPECS,
  type Values,
} from "./scrub";

/*
 * Two words and the four numbers that set them. Every number scrubs: press its
 * icon or the number itself and drag. `scrub.ts` is the model, `ruler.ts` the
 * ruler under a field in use, `scrub-sound.ts` the ticks, `field.tsx` the
 * gesture and the typing, and this file the words, the selection, x-ray, the
 * cursor badge and undo.
 */

/** A typed value, a key, a reset or an undo glides the words there. */
const GLIDE = { type: "spring", visualDuration: 0.32, bounce: 0.1 } as const;

/** Undo steps kept. */
const DEPTH = 64;

/** Repeated steps with one tag inside this window are one undo step, ms. */
const COALESCE = 900;

const KEYS: readonly Key[] = ["weight", "size", "track", "lead"];

const WORDS = ["Scrub", "this"] as const;

interface Item {
  v: Values;
  /** tracking follows size, by Inter's dynamic metrics */
  auto: boolean;
}

interface Snapshot {
  v: Values[];
  auto: boolean[];
}

type Word = Record<Key, MotionValue<number>>;

function useWord(): Word {
  const weight = useMotionValue(DEFAULTS.weight);
  const size = useMotionValue(DEFAULTS.size);
  const track = useMotionValue(DEFAULTS.track);
  const lead = useMotionValue(DEFAULTS.lead);
  return useMemo(
    () => ({ weight, size, track, lead }),
    [weight, size, track, lead],
  );
}

const same = (a: number[]) => a.every((v) => Math.abs(v - a[0]) < 1e-9);

function autoOf(items: Item[], sel: number[]): AutoState {
  const on = sel.map((i) => items[i].auto);
  if (on.every(Boolean)) return "on";
  if (on.some(Boolean)) return "mixed";
  return "off";
}

export default function ScrubNumber() {
  const stage = useRef<HTMLDivElement>(null);
  const pointer = useRef<HTMLDivElement>(null);
  const arrow = useRef<HTMLDivElement>(null);
  const tag = useRef<HTMLSpanElement>(null);
  const xrayBox = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const reduceRef = useRef(false);
  reduceRef.current = !!reduce;

  const items = useRef<Item[]>(
    WORDS.map(() => ({ v: { ...DEFAULTS }, auto: true })),
  );
  const [sel, setSel] = useState<number[]>([0, 1]);
  const selRef = useRef(sel);
  selRef.current = sel;
  const [auto, setAuto] = useState<AutoState>("on");
  const [xray, setXray] = useState(false);
  const xrayRef = useRef(xray);
  xrayRef.current = xray;
  const [sound, setSound] = useState(true);
  const soundRef = useRef(sound);
  soundRef.current = sound;

  const a = useWord();
  const b = useWord();
  const words = useMemo(() => [a, b], [a, b]);
  const runs = useRef(new Map<string, AnimationPlaybackControls>());

  const past = useRef<Snapshot[]>([]);
  const future = useRef<Snapshot[]>([]);
  const lastTag = useRef({ tag: "", at: 0 });
  /** undo answers while the pointer is over the demo or focus is inside it */
  const over = useRef(false);

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const panel = useMemo<Panel>(() => {
    const set = (i: number, key: Key, value: number, how: "jump" | "glide") => {
      items.current[i].v[key] = value;
      const mv = words[i][key];
      const id = `${i}:${key}`;
      runs.current.get(id)?.stop();
      runs.current.delete(id);
      if (how === "jump" || reduceRef.current) mv.jump(value);
      else runs.current.set(id, animate(mv, value, GLIDE));
    };

    const read = (key: Key) =>
      selRef.current.map((i) => items.current[i].v[key]);

    /** the number in the box, unless it is being typed or scrubbed */
    const show = (key: Key) => {
      const el = stage.current?.querySelector<HTMLInputElement>(
        `input[data-field="${key}"]`,
      );
      if (!el) return;
      const row = el.closest<HTMLElement>("[data-key]");
      if (row?.dataset.scrub === "true" || el.dataset.editing === "true") {
        return;
      }
      const spec = SPEC[key];
      const values = read(key);
      if (same(values)) {
        el.value = format(values[0], spec);
        el.placeholder = "";
        el.setAttribute("aria-valuenow", String(values[0]));
        el.setAttribute(
          "aria-valuetext",
          `${format(values[0], spec)} ${spec.spoken}`.trim(),
        );
      } else {
        // a selection that disagrees shows no number at all, the way a design
        // tool does, and a scrub on it moves every word by the same amount
        el.value = "";
        el.placeholder = "mixed";
        el.removeAttribute("aria-valuenow");
        el.setAttribute("aria-valuetext", "mixed");
      }
    };

    const syncAuto = () => setAuto(autoOf(items.current, selRef.current));

    /** an item following size takes Inter's tracking for whatever it is now */
    const follow = (i: number, how: "jump" | "glide") => {
      const it = items.current[i];
      if (it.auto) set(i, "track", autoTrack(it.v.size), how);
    };

    return {
      read,
      write(key, values, how) {
        let changed = false;
        selRef.current.forEach((i, j) => {
          set(i, key, values[j], how);
          if (key === "track" && items.current[i].auto) {
            items.current[i].auto = false;
            changed = true;
          }
          if (key === "size") follow(i, how);
        });
        if (changed) syncAuto();
        show(key);
        if (key === "size") show("track");
      },
      detents: (key) => detentsFor(key, items.current[selRef.current[0]].v),
      refs: () => selRef.current.map((i) => refsOf(items.current[i].v)),
      snapshot: (): Snapshot => ({
        v: items.current.map((it) => ({ ...it.v })),
        auto: items.current.map((it) => it.auto),
      }),
      record(before, t) {
        const now = performance.now();
        const repeat =
          t === lastTag.current.tag && now - lastTag.current.at < COALESCE;
        lastTag.current = { tag: t, at: now };
        future.current = [];
        if (repeat) return;
        past.current.push(before as Snapshot);
        if (past.current.length > DEPTH) past.current.shift();
      },
      restore(snap, how) {
        const s = snap as Snapshot;
        items.current.forEach((it, i) => {
          it.auto = s.auto[i];
          for (const key of KEYS) {
            if (it.v[key] !== s.v[i][key] || key === "track") {
              set(i, key, s.v[i][key], how);
            }
          }
        });
        syncAuto();
        for (const key of KEYS) show(key);
      },
      show,
      setAuto(on) {
        for (const i of selRef.current) {
          items.current[i].auto = on;
          follow(i, "glide");
        }
        syncAuto();
        show("track");
      },
      cursor(at) {
        const el = pointer.current;
        if (!el) return;
        if (!at || (!at.locked && !at.text)) {
          el.style.display = "none";
          return;
        }
        el.style.display = "block";
        el.style.transform = `translate(${at.x}px, ${at.y}px)`;
        if (arrow.current)
          arrow.current.style.display = at.locked ? "" : "none";
        if (tag.current) {
          tag.current.textContent = at.text;
          tag.current.style.display = at.text ? "" : "none";
        }
      },
      xray(info) {
        const box = xrayBox.current;
        if (!box) return;
        box.dataset.live = info ? "true" : "false";
        if (!info) return;
        const put = (k: string, v: string) => {
          const cell = box.querySelector<HTMLElement>(`[data-x="${k}"]`);
          if (cell) cell.textContent = v;
        };
        const spec = SPEC[info.key];
        const n = (v: number, d = 2) => String(Number(v.toFixed(d)));
        put(
          "field",
          `${spec.name.toLowerCase()}${info.mixed ? ", mixed" : ""}`,
        );
        put("mode", info.mode === "coast" ? "coasting" : "hand");
        put("hand", `${n(info.hand, 0)} px`);
        put("down", `${n(info.down, 0)} px`);
        put("rate", `×${n(info.rate)}`);
        put("gain", `${n(info.gain, 3)}/px`);
        put("raw", n(info.raw, 3));
        put(
          "value",
          info.mixed ? formatDelta(info.value, spec) : format(info.value, spec),
        );
        put(
          "hold",
          info.hold > 0 ? `${n(10 - info.hold, 1)} of 10 px` : "free",
        );
        put("over", `${n(Math.abs(info.over), 0)} px`);
        put("speed", `${n(info.speed, 0)} px/s`);
      },
      xrayOn: () => xrayRef.current,
      soundOn: () => soundRef.current,
      reduce: () => reduceRef.current,
    };
  }, [words]);

  // the numbers are written straight to the boxes rather than rendered, so a
  // scrub costs no render, and this puts them back whenever the selection moves
  useEffect(() => {
    for (const key of KEYS) panel.show(key);
    setAuto(autoOf(items.current, sel));
  }, [panel, sel]);

  // undo and redo, one step per scrub, per typed value, per reset and per
  // burst of arrow keys
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      const el = stage.current;
      if (!el || !(e.metaKey || e.ctrlKey)) return;
      const k = e.key.toLowerCase();
      if (k !== "z" && k !== "y") return;
      const active = document.activeElement as HTMLElement | null;
      const inside = !!active && el.contains(active);
      if (!inside && !over.current) return;
      // text being typed keeps the browser's own undo
      if (active?.dataset.editing === "true") return;
      // owned even with nothing to undo. Let through, Chrome's own undo
      // reaches back into whichever box was last typed in and rewrites it
      e.preventDefault();
      const redo = k === "y" || e.shiftKey;
      const from = redo ? future.current : past.current;
      const to = redo ? past.current : future.current;
      const snap = from.pop();
      if (!snap) return;
      to.push(panel.snapshot() as Snapshot);
      lastTag.current = { tag: "", at: 0 };
      panel.restore(snap, "glide");
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [panel]);

  const pick = (i: number, add: boolean) => {
    setSel((cur) => {
      if (!add) return [i];
      if (cur.includes(i))
        return cur.length > 1 ? cur.filter((j) => j !== i) : cur;
      return [...cur, i].sort();
    });
  };

  return (
    <div
      ref={stage}
      data-xray={xray}
      onPointerEnter={() => {
        over.current = true;
      }}
      onPointerLeave={() => {
        over.current = false;
      }}
      className="@container group/stage relative flex w-full select-none flex-col gap-6 overflow-hidden rounded-lg bg-fill p-6 ring-1 ring-stroke ring-inset sm:aspect-8/5 sm:flex-row sm:items-center sm:gap-8 sm:p-8"
    >
      <TooltipProvider delayDuration={500}>
        <div className="relative flex h-80 shrink-0 flex-col items-center justify-center sm:h-full sm:flex-1">
          {/* a press on the bare stage selects both words, as a design tool's
              canvas selects nothing, since here an empty panel says nothing */}
          <button
            type="button"
            tabIndex={-1}
            aria-label="Select both words"
            onClick={() => setSel([0, 1])}
            className="absolute inset-0 cursor-default"
          />
          {WORDS.map((text, i) => (
            <WordView
              key={text}
              text={text}
              word={words[i]}
              selected={sel.includes(i)}
              onPick={(add) => pick(i, add)}
            />
          ))}

          {/* what a scrub is doing, for the reader who asked to see it. Under
              the words, in two pairs a row, so it never sits over them */}
          <div
            ref={xrayBox}
            data-live="false"
            aria-hidden="true"
            className={cn(
              "group/x pointer-events-none absolute bottom-0 left-0 font-mono text-meta text-text-muted transition-opacity duration-200",
              xray ? "opacity-100" : "opacity-0",
            )}
          >
            <p className="group-data-[live=true]/x:hidden">
              drag an icon or a number
            </p>
            <dl className="hidden grid-cols-[auto_auto_auto_auto] gap-x-2.5 group-data-[live=true]/x:grid">
              {[
                ["hand", "hand"],
                ["down", "below"],
                ["rate", "speed"],
                ["gain", "gain"],
                ["raw", "raw"],
                ["value", "value"],
                ["hold", "detent"],
                ["speed", "throw"],
              ].map(([k, name]) => (
                <div key={k} className="contents">
                  <dt>{name}</dt>
                  <dd
                    data-x={k}
                    className="pr-2 text-text-primary tabular-nums"
                  />
                </div>
              ))}
            </dl>
          </div>
        </div>

        <div className="grid shrink-0 grid-cols-2 gap-2 rounded-lg bg-bg p-2 ring-1 ring-stroke sm:w-48 sm:grid-cols-1">
          {SPECS.map((spec) => (
            <Field
              key={spec.key}
              spec={spec}
              panel={panel}
              auto={spec.key === "track" ? auto : undefined}
            />
          ))}
        </div>

        <div className="absolute top-3 right-3 z-10 flex gap-1.5">
          <Toggle pressed={xray} onClick={() => setXray((x) => !x)}>
            x-ray
          </Toggle>
          <Tooltip label={sound ? "Mute" : "Unmute"}>
            <Toggle
              icon
              label={sound ? "Mute" : "Unmute"}
              onClick={() => setSound((s) => !s)}
            >
              {sound ? (
                <SpeakerHighIcon aria-hidden="true" className="size-3.5" />
              ) : (
                <SpeakerSlashIcon aria-hidden="true" className="size-3.5" />
              )}
            </Toggle>
          </Tooltip>
        </div>
      </TooltipProvider>

      {/* the badge beside the hand, and the drawn cursor while the real one is
          locked. In `body`, since the lab slot animates a transform and a
          fixed child would resolve against it */}
      {mounted &&
        createPortal(
          <div
            ref={pointer}
            aria-hidden="true"
            style={{ display: "none" }}
            className="pointer-events-none fixed top-0 left-0 z-50"
          >
            <div
              ref={arrow}
              className="-translate-x-1/2 -translate-y-1/2 absolute"
            >
              <ArrowsHorizontalIcon className="size-5 text-text-primary [filter:drop-shadow(0_0_1px_var(--color-bg))_drop-shadow(0_0_1px_var(--color-bg))]" />
            </div>
            <span
              ref={tag}
              className="absolute top-3.5 left-3.5 whitespace-nowrap rounded-full bg-text-primary px-1.5 py-0.5 font-mono text-meta leading-none"
              // theme-constant fill, so the label colour is pinned
              style={{ color: "#fff" }}
            />
          </div>,
          document.body,
        )}
    </div>
  );
}

function WordView({
  text,
  word,
  selected,
  onPick,
}: {
  text: string;
  word: Word;
  selected: boolean;
  onPick: (add: boolean) => void;
}) {
  const weight = useTransform(word.weight, (v) => String(v));
  const spacing = useTransform(word.track, (t) => `${t / 100}em`);
  const lead = useTransform(word.lead, (v) => String(v));

  return (
    <motion.button
      type="button"
      aria-pressed={selected}
      aria-label={`${text}, ${selected ? "selected" : "select"}`}
      onClick={(e) => onPick(e.shiftKey || e.metaKey || e.ctrlKey)}
      style={{
        fontSize: word.size,
        fontWeight: weight,
        letterSpacing: spacing,
        lineHeight: lead,
        // `button { text-transform: inherit }` in globals.css is unlayered and
        // beats any utility, and the word is set as written, not lowercased
        textTransform: "none",
      }}
      className={cn(
        "relative cursor-pointer whitespace-nowrap rounded-sm px-1 text-text-primary transition-shadow duration-150",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-primary/15 focus-visible:ring-offset-2 focus-visible:ring-offset-fill",
        selected
          ? "ring-1 ring-stroke-strong"
          : "hover:ring-1 hover:ring-stroke",
        // x-ray draws each word's line box, which is what line height sets
        "group-data-[xray=true]/stage:outline-1 group-data-[xray=true]/stage:outline-text-muted/50 group-data-[xray=true]/stage:outline-dashed",
      )}
    >
      {text}
    </motion.button>
  );
}

/**
 * The two corner toggles. `Pill`'s quiet fill is `fill`, which is this stage's
 * own ground, so a quiet pill here is bare text. These sit one step up the
 * fill scale, `fingerprint-ink`'s call for its own reset, and a pressed one
 * takes the site's filled dark pill.
 */
function Toggle({
  pressed,
  icon = false,
  label,
  onClick,
  children,
  ...rest
}: {
  /** a state toggle. Left off, the button is named by what a press does */
  pressed?: boolean;
  icon?: boolean;
  label?: string;
  onClick: () => void;
  children: React.ReactNode;
} & Omit<React.ComponentProps<"button">, "onClick" | "children">) {
  return (
    // spread so a `Tooltip` can hand its trigger the ref and the handlers
    <button
      {...rest}
      type="button"
      aria-label={label}
      aria-pressed={pressed}
      onClick={onClick}
      className={cn(
        "flex h-7 cursor-pointer items-center justify-center rounded-full text-meta transition-colors duration-200",
        icon ? "w-7" : "px-2.5",
        pressed
          ? "bg-text-primary text-bg hover:bg-text-primary/85 active:bg-text-primary/70"
          : "bg-fill-hover text-text-secondary hover:bg-fill-active hover:text-text-primary active:bg-stroke-strong",
        FOCUS,
        "focus-visible:ring-offset-fill",
      )}
    >
      {children}
    </button>
  );
}
