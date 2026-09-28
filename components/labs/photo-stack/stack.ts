/**
 * Where every photo sits, in stage pixels, as a function of the stage's size
 * and the one question that matters: is the pile shut or is a photo open.
 *
 * Pure and DOM-free, the split `document-pocket` makes with `poses.ts`. The
 * component measures the stage once per resize and asks this for targets.
 */

import { PHOTO_H, PHOTO_W } from "./photos";

const ASPECT = PHOTO_W / PHOTO_H;

/** the centre of a card as an offset from the stage's centre, and its box */
export interface Pose {
  cx: number;
  cy: number;
  rotate: number;
  width: number;
  height: number;
  opacity: number;
}

export interface Size {
  /** the open photo */
  bigW: number;
  bigH: number;
  /** a photo in the pile */
  cardW: number;
  cardH: number;
  /** the space between two photos in the carousel */
  gap: number;
}

/**
 * The open photo is as tall as the stage allows once the close control above
 * it and the caption under it have their rows, and never so wide that a
 * neighbour has no room to peek. The pile is 0.6 of it, so opening a photo is a
 * visible step up in size rather than a nudge.
 */
export function sizes(stageW: number, stageH: number): Size {
  const bigH = Math.min(stageH - 112, (stageW - 112) / ASPECT, 360);
  const cardH = bigH * 0.6;
  return {
    bigW: bigH * ASPECT,
    bigH,
    cardW: cardH * ASPECT,
    cardH,
    gap: Math.max(16, stageW * 0.04),
  };
}

/*
 * The pile, front first. Each card behind the front one leans a different way
 * and shifts off centre, so a sliver of it leaks out on the left or the right,
 * and that sliver is a target: pressing it opens that photo. Shifts are shares
 * of the card so the pile is the same shape at every size.
 */
const TILT = [-2, 6, -7, 3, -4];
const SHIFT_X = [0, 0.12, -0.12, 0.05, -0.05];
const SHIFT_Y = [0, -0.035, -0.05, -0.065, -0.075];

/**
 * How much further the cards behind lean out while a pointer is over the pile.
 * It is the only thing at rest that says the front card can be moved.
 */
export const SPREAD = 1.45;

export function stackPose(depth: number, size: Size, spread: boolean): Pose {
  const d = Math.min(depth, TILT.length - 1);
  const fan = spread && d > 0 ? SPREAD : 1;
  return {
    cx: SHIFT_X[d] * size.cardW * fan,
    cy: SHIFT_Y[d] * size.cardH + size.cardH * 0.04,
    rotate: TILT[d] * fan,
    width: size.cardW,
    height: size.cardH,
    opacity: 1,
  };
}

/** the open photo sits a little above centre, so the caption has its row */
const LIFT = 10;

/**
 * A photo `offset` places from the one open, `drag` pixels into a swipe.
 * Two away and further are out of the stage and transparent, so a pile of
 * any length is a carousel of three.
 */
export function carouselPose(offset: number, size: Size, drag: number): Pose {
  const far = Math.abs(offset);
  return {
    cx: offset * (size.bigW + size.gap) + drag,
    cy: -LIFT,
    rotate: 0,
    width: size.bigW,
    height: size.bigH,
    opacity: far === 0 ? 1 : far === 1 ? 0.55 : 0,
  };
}

/** where the caption row starts, below the open photo */
export function captionTop(stageH: number, size: Size): number {
  return stageH / 2 - LIFT + size.bigH / 2 + 12;
}

/**
 * Past either end of the carousel a swipe gives a third of what it asked for,
 * which says there is nothing further without a hard stop.
 */
export function resist(drag: number, open: number, count: number): number {
  const atStart = open === 0 && drag > 0;
  const atEnd = open === count - 1 && drag < 0;
  return atStart || atEnd ? drag / 3 : drag;
}
