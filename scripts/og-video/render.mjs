/**
 * Renders the home page's social card as a looping video, for `og:video`.
 *
 * `scene.html` beside this file is the card as a function of time. This steps
 * it one frame at a time in the installed Chrome and pipes each screenshot to
 * ffmpeg, so the clip is deterministic: no frame is dropped or doubled however
 * slow the machine is, which a screen recording cannot promise.
 *
 *   node scripts/og-video/render.mjs            writes public/assets/og-video.mp4
 *   node scripts/og-video/render.mjs --at 3.6   writes one frame, for a check
 *
 * Frames are taken at twice the size and scaled down, so a bubble moving by a
 * fraction of a pixel still moves smoothly rather than snapping to the pixel
 * grid. It needs `ffmpeg` on the path and nothing else: Chrome is the one
 * already installed, so nothing is downloaded.
 */
import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "playwright-core";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, "..", "..", "public", "assets", "og-video.mp4");
const CHROME =
  process.env.CHROME_PATH ??
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

const W = 1200;
const H = 630;
const SCALE = 2;
const FPS = 60;

const at = process.argv.includes("--at")
  ? Number(process.argv[process.argv.indexOf("--at") + 1])
  : null;

const browser = await chromium.launch({ executablePath: CHROME });
const page = await browser.newPage({
  viewport: { width: W, height: H },
  deviceScaleFactor: SCALE,
});
await page.goto(`${pathToFileURL(join(HERE, "scene.html")).href}?still`);
await page.evaluate(() => window.ready);
const duration = await page.evaluate(() => window.DURATION);
const stage = page.locator("#stage");

async function frame(t) {
  await page.evaluate((s) => window.render(s), t);
  return stage.screenshot({ type: "png", animations: "disabled" });
}

if (at !== null) {
  const file = join(tmpdir(), `og-frame-${at}.png`);
  const png = await frame(at);
  const ff = spawn(
    "ffmpeg",
    [
      "-y",
      "-loglevel",
      "error",
      "-i",
      "-",
      "-vf",
      `scale=${W}:${H}:flags=lanczos`,
      file,
    ],
    { stdio: ["pipe", "inherit", "inherit"] },
  );
  ff.stdin.end(png);
  await new Promise((done) => ff.on("close", done));
  console.log(file);
  await browser.close();
  process.exit(0);
}

await mkdir(dirname(OUT), { recursive: true });

// H.264 in yuv420p with the BT.709 matrix spelled out on both the conversion
// and the stream, or players guess BT.601 and the blue bubble shifts. `+faststart`
// moves the index to the front so a preview can start before the whole file
// has arrived.
const ff = spawn(
  "ffmpeg",
  [
    "-y",
    "-loglevel",
    "error",
    "-f",
    "image2pipe",
    "-framerate",
    String(FPS),
    "-i",
    "-",
    "-vf",
    `scale=${W}:${H}:flags=lanczos:out_color_matrix=bt709,format=yuv420p`,
    "-c:v",
    "libx264",
    "-preset",
    "veryslow",
    "-crf",
    "18",
    "-tune",
    "animation",
    "-colorspace",
    "bt709",
    "-color_primaries",
    "bt709",
    "-color_trc",
    "bt709",
    "-movflags",
    "+faststart",
    "-an",
    OUT,
  ],
  { stdio: ["pipe", "inherit", "inherit"] },
);

const total = Math.round(duration * FPS);
for (let i = 0; i < total; i++) {
  const png = await frame(i / FPS);
  if (!ff.stdin.write(png)) {
    await new Promise((drain) => ff.stdin.once("drain", drain));
  }
  if (i % FPS === 0) process.stdout.write(`\r${i}/${total} frames`);
}
ff.stdin.end();
await new Promise((done) => ff.on("close", done));
await browser.close();
console.log(`\r${total}/${total} frames, ${OUT}`);
