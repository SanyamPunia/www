import { memo } from "react";
import { CaretRightIcon } from "@/components/icons";
import { cn } from "@/lib/utils";

const H = "pt-3 text-body text-text-primary";
const P = "text-body text-text-secondary";

/**
 * The page find searches. It never renders again, so the ranges found in it
 * stay valid for as long as the lab is open. Each block is searched on its own,
 * so a match cannot run from one paragraph into the next.
 */
export const Page = memo(function Page() {
  return (
    <article className="flex flex-col gap-4">
      <h2 data-block className={H}>
        The café on the corner
      </h2>
      <p data-block className={P}>
        The café on the corner opens at seven, and by ten past there is a queue
        out to the window. Nobody minds. The light comes in low across the
        counter and catches the steam off every cup.
      </p>
      <p data-block className={P}>
        Ask for a <span className="text-text-primary">flat</span> white and you
        get one in a glass, which is the house rule. Ask for a cafe au lait and
        the owner, Zoë, will tell you it’s the same drink with a longer name.
        She is mostly right.
      </p>
      <h2 data-block className={H}>
        Morning light
      </h2>
      <p data-block className={P}>
        In winter the light reaches the back tables by nine. In summer it never
        gets past the window seats, so those go first. A regular keeps a book on
        the sill and moves it along with the light, a table at a time.
      </p>
      <p data-block className={P}>
        The window faces east. Somebody painted the name on the glass backwards,
        so it reads right from inside, and the morning light throws it across
        the floor: café, in long gold letters, sliding toward the door as the
        day goes on.
      </p>
      <h2 data-block className={H}>
        Closing time
      </h2>
      <p data-block className={P}>
        The café shuts at four. The last coffee is poured at quarter to, and the
        chairs go up on the tables while the light is still warm. Zoë counts the
        till, waters the plant by the window, and turns the sign.
      </p>
      <p data-block className={P}>
        On the way out, look at the glass. From the street the letters read the
        wrong way round, and the café stays lit for another hour by nothing but
        the low light off the river.
      </p>
      {/* folded shut: find searches it anyway and opens it on a match inside */}
      <details className="group">
        <summary className="-mx-2 flex w-fit cursor-pointer list-none items-center gap-1.5 rounded-md px-2 py-1 transition-all duration-150 hover:bg-fill active:bg-fill-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-primary/15 focus-visible:ring-offset-2 [&::-webkit-details-marker]:hidden">
          <CaretRightIcon className="size-3.5 text-text-muted transition-transform duration-200 group-open:rotate-90" />
          <span data-block className="text-body text-text-primary">
            The owner’s notebook
          </span>
        </summary>
        <p data-block className={cn(P, "pt-3")}>
          Kept behind the till. The cardamom buns sell out by eleven, the oat
          milk lives in the small fridge, and the light on the stairs still
          needs a new bulb.
        </p>
      </details>
    </article>
  );
});
