"use client";

import { ArrowsClockwiseIcon } from "@phosphor-icons/react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { Cycle, Frame, Morph, Pill, Readout } from "./frame";

/*
 * What a reduced motion setting should and should not take away, on one
 * object: a sync notice whose icon loops, whose bar fills itself on arrival,
 * and which slides in when asked for. The switch stands in for the OS setting
 * so the difference shows on a machine that has it off.
 */

type Setting = "motion allowed" | "reduced motion";
const SETTINGS = ["motion allowed", "reduced motion"] as const;

/** how long the bar takes to fill on its own */
const FILL = 1800;
/** how long the notice takes to arrive when asked for */
const ARRIVE = 300;

/** the bar fills itself on arrival, which nobody asked it to do */
function Bar({ reduce }: { reduce: boolean }) {
  const [full, setFull] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setFull(true));
    return () => cancelAnimationFrame(id);
  }, []);
  return (
    <div className="h-1 w-full overflow-hidden rounded-full bg-stroke">
      <div
        className="h-full origin-left rounded-full bg-text-primary transition-transform ease-out"
        style={{
          transform: `scaleX(${full ? 1 : 0})`,
          transitionDuration: `${reduce ? 0 : FILL}ms`,
        }}
      />
    </div>
  );
}

export function ReducedMotionDemo() {
  const [setting, setSetting] = useState<Setting>("motion allowed");
  const [shown, setShown] = useState(true);
  const [run, setRun] = useState(0);
  const reduce = setting === "reduced motion";

  return (
    <Frame
      label="switch the setting"
      readouts={
        <>
          <Readout label="loop" value={reduce ? "off" : "on"} />
          <Readout label="fill" value={reduce ? "0ms" : `${FILL}ms`} />
          <Readout label="arrive" value={reduce ? "0ms" : `${ARRIVE}ms`} />
        </>
      }
      controls={
        <>
          <Cycle
            value={setting}
            options={SETTINGS}
            onChange={setSetting}
            label="setting"
          />
          <Pill onClick={() => setShown((s) => !s)}>
            <Morph>{shown ? "hide the notice" : "show the notice"}</Morph>
          </Pill>
          <Pill onClick={() => setRun((r) => r + 1)} disabled={!shown}>
            replay
          </Pill>
        </>
      }
    >
      <div className="flex h-24 items-center justify-center">
        {/* the notice arrives when asked for. Reduced motion keeps the
            arrival and drops the trip, so it appears in place. */}
        <div
          className={cn(
            "flex w-64 items-center gap-3 rounded-lg bg-fill p-3 transition-[transform,opacity] ease-out",
            shown ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0",
          )}
          style={{ transitionDuration: `${reduce ? 0 : ARRIVE}ms` }}
          aria-hidden={!shown}
        >
          <ArrowsClockwiseIcon
            aria-hidden="true"
            className={cn(
              "size-4 shrink-0 text-text-secondary",
              !reduce && "motion-safe:animate-spin",
            )}
          />
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <div className="flex items-baseline justify-between gap-3 text-meta">
              <span className="text-text-primary">Syncing 12 files</span>
              <span className="font-mono text-text-muted tabular-nums [text-transform:none]">
                4.2 MB
              </span>
            </div>
            <Bar key={`${run}-${reduce}`} reduce={reduce} />
          </div>
        </div>
      </div>
    </Frame>
  );
}
