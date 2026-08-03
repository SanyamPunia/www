import { ArrowUpRightIcon } from "@phosphor-icons/react/dist/ssr";
import Image from "next/image";
import type { WorkRow } from "@/lib/work";

interface WorkSectionProps {
  section: { label: string; rows: WorkRow[] };
}

/**
 * One labelled group of rows, a company list or a project list. Each is its
 * own line per entry, linking out.
 *
 * Exported per section rather than as a whole list so the page can put each
 * one in its own `RevealItem` and have them stagger in. There is no client
 * state here, so this stays a server component and no row data crosses to the
 * browser.
 */
export function WorkSection({ section }: WorkSectionProps) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-meta text-text-muted">{section.label}</h2>

      {/*
       * No dividers. The leader rule inside each row already carries the
       * eye across, and a second horizontal line per row turns the list
       * back into a table. `gap-1` separates the rows instead, which is
       * also what lets the hover pill read as a discrete object rather
       * than a band butted against its neighbours.
       *
       * The `-mx-4` lives here so the pill can run wider than the column
       * while the row's own `px-4` pulls the content back to the column
       * edge, keeping it aligned with the heading above.
       */}
      <ul className="-mx-4 flex flex-col gap-1">
        {section.rows.map((row) => (
          <li key={row.slug}>
            <a
              href={row.href}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex cursor-pointer items-center gap-3 rounded-full px-4 py-2 transition-colors duration-200 hover:bg-fill active:bg-fill-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-primary/15"
            >
              {/*
               * One frame for every mark. The source logos are six
               * different silhouettes, some carrying their own square
               * ground and some floating bare, so without a shared tile
               * the left edge never settles. `overflow-hidden` is what
               * does the work: a logo with its own background gets its
               * corners clipped into the circle, a bare mark sits inside
               * it against `bg-fill`.
               */}
              <span className="size-6 shrink-0 overflow-hidden rounded-full bg-fill ring-1 ring-stroke ring-inset">
                <Image
                  src={row.logo}
                  alt=""
                  width={24}
                  height={24}
                  draggable={false}
                  className="size-full select-none object-contain"
                />
              </span>

              <span className="min-w-0 shrink truncate text-body leading-tight text-text-primary">
                {row.name}
              </span>

              {/* the leader rule. It replaces the divider, carries the eye
                      to the date, and absorbs all the slack so both ends stay
                      put however long the name runs. */}
              <span
                aria-hidden="true"
                className="h-px min-w-4 flex-1 bg-stroke-soft transition-colors duration-200 group-hover:bg-stroke"
              />

              {/*
               * Date and arrow are one tight pair at the right end, so the
               * leader rule stops short of both rather than running into
               * the icon.
               *
               * The arrow is always in the layout and only fades, never
               * mounts. Revealing it with `hidden` would resize the row
               * under the cursor and shift the date sideways on every
               * hover. It answers to focus as well, or the affordance
               * would not exist for anyone tabbing through.
               */}
              <span className="flex shrink-0 items-center gap-1.5">
                <span className="text-meta text-text-muted">{row.meta}</span>
                <ArrowUpRightIcon
                  aria-hidden="true"
                  className="size-3.75 text-text-muted opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-visible:opacity-100"
                />
              </span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
