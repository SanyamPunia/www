import { NowPlayingDisc } from "@/components/home/now-playing";
import { Portrait } from "@/components/home/portrait";

/**
 * The first thing on the page: the photo, with whatever is playing stacked
 * behind it.
 *
 * A server component still, because the interaction lives one level down.
 * `Portrait` owns the box, the photo and everything the photo does, and takes
 * what sits behind it as a prop so it can hide it while the photo is out of its
 * slot.
 *
 * The disc is `absolute` and the photo `relative`, both inside a box sized to the
 * photo. Both being positioned means DOM order alone decides the stack, so the
 * photo covers the disc without either needing a `z-index` to fight over. It also
 * means the photo masks the disc's pointer events, leaving only the exposed
 * sliver hoverable, which is what makes the reveal feel like it belongs to the
 * disc rather than to the avatar.
 */
export function Avatar() {
  return <Portrait behind={<NowPlayingDisc />} />;
}
