/**
 * The box the sheet lies on, drawn once onto a canvas the shader samples.
 *
 * It is the reason the film reads as film. Clear plastic over a flat colour is
 * invisible apart from its highlights, so the sheet lies across the top of a
 * shipping box: kraft board, the seam where its two flaps meet, a run of
 * packing tape along it, a shipping label and a fragile stamp. Every one of
 * those has edges and type, and the shader bends them through the bubbles, so
 * the label swells under a dome and the tape's edge kinks at each rim.
 *
 * The label sits mostly under the sheet and runs out past its right edge, so
 * the same type is seen through the film and bare side by side.
 *
 * Nothing rolls at runtime: every fibre and speck is a hash of its index, so the
 * box is the same on every visit. The colours are scoped to this experiment.
 */

import { hash } from "./sheet";

export const KRAFT = "#c7a477";
const FLUTE = "rgba(94, 68, 40, 0.05)";
const SEAM = "rgba(74, 52, 30, 0.75)";
const TAPE = "rgba(208, 171, 116, 0.62)";
const TAPE_EDGE = "rgba(150, 112, 64, 0.5)";
const PAPER = "#fbfaf6";
const INK = "#26221d";
const RED = "#c3362d";

/** the text face the page itself uses, so the print is in the site's type */
function face(): string {
  if (typeof document === "undefined") return "sans-serif";
  return getComputedStyle(document.body).fontFamily || "sans-serif";
}

