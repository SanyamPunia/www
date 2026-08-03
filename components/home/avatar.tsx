import Image from "next/image";
import { NowPlayingDisc } from "@/components/home/now-playing";

/** 40px exactly. `size-12.5` is 0.2rem x 12.5, which lands on a whole pixel. */
const SIZE = "size-12.5";

/**
 * The first thing on the page: the photo, with whatever is playing stacked
 * behind it.
 *
 * The disc is `absolute` and the photo `relative`, both inside a box sized to the
 * photo. Both being positioned means DOM order alone decides the stack, so the
 * photo covers the disc without either needing a `z-index` to fight over. It also
 * means the photo masks the disc's pointer events, leaving only the exposed
 * sliver hoverable, which is what makes the reveal feel like it belongs to the
 * disc rather than to the avatar.
 */
export function Avatar() {
  return (
    <div className={`relative ${SIZE}`}>
      <NowPlayingDisc />

      {/*
       * `ring-2 ring-bg` is what makes this read as a stack rather than two
       * circles overlapping. The ring is the page background, so the photo cuts
       * a clean gap out of the cover behind it, the same trick a stacked avatar
       * group uses. A `ring-stroke` hairline here instead would draw a grey line
       * across the cover and the two would read as one flat shape.
       *
       * `alt=""`. The photo is adjacent to the page's `h1`, which already reads
       * "Sanyam Punia", so naming it again would just repeat that. What a
       * portrait actually conveys is not something alt text can carry.
       *
       * `priority` because it is the first paint above the fold and the only
       * image on the route, so lazy-loading it only delays the thing a visitor
       * sees first.
       */}
      <Image
        src="/assets/sanyam.png"
        alt=""
        width={40}
        height={40}
        priority
        draggable={false}
        className={`relative ${SIZE} select-none rounded-full object-cover ring-2 ring-bg`}
      />
    </div>
  );
}
