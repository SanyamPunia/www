"use client";

import { motion } from "framer-motion";
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
    <div className="flex flex-col w-full py-12 gap-4">
      {/* Preview */}
      <div className="flex flex-col items-center gap-2">
        <button
          onClick={handleMainIconClick}
          type="button"
          className="size-10 flex items-center justify-center rounded-sm bg-[#0B0B0B] hover:bg-[#141414] transition-colors cursor-pointer ring-1 ring-[#2a2a2a] hover:ring-[#3a3a3a]"
        >
          <div className="text-[#f5f5f5]">
            <MorphingIconAnimated
              fromIcon={previousIcon}
              toIcon={currentIcon}
              size={32}
              strokeColor="currentColor"
              strokeWidth={2}
            />
          </div>
        </button>

        {/* Dot indicators */}
        {selectedIcons.length > 0 && (
          <div className="flex items-center gap-1">
            {selectedIcons.map((_, idx) => (
              <div
                key={`${selectedIcons[idx]}-${idx}`}
                className={`size-1 rounded-full transition-colors ${
                  idx === currentIndex ? "bg-[#f5f5f5]" : "bg-[#3a3a3a]"
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
            className="text-[10px] text-[#6b7280] hover:text-[#a3a3a3] transition-colors cursor-pointer lowercase"
          >
            all
          </button>
          <span className="text-[#3a3a3a]">/</span>
          <button
            onClick={handleDeselectAll}
            type="button"
            className="text-[10px] text-[#6b7280] hover:text-[#a3a3a3] transition-colors cursor-pointer lowercase"
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
              whileTap={{ scale: 0.98 }}
              className={`size-8 rounded-sm flex items-center justify-center transition-all border ${
                isSelected
                  ? "bg-[#1e1e1e] text-[#f5f5f5] border-[#2a2a2a]"
                  : "bg-[#0B0B0B] text-[#a3a3a3] border-[#1e1e1e] hover:bg-[#141414] hover:text-[#f5f5f5] hover:border-[#2a2a2a]"
              } cursor-pointer`}
              title={icon}
            >
              <MorphingIcon
                fromIcon="menu"
                toIcon={icon}
                progress={1}
                size={16}
                strokeColor="currentColor"
                strokeWidth={2}
              />
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
