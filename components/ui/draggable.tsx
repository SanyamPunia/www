"use client";

import type React from "react";
import {
  type Corner,
  type Corners,
  type Point,
  project,
  useDrag,
} from "@/hooks/use-drag";

interface DraggableProps {
  children: React.ReactElement;
  padding: number;
  position: Corners;
  setPosition: (position: Corners) => void;
  onDragStart?: () => void;
}

export function Draggable({
  children,
  padding,
  position: currentCorner,
  setPosition: setCurrentCorner,
  onDragStart,
}: DraggableProps) {
  const { ref, animate, ...drag } = useDrag({
    threshold: 5,
    onDragStart,
    onDragEnd,
    onAnimationEnd,
  });

  function onDragEnd(translation: Point, velocity: Point) {
    const projectedPosition = {
      x: translation.x + project(velocity.x),
      y: translation.y + project(velocity.y),
    };

    const nearestCorner = getNearestCorner(projectedPosition);
    animate(nearestCorner);
  }

  function onAnimationEnd({ corner }: Corner) {
    setTimeout(() => {
      ref.current?.style.removeProperty("translate");
      setCurrentCorner(corner);
    });
  }

  function getNearestCorner({ x, y }: Point): Corner {
    const allCorners = getCorners();

    const distances = Object.entries(allCorners).map(([key, translation]) => {
      const distance = Math.sqrt(
        (x - translation.x) ** 2 + (y - translation.y) ** 2,
      );
      return { key, distance };
    });

    const min = Math.min(...distances.map((d) => d.distance));
    const nearest = distances.find((d) => d.distance === min);

    if (!nearest) {
      return { corner: currentCorner, translation: allCorners[currentCorner] };
    }

    return {
      translation: allCorners[nearest.key as Corners],
      corner: nearest.key as Corners,
    };
  }

  function getCorners(): Record<Corners, Point> {
    const offset = padding;
    const triggerWidth = ref.current?.offsetWidth || 0;
    const triggerHeight = ref.current?.offsetHeight || 0;

    function getAbsolutePosition(corner: Corners) {
      const isRight = corner.includes("right");
      const isBottom = corner.includes("bottom");

      return {
        x: isRight ? window.innerWidth - offset - triggerWidth : offset,
        y: isBottom ? window.innerHeight - offset - triggerHeight : offset,
      };
    }

    const basePosition = getAbsolutePosition(currentCorner);

    return {
      "top-left": {
        x: offset - basePosition.x,
        y: offset - basePosition.y,
      },
      "top-right": {
        x: window.innerWidth - offset - triggerWidth - basePosition.x,
        y: offset - basePosition.y,
      },
      "bottom-left": {
        x: offset - basePosition.x,
        y: window.innerHeight - offset - triggerHeight - basePosition.y,
      },
      "bottom-right": {
        x: window.innerWidth - offset - triggerWidth - basePosition.x,
        y: window.innerHeight - offset - triggerHeight - basePosition.y,
      },
    };
  }

  return (
    <div ref={ref} {...drag} style={{ touchAction: "none" }}>
      {children}
    </div>
  );
}
