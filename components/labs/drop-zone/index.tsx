"use client";

import {
  AnimatePresence,
  type MotionValue,
  motion,
  useMotionValue,
  useReducedMotion,
} from "motion/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import {
  bytes,
  dragLine,
  hashString,
  judge,
  type Kind,
  kindOfType,
  LIMIT,
  preview,
} from "./files";
import { Folder, type Pose } from "./folder";
import { FLAKY, samples } from "./samples";
import { busy, plan, step, type Transfer } from "./upload";

/*
 * A drop zone as one card. The card's picture and the card's own edge say
 * everything: the edge marches when a file enters the window, closes into a
 * solid line over the card, traces round it as the upload goes and turns green
 * when it is done, and the folder in the middle acts out every state.
 *
 * `folder.tsx` is the picture, `files.ts` what a file is and whether it is
 * taken, `upload.ts` the simulated transfer and `samples.ts` the sample set.
 * This file is the drag, the drop, the loop and the card.
 *
 * **Nothing on it changes size.** The card is a fixed box, its two lines of
 * text cross-fade in fixed slots, and everything that moves moves by
 * transform, opacity or a stroke's dash.
 */

type Phase = "empty" | "dropping" | "uploading" | "done" | "failed" | "refused";

interface Drag {
  armed: boolean;
  over: boolean;
  line: string;
  /** every type in the drag is one the card refuses */
  reject: boolean;
  count: number;
  kinds: readonly (Kind | null)[];
}

interface Batch {
  count: number;
  size: number;
  kinds: (Kind | null)[];
}

interface Incoming {
  file: File;
  path: string;
}

const IDLE: Drag = {
  armed: false,
  over: false,
  line: "",
  reject: false,
  count: 0,
  kinds: [],
};

const EMPTY: Batch = { count: 0, size: 0, kinds: [] };

/** how long the sheets take to fall in, and how long a finished card holds */
const DROP_MS = 650;
const DONE_MS = 2600;
const REFUSED_MS = 1800;
const FOLDER_CAP = 64;
/** the card's corner, which the edge's path has to know */
const RADIUS = 16;

/**
 * A drag that sends no `dragover` for this long has gone. The spec has a still
 * pointer fire one every 350ms give or take 200, so anything under 550 would
 * disarm a hand that is only resting. Leaving the window is heard directly, so
 * this only catches a drag cancelled with Escape.
 */
const WATCHDOG = 1000;

function within(box: DOMRect, x: number, y: number): boolean {
  return x >= box.left && x <= box.right && y >= box.top && y <= box.bottom;
}

/**
 * The card's outline as one path that starts at the top's middle and runs
 * clockwise, so the upload traces round the card from twelve o'clock.
 */
function outline(w: number, h: number, r: number): string {
  const i = 0.75;
  const [x0, y0, x1, y1] = [i, i, w - i, h - i];
  return [
    `M${w / 2} ${y0}`,
    `H${x1 - r}`,
    `A${r} ${r} 0 0 1 ${x1} ${y0 + r}`,
    `V${y1 - r}`,
    `A${r} ${r} 0 0 1 ${x1 - r} ${y1}`,
    `H${x0 + r}`,
    `A${r} ${r} 0 0 1 ${x0} ${y1 - r}`,
    `V${y0 + r}`,
    `A${r} ${r} 0 0 1 ${x0 + r} ${y0}`,
    "Z",
  ].join(" ");
}

/**
 * The files a drop carries, walking any folder in it. The entries have to be
 * taken while the drop event is still running, since a `DataTransfer` empties
 * the moment its event returns.
 */
function collect(dt: DataTransfer): Promise<Incoming[]> {
  const entries = Array.from(dt.items)
    .filter((i) => i.kind === "file")
    .map((i) =>
      typeof i.webkitGetAsEntry === "function" ? i.webkitGetAsEntry() : null,
    );
  const plain = Array.from(dt.files).map((file) => ({ file, path: "" }));
  if (!entries.some((e) => e?.isDirectory)) return Promise.resolve(plain);

  const out: Incoming[] = [];
  const walk = async (entry: FileSystemEntry, dir: string): Promise<void> => {
    if (out.length >= FOLDER_CAP || entry.name.startsWith(".")) return;
    if (entry.isFile) {
      const file = await new Promise<File>((res, rej) =>
        (entry as FileSystemFileEntry).file(res, rej),
      );
      out.push({ file, path: dir });
      return;
    }
    if (!entry.isDirectory) return;
    const reader = (entry as FileSystemDirectoryEntry).createReader();
    const next = dir ? `${dir}/${entry.name}` : entry.name;
    for (;;) {
      const batch = await new Promise<FileSystemEntry[]>((res, rej) =>
        reader.readEntries(res, rej),
      );
      if (batch.length === 0) break;
      for (const child of batch) await walk(child, next);
    }
  };
  return (async () => {
    for (const e of entries) if (e) await walk(e, "").catch(() => undefined);
    return out;
  })();
}

