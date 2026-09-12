/**
 * Records the hover preview the lab index plays, one clip per experiment.
 *
 * The index needs a moving picture of each interaction, and every experiment
 * answers to a gesture rather than sitting still, so there is nothing to
 * screenshot. This drives the real page in a real browser, performs that
 * gesture, and crops the recording to the demo's own box.
 *
 * A lab whose component changes is re-recorded with `pnpm previews <slug>`.
 * Nothing else reproduces these files, and a lab with no clip in
 * `public/assets/labs` simply has no preview, so a missing one is a quiet
 * degradation rather than a build error.
 *
 *   pnpm previews              every implemented lab
 *   pnpm previews book-opening one lab
 *
 * It drives the dev server already listening on `BASE`, so start `pnpm dev`
 * first. Two Next servers cannot share one `.next`. It also needs
 * `agent-browser` on the path, `npm i -g agent-browser`, which does the
 * capture, and `ffmpeg` and `cwebp`, which cut and encode.
 */
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { chromium } from "playwright-core";

const run = promisify(execFile);

const BASE = process.env.PREVIEW_BASE ?? "http://localhost:3100";
const OUT = "public/assets/labs";

/**
 * The capture is agent-browser's, not Playwright's. Playwright's own recorder
 * hands over about 25 frames a second whatever the page does. agent-browser's
 * `record` runs Chrome's screencast into ffmpeg at the rate it is asked for
 * and holds a frame only when Chrome produced none, and Chrome produces one
 * per compositor frame: measured on the custom cursor lab, 298 distinct frames
 * in 5.0s at `--fps 60`. Playwright still drives the gesture, connected over
 * the daemon's own CDP socket, so nothing in the gesture table changed. It
 * drives the installed Chrome, so it downloads nothing.
 */
const CHROME =
  process.env.AGENT_BROWSER_EXECUTABLE_PATH ??
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const FPS = 60;
const ab = async (...args) => (await run("agent-browser", args)).stdout.trim();

/**
 * 8:5, twice the card's own 307x192 so it stays sharp on a 2x display. The
 * card's aspect lives in `lab-preview.tsx` and this is the same ratio: a clip
 * that does not match it is letterboxed by the card rather than distorted.
 */
const CARD = { w: 640, h: 400 };
const ASPECT = CARD.w / CARD.h;

/**
 * The viewport is a wide desktop, so the page renders at its `lg` layout and the
 * column is the same 537px a reader sees.
 *
 * The recording is one video pixel per CSS pixel, and asking for more does not
 * work: Chrome's screencast returns frames at the viewport's CSS size whatever
 * the device scale factor, measured 1280x1000 with the page at a factor of 2,
 * and Playwright's recorder before it only ever scaled a page down. So the
 * crop is upscaled to the card at encode time. The card is 307px wide, so a
 * 537px crop is already 1.75x what it paints.
 */
const VIEWPORT = { width: 1280, height: 800 };

/** Long enough for the page's own reveal stagger to finish before a gesture. */
const SETTLE = 2200;

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * A gesture per lab, in coordinates relative to the demo's own box, plus the
 * part of that box the clip is cropped to.
 *
 * `focus` is a rect inside the demo, not a window on the page: cropping past
 * the demo's edge pulls in the heading and the description, which is page
 * chrome and not the experiment. A rect that is not 8:5 is padded to the card's
 * aspect in white, so what the card shows is the demo frame floating on the
 * page's own ground.
 *
 * The numbers come from `scripts/probe` runs against each page, so a component
 * that moves its own controls needs its entry re-measured.
 */
