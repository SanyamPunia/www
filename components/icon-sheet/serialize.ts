/**
 * An icon's SVG markup as rendered, read off the DOM rather than restated, so
 * what a reader copies is exactly what the sheet paints.
 */

/** attributes the page adds for its own use, never part of a copied icon */
const PAGE_ONLY = new Set(["class", "aria-hidden", "focusable", "style"]);

function attributes(el: Element, drop: Set<string>): string {
  return [...el.attributes]
    .filter((attr) => !drop.has(attr.name))
    .map((attr) => {
      // the sheet paints at 1.5rem, a copied icon is the grid's own 24px
      const value =
        attr.name === "width" || attr.name === "height" ? "24" : attr.value;
      return `${attr.name}="${value}"`;
    })
    .join(" ");
}

export function iconMarkup(svg: SVGSVGElement): string {
  const paths = [...svg.children]
    .map((child) => `  <${child.tagName} ${attributes(child, new Set())} />`)
    .join("\n");
  return `<svg ${attributes(svg, PAGE_ONLY)}>\n${paths}\n</svg>\n`;
}
