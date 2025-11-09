"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "sound-muted";

function getInitialMutedState(): boolean {
  if (typeof window === "undefined") return false;

  const stored = localStorage.getItem(STORAGE_KEY);
  return stored === "true";
}

export function useSound() {
  const [isMuted, setIsMuted] = useState<boolean>(false);

  const toggleMute = () => {
    setIsMuted((prev) => {
      const newValue = !prev;
      localStorage.setItem(STORAGE_KEY, String(newValue));
      return newValue;
    });
  };

  useEffect(() => {
    setIsMuted(getInitialMutedState());
  }, []);

  return { isMuted, toggleMute };
}