const LABS = {
  "cursor-origin-button": {
    focus: [199, 79, 139, 87],
    // the hover origin is the point the pointer entered at, so the button is
    // entered twice from opposite sides
    async run({ m }) {
      await m.move(180, 175);
      await wait(300);
      await m.move(232, 122, 12);
      await wait(700);
      await m.click(232, 122);
      await wait(600);
      await m.move(420, 190, 10);
      await wait(500);
      await m.move(305, 118, 12);
      await wait(900);
      await m.move(430, 60, 10);
      await wait(600);
    },
  },

  "phrase-transition": {
    focus: [128, 15, 280, 175],
    // it cycles on its own, so the clip is a dwell
    async run() {
      await wait(5200);
    },
  },

  "split-to-edit": {
    // the three segments spread wider than the pill they came from, so the crop
    // is measured while they are apart
    async run({ page, m }) {
      const pencil = () =>
        page.locator("[data-lab-demo] svg[aria-label]").first();
      await wait(500);
      await m.at(pencil());
      await wait(400);
      await m.press(pencil());
      await wait(2200);
      const rect = await m.ink();
      await m.press(pencil());
      await wait(1800);
      return rect;
    },
  },

  "spring-image": {
    focus: [0, 0, 538, 205],
    // The constraints pin it to the origin, so a hard drag is all elastic and
    // the release is the spring.
    //
    // A drag that crosses the copy beside the photo selects it, and the site
    // paints a selection in `#34d399` with a caret at each end, so a clip about
    // a spring ends up being a clip about the selection colour. Suppressing
    // `selectstart` for the recording is the narrowest fix: the gesture is
    // unchanged and so is everything the demo itself does.
    async run({ page, m }) {
      await page.evaluate(() => {
        document
          .querySelector("[data-lab-demo]")
          .addEventListener("selectstart", (event) => event.preventDefault());
      });
      await m.move(60, 69, 8);
      await wait(500);
      await m.down();
      await m.move(150, 30, 20);
      await wait(300);
      await m.move(60, 40, 14);
      await wait(200);
      await m.up();
      await wait(1200);
      await m.down();
      await m.move(30, 120, 18);
      await wait(300);
      await m.up();
      await wait(1400);
    },
  },

  "discount-code-input": {
    focus: [149, 68, 240, 150],
    async run({ page, m }) {
      await wait(500);
      await m.click(269, 121);
      await wait(600);
      await page.keyboard.type("SANYAM10", { delay: 110 });
      await wait(400);
      await page.keyboard.press("Enter");
      await wait(3000);
    },
  },

  "file-tree-explorer": {
    // the tree grows a row per folder opened, so the crop is measured at its
    // tallest rather than written down
    async run({ pick, m }) {
      await m.move(269, 190, 8);
      await wait(400);
      await m.press(pick("app"));
      await wait(1100);
      await m.press(pick("lib"));
      await wait(1500);
      const rect = await m.ink();
      await m.press(pick("Collapse all"));
      await wait(1300);
      return rect;
    },
  },

  // the toasts are the subject and they stack at the viewport's own corner, so
  // this is the one clip cropped to the page rather than to the demo
  "sonner-extended-toast": {
    async run({ page, pick, m }) {
      await wait(300);
      await m.press(pick("With footer").first());
      await wait(1100);
      await m.press(pick("No footer").first());
      await wait(1100);
      await m.press(pick("With footer").last());
      await wait(2200);
      // The toaster is mounted in the root layout, so the toasts stack at the
      // viewport's own corner rather than inside the demo. They are the subject
      // here, so this is the one clip cropped to where they landed.
      // Anchored on the stack's bottom right corner and already 8:5, since a
      // rect corrected to that aspect afterwards grows leftward into the
      // column and catches a slice of the post's own date line.
      const rect = await page.evaluate((aspect) => {
        const boxes = [...document.querySelectorAll("[data-sonner-toast]")].map(
          (toast) => toast.getBoundingClientRect(),
        );
        const pad = 14;
        const right = Math.max(...boxes.map((b) => b.right)) + pad;
        const bottom = Math.max(...boxes.map((b) => b.bottom)) + pad;
        const w = right - Math.min(...boxes.map((b) => b.x)) + pad;
        return [right - w, bottom - w / aspect, w, w / aspect];
      }, ASPECT);
      await wait(500);
      return rect;
    },
  },

  "number-counter": {
    focus: [204, 84, 130, 81],
    async run({ pick, m }) {
      await m.move(269, 160, 8);
      await wait(400);
      for (let i = 0; i < 4; i += 1) {
        await m.press(pick("Increment"));
        await wait(620);
      }
      for (let i = 0; i < 2; i += 1) {
        await m.press(pick("Decrement"));
        await wait(680);
      }
      await wait(600);
    },
  },

  "multi-step-form": {
    // the card is a step taller on step two, so the crop is measured there
    async run({ page, pick, m }) {
      await wait(400);
      await m.click(269, 168);
      await page.keyboard.type("Sanyam Punia", { delay: 70 });
      await wait(300);
      await m.click(269, 236);
      await page.keyboard.type("24", { delay: 110 });
      await wait(500);
      await m.press(pick("Next"));
      await wait(1900);
      // Anchored at the card's top rather than around all of it. The card is
      // shorter on step one, so a crop as tall as step two shows the hint row
      // under the demo for half the clip, and a line of page chrome in a
      // preview reads as a mistake where a cropped edge reads as a crop.
      const [x, y, w] = await m.ink();
      await m.press(pick("Back"));
      await wait(1500);
      return [x, y, w, w / ASPECT];
    },
  },

  "morphing-icons": {
    focus: [155, 20, 230, 144],
    async run({ pick, m }) {
      await m.move(269, 240, 8);
      await wait(400);
      for (const name of [
        "menu to cross",
        "menu to plus",
        "menu to asterisk",
        "menu to more",
      ]) {
        await m.press(pick(name).last());
        await wait(900);
      }
      await wait(500);
    },
  },

  "animated-dashed-border": {
    focus: [144, 69, 249, 156],
    async run({ pick, m }) {
      await m.move(269, 250, 8);
      await wait(1800);
      await m.press(pick("rounded-xl"));
      await wait(2000);
      await m.press(pick("rounded-md"));
      await wait(1600);
    },
  },

  "tab-overview": {
    focus: [0, 0, 538, 282],
    async run({ page, m }) {
      await m.move(22, 22, 10);
      await wait(1000);
      await page.mouse.click(...m.abs(22, 22));
      await wait(1900);
      await m.move(150, 150, 10);
      await wait(500);
      await page.mouse.click(...m.abs(150, 150));
      await wait(1900);
    },
  },

  "tether-button": {
    focus: [0, 0, 538, 256],
    async run({ m }) {
      await m.move(60, 210, 10);
      await wait(500);
      await m.down();
      await wait(400);
      await m.move(110, 60, 18);
      await wait(250);
      await m.up();
      await wait(900);
      await m.move(468, 214, 14);
      await m.down();
      await wait(450);
      await m.move(430, 52, 16);
      await wait(200);
      await m.up();
      await wait(1100);
    },
  },

  "document-pocket": {
    focus: [0, 8, 538, 356],
    async run({ m }) {
      await m.move(269, 330, 10);
      await wait(300);
      await m.move(269, 272, 8);
      await wait(1200);
      await m.move(269, 196, 8);
      await wait(800);
      await m.click(269, 196);
      await wait(2000);
      await m.click(269, 196);
      await wait(1000);
      await m.move(525, 366, 10);
      await wait(900);
    },
  },

  "event-stacking": {
    focus: [0, 0, 538, 363],
    // a drop onto an occupied cell is the interaction, so the card is carried
    // onto the pile at Thu 9:00
    async run({ m }) {
      await m.move(111, 91, 10);
      await wait(500);
      await m.down();
      await m.move(180, 110, 8);
      await m.move(320, 105, 12);
      await m.move(471, 95, 12);
      await wait(400);
      await m.up();
      await wait(1800);
    },
  },

  "stamp-collection": {
    focus: [26, 16, 486, 326],
    async run({ m }) {
      await m.move(155, 300, 10);
      await wait(300);
      await m.move(155, 171, 8);
      await wait(900);
      await m.click(155, 171);
      await wait(2200);
      await m.move(210, 130, 12);
      await wait(500);
      await m.move(120, 210, 12);
      await wait(700);
      await m.click(269, 179);
      await wait(1900);
    },
  },

  "book-opening": {
    focus: [0, 12, 538, 336],
    async run({ m }) {
      await m.move(269, 340, 10);
      await wait(400);
      await m.move(269, 185, 10);
      await wait(1600);
      await m.move(240, 200, 8);
      await wait(700);
      await m.move(520, 350, 12);
      await wait(1400);
    },
  },

  "folder-stack": {
    focus: [0, 150, 538, 336],
    async run({ m }) {
      await m.move(269, 240, 10);
      await wait(1000);
      await m.move(269, 300, 8);
      await wait(1000);
      await m.move(269, 360, 8);
      await wait(1000);
      await m.move(269, 420, 8);
      await wait(1000);
      await m.move(520, 560, 10);
      await wait(800);
    },
  },

  "window-shade": {
    focus: [0, 27, 538, 336],
    async run({ m }) {
      await m.move(199, 90, 10);
      await wait(500);
      await m.down();
      await m.move(199, 160, 10);
      await m.move(199, 250, 12);
      await m.move(199, 306, 10);
      await wait(300);
      await m.up();
      await wait(1200);
      await m.down();
      await m.move(199, 210, 12);
      await m.move(199, 95, 12);
      await wait(200);
      await m.up();
      await wait(1000);
    },
  },

  "rain-splatter": {
    focus: [0, 0, 538, 336],
    async run({ m }) {
      await wait(2000);
      await m.click(150, 280);
      await wait(900);
      await m.click(380, 210);
      await wait(900);
      await m.click(262, 320);
      await wait(1600);
    },
  },

  "sticker-peel": {
    focus: [0, 0, 538, 336],
    // the peel is slow and the carry is quick, which is what the gesture is: a
    // sticker gives way gradually and then all at once
    async run({ m }) {
      await m.move(108, 104, 8);
      await wait(500);
      await m.down();
      await wait(160);
      await m.move(138, 126, 10);
      await wait(300);
      await m.move(172, 152, 10);
      await wait(360);
      await m.move(272, 214, 12);
      await wait(180);
      await m.move(352, 248, 10);
      await wait(220);
      await m.up();
      await wait(1300);
    },
  },
  "halftone-ripple": {
    focus: [169, 59, 200, 125],
    // hover first, so the label's step shows, then a press at each end of the
    // pill: one in the hue turning it on, one in grey turning it off, one more
    // on. Each ripple is a second long and the gesture waits for it.
    async run({ m }) {
      await m.move(269, 60, 6);
      await wait(300);
      await m.move(269, 121, 8);
      await wait(600);
      await m.click(252, 121);
      await wait(1250);
      await m.click(300, 124);
      await wait(1250);
      await m.click(240, 118);
      await wait(1400);
    },
  },
  "notch-drop": {
    focus: [0, 0, 538, 307],
    // lift the first card, wander so the notch is seen opening, then carry it
    // up to the notch, hold there so the shrink and the plus show, and let go
    async run({ m }) {
      await m.move(180, 100, 6);
      await wait(300);
      await m.down();
      await wait(120);
      await m.move(230, 150, 10);
      await wait(500);
      await m.move(269, 40, 14);
      await wait(700);
      await m.up();
      await wait(1600);
    },
  },
  "custom-cursor": {
    // the cards sit centred in a 448px stage, so the crop takes the middle
    // 336px and keeps 56px of bare ground above and below them
    focus: [0, 56, 538, 336],
    // come in from the left so the dot appears under the hand, visit the four
    // cards so the pill morphs between their names, then leave
    async run({ m }) {
      await m.move(-40, 224);
      await wait(300);
      await m.move(50, 224, 8);
      await wait(500);
      await m.move(173, 158, 10);
      await wait(700);
      await m.move(365, 158, 14);
      await wait(700);
      await m.move(365, 290, 12);
      await wait(700);
      await m.move(173, 290, 14);
      await wait(700);
      await m.move(269, 224, 8);
      await wait(400);
      await m.move(600, 224, 10);
      await wait(600);
    },
  },
  "flip-clock": {
    // the stage is the card's own 8:5, 538 by 336, so the clip is the whole
    // stage with nothing padded or cut
    focus: [0, 0, 538, 336],
    // let a few seconds flip, then set the minutes and the hours forward so
    // all three flaps are seen
    async run({ m, pick }) {
      await wait(1800);
      await m.press(pick(/^minutes/));
      await wait(1400);
      await m.press(pick(/^hours/));
      await wait(1400);
      await m.press(pick(/^minutes/));
      await wait(1400);
    },
  },
  "book-shelf": {
    // the stage is 538 by 500, and the crop is the card's own 8:5 centred on
    // the band the shelf and a picked cover both live in
    focus: [0, 66, 538, 336],
    // run along the spines so they tip out, take one book, put it back, take
    // another and leave it out
    async run({ page, m, pick }) {
      await wait(400);
      await m.move(180, 250, 10);
      await m.move(330, 250, 14);
      await wait(200);
      await m.press(pick(/^Open Cold Type/));
      await wait(1500);
      await page.keyboard.press("Escape");
      await wait(1100);
      await m.press(pick(/^Open Slow Light/));
      await wait(1500);
    },
  },
  "crack-button": {
    // the stage is 538 by 360, and the crop is the card's own 8:5 centred on it,
    // which holds the button and the room the shards fly into
    focus: [0, 12, 538, 336],
    /*
     * Five presses at five points, since a crack leaves the place it was hit and
     * all five in one spot reads as one star growing. Then the break plays out
     * and the glass is repaired, because putting it back is the other half of
     * the experiment.
     */
    async run({ m }) {
      await wait(400);
      await m.click(232, 170);
      await wait(560);
      await m.click(305, 192);
      await wait(560);
      await m.click(266, 160);
      await wait(560);
      await m.click(330, 178);
      await wait(560);
      await m.click(210, 188);
      await wait(1500);
      await m.click(269, 328);
      await wait(700);
    },
  },
  "shelf-drop": {
    // the stage is 538 by 400, and the crop is the card's own 8:5 taken from
    // just above the prints down to the foot of the frame, so the ledge and the
    // whole visible fall are both in it
    focus: [0, 64, 538, 336],
    /*
     * Knock four off. Which side a print falls on comes from a bag holding
     * three of each, so four presses cannot all land on the same side and the
     * clip is guaranteed to show one going forward and one going back, which is
     * the thing the experiment is about. Then put them back, since the refill
     * staggering across the row is the other half of it.
     */
    async run({ m, pick }) {
      await wait(400);
      await m.press(pick(/^Knock Dune/));
      await wait(430);
      await m.press(pick(/^Knock Pine/));
      await wait(430);
      await m.press(pick(/^Knock Kiln/));
      await wait(430);
      await m.press(pick(/^Knock Meadow/));
      await wait(1600);
      await m.press(pick(/^Put them back/));
      await wait(1300);
    },
  },
  "wrapped-pattern": {
    // the sheet is centred in a 525px stage, so the crop is centred on it
    focus: [0, 62, 538, 336],
    // roll the sheet, let the column start its idle turn, then grab it and
    // throw it the other way
    async run({ m, pick }) {
      await wait(500);
      await m.press(pick(/^Roll/));
      await wait(2200);
      await m.move(269, 190, 4);
      await m.down();
      await m.move(120, 190, 16);
      await m.up();
      await wait(1800);
    },
  },
  "radial-menu": {
    // the file sits at the centre of a 448px stage, so the crop takes the
    // middle 336px, which holds the whole wheel
    focus: [0, 56, 538, 336],
    // press the file, pull it up into the top wedge, sweep to the next one and
    // let go, then pull it down to the left and let go again
    async run({ m }) {
      await wait(300);
      await m.move(269, 224, 4);
      await m.down();
      await wait(150);
      await m.move(269, 118, 12);
      await wait(600);
      await m.move(370, 191, 12);
      await wait(600);
      await m.up();
      await wait(1000);
      await m.move(269, 224, 6);
      await m.down();
      await wait(150);
      await m.move(207, 310, 12);
      await wait(600);
      await m.up();
      await wait(1000);
    },
  },
  "island-menu": {
    // the bar sits at the foot of a fixed stage, so the crop starts 34px down
    // to hold the open menu's top and the bar's bottom with equal margins
    focus: [0, 34, 538, 336],
    // open, let the menu settle, hover a link, then close and let the pill
    // land, so the clip holds both unfoldings
    async run({ m, pick }) {
      await wait(300);
      await m.press(pick("Menu"));
      await wait(1400);
      await m.move(150, 120, 8);
      await wait(500);
      await m.press(pick("Close"));
      await wait(1300);
    },
  },
};

