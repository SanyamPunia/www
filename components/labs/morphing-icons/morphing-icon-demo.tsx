"use client";

import { motion } from "motion/react";
import { useState } from "react";
import { ICON_DEFINITIONS } from "./icons";
import { MorphingIcon, MorphingIconAnimated } from "./morphing-icon";

export function MorphingIconDemo() {
  const [selectedIcons, setSelectedIcons] = useState<string[]>(["menu"]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [currentIcon, setCurrentIcon] = useState("menu");
  const [previousIcon, setPreviousIcon] = useState("menu");

  const allIcons = Object.keys(ICON_DEFINITIONS);

  const handleMainIconClick = () => {
    if (selectedIcons.length === 0) return;

    const nextIndex = (currentIndex + 1) % selectedIcons.length;
    const nextIcon = selectedIcons[nextIndex];
    setPreviousIcon(currentIcon);
    setCurrentIcon(nextIcon);
    setCurrentIndex(nextIndex);
  };

  const handleIconClick = (icon: string) => {
    if (selectedIcons.includes(icon)) {
      const newSelection = selectedIcons.filter((i) => i !== icon);
      setSelectedIcons(newSelection);

      if (newSelection.length === 0) return;

      if (icon === currentIcon) {
        const newIndex = Math.min(currentIndex, newSelection.length - 1);
        const newIcon = newSelection[newIndex];
        setPreviousIcon(currentIcon);
        setCurrentIcon(newIcon);
        setCurrentIndex(newIndex);
      } else {
        const oldIndex = selectedIcons.indexOf(icon);
        if (oldIndex < currentIndex) {
          setCurrentIndex(currentIndex - 1);
        }
      }
    } else {
      const newSelection = [...selectedIcons, icon];
      setSelectedIcons(newSelection);
    }
  };

  const handleSelectAll = () => {
    setSelectedIcons([...allIcons]);
    if (currentIcon && allIcons.includes(currentIcon)) {
      setCurrentIndex(allIcons.indexOf(currentIcon));
    } else {
      setCurrentIcon(allIcons[0]);
      setPreviousIcon(currentIcon);
      setCurrentIndex(0);
    }
  };

  const handleDeselectAll = () => {
    const firstIcon = allIcons[0];
    setSelectedIcons([firstIcon]);
    setCurrentIcon(firstIcon);
    setPreviousIcon(currentIcon);
    setCurrentIndex(0);
  };

  return (
    <div className="flex w-full flex-col gap-4 py-4">
      {/* Preview */}
      <div className="flex flex-col items-center gap-2">
        <button
          onClick={handleMainIconClick}
          type="button"
          className="flex size-10 cursor-pointer items-center justify-center rounded-lg bg-bg ring-1 ring-stroke ring-inset transition-colors hover:bg-fill hover:ring-stroke-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-primary/15"
        >
          <div className="text-text-primary">
            <MorphingIconAnimated
              fromIcon={previousIcon}
              toIcon={currentIcon}
              size={32}
              strokeColor="currentColor"
              strokeWidth={2.5}
            />
          </div>
        </button>

        {/* Dot indicators */}
        {selectedIcons.length > 0 && (
          <div className="flex items-center gap-1">
            {/* the icon name is the identity here, the dots are a set not a
                sequence, so position is not what makes one dot distinct */}
            {selectedIcons.map((icon, idx) => (
              <div
                key={icon}
                className={`size-1.25 rounded-full transition-colors ${
                  idx === currentIndex ? "bg-text-primary" : "bg-stroke-strong"
                }`}
              />
            ))}
          </div>
        )}

        {/* Select All / Deselect All */}
        <div className="flex items-center gap-2 mt-1">
          <button
            onClick={handleSelectAll}
            type="button"
            className="text-meta text-text-muted hover:text-text-secondary transition-colors cursor-pointer lowercase"
          >
            all
          </button>
          <span
            aria-hidden="true"
            className="inline-block size-1.25 shrink-0 rounded-full bg-stroke-strong"
          />
          <button
            onClick={handleDeselectAll}
            type="button"
            className="text-meta text-text-muted hover:text-text-secondary transition-colors cursor-pointer lowercase"
          >
            none
          </button>
        </div>
      </div>

      {/* Icon Grid - 6 per row */}
      <div className="grid grid-cols-6 gap-1.5 max-w-xs mx-auto">
        {allIcons.map((icon) => {
          const isSelected = selectedIcons.includes(icon);
          return (
            <motion.button
              key={icon}
              onClick={() => handleIconClick(icon)}
              type="button"
              className={`flex size-8 cursor-pointer items-center justify-center rounded-lg ring-1 ring-inset transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-primary/15 ${
                isSelected
                  ? // `surface`, not `fill`. Nearly every key starts selected,
                    // so this is the resting majority: at `fill` the grid reads
                    // as one grey slab, at `surface` it is a 2% lift that the
                    // eye takes as texture rather than emphasis. The hairline
                    // stays identical across both states, so a toggle only ever
                    // changes the fill and the glyph.
                    "bg-surface text-text-primary ring-stroke hover:bg-fill hover:ring-stroke-strong"
                  : // off, so the glyph fades out. The edge stays put, or the
                    // key would appear to move when toggled.
                    "bg-bg text-stroke-strong ring-stroke hover:bg-fill hover:text-text-muted hover:ring-stroke-strong"
              }`}
              title={icon}
            >
              <MorphingIcon
                fromIcon="menu"
                toIcon={icon}
                progress={1}
                size={16}
                strokeColor="currentColor"
                strokeWidth={2.5}
              />
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
