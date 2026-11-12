import { memo } from "react";
import {
  ChatIcon,
  EnvelopeIcon,
  HashIcon,
  SpeakerHighIcon,
  UserIcon,
} from "@/components/icons";
import {
  type App,
  CALENDAR_DATE,
  COVER,
  type Notification,
  TILE,
} from "./notifications";

/*
 * One notification, drawn the way iOS draws one: the app icon on the left, a
 * semibold title with the time at its right, and up to two lines of body in
 * the primary ink, on a solid card with no edge. It is drawn once at
 * its design size and never re-rendered by the stack. The stack moves it with
 * one `transform` and one custom property, `--shade`.
 *
 * Every length inside is px at a 400 by 88 card, and the stack scales the
 * whole card to the stage, the standing `specimen-stack` gives its own cards.
 */

export const CARD = { w: 400, h: 88, r: 22 } as const;

/** a soft lift, since the material has no edge to separate it from the stage */
const LIFT =
  "0 1px 1px rgb(0 0 0 / 0.04), 0 6px 16px rgb(0 0 0 / 0.06), 0 18px 36px rgb(0 0 0 / 0.06)";

const GLYPH: Partial<Record<App, typeof ChatIcon>> = {
  messages: ChatIcon,
  music: SpeakerHighIcon,
  mail: EnvelopeIcon,
  home: UserIcon,
  studio: HashIcon,
};

/** an iOS app icon: a squircle whose corner is 22.37% of its side */
function Tile({ app }: { app: App }) {
  const t = TILE[app];
  const Glyph = GLYPH[app];
  return (
    <span
      aria-hidden="true"
      className="grid size-[38px] shrink-0 place-items-center overflow-hidden rounded-[8.5px]"
      style={{
        background: `linear-gradient(180deg, ${t.from}, ${t.to})`,
        color: t.ink,
        boxShadow: "inset 0 0 0 0.5px rgb(0 0 0 / 0.08)",
      }}
    >
      {Glyph ? (
        <Glyph className="size-[21px]" />
      ) : (
        <span className="flex flex-col items-center leading-none">
          <span className="font-semibold text-[7.5px] tracking-wide">
            {CALENDAR_DATE.day}
          </span>
          <span
            className="mt-[1px] text-[19px]"
            style={{ color: CALENDAR_DATE.ink }}
          >
            {CALENDAR_DATE.date}
          </span>
        </span>
      )}
    </span>
  );
}

export const Card = memo(function Card({ n }: { n: Notification }) {
  return (
    <>
      {/* solid, not iOS's frosted material: on a pile, a translucent card
          shows the text of the cards under it through its own */}
      <span
        className="absolute inset-0 bg-bg"
        style={{ borderRadius: CARD.r, boxShadow: LIFT }}
      />
      {/* card type is off the scale on purpose: it is printed on a drawn
          object and scaled with it, `foil-card`'s standing. iOS sets it in
          sentence case, so the card keeps the casing it is written in */}
      <span className="absolute inset-0 flex items-center gap-[10px] py-[12px] pr-[14px] pl-[13px] text-left normal-case">
        <Tile app={n.app} />
        <span className="flex min-w-0 flex-1 flex-col gap-[1px]">
          <span className="flex min-w-0 items-baseline gap-[8px]">
            <span className="truncate font-semibold text-[14px] text-text-primary leading-[18px]">
              {n.title}
            </span>
            <span className="ml-auto shrink-0 whitespace-nowrap text-[12px] text-text-muted leading-[18px]">
              {n.time}
            </span>
          </span>
          <span className="line-clamp-2 text-[14px] text-text-primary leading-[18px]">
            {n.body}
          </span>
        </span>
        {n.thumb && (
          <span
            aria-hidden="true"
            className="size-[40px] shrink-0 rounded-[8px]"
            style={{ background: COVER }}
          />
        )}
      </span>
      {/* a card further back in a closed stack is greyed, the way iOS dims
          the cards peeking under the front one. `--shade` is written by the
          stack */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-fill-active"
        style={{ borderRadius: CARD.r, opacity: "var(--shade, 0)" }}
      />
    </>
  );
});
