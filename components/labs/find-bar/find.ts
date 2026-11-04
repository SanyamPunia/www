const MARKS = /\p{M}/gu;
const QUOTES: Record<string, string> = {
  "‘": "'",
  "’": "'",
  "“": '"',
  "”": '"',
};

/** One character as find compares it: no case, no accents, plain quotes */
function foldChar(c: string): string {
  return QUOTES[c] ?? c.normalize("NFD").replace(MARKS, "").toLowerCase();
}

/** A query as find compares it, with runs of space collapsed to one */
export function fold(text: string): string {
  let out = "";
  for (const c of text) out += foldChar(c);
  return out.replace(/\s+/g, " ");
}

/**
 * Every match of `query` inside `root`, in document order, as ranges. Each
 * `[data-block]` is searched as one string made of all its text nodes, so a
 * match may cross an element boundary inside a paragraph and never crosses from
 * one paragraph into the next. The folded string keeps a map back to the node
 * and offset each character came from, since folding can change lengths.
 */
export function findAll(root: HTMLElement, query: string): Range[] {
  const q = fold(query);
  if (!q.trim()) return [];
  const ranges: Range[] = [];
  for (const block of root.querySelectorAll("[data-block]")) {
    let hay = "";
    const node: Text[] = [];
    const start: number[] = [];
    const end: number[] = [];
    const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const text = n as Text;
      const data = text.data;
      for (let i = 0; i < data.length; ) {
        const c = String.fromCodePoint(data.codePointAt(i) ?? 0);
        let f = foldChar(c);
        if (/\s/.test(f)) {
          // collapsed the way the page renders it
          if (hay.endsWith(" ")) {
            i += c.length;
            continue;
          }
          f = " ";
        }
        for (const ch of f) {
          hay += ch;
          node.push(text);
          start.push(i);
          end.push(i + c.length);
        }
        i += c.length;
      }
    }
    for (
      let at = hay.indexOf(q);
      at !== -1;
      at = hay.indexOf(q, at + q.length)
    ) {
      const last = at + q.length - 1;
      const range = document.createRange();
      range.setStart(node[at], start[at]);
      range.setEnd(node[last], end[last]);
      ranges.push(range);
    }
  }
  return ranges;
}
