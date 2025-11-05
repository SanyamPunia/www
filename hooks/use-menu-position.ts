"use client";

import { useEffect, useState } from "react";
import type { Corners } from "@/hooks/use-drag";

const STORAGE_KEY = "sound-control-position";

function getInitialPosition(): Corners {
  if (typeof window === "undefined") return "top-right";

  const stored = localStorage.getItem(STORAGE_KEY);

  if (
    stored &&
    ["top-left", "top-right", "bottom-left", "bottom-right"].includes(stored)
  ) {
    return stored as Corners;
  }
  return "top-right";
}

export function useMenuPosition() {
  const [position, setPosition] = useState<Corners>(getInitialPosition);

  const updatePosition = (newPosition: Corners) => {
    setPosition(newPosition);
    localStorage.setItem(STORAGE_KEY, newPosition);
  };

  useEffect(() => {
    setPosition(getInitialPosition());
  }, []);

  return { position, setPosition: updatePosition };
}
