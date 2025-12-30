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

export function ordinal(n: number) {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] || s[v] || s[0]}`;
}
