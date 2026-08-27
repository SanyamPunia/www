"use client";

import { useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";
import { Spotify } from "@/components/icons/spotify";
import { Tooltip, TooltipProvider } from "@/components/ui/tooltip";
import type { NowPlaying as NowPlayingData } from "@/lib/spotify";
import { cn } from "@/lib/utils";

const POLL_MS = 30_000;

/**
 * The album cover of whatever is playing, stacked behind the avatar.
 *
 * The reveal is horizontal, sliding from 30% clear of the avatar to 50%. It is
 * not a rotation: a circle has no corner to lean on, so rotating the anchor
 * would move nothing. The cover does spin, but that is the image inside turning
 * on its own axis like a record, which is a separate thing from the reveal.
 *
 * A real link with an `aria-label`, not decoration. At rest 12px of it shows,
 * which is a reachable target, and being an anchor means it is also focusable, so
 * the tooltip is not mouse-only.
 *
 * Renders `null` until Spotify answers, so an unconfigured install, a dead API
 * and a paused player all leave the avatar exactly as it is.
 */
/**
 * Written out in full, never composed. Tailwind scans source text for class
 * names, so a class built from template interpolation is invisible to it and
 * compiles to nothing: `cover-conceal` was assembled that way at first and the
 * exit silently did not exist.
 *
 * `forwards` on the exit only. Its end state is not the element's resting state,
 * so without the fill the cover would slide away and then flick back to full
 * opacity for the frames before it unmounts.
 */
const REVEAL =
  "motion-safe:animate-[cover-reveal_460ms_cubic-bezier(0.22,1,0.36,1)]";

/**
 * The record turn.
 *
 * **It runs whenever the avatar is whole, and stops while the stack is in
 * pieces.** What the cover says is that something is playing, and a record that
 * only turns when it is pointed at says it only then, so the hover gate this used
 * to have is gone. But a record does not turn while it is off the turntable
 * either: `Portrait` marks the slot `data-loose` from the moment any piece of the
 * stack comes out of it, which freezes this at the angle it had reached and lets
 * the loose copy hold that same angle. Nothing spins mid-air or on the floor, and
 * both handovers are at one angle, so neither jumps.
 *
 * **Four longhands rather than `animate-[…]`, and that is what makes the pause
 * possible at all.** The shorthand resets `animation-play-state` to `running`,
 * and Tailwind emits `animation` after `animation-play-state` in the same layer
 * whatever spelling the pause uses, so a pause beside a shorthand can never land.
 * That is why the hover gate never worked and the disc used to turn constantly.
 * Longhands do not reset each other.
 */
export const DISC_SPIN = cn(
  "motion-safe:[animation-name:disc-spin]",
  "motion-safe:[animation-duration:8s]",
  "motion-safe:[animation-timing-function:linear]",
  "motion-safe:[animation-iteration-count:infinite]",
  "[[data-loose=true]_&]:[animation-play-state:paused]",
);
const CONCEAL =
  "motion-safe:animate-[cover-conceal_460ms_cubic-bezier(0.22,1,0.36,1)_forwards]";
/** must match the keyframes name above, for the `animationend` guard */
const CONCEAL_NAME = "cover-conceal";

export function NowPlayingDisc() {
  const reducedMotion = useReducedMotion();

  /*
   * Two pieces of state, because the cover has to outlive the track that put it
   * there. `track` is the last thing worth rendering and `playing` is whether it
   * is current, so when a song stops the element stays mounted long enough to
   * slide back rather than vanishing on the frame the poll returns.
   */
  const [track, setTrack] = useState<NowPlayingData | null>(null);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    // guards against a response landing after unmount, which would otherwise
    // set state on a dead component
    let active = true;

    const load = async () => {
      try {
        const response = await fetch("/api/now-playing", { cache: "no-store" });
        if (!response.ok) return;
        const data = (await response.json()) as NowPlayingData;
        if (!active) return;

        if (data.isPlaying && data.albumArt && data.title) {
          setTrack(data);
          setPlaying(true);
          return;
        }

        setPlaying(false);
        /*
         * Under reduced motion there is no conceal animation, so `animationend`
         * never fires and the unmount below would never run. Drop it here
         * instead.
         */
        if (reducedMotion) setTrack(null);
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
  }, [reducedMotion]);

  if (!track?.albumArt || !track.title) return null;

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
          /*
           * The unmount waits for the slide back to finish. Guarded on the name
           * because `animationend` bubbles, and the cover's own spin sits on the
           * image inside this anchor. Guarded on `playing` too, so a track
           * starting again mid-exit does not tear the element out from under its
           * new reveal.
           */
          onAnimationEnd={(event) => {
            if (event.animationName === CONCEAL_NAME && !playing)
              setTrack(null);
          }}
          className={[
            // `group` so the spin on the image below can key off this anchor's
            // hover and the tooltip's open state
            "group",
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
             * 12px showing at rest, 20px on hover. An 8px nudge: at 45% the cover
             * was already most of the way clear before you touched it, which left
             * the hover nothing to reveal and the pair barely reading as a stack.
             */
            /*
             * Slides out from fully behind the avatar to its resting offset,
             * rather than appearing there. It used to fade in on the spot, which
             * read as the cover popping into existence next to the photo instead
             * of emerging from behind it.
             *
             * `motion-safe:`, because `MotionProvider`'s `reducedMotion` only
             * governs Motion's own animations and never raw CSS keyframes. Without
             * it the cover would still travel for someone who asked it not to.
             *
             * The easing is the project's own settle curve, the same one the
             * `InlineLink` underline draws on.
             */
            playing ? REVEAL : CONCEAL,
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
            className={[
              "size-full select-none rounded-full object-cover",
              DISC_SPIN,
            ].join(" ")}
          />
        </a>
      </Tooltip>
    </TooltipProvider>
  );
}
