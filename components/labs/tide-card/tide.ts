/**
 * The tide the card reads, and the one function the whole piece is built on.
 *
 * **Everything on the card is `heightAt` evaluated somewhere.** The curve is
 * that function drawn, the readout is it at now, the state is its sign and the
 * countdown is the distance to its next peak. There is no second copy of the
 * tide anywhere, so nothing on the card can disagree with the drawing.
 */
export const TIDE = {
  station: "NEWLYN",
  kind: "Spring tide",
  zone: "BST",
  /** metres at low water and at high water */
  low: 0.8,
  high: 4.6,
  /**
   * Minutes from one low water to the next. A semidiurnal tide runs on the
   * lunar day rather than the solar one, which is what puts high water about
   * fifty minutes later each day and makes this 12h25 rather than 12h.
   */
  period: 745,
  /**
   * Where the water is when the card opens: 0 is low water and 0.5 is high.
   *
   * 0.301 is 3.3m and rising, with high water 2h 28m off. It is picked for the
   * drawing rather than for the number: a cosine is flat at both ends, so a
   * phase close to either turn puts the marker where it has nowhere visible to
   * go, and this one sits two thirds up the rise where the curve is steepest
   * and the water is visibly coming in.
   */
  start: 0.301,
} as const;

/** low water, in minutes past midnight, which the axis is counted off */
const FIRST_LOW = 8 * 60 + 14;

/**
 * How long a tidal minute takes on the stage.
 *
 * The tide runs while the card is open, so the countdown ticks about once a
 * second, the height moves about every six, and the water visibly comes in.
 *
 * **Nothing here has to be put back when the card shuts, and that is the whole
 * difference between a tide and a journey.** A flight lands and a demo of one
 * has to either end dead or restart a flight that was already half over, which
 * is a thing a real tracker never does. A tide only ever carries on, so the
 * phase runs from wherever it was and the card is honest at every opening.
 */
export const MINUTE = 1;

/** metres at a point in the cycle, and the curve the card draws is this */
export function heightAt(phase: number): number {
  const p = phase - Math.floor(phase);
  return (
    TIDE.low + ((TIDE.high - TIDE.low) * (1 - Math.cos(2 * Math.PI * p))) / 2
  );
}

/** the water is coming in over the first half of the cycle */
export function isRising(phase: number): boolean {
  return phase - Math.floor(phase) < 0.5;
}

/** minutes to the next turn, which is high water while it is rising */
export function toTurn(phase: number): number {
  const p = phase - Math.floor(phase);
  return (p < 0.5 ? 0.5 - p : 1 - p) * TIDE.period;
}

/**
 * The clock time at a point in the cycle.
 *
 * Derived off one low water and the period rather than written down three
 * times, so the axis cannot drift from the curve above it: move the period and
 * the labels move with it.
 */
export function clockAt(phase: number): string {
  const total = Math.round(FIRST_LOW + phase * TIDE.period);
  const hh = Math.floor(total / 60) % 24;
  const mm = total % 60;
  return `${String(hh).padStart(2, "0")}.${String(mm).padStart(2, "0")}`;
}

/** "2h 28m", and "48m" once the hours have run out */
export function formatSpan(minutes: number): string {
  const whole = Math.max(0, Math.round(minutes));
  const hh = Math.floor(whole / 60);
  return hh > 0
    ? `${hh}h ${String(whole % 60).padStart(2, "0")}m`
    : `${whole}m`;
}

/** "3.3", which is the precision a tide table prints and a reader can read */
export function formatHeight(metres: number): string {
  return metres.toFixed(1);
}