export function drawBox(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  dpr: number,
): void {
  const family = face();
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);

  /* the board, with the light falling off toward its far corners */
  ctx.fillStyle = KRAFT;
  ctx.fillRect(0, 0, w, h);
  const fall = ctx.createRadialGradient(
    w * 0.38,
    h * 0.3,
    0,
    w * 0.5,
    h * 0.5,
    Math.hypot(w, h) * 0.62,
  );
  fall.addColorStop(0, "rgba(255, 244, 222, 0.16)");
  fall.addColorStop(1, "rgba(70, 46, 20, 0.16)");
  ctx.fillStyle = fall;
  ctx.fillRect(0, 0, w, h);

  /* the flutes inside the board show through its face as faint bands */
  const pitch = Math.max(3.2, w / 110);
  ctx.fillStyle = FLUTE;
  for (let y = 0; y < h; y += pitch) ctx.fillRect(0, y, w, pitch * 0.42);

  /* fibres: short pale and dark strokes, which is what kraft is made of */
  const fibres = Math.round((w * h) / 26);
  ctx.lineCap = "round";
  for (let i = 0; i < fibres; i++) {
    const x = hash(i * 4 + 1) * w;
    const y = hash(i * 4 + 2) * h;
    const t = hash(i * 4 + 3) * Math.PI;
    const len = 1.5 + hash(i * 4 + 4) * 5;
    const pale = hash(i * 9) > 0.55;
    ctx.strokeStyle = pale
      ? `rgba(240, 222, 190, ${0.12 + hash(i * 11) * 0.2})`
      : `rgba(110, 78, 44, ${0.08 + hash(i * 13) * 0.16})`;
    ctx.lineWidth = 0.35 + hash(i * 17) * 0.5;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(t) * len, y + Math.sin(t) * len);
    ctx.stroke();
  }
  /* and the odd dark speck of something recycled */
  for (let i = 0; i < Math.round((w * h) / 2400); i++) {
    ctx.fillStyle = `rgba(70, 48, 26, ${0.25 + hash(i * 3 + 70) * 0.35})`;
    ctx.beginPath();
    ctx.arc(
      hash(i * 3 + 71) * w,
      hash(i * 3 + 72) * h,
      0.4 + hash(i * 3 + 73) * 0.7,
      0,
      Math.PI * 2,
    );
    ctx.fill();
  }

  /* the seam between the two flaps, and the tape over it */
  const seam = h * 0.58;
  ctx.save();
  ctx.translate(0, seam);
  ctx.rotate(-0.012);
  ctx.fillStyle = "rgba(60, 40, 20, 0.18)";
  ctx.fillRect(-20, -2.2, w + 40, 4.4);
  ctx.fillStyle = SEAM;
  ctx.fillRect(-20, -0.6, w + 40, 1.2);
  ctx.fillStyle = "rgba(255, 240, 215, 0.3)";
  ctx.fillRect(-20, 0.9, w + 40, 0.7);

  const band = h * 0.2;
  ctx.fillStyle = TAPE;
  ctx.fillRect(-20, -band / 2, w + 40, band);
  const sheen = ctx.createLinearGradient(0, -band / 2, 0, band / 2);
  sheen.addColorStop(0, "rgba(255, 250, 238, 0.28)");
  sheen.addColorStop(0.35, "rgba(255, 250, 238, 0.06)");
  sheen.addColorStop(1, "rgba(120, 84, 40, 0.1)");
  ctx.fillStyle = sheen;
  ctx.fillRect(-20, -band / 2, w + 40, band);
  ctx.fillStyle = TAPE_EDGE;
  ctx.fillRect(-20, -band / 2, w + 40, 0.8);
  ctx.fillRect(-20, band / 2 - 0.8, w + 40, 0.8);
  /* tape never goes on flat: a few creases run across it */
  for (let i = 0; i < 14; i++) {
    const x = hash(i + 300) * w;
    const lean = (hash(i + 320) - 0.5) * band * 0.6;
    ctx.strokeStyle = `rgba(255, 248, 230, ${0.12 + hash(i + 340) * 0.16})`;
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    ctx.moveTo(x, -band / 2);
    ctx.lineTo(x + lean, band / 2);
    ctx.stroke();
  }
  ctx.restore();

  /* this side up, printed on the board */
  ctx.save();
  ctx.translate(w * 0.075, h * 0.12);
  ctx.fillStyle = "rgba(40, 30, 20, 0.62)";
  const arrow = Math.max(6, w * 0.018);
  for (let k = 0; k < 2; k++) {
    const x = k * arrow * 1.5;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + arrow * 0.6, arrow * 0.7);
    ctx.lineTo(x + arrow * 0.25, arrow * 0.7);
    ctx.lineTo(x + arrow * 0.25, arrow * 1.5);
    ctx.lineTo(x - arrow * 0.25, arrow * 1.5);
    ctx.lineTo(x - arrow * 0.25, arrow * 0.7);
    ctx.lineTo(x - arrow * 0.6, arrow * 0.7);
    ctx.closePath();
    ctx.fill();
  }
  ctx.font = `600 ${Math.max(5, w * 0.014)}px ${family}`;
  ctx.textBaseline = "top";
  ctx.fillText("this side up", -arrow * 0.6, arrow * 1.9);
  ctx.restore();

  /* the shipping label: mostly under the sheet, its right edge out past it */
  const lw = w * 0.34;
  const lh = h * 0.36;
  ctx.save();
  ctx.translate(w * 0.62 + lw / 2, h * 0.1 + lh / 2);
  ctx.rotate(0.05);
  ctx.translate(-lw / 2, -lh / 2);
  ctx.shadowColor = "rgba(60, 40, 20, 0.22)";
  ctx.shadowBlur = 3;
  ctx.shadowOffsetY = 1;
  ctx.fillStyle = PAPER;
  ctx.beginPath();
  ctx.roundRect(0, 0, lw, lh, 3);
  ctx.fill();
  ctx.shadowColor = "transparent";

  const pad = lw * 0.07;
  const unit = lw / 22;
  ctx.fillStyle = RED;
  ctx.fillRect(pad, pad, lw - pad * 2, unit * 2.6);
  ctx.fillStyle = PAPER;
  ctx.font = `700 ${unit * 1.7}px ${family}`;
  ctx.textBaseline = "middle";
  ctx.fillText("fragile", pad + unit * 0.8, pad + unit * 1.35);
  ctx.font = `500 ${unit * 0.9}px ${family}`;
  ctx.textAlign = "right";
  ctx.fillText("handle with care", lw - pad - unit * 0.8, pad + unit * 1.4);
  ctx.textAlign = "left";

  ctx.fillStyle = INK;
  ctx.textBaseline = "top";
  let y = pad + unit * 3.6;
  ctx.font = `600 ${unit * 0.75}px ${family}`;
  ctx.globalAlpha = 0.55;
  ctx.fillText("ship to", pad, y);
  ctx.globalAlpha = 1;
  y += unit * 1.2;
  ctx.font = `600 ${unit * 1.25}px ${family}`;
  ctx.fillText("sanyam punia", pad, y);
  y += unit * 1.6;
  ctx.font = `400 ${unit * 0.95}px ${family}`;
  for (const line of [
    "sanyam.sh/lab",
    "bubble wrap, one sheet",
    "do not drop",
  ]) {
    ctx.fillText(line, pad, y);
    y += unit * 1.3;
  }
  /* a barcode, which is the most legible thing to see bent through a lens */
  const bars = lh - pad - unit * 2.4;
  let x = pad;
  for (let i = 0; x < lw - pad; i++) {
    const bw = unit * (0.12 + Math.floor(hash(i + 500) * 3) * 0.14);
    if (hash(i + 600) > 0.38) ctx.fillRect(x, bars, bw, unit * 1.7);
    x += bw + unit * 0.14;
  }
  ctx.font = `500 ${unit * 0.6}px ${family}`;
  ctx.fillText("1Z 7B3 0A1 64 2611 0427", pad, bars + unit * 1.85);
  ctx.restore();

  /* the fragile stamp, inked by hand and not quite evenly */
  ctx.save();
  ctx.translate(w * 0.17, h * 0.82);
  ctx.rotate(-0.15);
  const sz = Math.max(9, w * 0.034);
  ctx.font = `800 ${sz}px ${family}`;
  ctx.textBaseline = "middle";
  ctx.textAlign = "center";
  const tw = ctx.measureText("fragile").width;
  ctx.strokeStyle = "rgba(180, 46, 38, 0.7)";
  ctx.lineWidth = sz * 0.12;
  ctx.strokeRect(-tw / 2 - sz * 0.45, -sz * 0.75, tw + sz * 0.9, sz * 1.5);
  ctx.fillStyle = "rgba(180, 46, 38, 0.72)";
  ctx.fillText("fragile", 0, sz * 0.04);
  /* where the stamp missed the board */
  ctx.globalCompositeOperation = "destination-out";
  for (let i = 0; i < 90; i++) {
    ctx.fillStyle = `rgba(0, 0, 0, ${0.3 + hash(i + 800) * 0.6})`;
    ctx.beginPath();
    ctx.arc(
      (hash(i + 810) - 0.5) * (tw + sz),
      (hash(i + 820) - 0.5) * sz * 1.6,
      0.3 + hash(i + 830) * sz * 0.06,
      0,
      Math.PI * 2,
    );
    ctx.fill();
  }
  ctx.restore();
  ctx.globalCompositeOperation = "source-over";

  /* the board darkens into its own edges */
  const rim = ctx.createLinearGradient(0, 0, 0, h);
  rim.addColorStop(0, "rgba(90, 62, 32, 0.08)");
  rim.addColorStop(0.12, "rgba(90, 62, 32, 0)");
  rim.addColorStop(0.88, "rgba(90, 62, 32, 0)");
  rim.addColorStop(1, "rgba(90, 62, 32, 0.1)");
  ctx.fillStyle = rim;
  ctx.fillRect(0, 0, w, h);
}