function crop(rect, bounds) {
  // Correct the rect to the card's aspect inside whatever bounds it was
  // measured against, so the clip fills the card rather than being letterboxed.
  // A rect that cannot be corrected without leaving those bounds keeps its own
  // shape and is padded in white at encode time.
  let [x, y, w, h] = rect;
  if (w / h < ASPECT) {
    const want = Math.min(h * ASPECT, bounds.width);
    x = Math.max(
      bounds.x,
      Math.min(x - (want - w) / 2, bounds.x + bounds.width - want),
    );
    w = want;
  } else if (w / h > ASPECT) {
    const want = Math.min(w / ASPECT, bounds.height);
    y = Math.max(
      bounds.y,
      Math.min(y - (want - h) / 2, bounds.y + bounds.height - want),
    );
    h = want;
  }
  return {
    x: Math.round(x),
    y: Math.round(y),
    w: Math.round(w),
    h: Math.round(h),
  };
}

const VIEWPORT_BOUNDS = {
  x: 0,
  y: 0,
  width: VIEWPORT.width,
  height: VIEWPORT.height,
};

async function record(page, slug, lab, tmp) {
  await page.goto(`${BASE}/lab/${slug}`, { waitUntil: "load" });
  await page.waitForFunction(() => {
    const demo = document.querySelector("[data-lab-demo]");
    return demo !== null && demo.getBoundingClientRect().height > 80;
  });

  // centre the demo in the viewport before anything is measured, so a tall one
  // is not half off screen and nothing scrolls mid-gesture
  await page.evaluate(() => {
    const demo = document.querySelector("[data-lab-demo]");
    const r = demo.getBoundingClientRect();
    window.scrollBy(0, r.top - (window.innerHeight - r.height) / 2);
  });
  await page.waitForTimeout(SETTLE);

  const box = await page.locator("[data-lab-demo]").boundingBox();

  // Pin the scroll. Nothing on these pages scrolls on its own, but a focused
  // control that grows the page can, and the crop is a fixed rect in viewport
  // coordinates: a page that moves under it lands the clip on the prose below
  // the demo. `locator.click()` is the other way in, since it scrolls its target
  // into view first, so every press below goes through `m.press` instead.
  await page.evaluate(() => {
    const y = window.scrollY;
    window.addEventListener(
      "scroll",
      () => {
        if (window.scrollY !== y) window.scrollTo(0, y);
      },
      true,
    );
  });

  const m = {
    abs: (x, y) => [box.x + x, box.y + y],
    move: (x, y, steps = 1) => page.mouse.move(box.x + x, box.y + y, { steps }),
    down: () => page.mouse.down(),
    up: () => page.mouse.up(),
    click: async (x, y) => {
      await page.mouse.move(box.x + x, box.y + y, { steps: 6 });
      await page.mouse.down();
      await page.waitForTimeout(60);
      await page.mouse.up();
    },
    at: async (locator) => {
      const b = await locator.boundingBox();
      await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, {
        steps: 8,
      });
    },
    press: async (locator) => {
      await m.at(locator);
      await page.mouse.down();
      await page.waitForTimeout(60);
      await page.mouse.up();
    },
    /**
     * The union of everything the demo currently paints, in viewport
     * coordinates. A demo whose own box grows with the interaction is cropped to
     * what it measures at its largest rather than to a rect written down here.
     */
    ink: async () => {
      const r = await page.evaluate(() => {
        const demo = document.querySelector("[data-lab-demo]");
        const d = demo.getBoundingClientRect();
        let x0 = Infinity;
        let y0 = Infinity;
        let x1 = -Infinity;
        let y1 = -Infinity;
        for (const el of demo.querySelectorAll("*")) {
          const paints = /^(svg|canvas|img|video)$/.test(
            el.tagName.toLowerCase(),
          );
          if (el.children.length > 0 && !paints) continue;
          const b = el.getBoundingClientRect();
          if (b.width < 1 || b.height < 1) continue;
          const cs = getComputedStyle(el);
          if (cs.visibility === "hidden" || Number(cs.opacity) === 0) continue;
          x0 = Math.min(x0, b.x);
          y0 = Math.min(y0, b.y);
          x1 = Math.max(x1, b.right);
          y1 = Math.max(y1, b.bottom);
        }
        return [x0, y0, x1 - x0, y1 - y0, d.x, d.y, d.width, d.height];
      });
      const pad = 12;
      return [r[0] - pad, r[1] - pad, r[2] + pad * 2, r[3] + pad * 2];
    },
  };
  const pick = (name) =>
    page.locator("[data-lab-demo]").getByRole("button", { name });

  // the recording opens on the settled demo and closes on the gesture's end,
  // so there is nothing to trim
  const raw = join(tmp, `${slug}.mp4`);
  await ab("--json", "record", "start", raw, "--fps", String(FPS));
  const clock = Date.now();
  const measured = await lab.run({ page, m, pick, box });
  const seconds = (Date.now() - clock) / 1000;
  await ab("--json", "record", "stop");

  const region = measured
    ? crop(measured, VIEWPORT_BOUNDS)
    : lab.viewport
      ? crop(lab.viewport, VIEWPORT_BOUNDS)
      : crop(
          [
            box.x + lab.focus[0],
            box.y + lab.focus[1],
            lab.focus[2],
            lab.focus[3],
          ],
          box,
        );

  const mp4 = join(OUT, `${slug}.mp4`);
  await run("ffmpeg", [
    "-y",
    "-i",
    raw,
    "-vf",
    [
      `crop=${region.w}:${region.h}:${region.x}:${region.y}`,
      `scale=${CARD.w}:${CARD.h}:force_original_aspect_ratio=decrease:flags=lanczos`,
      `pad=${CARD.w}:${CARD.h}:-1:-1:white`,
      `fps=${FPS}`,
    ].join(","),
    "-an",
    "-c:v",
    "libx264",
    "-profile:v",
    "high",
    "-pix_fmt",
    "yuv420p",
    "-crf",
    "30",
    "-preset",
    "slow",
    "-movflags",
    "+faststart",
    mp4,
  ]);

  // The poster is what the card paints while the clip loads, and the whole of
  // what it shows under reduced motion.
  //
  // Through `cwebp` rather than ffmpeg, because the ffmpeg on this machine is
  // built without libwebp and fails with "encoder not found".
  const still = join(tmp, `${slug}.png`);
  await run("ffmpeg", ["-y", "-i", mp4, "-frames:v", "1", still]);
  await run("cwebp", [
    "-quiet",
    "-q",
    "72",
    still,
    "-o",
    join(OUT, `${slug}.webp`),
  ]);
  await rm(still, { force: true });

  await rm(raw, { force: true });
  const size = (await readFile(mp4)).byteLength;
  return { seconds: seconds.toFixed(1), kb: Math.round(size / 1024) };
}

