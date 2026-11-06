/**
 * The site the window browses, written for the lab: a harbour walk whose stops
 * link to each other, so history can fork. History opens on the main route.
 */
export const HOST = "walks.example";

export type PageId =
  | "harbour"
  | "market"
  | "beach"
  | "library"
  | "steps"
  | "garden"
  | "light";

export interface Stop {
  path: string;
  /** the part of town, above the title */
  area: string;
  title: string;
  /** the picture's sky and ground, scoped here and not tokens */
  tone: readonly [string, string];
  paragraphs: readonly string[];
  /** where the foot of the page leads */
  links: readonly PageId[];
}

export const PAGES: Record<PageId, Stop> = {
  harbour: {
    path: "/harbour",
    area: "The waterfront",
    title: "The harbour wall",
    tone: ["#bcd3e6", "#5f7f9e"],
    paragraphs: [
      "The walk starts where the ferries tie up. The wall was built in 1871 from stone cut on the far side of the bay.",
      "Look down at low tide and you can see the courses change colour, where a later repair used stone from a closer quarry.",
      "The iron rings along the top were for sailing boats. Nothing has tied up to them in fifty years, and they are still oiled every spring.",
      "Follow the wall east until the paving turns to cobbles. That is where the old fish market stood.",
      "Or go down the slipway at the end of the wall. At low tide the beach runs all the way to the cliff.",
      "Allow ten minutes for this stretch, more if the tide is out and the rock pools are worth a look.",
    ],
    links: ["market", "beach"],
  },
  market: {
    path: "/harbour/market",
    area: "Old town",
    title: "The old fish market",
    tone: ["#e9d3b4", "#9c7650"],
    paragraphs: [
      "The market closed in 1962, but the slate counters are still there under the arcade, worn into shallow bowls.",
      "Every counter had a number painted on its end. You can still read seven of them if you know where to look.",
      "The building is a library now. The reading room is the old cold store, which is why it has no windows.",
      "Ask at the desk and they will show you the tally books, a hundred years of catches in one hand after another.",
      "Leave by the back door and take the steps up. The street at the top is the oldest one in the town.",
      "The bakery on the corner opens only on a falling tide. Nobody has been able to explain why to me.",
    ],
    links: ["steps", "library"],
  },
  beach: {
    path: "/harbour/beach",
    area: "The waterfront",
    title: "Shingle beach",
    tone: ["#d6e4ea", "#a89c86"],
    paragraphs: [
      "The shingle is sorted by the sea: fist-sized stones by the wall, pea gravel by the time you reach the cliff.",
      "The black rocks halfway along are the old breakwater. At low tide you can walk out to the last of its posts.",
      "Watch the tide table. The water comes in over the flat sand faster than it looks like it should.",
      "At the far end a path climbs up through the gorse and meets the steps near the top.",
      "Or keep to the cliff road, which is longer, and comes out under the light.",
    ],
    links: ["steps", "light"],
  },
  library: {
    path: "/harbour/market/library",
    area: "Old town",
    title: "The cold store library",
    tone: ["#ddd3e6", "#7c6a96"],
    paragraphs: [
      "The walls are a metre thick and lined with cork, so the room is cool in August and quiet all year.",
      "The shelves stand where the ice blocks did. The drain in the middle of the floor is still there, under a rug.",
      "The tally books are in the glass case by the door. The oldest one starts in 1838.",
      "There is a map of the walk on the wall, drawn by the keeper's father, with the steps counted wrong.",
      "The side door lets out at the foot of the steps.",
    ],
    links: ["steps"],
  },
  steps: {
    path: "/harbour/steps",
    area: "The headland",
    title: "Ninety one steps",
    tone: ["#cfe0c4", "#6d8a5c"],
    paragraphs: [
      "The steps climb from the market to the headland. Count them on the way up and you will get a different number on the way down.",
      "Halfway up there is a landing with an iron gate. It was the coastguard's garden, and the rosemary is still alive.",
      "The wall on your left is lined with glass from the old lamp, broken up and set in the mortar so it catches the sun.",
      "Rest at the top. The path to the light runs along the cliff from here, and it is flat the rest of the way.",
      "On a clear day you can see the island ferry the whole way across from this bench.",
      "The last stop is at the end of the path, where the keeper still climbs the tower every evening.",
    ],
    links: ["light", "garden"],
  },
  garden: {
    path: "/harbour/steps/garden",
    area: "The headland",
    title: "The coastguard garden",
    tone: ["#d9e8c8", "#5f8a4c"],
    paragraphs: [
      "The gate is never locked. The garden was planted to feed the coastguard's family, and some of it still does.",
      "The rosemary hedge is older than anyone in the town. It flowers in February, when nothing else does.",
      "The volunteers leave spare cuttings in a crate by the gate, with a tin for whatever you think is fair.",
      "The path out of the top corner joins the cliff path a short way from the light.",
    ],
    links: ["light"],
  },
  light: {
    path: "/harbour/light",
    area: "The headland",
    title: "Kettle Point light",
    tone: ["#e6c6c0", "#9a5d58"],
    paragraphs: [
      "The light has turned itself on since 1994, but the keeper still climbs the tower at six every evening.",
      "He keeps a log of the time, the weather, and whether the lamp came on. In thirty one years it has said yes every night but four.",
      "The door at the foot of the tower is open on Sundays. The stairs inside are steep, and the view at the top is worth them.",
      "From the gallery you can see the whole walk at once: the wall, the market roofs, the steps and the bench.",
      "Go back the way you came, or take the cliff road down. It is longer, and it meets the harbour at the ferry.",
    ],
    links: [],
  },
};

/** the history the window opens on, at its last page */
export const START: readonly PageId[] = ["harbour", "market", "steps", "light"];
