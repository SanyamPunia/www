import { renderCard } from "@/app/og/card";
import {
  CherriesIcon,
  CloudRainIcon,
  CrownIcon,
  CursorIcon,
  FlameIcon,
  FolderIcon,
  GearIcon,
  HeartIcon,
  PaletteIcon,
  PlayIcon,
  SealCheckIcon,
  SnowflakeIcon,
  StarIcon,
  SunIcon,
} from "@/components/icons";
import { ICON_COUNT, ICONS_DESCRIPTION } from "@/lib/icons";

// nothing in the card varies by request, so it is drawn once at build, the way
// the blog and lab cards are through `generateStaticParams`
export const dynamic = "force-static";

/** a row of the set's most recognisable drawings, so the card shows the style */
const SHOWN = [
  HeartIcon,
  StarIcon,
  FlameIcon,
  SunIcon,
  CloudRainIcon,
  SnowflakeIcon,
  FolderIcon,
  GearIcon,
  PaletteIcon,
  CursorIcon,
  PlayIcon,
  SealCheckIcon,
  CherriesIcon,
  CrownIcon,
];

export async function GET(): Promise<Response> {
  return renderCard({
    title: "Icons",
    description: ICONS_DESCRIPTION,
    meta: [`${ICON_COUNT} icons`, "24 unit grid"],
    art: (
      <div
        style={{
          display: "flex",
          // 14 icons at 48 with 28 between is 1036, inside the 1040 the padding leaves
          gap: 28,
          marginTop: 64,
          color: "#1a1a1a",
        }}
      >
        {SHOWN.map((Icon) => (
          <Icon key={Icon.name} width={48} height={48} />
        ))}
      </div>
    ),
  });
}
