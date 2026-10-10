"use client";

import { useEffect, useRef } from "react";

/**
 * One card's preview clip, which plays while the card is near the viewport and
 * pauses when it leaves.
 *
 * `preload="none"`, so the clip is only fetched when `play()` asks for it. A
 * grid of 58 cards then fetches the clips a reader actually scrolls past. In
 * view rather than on hover, because a phone has no hover, and a grid of stills
 * hides the fact that every one of these is an interaction.
 *
 * **Until the clip has a frame the card is a pulsing `fill` block**, the
 * placeholder a lab page shows while its demo loads, so the grid and the page
 * a card opens into wait the same way. `data-ready` is written to the node on
 * `loadeddata`, so nothing renders when a clip arrives, and the clip fades in
 * over the block.
 *
 * Reduced motion is read in the effect rather than through `MotionProvider`,
 * which governs Motion components and never a `<video>`. Under it the clip is
 * never played, the card is marked ready at once, and it shows the still the
 * video carries as its `poster`.
 */
export function LabClip({ slug }: { slug: string }) {
  const root = useRef<HTMLDivElement>(null);
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const box = root.current;
    const video = ref.current;
    if (!box || !video) return;

    const ready = () => {
      box.dataset.ready = "true";
    };

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      ready();
      return;
    }

    // a clip restored from the back-forward cache already has its frame
    if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) ready();
    video.addEventListener("loadeddata", ready);

    const observer = new IntersectionObserver(
      ([entry]) => {
        // a rejected play is a browser refusing autoplay, and the card waits
        if (entry?.isIntersecting) video.play().catch(() => {});
        else video.pause();
      },
      // starts a clip 200px before its card scrolls in, so the grey block is
      // rarely what a reader sees
      { rootMargin: "200px 0px" },
    );
    observer.observe(video);

    return () => {
      observer.disconnect();
      video.removeEventListener("loadeddata", ready);
      video.pause();
    };
  }, []);

  return (
    <div ref={root} className="group/clip absolute inset-0">
      <span
        aria-hidden="true"
        className="absolute inset-0 bg-fill motion-safe:animate-pulse group-data-[ready=true]/clip:hidden"
      />
      <video
        ref={ref}
        src={`/assets/labs/${slug}.mp4`}
        poster={`/assets/labs/${slug}.webp`}
        preload="none"
        muted
        loop
        playsInline
        disablePictureInPicture
        className="absolute inset-0 size-full select-none object-cover opacity-0 transition-opacity duration-200 group-data-[ready=true]/clip:opacity-100"
      />
    </div>
  );
}
