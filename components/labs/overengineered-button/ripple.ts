/**
 * How the button changes colour: the new fill flows out from the middle of the
 * button, under the label and inside the button's own clip, and settles as the
 * button's colour. It is one radial gradient scaled out by WAAPI, solid only in
 * its inner fifth and fading out over the rest on a smoothstep. The gradient is
 * several times the pill's size, so whatever part of the fade is over the pill
 * at any moment spans most of it: the colour deepens across the pill as a
 * flow, and there is no front for the eye to catch.
 */

const FLOW = "cubic-bezier(0.3, 0.1, 0.3, 1)";
/** where the solid part of the gradient ends, as a share of its radius */
const SOLID = 0.2;
/** how many stops the fade is drawn through, enough that it never bands */
const STEPS = 10;

function smoothstep(t: number): number {
  return t * t * (3 - 2 * t);
}

/**
 * Spread `color` across `host` from its centre. `reach` is the farthest
 * distance from there the colour has to cover. `done` runs once the wash has
 * settled, which is when the caller makes it the button's own colour.
 */
export function spread(
  host: HTMLElement,
  color: string,
  reach: number,
  reduce: boolean,
  done: () => void,
): void {
  const size = (reach / SOLID) * 2;
  const stops: string[] = [`${color} 0%`, `${color} ${SOLID * 100}%`];
  for (let i = 1; i <= STEPS; i++) {
    const t = i / STEPS;
    const share = Math.round((1 - smoothstep(t)) * 100);
    const at = (SOLID + (1 - SOLID) * t) * 100;
    stops.push(
      `color-mix(in oklab, ${color} ${share}%, transparent) ${at.toFixed(1)}%`,
    );
  }
  const el = document.createElement("div");
  el.setAttribute("aria-hidden", "true");
  Object.assign(el.style, {
    position: "absolute",
    left: "50%",
    top: "50%",
    width: `${size}px`,
    height: `${size}px`,
    marginLeft: `${-size / 2}px`,
    marginTop: `${-size / 2}px`,
    backgroundImage: `radial-gradient(closest-side, ${stops.join(", ")})`,
    pointerEvents: "none",
    willChange: "transform, opacity",
  });
  host.appendChild(el);
  // the part of the growth that shows is the first stretch, while the gradient
  // is about the pill's size, so it gets most of the time on a gentle ease-out
  // and the rest only finishes covering the corners
  const run = el.animate(
    reduce
      ? [{ opacity: 0 }, { opacity: 1 }]
      : [
          { transform: "scale(0.04)", opacity: 0, easing: FLOW },
          { transform: "scale(0.45)", opacity: 1, offset: 0.72 },
          { transform: "scale(1)", opacity: 1 },
        ],
    { duration: reduce ? 200 : 1300, fill: "forwards" },
  );
  run.onfinish = () => {
    done();
    el.remove();
  };
}
