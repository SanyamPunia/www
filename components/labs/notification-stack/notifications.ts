/*
 * The six notifications in the stack, in the order they pile up, written the
 * way iOS lays one out: a title (the sender or the event), the time, and a
 * body. `name` is the app's, read to a screen reader and never drawn, since
 * iOS dropped the app name from the tile. Each app's tile hues are scoped here
 * and are not tokens: an app's colour is what tells six tiles built from the
 * same square apart.
 */

export type App =
  | "messages"
  | "calendar"
  | "music"
  | "mail"
  | "home"
  | "studio";

export interface Notification {
  app: App;
  name: string;
  title: string;
  time: string;
  body: string;
  /** an attachment drawn on the right, the way iOS shows an image */
  thumb?: boolean;
}

export const NOTIFICATIONS: readonly Notification[] = [
  {
    app: "messages",
    name: "Messages",
    title: "Maya Chen",
    time: "now",
    body: "Made it home? That little place you picked was perfect. Sending you the photos now.",
  },
  {
    app: "calendar",
    name: "Calendar",
    title: "Design review",
    time: "now",
    body: "In 12 minutes, Studio, Room 04. Bring the motion studies.",
  },
  {
    app: "music",
    name: "Music",
    title: "Kairo",
    time: "1h ago",
    body: "After Hours is out now. Listen to the new album.",
    thumb: true,
  },
  {
    app: "mail",
    name: "Mail",
    title: "Studio North",
    time: "4m ago",
    body: "Re: First pass. This feels close. The quieter transition on frame 03 is the one.",
  },
  {
    app: "home",
    name: "Home",
    title: "Front Door",
    time: "now",
    body: "A person was seen at the front door.",
  },
  {
    app: "studio",
    name: "Studio",
    title: "Alex Rivera",
    time: "2m ago",
    body: "Mentioned you: the spring on the card stack feels right. Can you share the values?",
  },
];

/** each tile's gradient and the ink on it, constant across themes */
export const TILE: Record<App, { from: string; to: string; ink: string }> = {
  messages: { from: "#5bf675", to: "#0cbd2a", ink: "#ffffff" },
  calendar: { from: "#ffffff", to: "#f3f2ef", ink: "#ff3b30" },
  music: { from: "#fd5b78", to: "#fb243f", ink: "#ffffff" },
  mail: { from: "#1e9ffd", to: "#1468f2", ink: "#ffffff" },
  home: { from: "#ffb340", to: "#ff9500", ink: "#ffffff" },
  studio: { from: "#36383b", to: "#151719", ink: "#ffffff" },
};

/** the calendar tile's date, under the weekday in `TILE.calendar.ink` */
export const CALENDAR_DATE = { day: "WED", date: "14", ink: "#1c1c1e" };

/** the music attachment, an album cover */
export const COVER = "linear-gradient(145deg, #d99a79, #80534d 56%, #343348)";
