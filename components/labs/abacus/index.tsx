"use client";

import { SlidersHorizontalIcon } from "@phosphor-icons/react";
import { useEffect, useId, useRef, useState } from "react";
import { TextMorph } from "torph/react";
import { type Knob, Lane, Pill } from "@/components/lab/controls";
import { cn } from "@/lib/utils";
import { FIGURE, mount } from "./figure";
import { HL } from "./kernel";

const STAGGER: Knob<"stagger"> = {
  key: "stagger",
  label: "Stagger",
  min: FIGURE.range[0],
  max: FIGURE.range[2],
  step: 1,
  format: (value) => `${value}ms`,
};

/**
 * The abacus, drawn by the vendored Hairline kernel into an svg this component
 * hands it. The figure owns the drawing, the pointer and the frame loop, and
 * this owns the read-out and the slider the skill's bench page would have.
 */
export default function Abacus() {
  const hostRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<ReturnType<typeof mount> | null>(null);
  const [stagger, setStagger] = useState<number>(FIGURE.range[1]);
  const [readout, setReadout] = useState("rest");
  const [open, setOpen] = useState(false);
  const panelId = useId();

  // Mounted once. The slider reaches the running figure through `set`, so
  // `stagger` is read here only for the first draw.
  // biome-ignore lint/correctness/useExhaustiveDependencies: a changed stagger goes through set, never a remount
  useEffect(() => {
    const host = hostRef.current;
    if (host === null) return;
    HL.inject(document);
    const svg = HL.mk(
      "svg",
      { viewBox: "0 0 400 320", "aria-hidden": "true" },
      host,
    );
    let text = "rest";
    const read = {
      get textContent() {
        return text;
      },
      set textContent(value: string | null) {
        text = value ?? "";
        setReadout(text);
      },
    };
    const handle = mount({ stage: host, svg, read }, stagger);
    handleRef.current = handle;
    return () => {
      handle.destroy();
      svg.remove();
      handleRef.current = null;
    };
  }, []);

  return (
    <div className="flex w-full select-none flex-col gap-4 rounded-lg bg-surface p-6 ring-1 ring-stroke ring-inset">
      <div className="relative">
        {/*
          The read-out morphs, `rest` to `count 7` and between counts, at 160ms
          rather than the site's 200: a sweep along the rod changes the count
          about as often as a hand drops in `the-card-flinches`, and a morph
          still running when the next starts reads as a smear.
        */}
        <span className="pointer-events-none absolute top-0 right-0 whitespace-nowrap font-mono text-meta text-text-muted tabular-nums">
          <TextMorph duration={160} ease="cubic-bezier(0.32, 0.72, 0, 1)">
            {readout}
          </TextMorph>
        </span>
        {/*
          The kernel's palette is five strokes, read from `--hairline-*` when
          they are set. Mapping them to the site's tokens is what keeps the
          figure on the light theme rather than following the OS.

          `aspect-5/4` restates the box the kernel's stylesheet gives it. That
          sheet is injected in the mount effect, after the lab slot has measured
          this component in its layout effect, so without it the host measures
          0px tall and the frame eases to a sliver before the figure appears.
        */}
        <div
          ref={hostRef}
          data-hairline={FIGURE.name}
          role="img"
          aria-label={FIGURE.means}
          className="relative block aspect-5/4 [--hairline-edge:var(--color-text-muted)] [--hairline-hi:var(--color-text-primary)] [--hairline-lo:var(--color-stroke)] [--hairline-mid:var(--color-stroke-strong)] [--hairline-plate:var(--color-bg)]"
        />
      </div>
      <div className="flex justify-center">
        <Pill
          onClick={() => setOpen((o) => !o)}
          expanded={open}
          controls={panelId}
        >
          <SlidersHorizontalIcon
            aria-hidden="true"
            className="size-3 shrink-0"
          />
          tune
        </Pill>
      </div>

      {/*
        The shared disclosure: one grid row from `0fr` to `1fr`, so it eases to
        a height the browser works out, and `inert` while shut, since a `0fr`
        row still has its range in the tab order.
      */}
      <div
        id={panelId}
        inert={!open}
        className={cn(
          "-mt-4 grid w-full motion-safe:transition-all motion-safe:duration-200",
          open ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
        )}
      >
        <div className="overflow-hidden">
          <div className="mx-auto w-full max-w-60 pt-5">
            <Lane
              knob={STAGGER}
              value={stagger}
              onChange={(value) => {
                setStagger(value);
                handleRef.current?.set(value);
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
