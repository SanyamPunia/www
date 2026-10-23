/**
 * What the camera is pointed at: nested discs on pale paper, a faint dot grid
 * and one small circle on an orbit. Drawn once, and zoomed by its `viewBox`
 * rather than a transform, so every zoom is a fresh vector render and stays
 * sharp at 10x, where a scaled layer would be a blurred bitmap.
 *
 * The drawing is 1600 by 1000 units, which is the frame at 0.5x. The discs are
 * centred on the middle of the 1x frame and each is about two and a half times
 * the next, so every lens finds a disc that fills its frame: 1x the widest,
 * 2x the next, 5x the next and 10x the last, with a hole and a dot in it. The
 * grid is what says how far the camera has gone.
 *
 * The hues are this lab's own, scoped here and not tokens: the picture is the
 * subject, and its colours are the picture.
 */

export const SCENE = { w: 1600, h: 1000, cx: 800, cy: 470 } as const;

const PAPER = ["#f7f4ef", "#efeae2"] as const;
const GRID = "#d8d0c4";
const ORBIT = "#ddd4c7";
const PLANET = "#c4d0d9";
const DISCS = [
  { r: 330, fill: "#eee6da" },
  { r: 140, fill: "#e8d8c5" },
  { r: 56, fill: "#e2c1a6" },
  { r: 22, fill: "#d98a67" },
  { r: 9, fill: PAPER[0] },
  { r: 3.5, fill: "#d98a67" },
] as const;

export function Scene() {
  const { cx, cy } = SCENE;
  return (
    <>
      <defs>
        <linearGradient
          id="zd-paper"
          gradientUnits="userSpaceOnUse"
          x1={0}
          y1={0}
          x2={0}
          y2={SCENE.h}
        >
          <stop offset="0" stopColor={PAPER[0]} />
          <stop offset="1" stopColor={PAPER[1]} />
        </linearGradient>
        <pattern
          id="zd-grid"
          width={40}
          height={40}
          patternUnits="userSpaceOnUse"
          x={cx - 20}
          y={cy - 20}
        >
          <circle cx={20} cy={20} r={1.1} fill={GRID} />
        </pattern>
      </defs>
      {/* the paper runs past the drawing, since the lift moves the frame */}
      <rect
        x={-400}
        y={-400}
        width={2400}
        height={1800}
        fill="url(#zd-paper)"
      />
      <rect x={-400} y={-400} width={2400} height={1800} fill="url(#zd-grid)" />
      <circle
        cx={cx}
        cy={cy}
        r={487}
        fill="none"
        stroke={ORBIT}
        strokeWidth={1.5}
      />
      <circle cx={cx - 440} cy={cy - 210} r={16} fill={PLANET} />
      {DISCS.map((d) => (
        <circle key={d.r} cx={cx} cy={cy} r={d.r} fill={d.fill} />
      ))}
    </>
  );
}
