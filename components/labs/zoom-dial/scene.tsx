/**
 * What the camera is pointed at: a photograph of a bright room with a sofa in
 * it, `public/assets/zoom-dial/room.webp`. It is drawn inside the viewfinder's
 * SVG and zoomed by that SVG's `viewBox`, so every zoom resamples the source
 * rather than scaling a bitmap already drawn at another size.
 *
 * The scene's units are the photograph's own pixels, 1368 by 768, so the frame
 * at 0.5x is the whole photograph. `focus` is the sofa, and the camera zooms
 * about it as one fixed point: it holds the share of the frame it has in the
 * whole photograph, so nothing pans and no frame runs past the edges.
 */

export const SCENE = {
  w: 1368,
  h: 768,
  focus: { x: 618, y: 432 },
  src: "/assets/zoom-dial/room.webp",
} as const;

export function Scene({ onLoad }: { onLoad?: () => void }) {
  return (
    <image
      href={SCENE.src}
      width={SCENE.w}
      height={SCENE.h}
      preserveAspectRatio="none"
      onLoad={onLoad}
    />
  );
}
