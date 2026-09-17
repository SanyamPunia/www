/**
 * What is in the tray: four notices of the kind a project dashboard sends.
 *
 * Every one is a title, a line or two of detail and one thing to do about it,
 * and that is not only a house style. The pile is a grid stack, so its height
 * is the tallest card in it and every card is stretched to that, which is what
 * lets a peek be one number rather than one number per card. Four notices of
 * four different shapes would need four peeks and the pile would step.
 *
 * The bodies are written to wrap to two lines at the column's width and still
 * two at a phone's, so the pile is the same height on both.
 */
export interface Notice {
  id: string;
  title: string;
  body: string;
  /**
   * What acting on it is called. Acting retires the notice, the same as
   * dismissing it does: a notification tray is a queue of things to deal with,
   * and both of those are dealing with one. The demo does not pretend the
   * button navigates anywhere.
   */
  action: string;
}

export const NOTICES: Notice[] = [
  {
    id: "build",
    title: "Build passed",
    body: "main deployed in 34 seconds with no errors.",
    action: "View build",
  },
  {
    id: "storage",
    title: "Storage is at 82%",
    body: "Your project is close to the limit on this plan.",
    action: "Manage plan",
  },
  {
    id: "reviews",
    title: "Two reviews waiting",
    body: "Both pull requests have been open since Tuesday.",
    action: "Open reviews",
  },
  {
    id: "invite",
    title: "Invite accepted",
    body: "A teammate joined and can deploy to production.",
    action: "View team",
  },
];