/** one line that cross-fades in its own grid cell, so it never moves */
function Swap({ text, className }: { text: string; className?: string }) {
  return (
    <span className={cn("grid place-items-center", className)}>
      <AnimatePresence initial={false}>
        <motion.span
          key={text}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.16 }}
          className="col-start-1 row-start-1 whitespace-nowrap"
        >
          {text}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

export default function DropZone() {
  const stage = useRef<HTMLDivElement>(null);
  const card = useRef<HTMLButtonElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const progress = useRef<SVGPathElement>(null);
  const live = useRef<HTMLSpanElement>(null);
  const transfers = useRef(new Map<number, Transfer>());
  const nextId = useRef(1);
  const loop = useRef({ raf: 0, last: 0 });
  const timer = useRef(0);
  const phaseRef = useRef<Phase>("empty");
  const batchRef = useRef<Batch>(EMPTY);
  const reduce = useReducedMotion() ?? false;

  const [phase, setPhaseState] = useState<Phase>("empty");
  const [batch, setBatch] = useState<Batch>(EMPTY);
  const [drag, setDrag] = useState<Drag>(IDLE);
  const [hover, setHover] = useState(false);
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState("");
  const [size, setSize] = useState({ w: 0, h: 0 });

  const lift0 = useMotionValue(0);
  const lift1 = useMotionValue(0);
  const lift2 = useMotionValue(0);
  // how far each of the three sheets has risen out of the folder
  const lifts = useMemo<readonly MotionValue<number>[]>(
    () => [lift0, lift1, lift2],
    [lift0, lift1, lift2],
  );

  const setPhase = useCallback((next: Phase) => {
    phaseRef.current = next;
    setPhaseState(next);
  }, []);

  const later = useCallback((ms: number, run: () => void) => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(run, ms);
  }, []);

  /** the card goes back to waiting for files */
  const reset = useCallback(() => {
    transfers.current.clear();
    batchRef.current = EMPTY;
    setBatch(EMPTY);
    for (const l of lifts) l.set(0);
    if (progress.current) progress.current.style.strokeDasharray = "0 1";
    setPhase("empty");
  }, [lifts, setPhase]);

  /** write the upload's progress to the edge, the sheets and the line */
  const paint = useCallback(() => {
    let sent = 0;
    let total = 0;
    for (const t of transfers.current.values()) {
      sent += t.sent;
      total += t.size;
    }
    const p = total > 0 ? sent / total : 0;
    if (progress.current) progress.current.style.strokeDasharray = `${p} 1`;
    // each sheet rises out over its own share of the batch
    const n = Math.min(3, Math.max(1, batchRef.current.count));
    lifts.forEach((l, i) => {
      l.set(Math.min(1, Math.max(0, p * n - i)));
    });
    // every byte is sent before the server has finished with them
    if (live.current)
      live.current.textContent =
        p >= 1
          ? "finishing"
          : `${Math.floor(p * 100)}%, ${bytes(sent)} of ${bytes(total)}`;
  }, [lifts]);

  const tick = useCallback(
    function frame(now: number) {
      const l = loop.current;
      l.raf = 0;
      const dt = Math.min(0.05, (now - l.last) / 1000);
      l.last = now;
      const all = [...transfers.current.values()];
      step(all, dt);
      paint();
      if (busy(all)) {
        l.raf = requestAnimationFrame(frame);
        return;
      }
      if (all.some((t) => t.phase === "failed")) {
        setPhase("failed");
        setMessage("The connection dropped. Press the card to resume.");
      } else {
        setPhase("done");
        setMessage(
          `${all.length} ${all.length === 1 ? "file" : "files"} uploaded`,
        );
        later(DONE_MS, reset);
      }
    },
    [later, paint, reset, setPhase],
  );

  const start = useCallback(() => {
    const l = loop.current;
    if (l.raf) return;
    l.last = performance.now();
    l.raf = requestAnimationFrame(tick);
  }, [tick]);

  const resume = useCallback(() => {
    for (const t of transfers.current.values())
      if (t.phase === "failed") t.phase = "queued";
    setPhase("uploading");
    setMessage("Resuming from where it stopped");
    start();
  }, [setPhase, start]);

  /** take a set of files, judge each one, and put the good ones in */
  const add = useCallback(
    (incoming: readonly Incoming[]) => {
      // a finished, refused or stopped card starts a fresh batch rather than
      // adding to the last
      if (
        phaseRef.current === "done" ||
        phaseRef.current === "refused" ||
        phaseRef.current === "failed"
      )
        reset();
      let space = LIMIT.files - transfers.current.size;
      const next: Batch = {
        ...batchRef.current,
        kinds: [...batchRef.current.kinds],
      };
      let refused = "";
      let skipped = 0;
      for (const { file } of incoming) {
        const v = judge(file.name, file.type, file.size, space);
        if (!v.ok) {
          skipped += 1;
          refused ||= v.reason;
          continue;
        }
        space -= 1;
        const id = nextId.current++;
        const seed = hashString(
          `${file.name}:${file.size}:${file.lastModified}`,
        );
        // only the flaky sample drops, so a real file never fails at random
        const failAt = file.name === FLAKY.name ? FLAKY.at : null;
        transfers.current.set(id, plan(id, file.size, seed, failAt));
        next.count += 1;
        next.size += file.size;
        if (next.kinds.length < 3) next.kinds.push(v.kind);
      }

      const taken = next.count - batchRef.current.count;
      if (taken === 0) {
        setReason(refused || "Not supported");
        setPhase("refused");
        setMessage(`Not uploaded: ${refused.toLowerCase()}`);
        later(REFUSED_MS, reset);
        return;
      }
      batchRef.current = next;
      setBatch(next);
      setMessage(
        `${taken} ${taken === 1 ? "file" : "files"} added${
          skipped > 0 ? `, ${skipped} skipped` : ""
        }`,
      );
      if (phaseRef.current === "uploading") {
        setPhase("uploading");
        start();
        return;
      }
      setPhase("dropping");
      later(reduce ? 0 : DROP_MS, () => {
        setPhase("uploading");
        start();
      });
    },
    [later, reduce, reset, setPhase, start],
  );

  // the edge's path is built for the card's real size
  useEffect(() => {
    const el = card.current;
    if (!el) return;
    const read = () => setSize({ w: el.offsetWidth, h: el.offsetHeight });
    read();
    const observer = new ResizeObserver(read);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  /*
   * The drag, heard on the window. A file entering the window wakes the card
   * before it is anywhere near it, and what the drag carries is judged from
   * its types. Whether the pointer is over the card is a test against the
   * card's box on every `dragover`, never `dragenter` and `dragleave` on the
   * card, which fire for every child the pointer crosses and flicker.
   */
  useEffect(() => {
    const node = stage.current;
    if (!node) return;
    let watchdog = 0;
    let current = IDLE;

    const set = (next: Drag) => {
      if (
        next.armed === current.armed &&
        next.over === current.over &&
        next.line === current.line &&
        next.count === current.count
      )
        return;
      current = next;
      setDrag(next);
    };
    const disarm = () => {
      window.clearTimeout(watchdog);
      set(IDLE);
    };
    const carriesFiles = (e: DragEvent) =>
      !!e.dataTransfer && Array.from(e.dataTransfer.types).includes("Files");

    const over = (e: DragEvent) => {
      if (!carriesFiles(e)) return;
      window.clearTimeout(watchdog);
      watchdog = window.setTimeout(disarm, WATCHDOG);
      const inside = within(node.getBoundingClientRect(), e.clientX, e.clientY);
      const c = card.current?.getBoundingClientRect();
      const onCard = !!c && within(c, e.clientX, e.clientY);
      if (inside) {
        // the stage takes the drop, so the browser never opens the file in
        // place of the page, and only the card says it will accept one
        e.preventDefault();
        if (e.dataTransfer)
          e.dataTransfer.dropEffect = onCard ? "copy" : "none";
      }
      const types = Array.from(e.dataTransfer?.items ?? [])
        .filter((i) => i.kind === "file")
        .map((i) => i.type);
      const p = preview(types);
      set({
        armed: true,
        over: onCard,
        line: dragLine(p),
        reject: p.count > 0 && p.accepted + p.unknown === 0,
        count: p.count,
        kinds: types.slice(0, 3).map((t) => kindOfType(t)),
      });
    };

    const leave = (e: DragEvent) => {
      if (!carriesFiles(e)) return;
      const out =
        e.clientX <= 0 ||
        e.clientY <= 0 ||
        e.clientX >= window.innerWidth ||
        e.clientY >= window.innerHeight;
      if (e.relatedTarget === null && out) disarm();
    };

    const drop = (e: DragEvent) => {
      if (!carriesFiles(e) || !e.dataTransfer) return;
      const inside = within(node.getBoundingClientRect(), e.clientX, e.clientY);
      const c = card.current?.getBoundingClientRect();
      const onCard = !!c && within(c, e.clientX, e.clientY);
      disarm();
      // the rest of the page keeps whatever a drop does there
      if (!inside) return;
      e.preventDefault();
      if (onCard) collect(e.dataTransfer).then(add);
    };

    window.addEventListener("dragenter", over);
    window.addEventListener("dragover", over);
    window.addEventListener("dragleave", leave);
    window.addEventListener("drop", drop);
    return () => {
      window.clearTimeout(watchdog);
      window.removeEventListener("dragenter", over);
      window.removeEventListener("dragover", over);
      window.removeEventListener("dragleave", leave);
      window.removeEventListener("drop", drop);
    };
  }, [add]);

  // a paste lands in the card when the pointer or the focus is on the demo
  useEffect(() => {
    const paste = (e: ClipboardEvent) => {
      const node = stage.current;
      if (!node) return;
      if (!node.matches(":hover") && !node.contains(document.activeElement))
        return;
      const files = Array.from(e.clipboardData?.files ?? []);
      if (files.length === 0) return;
      e.preventDefault();
      add(files.map((file) => ({ file, path: "" })));
    };
    window.addEventListener("paste", paste);
    return () => window.removeEventListener("paste", paste);
  }, [add]);

  useEffect(() => {
    const l = loop.current;
    return () => {
      cancelAnimationFrame(l.raf);
      window.clearTimeout(timer.current);
    };
  }, []);

  /** the samples come in the way a drop does: held over the card, then let go */
  const trySamples = async () => {
    if (phase === "dropping" || phase === "uploading") return;
    const files = await samples();
    const types = files.map((f) => f.type);
    const p = preview(types);
    setDrag({
      armed: true,
      over: true,
      line: dragLine(p),
      reject: false,
      count: p.count,
      kinds: types.slice(0, 3).map((t) => kindOfType(t)),
    });
    window.setTimeout(
      () => {
        setDrag(IDLE);
        add(files.map((file) => ({ file, path: "" })));
      },
      reduce ? 0 : 520,
    );
  };

  const onPicked = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (files.length > 0) add(files.map((file) => ({ file, path: "" })));
  };

  const pose: Pose = drag.armed
    ? drag.over
      ? drag.reject
        ? "reject"
        : "over"
      : "armed"
    : phase === "refused"
      ? "reject"
      : phase === "empty"
        ? hover
          ? "hover"
          : "idle"
        : phase;

  const files = (n: number) => `${n} ${n === 1 ? "file" : "files"}`;
  const title = drag.armed
    ? drag.line
    : {
        empty: "Drop files to upload",
        dropping: `Uploading ${files(batch.count)}`,
        uploading: `Uploading ${files(batch.count)}`,
        done: `${files(batch.count)} uploaded`,
        failed: "Connection dropped",
        refused: reason,
      }[phase];
  // written lowercase, since the line keeps its casing for the units in it
  const sub = drag.armed
    ? drag.over
      ? drag.reject
        ? "images, pdfs, sheets, text and zip"
        : "let go to upload"
      : "bring them over the card"
    : {
        empty: "or click to browse",
        dropping: "",
        uploading: "",
        done: bytes(batch.size),
        failed: "click to resume",
        refused: "images, pdfs, sheets, text and zip",
      }[phase];
  const counting =
    !drag.armed && (phase === "uploading" || phase === "dropping");

  // the edge: dashes at rest, marching when armed, solid over the card. Every
  // tone is a step softer than the state's own colour, since a full-strength
  // line round the whole card outweighed the folder it frames
  const edge =
    drag.armed && drag.over
      ? drag.reject
        ? "stroke-danger/40"
        : "stroke-text-muted/70"
      : phase === "refused"
        ? "stroke-danger/40"
        : drag.armed
          ? "stroke-text-muted/70"
          : hover
            ? "stroke-text-muted/50"
            : "stroke-stroke-strong";
  const solid =
    (drag.armed && drag.over) ||
    phase === "refused" ||
    (!drag.armed && phase !== "empty");

  return (
    <div
      ref={stage}
      className="relative flex aspect-8/5 min-h-78 w-full select-none flex-col items-center justify-center gap-3 overflow-hidden rounded-lg bg-fill"
    >
      <button
        ref={card}
        type="button"
        onClick={() => (phase === "failed" ? resume() : input.current?.click())}
        onPointerEnter={(e) => {
          if (e.pointerType === "mouse") setHover(true);
        }}
        onPointerLeave={() => setHover(false)}
        aria-label={
          phase === "failed" ? "Resume the upload" : "Choose files to upload"
        }
        aria-describedby="drop-zone-help"
        className={cn(
          "relative flex h-64 w-88 max-w-[calc(100%-2rem)] cursor-pointer flex-col items-center justify-center gap-1 rounded-[16px] bg-bg",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-primary/15 focus-visible:ring-offset-2 focus-visible:ring-offset-fill",
        )}
        style={{
          boxShadow:
            "0 1px 2px rgba(0,0,0,0.04), 0 14px 36px -14px rgba(0,0,0,0.16)",
        }}
      >
        {size.w > 0 && (
          <svg
            aria-hidden="true"
            width={size.w}
            height={size.h}
            className="pointer-events-none absolute inset-0 overflow-visible"
          >
            <path
              d={outline(size.w, size.h, RADIUS)}
              fill="none"
              strokeWidth="1.25"
              strokeDasharray={solid ? undefined : "6 5"}
              className={cn(
                "transition-[stroke] duration-200",
                !drag.armed && phase !== "empty" && phase !== "refused"
                  ? "stroke-stroke"
                  : edge,
                drag.armed &&
                  !drag.over &&
                  "motion-safe:animate-[ants_0.6s_linear_infinite]",
              )}
            />
            {/* the upload, traced round the card from twelve o'clock */}
            <path
              ref={progress}
              d={outline(size.w, size.h, RADIUS)}
              pathLength={1}
              fill="none"
              strokeWidth="1.5"
              strokeLinecap="round"
              className={cn(
                "transition-[stroke,opacity] duration-300",
                phase === "failed"
                  ? "stroke-danger/45"
                  : phase === "done"
                    ? "stroke-success/45"
                    : "stroke-text-muted/70",
                drag.armed ||
                  phase === "empty" ||
                  phase === "refused" ||
                  phase === "dropping"
                  ? "opacity-0"
                  : "opacity-100",
              )}
              style={{ strokeDasharray: "0 1" }}
            />
          </svg>
        )}

        <Folder
          pose={pose}
          kinds={
            drag.armed
              ? drag.kinds
              : batch.kinds.length
                ? batch.kinds
                : ["image"]
          }
          count={drag.armed ? drag.count : batch.count}
          lifts={lifts}
        />

        <Swap
          text={title}
          className={cn(
            "text-body transition-colors duration-200",
            pose === "reject" ? "text-danger" : "text-text-primary",
          )}
        />
        <span className="grid h-5 place-items-center text-meta text-text-muted normal-case">
          {counting ? (
            <span key="live" ref={live} className="tabular-nums" />
          ) : (
            <Swap key="words" text={sub} />
          )}
        </span>
      </button>

      <button
        type="button"
        onClick={trySamples}
        className="cursor-pointer rounded-full px-2.5 py-1 text-meta text-text-muted transition-colors duration-200 hover:bg-fill-hover hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-primary/15 focus-visible:ring-offset-2 focus-visible:ring-offset-fill"
      >
        or try sample files
      </button>

      <p id="drop-zone-help" className="sr-only">
        Opens a file picker. You can also drop files or a folder on this card,
        or paste a file. Uploads are simulated, and nothing leaves your browser.
      </p>
      <input
        ref={input}
        type="file"
        multiple
        tabIndex={-1}
        aria-hidden="true"
        className="hidden"
        onChange={onPicked}
      />
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
