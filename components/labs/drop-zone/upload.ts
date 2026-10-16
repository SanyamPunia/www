/*
 * The upload, simulated. Nothing leaves the browser: a file's bytes are never
 * read, and "sent" is a number this file advances on the component's clock.
 *
 * It is simulated carefully enough to look like a real one, since a progress
 * bar that moves at one steady rate is the tell of a fake:
 *
 * - **Three files go at once and the rest queue**, the way a browser shares a
 *   connection.
 * - **Each file has its own rate and the rate wanders.** Two sines with no
 *   common period, off the file's own seed, so a transfer surges and stalls.
 * - **A transfer takes between 0.9s and 4.2s whatever the size**, so a 2 KB
 *   text file still shows a bar and a 9 MB archive does not take a minute.
 * - **Bytes done is not the end.** A finished transfer spends half a second
 *   processing before it is done, which is what a server does with an upload.
 * - **A transfer can drop, and a retry resumes it** from the byte it reached,
 *   rather than starting over.
 */

import { hash } from "./files";

export type Phase = "queued" | "uploading" | "processing" | "done" | "failed";

export const CONCURRENCY = 3;

export interface Transfer {
  id: number;
  size: number;
  sent: number;
  phase: Phase;
  /** the rate it averages, in bytes a second */
  base: number;
  /** the rate it is moving at this frame */
  rate: number;
  seed: number;
  /** the share of the file at which it drops once, or null */
  failAt: number | null;
  /** seconds of processing left */
  processing: number;
  /** seconds since it started, which is what its rate wanders on */
  clock: number;
}

const DURATION = { min: 0.9, max: 4.2 } as const;

export function plan(
  id: number,
  size: number,
  seed: number,
  failAt: number | null,
): Transfer {
  // a connection somewhere between 0.8 and 3.4 MB a second
  const natural = 0.8e6 + hash(seed) * 2.6e6;
  const duration = Math.min(
    DURATION.max,
    Math.max(DURATION.min, size / natural),
  );
  return {
    id,
    size,
    sent: 0,
    phase: "queued",
    base: Math.max(1, size) / duration,
    rate: 0,
    seed,
    failAt,
    processing: 0.4 + hash(seed + 7) * 0.45,
    clock: 0,
  };
}

/** advance every transfer by `dt` seconds, and say which changed phase */
export function step(transfers: Transfer[], dt: number): Transfer[] {
  const changed: Transfer[] = [];
  let running = transfers.filter((t) => t.phase === "uploading").length;
  for (const t of transfers) {
    if (t.phase === "queued" && running < CONCURRENCY) {
      t.phase = "uploading";
      running += 1;
      changed.push(t);
    }
  }
  for (const t of transfers) {
    if (t.phase === "uploading") {
      t.clock += dt;
      const a = (t.seed % 997) / 997;
      // surges and stalls, never below a fifth of the average
      const wander =
        0.62 * Math.sin(t.clock * 2.3 + a * 6.28) +
        0.38 * Math.sin(t.clock * 5.9 + a * 19.1);
      t.rate = t.base * Math.max(0.2, 1 + 0.55 * wander);
      t.sent = Math.min(t.size, t.sent + t.rate * dt);
      if (t.failAt !== null && t.sent >= t.size * t.failAt) {
        t.sent = t.size * t.failAt;
        t.failAt = null;
        t.phase = "failed";
        t.rate = 0;
        changed.push(t);
      } else if (t.sent >= t.size) {
        t.phase = "processing";
        t.rate = 0;
        changed.push(t);
      }
    } else if (t.phase === "processing") {
      t.processing -= dt;
      if (t.processing <= 0) {
        t.phase = "done";
        changed.push(t);
      }
    }
  }
  return changed;
}

export function busy(transfers: readonly Transfer[]): boolean {
  return transfers.some(
    (t) =>
      t.phase === "queued" ||
      t.phase === "uploading" ||
      t.phase === "processing",
  );
}
