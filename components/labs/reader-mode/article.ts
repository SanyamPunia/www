/** The article the page carries, written for the lab */
export const ARTICLE = {
  host: "harbourtimes.example",
  path: "/coast/the-last-keeper",
  kicker: "Coast",
  title: "The last keeper of Kettle Point",
  author: "Mara Quill",
  date: "4 Nov 2026",
  caption: "The lamp room at Kettle Point, an hour before dusk.",
  paragraphs: [
    "Tom Avery climbs the ninety one steps of the Kettle Point light every evening at six. The lamp has turned itself on since 1994, so the climb is the job now.",
    "The light was automated the year his father retired. Tom stayed on as caretaker, on a salary the board reviews every spring and has never yet cut.",
    "He keeps a log anyway: the time, the weather, and whether the lamp came on. In thirty one years the last line has said yes every night but four.",
    "On those four nights he lit it by hand, with the brass key his father hung by the door, a little too high for him.",
    "There are fewer ships now, and none of them look at the light. Their routes are drawn by satellite, and the beam is a thing they see on a screen.",
    "He does not mind. The light was never only for ships, he says. It is for the people on the shore who want to know someone is up there.",
    "At seven he climbs back down, writes yes in the ledger, and walks home with the beam going round behind him.",
  ],
} as const;

const WORDS = [ARTICLE.title, ...ARTICLE.paragraphs]
  .join(" ")
  .split(/\s+/).length;

/** Reader mode's reading time, at 230 words a minute, derived from the copy */
export const READ_MINUTES = Math.max(1, Math.round(WORDS / 230));

/** The paragraph the inline advert sits after, in the ordinary page */
export const AD_AFTER = 1;

export const MOST_READ = [
  "Ferry fares rise again",
  "East quay to close",
  "The tide-only bakery",
] as const;