const only = process.argv.slice(2);
const slugs = Object.keys(LABS).filter(
  (slug) => only.length === 0 || only.includes(slug),
);
if (slugs.length === 0) {
  console.error(`no such lab. known: ${Object.keys(LABS).join(", ")}`);
  process.exit(1);
}

await mkdir(OUT, { recursive: true });
const tmp = await mkdtemp(join(tmpdir(), "lab-previews-"));

// one daemon, one Chrome, one tab, driven over the daemon's own CDP socket. A
// session left from a crashed run is closed first, and the daemon needs a beat
// to go before it can come back
await ab("close", "--all").catch(() => {});
await wait(1500);
await ab("--executable-path", CHROME, "open", "about:blank");
const browser = await chromium.connectOverCDP(await ab("get", "cdp-url"));
const page = browser.contexts()[0].pages().at(-1);
await page.setViewportSize(VIEWPORT);
const emulation = await page.context().newCDPSession(page);
await emulation.send("Emulation.setEmulatedMedia", {
  features: [{ name: "prefers-reduced-motion", value: "no-preference" }],
});

for (const slug of slugs) {
  process.stdout.write(`${slug.padEnd(24)}`);
  try {
    const { seconds, kb } = await record(page, slug, LABS[slug], tmp);
    console.log(`${seconds}s  ${kb}KB`);
  } catch (error) {
    console.log(`failed: ${error.message.split("\n")[0]}`);
  }
}

await browser.close().catch(() => {});
await ab("close", "--all").catch(() => {});
await rm(tmp, { recursive: true, force: true });
