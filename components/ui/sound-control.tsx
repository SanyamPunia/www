"use client";

import { motion } from "framer-motion";
import { Volume2, VolumeX } from "lucide-react";
import { useEffect, useState } from "react";
import { useMenuPosition } from "@/hooks/use-menu-position";
import { useSound } from "@/hooks/use-sound";
import { cn, playTapSound } from "@/lib/utils";
import { Draggable } from "./draggable";

export function SoundControl() {
  const { position, setPosition } = useMenuPosition();
  const { isMuted, toggleMute } = useSound();
  const [isDragging, setIsDragging] = useState(false);

  const handleDragStart = () => {
    setIsDragging(true);
  };

  const handleClick = () => {
    if (!isDragging) {
      playTapSound();
      toggleMute();
    }
  };

  useEffect(() => {
    if (isDragging) {
      const timer = setTimeout(() => {
        setIsDragging(false);
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [isDragging]);

  const [vertical, horizontal] = position.split("-");
  const positionStyles = {
    [vertical]: "1rem",
    [horizontal]: "1rem",
  };

  return (
    <div className="fixed z-50" style={positionStyles}>
      <Draggable
        padding={16}
        position={position}
        setPosition={setPosition}
        onDragStart={handleDragStart}
      >
        <motion.button
          onClick={handleClick}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className={cn(
            "cursor-pointer bg-primary-bg/90 backdrop-blur-sm border border-[#1e1e1e] rounded-full p-2.5 shadow-sm hover:bg-primary-bg hover:shadow-md transition-all duration-200",
            "select-none flex items-center justify-center",
          )}
          aria-label={isMuted ? "Unmute sounds" : "Mute sounds"}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.15, ease: "easeInOut" }}
          >
            {isMuted ? (
              <VolumeX size={16} className="text-text-secondary" />
            ) : (
              <Volume2 size={16} className="text-text-secondary" />
            )}
          </motion.div>
        </motion.button>
      </Draggable>
    </div>
  );
}
