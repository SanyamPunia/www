/*
 * Sample files, for a reader with nothing to drop: a phone, or a laptop with an
 * empty desktop. They are real `File` objects made in the page, so they take
 * exactly the path a dropped file takes, and the preview recorder drags them
 * in with a real `DataTransfer`.
 *
 * Three of them: a picture, a report that drops part way so the card shows its
 * failed state and resumes, and a spreadsheet.
 */

const DATE = Date.UTC(2026, 9, 14, 9, 30);

/** the one sample that drops, and how far it gets */
export const FLAKY = { name: "q3-report.pdf", at: 0.62 } as const;

function picture(
  w: number,
  h: number,
  paint: (ctx: CanvasRenderingContext2D) => void,
  type: string,
): Promise<Blob> {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d");
  if (!ctx) return Promise.resolve(new Blob([], { type }));
  paint(ctx);
  return new Promise((resolve) =>
    c.toBlob((b) => resolve(b ?? new Blob([], { type })), type, 0.9),
  );
}

/** a harbour at dusk: a sky, a low sun, and the water under it */
function sunset(ctx: CanvasRenderingContext2D): void {
  const sky = ctx.createLinearGradient(0, 0, 0, 400);
  sky.addColorStop(0, "#2b2f6b");
  sky.addColorStop(0.55, "#e0706a");
  sky.addColorStop(0.75, "#f6c28b");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, 640, 400);
  ctx.fillStyle = "#ffe3a8";
  ctx.beginPath();
  ctx.arc(420, 262, 46, 0, Math.PI * 2);
  ctx.fill();
  const sea = ctx.createLinearGradient(0, 280, 0, 400);
  sea.addColorStop(0, "#3f4f86");
  sea.addColorStop(1, "#1d2147");
  ctx.fillStyle = sea;
  ctx.fillRect(0, 280, 640, 120);
  ctx.fillStyle = "rgba(255, 227, 168, 0.55)";
  for (let k = 0; k < 9; k++)
    ctx.fillRect(420 - 40 + k * 3, 292 + k * 11, 80 - k * 6, 2.4);
}

/** a block of a given size, for the files whose content does not matter */
function filler(size: number, type: string): Blob {
  return new Blob([new Uint8Array(size)], { type });
}

function csv(): Blob {
  const rows = ["date,merchant,category,amount"];
  const merchants = ["Harbour Cafe", "Lumen Books", "Ferry Co", "Salt Market"];
  for (let i = 0; i < 2400; i++) {
    const m = merchants[i % merchants.length];
    rows.push(
      `2026-09-${String((i % 28) + 1).padStart(2, "0")},${m},ops,${(
        ((i * 37) % 9000) / 100 + 4
      ).toFixed(2)}`,
    );
  }
  return new Blob([rows.join("\n")], { type: "text/csv" });
}

export async function samples(): Promise<File[]> {
  const png = await picture(640, 400, sunset, "image/png");
  const file = (blob: Blob, name: string, type: string) =>
    new File([blob], name, { type, lastModified: DATE });
  return [
    file(png, "harbour-at-dusk.png", "image/png"),
    file(filler(2_480_000, "application/pdf"), FLAKY.name, "application/pdf"),
    file(csv(), "september-transactions.csv", "text/csv"),
  ];
}
