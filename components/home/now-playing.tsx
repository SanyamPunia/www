"use client";

import { motion } from "motion/react";
import { useEffect, useState } from "react";
import { InlineLink } from "@/components/ui/inline-link";
import type { NowPlaying as NowPlayingData } from "@/lib/spotify";

const POLL_MS = 30_000;

/**
 * The p.s. line on the home page, when something is actually playing.
 *
 * Renders `null` until the first response resolves, and that is deliberate on
 * two counts. It means an unconfigured install, a dead API or a paused player
 * all leave the page exactly as it was, with no placeholder and no empty
 * `gap-12` slot in the column. It also keeps this out of `Reveal`'s stagger:
 * the count of rendered children at mount stays five, so `revealSettled` on the
 * page, and the underline timings derived from it, do not move.
 *
 * Because of that it animates itself in with an explicit `initial`/`animate`
 * pair rather than `RevealItem`'s variants. A variant label would inherit the
 * container's already-settled `show` state and the line would simply appear.
 *
 * `appearAt` is what keeps it in sequence. Spotify answers whenever it answers,
 * which on a warm route is well inside the opening stagger, so without a floor
 * the line either barges in mid-sequence or turns up long after the page has
 * settled. Neither reads as part of the page arriving. It holds until the beat
 * the caller nominates and animates then, so a slow response is late and a fast
 * one still waits its turn.
 */
export function NowPlaying({ appearAt = 0 }: { appearAt?: number }) {
  const [track, setTrack] = useState<NowPlayingData | null>(null);
  const [reachedCue, setReachedCue] = useState(appearAt <= 0);

  useEffect(() => {
    // guards against a response landing after unmount, which would otherwise
    // set state on a dead component
    let active = true;

    const load = async () => {
      try {
        const response = await fetch("/api/now-playing", { cache: "no-store" });
        if (!response.ok) return;
        const data = (await response.json()) as NowPlayingData;
        if (active) setTrack(data);
      } catch {
        // offline or the route is down. The line stays absent, which is the
        // same outcome as nothing playing, so there is nothing to report.
      }
    };

    load();
    const timer = setInterval(load, POLL_MS);

    return () => {
      active = false;
      clearInterval(timer);
    };
  }, []);

  /*
   * A separate timer from the fetch, so the two do not have to agree on which
   * finishes first. Whichever lands last is what reveals the line.
   */
  useEffect(() => {
    if (appearAt <= 0) return;
    const cue = setTimeout(() => setReachedCue(true), appearAt);
    return () => clearTimeout(cue);
  }, [appearAt]);

  if (!reachedCue || !track?.isPlaying || !track.title) return null;

  return (
    <motion.p
      className="text-body text-text-secondary text-pretty"
      initial={{ opacity: 0, y: 4, filter: "blur(6px)" }}
      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      transition={{ duration: 0.4, ease: "easeOut" }}
    >
      P.s. currently listening to{" "}
      {track.songUrl ? (
        <InlineLink href={track.songUrl} external>
          {track.title}
        </InlineLink>
      ) : (
        track.title
      )}
      {track.artist ? ` by ${track.artist}` : ""}.
    </motion.p>
  );
}
