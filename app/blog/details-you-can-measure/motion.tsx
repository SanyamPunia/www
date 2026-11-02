"use client";

import { useEffect, useState } from "react";
import { ArrowsClockwiseIcon } from "@/components/icons";
import { cn } from "@/lib/utils";
import { Cycle, Frame, Morph, Pill, Ping, RAISED } from "./frame";

/*
 * What a reduced motion setting takes away, on one object: a sync notice whose
 * icon loops, whose bar fills itself on arrival, and which slides in when
 * asked for. The switch stands in for the OS setting.
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
  const reduce = setting === "reduced motion";

  return (
    <Frame
      hint="Switch the setting, then hide and show the notice."
      after={
        reduce
          ? "The loop and the fill stop. The notice still appears when asked."
          : "Everything moves. Now switch the setting."
      }
      controls={
        <>
          <Cycle
            value={setting}
            options={SETTINGS}
            onChange={setSetting}
            label="setting"
          />
          <Pill lead onClick={() => setShown((s) => !s)}>
            <Morph>{shown ? "hide" : "show"}</Morph>
            <Ping />
          </Pill>
        </>
      }
    >
      {/* the notice arrives when asked for. Reduced motion keeps the arrival
          and drops the trip, so it appears in place. */}
      <div
        className={cn(
          "mx-auto flex w-full max-w-80 items-center gap-4 rounded-lg p-5 transition-[transform,opacity] ease-out",
          RAISED,
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
          <span className="text-meta text-text-primary">Syncing 12 files</span>
          <Bar key={`${shown}-${reduce}`} reduce={reduce} />
        </div>
      </div>
    </Frame>
  );
}
