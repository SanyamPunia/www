"use client";

import type React from "react";
import { useRef } from "react";

interface Point {
  x: number;
  y: number;
}

export type Corners = "top-left" | "top-right" | "bottom-left" | "bottom-right";

interface Corner {
  corner: Corners;
  translation: Point;
}

interface UseDragOptions {
  onDragStart?: () => void;
  onDrag?: (translation: Point) => void;
  onDragEnd?: (translation: Point, velocity: Point) => void;
  onAnimationEnd?: (corner: Corner) => void;
  threshold: number;
}

interface Velocity {
  position: Point;
  timestamp: number;
}

export function useDrag(options: UseDragOptions) {
  const ref = useRef<HTMLDivElement>(null);
  const state = useRef<"idle" | "press" | "drag" | "drag-end">("idle");
  const origin = useRef<Point>({ x: 0, y: 0 });
  const translation = useRef<Point>({ x: 0, y: 0 });
  const lastTimestamp = useRef(0);
  const velocities = useRef<Velocity[]>([]);

  function set(position: Point) {
    if (ref.current) {
      translation.current = position;
      ref.current.style.translate = `${position.x}px ${position.y}px`;
    }
  }

  function animate(corner: Corner) {
    const el = ref.current;
    if (el === null) return;

    function listener(e: TransitionEvent) {
      if (e.propertyName === "translate") {
        options.onAnimationEnd?.(corner);
        translation.current = { x: 0, y: 0 };
        if (el) {
          el.style.transition = "";
          el.removeEventListener("transitionend", listener);
        }
      }
    }

    el.style.transition =
      "translate 491.22ms cubic-bezier(0.23, 0.88, 0.26, 0.92)";
    el.addEventListener("transitionend", listener);
    set(corner.translation);
  }

  function onClick(e: MouseEvent) {
    if (state.current === "drag-end") {
      e.preventDefault();
      e.stopPropagation();
      state.current = "idle";
      ref.current?.removeEventListener("click", onClick);
    }
  }

  function onPointerDown(e: React.PointerEvent) {
    origin.current = { x: e.clientX, y: e.clientY };
    state.current = "press";

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    ref.current?.addEventListener("click", onClick);
  }

  function onPointerMove(e: PointerEvent) {
    if (state.current === "press") {
      const dx = e.clientX - origin.current.x;
      const dy = e.clientY - origin.current.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance >= options.threshold) {
        state.current = "drag";
        ref.current?.setPointerCapture(e.pointerId);
        ref.current?.classList.add("dragging");
        options.onDragStart?.();
      }
    }

    if (state.current !== "drag") return;

    const currentPosition = { x: e.clientX, y: e.clientY };
    const dx = currentPosition.x - origin.current.x;
    const dy = currentPosition.y - origin.current.y;
    origin.current = currentPosition;

    const newTranslation = {
      x: translation.current.x + dx,
      y: translation.current.y + dy,
    };

    set(newTranslation);

    const now = Date.now();
    const shouldAddToHistory = now - lastTimestamp.current >= 10;

    if (shouldAddToHistory) {
      velocities.current = [
        ...velocities.current.slice(-5),
        { position: currentPosition, timestamp: now },
      ];
    }

    lastTimestamp.current = now;
    options.onDrag?.(translation.current);
  }

  function onPointerUp(e: PointerEvent) {
    state.current = state.current === "drag" ? "drag-end" : "idle";
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", onPointerUp);
    const velocity = calculateVelocity(velocities.current);
    velocities.current = [];

    ref.current?.classList.remove("dragging");
    ref.current?.releasePointerCapture(e.pointerId);

    options.onDragEnd?.(translation.current, velocity);
  }

  return {
    ref,
    onPointerDown,
    animate,
  };
}

function calculateVelocity(
  history: Array<{ position: Point; timestamp: number }>,
): Point {
  if (history.length < 2) {
    return { x: 0, y: 0 };
  }

  const oldestPoint = history[0];
  const latestPoint = history[history.length - 1];
  const timeDelta = latestPoint.timestamp - oldestPoint.timestamp;

  if (timeDelta === 0) {
    return { x: 0, y: 0 };
  }

  const velocityX =
    (latestPoint.position.x - oldestPoint.position.x) / timeDelta;
  const velocityY =
    (latestPoint.position.y - oldestPoint.position.y) / timeDelta;

  return {
    x: velocityX * 1000,
    y: velocityY * 1000,
  };
}

function project(initialVelocity: number, decelerationRate = 0.999) {
  return ((initialVelocity / 1000) * decelerationRate) / (1 - decelerationRate);
}

export { project };
export type { Point, Corner };
