/**
 * The print on the sheet, generated here rather than loaded, so the page makes
 * no request for it and the geometry can answer to the object it wraps.
 *
 * It is a half-drop grid of dots with a hairline rule every third column, and
 * the dots take a hue that cycles every five columns. **Everything on it
 * repeats on a period that divides the sheet's width**, the dots at 20 and the
 * cycle at 100, which is what lets the column close: the run leaving the right
 * edge is the run arriving at the left, so the wrapped sheet has no seam to
 * find, and turning it walks through the five in order.
 *
 * The paper and the rule are the site's own `fill` and `stroke-strong`,
 * written out because an SVG in a data URI cannot read a custom property. The
 * five hues are this lab's own, the exception the other fourteen take, and
 * nothing else may reach for them.
 */

export const W = 300;
export const H = 375;

const PAPER = "#f4f4f5";
const RULE = "#dcdcdc";
/** one hue per column, five of them, each at least 4:1 on the paper */
const HUES = ["#3f5aa6", "#2f8a6f", "#c8892c", "#c2564c", "#7d5296"];

/** the dot grid, the rule every third column, and the hue every fifth */
const STEP = 20;
const DOT = 2.3;
const RULE_EVERY = 3;

function build(): string {
  const dots = HUES.map(() => [] as string[]);
  const rules: string[] = [];
  const columns = W / STEP;
  for (let c = 0; c < columns; c++) {
    const x = c * STEP + STEP / 2;
    if (c % RULE_EVERY === 0) rules.push(`M${x - STEP / 2} 0V${H}`);
    for (let y = STEP / 2; y < H; y += STEP) {
      /* half-drop: every other column sits half a step down */
      const cy = y + (c % 2 ? STEP / 2 : 0);
      if (cy > H - 2) continue;
      dots[c % HUES.length].push(`<circle cx="${x}" cy="${cy}" r="${DOT}"/>`);
    }
  }
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">`,
    `<rect width="${W}" height="${H}" fill="${PAPER}"/>`,
    `<path d="${rules.join("")}" stroke="${RULE}" stroke-width="1"/>`,
    HUES.map((hue, i) => `<g fill="${hue}">${dots[i].join("")}</g>`).join(""),
    `</svg>`,
  ].join("");
}

export const PATTERN_URL = `url("data:image/svg+xml,${encodeURIComponent(build())}")`;
