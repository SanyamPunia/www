"use client";

import { useEffect, useState } from "react";
import { Spotify } from "@/components/icons/spotify";
import { Tooltip, TooltipProvider } from "@/components/ui/tooltip";
import type { NowPlaying as NowPlayingData } from "@/lib/spotify";

const POLL_MS = 30_000;

/**
 * The album cover of whatever is playing, stacked behind the avatar.
 *
 * Not rotated on hover, despite "tilt". Both discs are `rounded-full`, and
 * rotating a circle is a no-op: there is no corner to lean. The reveal is
 * horizontal instead, sliding from 30% clear of the avatar to 50%, which is what
 * "tilts further right" actually looks like on a circle.
 *
 * A real link with an `aria-label`, not decoration. At rest 12px of it shows,
 * which is a reachable target, and being an anchor means it is also focusable, so
 * the tooltip is not mouse-only.
 *
 * Renders `null` until Spotify answers, so an unconfigured install, a dead API
 * and a paused player all leave the avatar exactly as it is.
 */
export function NowPlayingDisc() {
  const [track, setTrack] = useState<NowPlayingData | null>(null);

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
        // offline or the route is down. Nothing renders, which is the same
        // outcome as nothing playing.
      }
    };

    load();
    const timer = setInterval(load, POLL_MS);

    return () => {
      active = false;
      clearInterval(timer);
    };
  }, []);

  if (!track?.isPlaying || !track.albumArt || !track.title) return null;

  const label = track.artist
    ? `${track.title} by ${track.artist}`
    : track.title;

  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip
        side="right"
        label={
          <>
            {/* the mark keeps its brand green, which is the sanctioned exception
                and reads cleanly on the tooltip's near-black fill */}
            <Spotify className="size-3 shrink-0" />
            {label}
          </>
        }
      >
        <a
          href={track.songUrl ?? "https://open.spotify.com"}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Now playing: ${label}`}
          className={[
            // percentages, so the offsets track the avatar rather than needing
            // to be retuned whenever its size changes
            "absolute inset-0 translate-x-[30%] cursor-pointer rounded-full",
            /*
             * Not `ring-inset`. The `<img>` below is `size-full`, so it paints
             * over an inset ring and there was effectively no edge on the cover
             * at all. A non-inset ring draws just outside the anchor's box, where
             * nothing can cover it, and reads as a hairline around the disc.
             */
            "ring-1 ring-stroke",
            /*
             * 12px showing at rest, 20px on hover. An 8px nudge, unchanged from
             * before, just starting further left: at 45% the cover was already
             * most of the way clear before you touched it, which left the hover
             * nothing to reveal and the pair barely reading as a stack.
             *
             * `duration-150` covers both the entrance fade and the hover slide.
             * It is the quick end of the project's two durations, and a reveal
             * this small needs to keep up with the pointer or it feels like drag.
             */
            "animate-in fade-in-0 duration-150",
            "transition-transform ease-out",
            /*
             * Two triggers for one state, deliberately.
             *
             * `hover:` alone desynced: the tooltip sits 8px to the right, so
             * moving onto it leaves the anchor, `:hover` drops and the cover
             * slid back while Radix kept the tooltip open. `data-state` is the
             * tooltip's own open flag, which Trigger puts on this anchor, so the
             * cover now stays out for exactly as long as the tooltip is up,
             * including while the pointer is over the label.
             *
             * `hover:` stays because `data-state` only flips after
             * `delayDuration`, and waiting 150ms to start moving reads as lag.
             * Keyboard focus is covered too, since Radix opens on focus.
             */
            "hover:translate-x-[50%]",
            "data-[state=delayed-open]:translate-x-[50%]",
            "data-[state=instant-open]:translate-x-[50%]",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-primary/15",
          ].join(" ")}
        >
          {/*
            biome-ignore lint/performance/noImgElement: a remote Spotify CDN url,
            so next/image would need `i.scdn.co` in remotePatterns and would
            route a 40px disc through the image optimiser on every track change
          */}
          <img
            src={track.albumArt}
            alt=""
            width={40}
            height={40}
            draggable={false}
            className="size-full select-none rounded-full object-cover"
          />
        </a>
      </Tooltip>
    </TooltipProvider>
  );
}
