"use client";

import {
  AnimatePresence,
  animate,
  motion,
  useMotionValue,
  useReducedMotion,
} from "motion/react";
import {
  type ChangeEvent,
  type KeyboardEvent,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { TextMorph } from "torph/react";
import { ClockIcon, MagnifyingGlassIcon } from "@/components/icons";
import { cn } from "@/lib/utils";
import {
  address,
  complete,
  ENTRIES,
  type Entry,
  type Hit,
  postEntries,
  type Range,
  SITE,
  START,
  suggest,
} from "./suggest";

/** The bar stands on the stage and the address is cut into the bar */
const RAISED =
  "inset 0 1px 0 rgb(255 255 255), inset 0 -1px 0 rgb(0 0 0 / 0.04), 0 1px 2px rgb(0 0 0 / 0.08), 0 6px 12px -4px rgb(0 0 0 / 0.1), 0 20px 36px -14px rgb(0 0 0 / 0.16)";
const WELL =
  "inset 0 1px 3px rgb(0 0 0 / 0.13), inset 0 1px 1px rgb(0 0 0 / 0.05), 0 1px 0 rgb(255 255 255)";
const LOAD = 0.9;
/** how many visits the session keeps */
const HISTORY = 8;
const TYPE =
  "text-body [text-transform:none] [font-kerning:none] [font-variant-ligatures:none]";

/** What the next render does to the input's selection */
type Select = "none" | "completion" | "end" | "all";

/** `text` with the letters in `range` set in the stronger of two tones */
function Marked({
  text,
  range,
  ink,
}: {
  text: string;
  range: Range;
  ink: string;
}) {
  if (!range) return <>{text}</>;
  return (
    <>
      {text.slice(0, range[0])}
      <span className={ink}>{text.slice(range[0], range[1])}</span>
      {text.slice(range[1])}
    </>
  );
}

function Row({
  hit,
  id,
  selected,
  onPick,
}: {
  hit: Hit;
  id: string;
  selected: boolean;
  onPick: () => void;
}) {
  // a visited page shows a clock, the way a browser marks its history
  const Icon = hit.visited ? ClockIcon : hit.entry.Icon;
  return (
    // The input keeps focus and points here with aria-activedescendant, so a
    // row is never focused and its keys are the input's
    // biome-ignore lint/a11y/useKeyWithClickEvents: the input handles the keys
    <div
      id={id}
      role="option"
      tabIndex={-1}
      aria-selected={selected}
      data-row={hit.entry.path || "home"}
      onPointerDown={(e) => e.preventDefault()}
      onClick={onPick}
      className={cn(
        "flex h-10 cursor-pointer items-center gap-3 rounded-lg px-2.5 transition-colors duration-150",
        selected ? "bg-fill-hover" : "hover:bg-fill",
      )}
    >
      <span className="grid size-7 shrink-0 place-items-center rounded-md bg-fill text-text-secondary">
        <Icon className="size-4" />
      </span>
      <span className="flex min-w-0 flex-1 items-center gap-2">
        <span className="max-w-3/5 shrink-0 -translate-y-[0.085em] truncate text-body text-text-secondary leading-tight">
          <Marked
            text={hit.entry.title}
            range={hit.title}
            ink="text-text-primary"
          />
        </span>
        <span
          aria-hidden="true"
          className="inline-block size-1 shrink-0 rounded-full bg-stroke-strong"
        />
        <span className="min-w-0 flex-1 -translate-y-[0.11em] truncate text-meta text-text-muted leading-tight normal-case">
          <Marked
            text={address(hit.entry)}
            range={hit.url}
            ink="text-text-secondary"
          />
        </span>
      </span>
      <kbd
        className={cn(
          "shrink-0 -translate-y-[0.02em] font-mono text-meta text-text-muted leading-tight transition-opacity duration-150",
          selected ? "opacity-100" : "opacity-0",
        )}
      >
        enter
      </kbd>
    </div>
  );
}

export default function Omnibox() {
  const reduce = useReducedMotion();
  const listId = useId();
  const input = useRef<HTMLInputElement>(null);
  const well = useRef<HTMLDivElement>(null);
  const select = useRef<Select>("none");
  const timer = useRef(0);

  const [committed, setCommitted] = useState<Entry>(START);
  const [editing, setEditing] = useState(false);
  /** whether the reader has changed anything since focusing */
  const [dirty, setDirty] = useState(false);
  const [typed, setTyped] = useState("");
  const [completion, setCompletion] = useState("");
  const [lead, setLead] = useState<Entry | null>(null);
  /**
   * The row Enter goes to. Row 0 is the default, and the address shows the
   * typed text there. With nothing typed no row is the default, which is -1.
   */
  const [hi, setHi] = useState(0);
  const [posts, setPosts] = useState<Entry[]>([]);
  /** this session's visits, newest first, as paths */
  const [history, setHistory] = useState<string[]>([]);

  const progress = useMotionValue(0);
  const barOpacity = useMotionValue(0);

  const open = editing && dirty;
  const entries = useMemo(() => [...ENTRIES, ...posts], [posts]);
  const rows = useMemo(
    () => suggest(typed, lead, entries, history),
    [typed, lead, entries, history],
  );
  const empty = typed.trim() === "";
  /** an empty bar has no default row, so Enter cannot go anywhere unasked */
  const floor = empty ? -1 : 0;
  const row = hi >= 0 ? rows[Math.min(hi, rows.length - 1)] : undefined;
  const value =
    row && (hi > 0 || empty) ? address(row.entry) : `${typed}${completion}`;

  // The selection is set after the render that changed the value, since a
  // controlled input that gets a new value puts its caret at the end
  useLayoutEffect(() => {
    const el = input.current;
    const want = select.current;
    select.current = "none";
    if (!el || want === "none") return;
    if (want === "all") el.select();
    else if (want === "end")
      el.setSelectionRange(el.value.length, el.value.length);
    else el.setSelectionRange(typed.length, el.value.length, "forward");
  });

  useEffect(() => () => clearTimeout(timer.current), []);

  // the posts come from the blog's feed, since the browser cannot list them
  useEffect(() => {
    const abort = new AbortController();
    fetch("/blog/feed.json", { signal: abort.signal })
      .then((res) => res.json())
      .then((feed: { items?: { url?: string; title?: string }[] }) =>
        setPosts(postEntries(feed.items ?? [])),
      )
      .catch(() => {});
    return () => abort.abort();
  }, []);

  const reset = () => {
    setTyped(address(committed));
    setCompletion("");
    setLead(null);
    setHi(0);
    setDirty(false);
  };

  const load = () => {
    clearTimeout(timer.current);
    progress.jump(0);
    barOpacity.jump(1);
    animate(progress, 1, { duration: LOAD, ease: [0.2, 0.7, 0.3, 1] });
    animate(barOpacity, 0, { duration: 0.2, delay: LOAD });
  };

  const commit = (entry: Entry) => {
    setCommitted(entry);
    setHistory((h) =>
      [entry.path, ...h.filter((path) => path !== entry.path)].slice(
        0,
        HISTORY,
      ),
    );
    input.current?.blur();
    load();
  };

  const shake = () => {
    if (reduce || !well.current) return;
    well.current.animate(
      [
        { translate: "0" },
        { translate: "-4px" },
        { translate: "3px" },
        { translate: "-2px" },
        { translate: "0" },
      ],
      { duration: 280, easing: "ease-out" },
    );
  };

  const accept = () => {
    if (!completion) return false;
    setTyped(typed + completion);
    setCompletion("");
    select.current = "end";
    return true;
  };

  const onChange = (e: ChangeEvent<HTMLInputElement>) => {
    const el = e.currentTarget;
    const next = el.value;
    const kind = (e.nativeEvent as InputEvent).inputType ?? "";
    const atEnd =
      el.selectionStart === next.length && el.selectionEnd === next.length;
    setDirty(true);
    setHi(next.trim() ? 0 : -1);
    // only a letter typed at the end completes. A deletion, a paste or an
    // edit in the middle keeps exactly what is there
    if (kind === "insertText" && atEnd) {
      const done = complete(next, lead, entries, history);
      if (done) {
        setTyped(next);
        setCompletion(done.rest);
        setLead(done.entry);
        select.current = "completion";
        return;
      }
    }
    setTyped(next);
    setCompletion("");
    setLead(null);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    const el = e.currentTarget;
    const onCompletion =
      completion !== "" &&
      hi === 0 &&
      el.selectionStart === typed.length &&
      el.selectionEnd === el.value.length;

    // Shift+Delete forgets the highlighted visit, the way a browser does
    if (
      e.shiftKey &&
      (e.key === "Delete" || e.key === "Backspace") &&
      open &&
      row?.visited
    ) {
      e.preventDefault();
      setHistory((h) => h.filter((path) => path !== row.entry.path));
      if (lead?.path === row.entry.path) {
        setCompletion("");
        setLead(null);
      }
      setHi((i) => Math.max(floor, Math.min(i, rows.length - 2)));
      select.current = "end";
      return;
    }

    switch (e.key) {
      case "Backspace":
      case "Delete":
        // the first press takes the completion away and leaves the typing
        if (onCompletion) {
          e.preventDefault();
          setCompletion("");
          setLead(null);
          select.current = "end";
        }
        return;
      case "Tab":
        if (onCompletion && accept()) e.preventDefault();
        return;
      case "ArrowRight":
      case "End":
        if (onCompletion && !e.shiftKey) {
          e.preventDefault();
          accept();
        }
        return;
      case "ArrowDown":
      case "ArrowUp": {
        e.preventDefault();
        if (!open) {
          setDirty(true);
          return;
        }
        const to = Math.max(
          floor,
          Math.min(rows.length - 1, hi + (e.key === "ArrowDown" ? 1 : -1)),
        );
        setHi(to);
        select.current = to === 0 && completion ? "completion" : "end";
        return;
      }
      case "Enter": {
        e.preventDefault();
        if (!open) {
          commit(committed);
          return;
        }
        if (row) commit(row.entry);
        else if (empty) el.blur();
        else shake();
        return;
      }
      case "Escape":
        e.preventDefault();
        // the first press puts the address back, the second leaves the bar
        if (dirty) {
          reset();
          select.current = "all";
        } else {
          el.blur();
        }
        return;
    }
  };

  const status = open
    ? rows.length
      ? `${rows.length} suggestions`
      : "No matching page"
    : address(committed);

  return (
    <div className="flex h-[25rem] w-full select-none justify-center rounded-lg bg-linear-to-b from-surface to-fill-hover px-3 pt-10 ring-1 ring-stroke ring-inset sm:px-8 sm:pt-14">
      <div className="relative h-fit w-full max-w-120">
        <div
          className="relative overflow-hidden rounded-xl bg-bg p-1.5 outline outline-stroke sm:p-2"
          style={{
            backgroundImage:
              "linear-gradient(to bottom, rgb(255 255 255 / 1), rgb(0 0 0 / 0.018))",
            boxShadow: RAISED,
          }}
        >
          <div
            ref={well}
            style={editing ? undefined : { boxShadow: WELL }}
            className={cn(
              "relative flex h-11 items-center gap-2.5 rounded-lg px-3 transition-all duration-200 sm:h-12",
              editing
                ? "bg-bg ring-2 ring-text-primary/15 ring-offset-2 ring-offset-bg"
                : "bg-fill",
            )}
          >
            {/* a flex row centres the icon on the line box, and lowercase reads at its x-height */}
            <span className="relative grid size-4 shrink-0 translate-y-[0.155em] text-body text-text-secondary">
              <AnimatePresence initial={false} mode="popLayout">
                <motion.span
                  key={editing ? "search" : committed.path || "home"}
                  className="col-start-1 row-start-1 grid"
                  initial={{ opacity: 0, scale: 0.7 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.7 }}
                  transition={{ duration: 0.15, ease: "easeOut" }}
                >
                  {editing ? (
                    <MagnifyingGlassIcon className="size-4" />
                  ) : (
                    <committed.Icon className="size-4" />
                  )}
                </motion.span>
              </AnimatePresence>
            </span>
            <div className="relative h-full min-w-0 flex-1">
              <input
                ref={input}
                role="combobox"
                aria-label="Address and search bar"
                aria-expanded={open}
                aria-controls={listId}
                aria-autocomplete="both"
                aria-activedescendant={
                  open && row ? `${listId}-${hi}` : undefined
                }
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
                placeholder="Search sanyam.sh or type a page"
                value={editing ? value : address(committed)}
                onPointerDown={(e) => {
                  // the first click selects the whole address, the way a
                  // browser's bar does, and later clicks place the caret
                  if (editing) return;
                  e.preventDefault();
                  e.currentTarget.focus();
                }}
                onFocus={() => {
                  setEditing(true);
                  reset();
                  select.current = "all";
                }}
                onBlur={() => {
                  setEditing(false);
                  setDirty(false);
                }}
                onChange={onChange}
                onKeyDown={onKeyDown}
                className={cn(
                  "size-full min-w-0 select-text bg-transparent text-text-primary caret-text-primary outline-none transition-all duration-200 placeholder:text-body placeholder:text-text-muted",
                  TYPE,
                  !editing && "text-transparent",
                )}
              />
              {/* the quiet form, which a commit morphs to the new path */}
              <div
                aria-hidden="true"
                className={cn(
                  "pointer-events-none absolute inset-0 flex items-center whitespace-nowrap",
                  TYPE,
                  // the input sets its text a pixel lower, so focusing does not jump
                  "translate-y-px leading-tight",
                  editing ? "opacity-0" : "opacity-100",
                )}
              >
                <span className="text-text-primary">{SITE}</span>
                <span className="text-text-muted">
                  <TextMorph duration={220} ease="cubic-bezier(0.4, 0, 0.2, 1)">
                    {committed.path ? `/${committed.path}` : ""}
                  </TextMorph>
                </span>
              </div>
            </div>
          </div>
          <motion.span
            aria-hidden="true"
            className="absolute inset-x-0 bottom-0 h-0.5 origin-left bg-linear-to-r from-accent/0 via-accent/35 to-accent"
            style={{ scaleX: progress, opacity: barOpacity }}
          />
        </div>

        <AnimatePresence>
          {open && (
            <motion.div
              key="list"
              id={listId}
              role="listbox"
              aria-label="Suggestions"
              initial={{ opacity: 0, y: -4 }}
              animate={{
                opacity: 1,
                y: 0,
                transition: { duration: 0.16, ease: [0.23, 1, 0.32, 1] },
              }}
              exit={{ opacity: 0, y: -4, transition: { duration: 0.11 } }}
              className="absolute inset-x-0 top-full z-10 mt-2 overflow-hidden rounded-xl bg-bg p-1.5 outline outline-stroke"
              style={{ boxShadow: RAISED }}
            >
              {rows.length ? (
                rows.map((hit, i) => (
                  <Row
                    key={hit.entry.path || "home"}
                    hit={hit}
                    id={`${listId}-${i}`}
                    selected={i === hi}
                    onPick={() => commit(hit.entry)}
                  />
                ))
              ) : (
                <p className="flex h-10 items-center px-2.5 text-body text-text-muted">
                  No page on sanyam.sh matches that
                </p>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        <span role="status" className="sr-only">
          {status}
        </span>
      </div>
    </div>
  );
}
