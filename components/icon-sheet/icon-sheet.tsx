"use client";

import type React from "react";
import { useEffect, useRef, useState } from "react";
import { CheckIcon } from "@/components/icons";
import { CATALOG } from "@/components/icons/catalog";
import { Reveal, RevealItem } from "@/components/ui/reveal";
import { Tooltip, TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { iconMarkup } from "./serialize";

/** every icon in sheet order, one grid with no group breaks */
const ICONS = CATALOG.flatMap((group) => group.icons);

/** what a press copies, named once so the label and the copy agree */
const FORMAT = "SVG";

/** how long a tile shows its tick */
const DONE_MS = 1200;

export function IconSheet() {
  const sheet = useRef<HTMLDivElement>(null);
  const timer = useRef<number | undefined>(undefined);
  const [done, setDone] = useState<string | null>(null);
  const [said, setSaid] = useState("");

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const take = async (name: string, tile: HTMLElement) => {
    const svg = tile.querySelector("svg");
    if (!svg) return;
    try {
      await navigator.clipboard.writeText(iconMarkup(svg));
      setDone(name);
      setSaid(`${name} copied as ${FORMAT}`);
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setDone(null), DONE_MS);
    } catch {
      setSaid("The clipboard refused the copy");
    }
  };

  /**
   * Arrow keys walk the grid the way it is laid out: left and right step in
   * order, up and down go to the tile in the same column of the next row.
   */
  const walk = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const root = sheet.current;
    const current = (event.target as HTMLElement).closest<HTMLElement>(
      "[data-tile]",
    );
    if (!root || !current) return;

    const tiles = [...root.querySelectorAll<HTMLElement>("[data-tile]")];
    const at = tiles.indexOf(current);
    const top = tiles[0]?.offsetTop ?? 0;
    const columns = tiles.filter((tile) => tile.offsetTop === top).length;

    const step: Record<string, number | undefined> = {
      ArrowRight: 1,
      ArrowLeft: -1,
      ArrowDown: columns,
      ArrowUp: -columns,
    };
    const offset = step[event.key];
    const next =
      event.key === "Home"
        ? tiles[0]
        : event.key === "End"
          ? tiles.at(-1)
          : offset !== undefined
            ? tiles[at + offset]
            : undefined;

    if (!next) return;
    event.preventDefault();
    next.focus();
  };

  return (
    <TooltipProvider delayDuration={150}>
      {/* the stagger every other page opens on, one item for the line and
          one for the grid */}
      <Reveal className="flex flex-col gap-4">
        <RevealItem>
          <p className="text-meta text-text-muted">
            Every icon used on this site. Click any to copy its {FORMAT}.
          </p>
        </RevealItem>

        <RevealItem>
          {/* biome-ignore lint/a11y/noStaticElementInteractions: the arrow keys
          are heard here once for every tile inside, each a real button */}
          <div
            ref={sheet}
            onKeyDown={walk}
            className="grid grid-cols-[repeat(auto-fill,minmax(3rem,1fr))] gap-1.5"
          >
            {ICONS.map(({ name, Icon }) => {
              const ticked = done === name;
              return (
                <Tooltip
                  key={name}
                  label={
                    <span className="font-mono [text-transform:none]">
                      {name}
                    </span>
                  }
                >
                  <button
                    type="button"
                    data-tile={name}
                    aria-label={`${name}, copy as ${FORMAT}`}
                    onClick={(event) => take(name, event.currentTarget)}
                    className="grid aspect-square cursor-pointer place-items-center rounded-lg bg-surface text-text-primary transition-all duration-150 hover:bg-fill focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-primary/15 active:bg-fill-hover"
                  >
                    {/* 24px exactly, the grid's own size, so every unit of the
                    drawing lands on a whole pixel */}
                    <span className="relative grid size-[1.5rem] place-items-center">
                      <Icon
                        className={cn(
                          "size-full transition-[opacity,scale] duration-150 motion-reduce:transition-none",
                          ticked
                            ? "scale-50 opacity-0"
                            : "scale-100 opacity-100",
                        )}
                      />
                      <CheckIcon
                        className={cn(
                          "absolute inset-0 size-full transition-[opacity,scale] duration-150 motion-reduce:transition-none",
                          ticked
                            ? "scale-100 opacity-100"
                            : "scale-50 opacity-0",
                        )}
                      />
                    </span>
                  </button>
                </Tooltip>
              );
            })}
          </div>
        </RevealItem>
      </Reveal>

      <p aria-live="polite" className="sr-only">
        {said}
      </p>
    </TooltipProvider>
  );
}
