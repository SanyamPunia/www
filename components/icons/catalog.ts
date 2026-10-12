/**
 * Every icon in the set, grouped and in sheet order, for the `/icons` page.
 * Nothing else imports this file, so no other page pays for the whole set.
 *
 * The order and the groups come from `lib/icons.ts`. The components come from
 * the glyph modules, and the two are checked against each other at module
 * load, the call `IMPLEMENTED_LABS` makes for the labs: a missing icon is a
 * build error rather than a gap in the sheet.
 */
import { ICON_GROUPS } from "@/lib/icons";
import * as arrows from "./glyphs/arrows";
import * as hands from "./glyphs/hands";
import * as marks from "./glyphs/marks";
import * as media from "./glyphs/media";
import * as nature from "./glyphs/nature";
import * as objects from "./glyphs/objects";
import type { IconComponent } from "./icon";

const MODULES: Record<string, Record<string, IconComponent>> = {
  arrows,
  marks,
  objects,
  media,
  nature,
  hands,
};

export interface CatalogIcon {
  /** the export name without its `Icon` suffix */
  name: string;
  Icon: IconComponent;
}

export interface CatalogGroup {
  id: string;
  label: string;
  icons: CatalogIcon[];
}

export const CATALOG: CatalogGroup[] = ICON_GROUPS.map((group) => {
  const glyphs = MODULES[group.id];
  if (!glyphs) throw new Error(`No glyph module for the "${group.id}" group`);

  const named = new Set(group.names.map((name) => `${name}Icon`));
  const missing = Object.keys(glyphs).filter((key) => !named.has(key));
  if (missing.length) {
    throw new Error(`Icons missing from lib/icons.ts: ${missing.join(", ")}`);
  }

  return {
    id: group.id,
    label: group.label,
    icons: group.names.map((name) => {
      const Icon = glyphs[`${name}Icon`];
      if (!Icon)
        throw new Error(`lib/icons.ts names ${name}, which has no icon`);
      return { name, Icon };
    }),
  };
});
