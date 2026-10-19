/**
 * The page: a chapter heading and six paragraphs, written for this lab. The
 * rail in the margin has one tick per paragraph, and the time left is counted
 * off these words at 230 a minute, which is a typical reading pace.
 */

export const CHAPTER = "Chapter three";
export const TITLE = "The last ferry";

export const PARAGRAPHS: readonly string[] = [
  "The last ferry left the harbour at eleven, and Ines was the only one on deck. The lights of the town went small behind her, one window at a time, until the shore was a line of gold thread laid on black water.",
  "She had made this crossing every week for a year. She knew the cough of the engine, the rope that always slapped the rail, and the gull that rode the mast as far as the breakwater and then gave up.",
  "Tonight the gull stayed. It sat on the rail beside her, close enough to touch, and watched the dark ahead as if it knew something about it that she did not.",
  "Halfway across, the engine went quiet. Not broken, only quiet, the way a room goes quiet when someone you love walks in. The ferry kept moving, and the water ahead had started to glow.",
  "It was faint at first, a green so pale it could have been tired eyes. Then it gathered under the hull and spread out on both sides, until the boat was crossing a field of light that had not been there a minute before.",
  "The gull lifted off the rail and dropped straight into it. Ines leaned out to watch it go, and when it came back up, it was carrying the moon.",
];

export const WPM = 230;

export const WORDS = PARAGRAPHS.reduce((n, p) => n + p.split(/\s+/).length, 0);
