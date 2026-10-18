/**
 * The inbox, and the three hues its actions are painted in.
 *
 * The hues are Apple's system red and blue and an orange taken down until a
 * white icon on it clears 3:1, which is the floor for a graphic: `#ff9500`,
 * the system orange, is 2.2:1. Measured white on each: red 3.55, blue 4.02,
 * orange 3.01. Scoped to this experiment, not tokens, and nothing else may
 * reach for them. The colour is what tells three actions built from the same
 * button apart, the exception the lab's other scoped sets take.
 */
export const HUE = {
  trash: "#ff3b30",
  unread: "#007aff",
  flag: "#e87500",
} as const;

export interface Message {
  id: string;
  from: string;
  subject: string;
  time: string;
  unread: boolean;
  flagged: boolean;
}

export const INBOX: readonly Message[] = [
  {
    id: "maya",
    from: "Maya Chen",
    subject: "Photos from the weekend are up",
    time: "9:41",
    unread: true,
    flagged: false,
  },
  {
    id: "studio",
    from: "Studio",
    subject: "Your order has shipped",
    time: "8:12",
    unread: true,
    flagged: false,
  },
  {
    id: "jonah",
    from: "Jonah Park",
    subject: "Lunch on Thursday?",
    time: "Yesterday",
    unread: false,
    flagged: true,
  },
  {
    id: "lena",
    from: "Lena Ortiz",
    subject: "Notes from the review",
    time: "Monday",
    unread: false,
    flagged: false,
  },
];
