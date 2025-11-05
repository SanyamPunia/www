import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function playTapSound() {
  // Check if sound is muted
  if (typeof window !== "undefined") {
    const isMuted = localStorage.getItem("sound-muted") === "true";
    if (isMuted) {
      return;
    }
  }

  const audio = new Audio("/media/tap.wav");
  audio.volume = 0.5;
  audio.play().catch(() => {
    // no-op
  });
}
