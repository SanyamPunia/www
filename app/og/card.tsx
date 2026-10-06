import { readFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";

// Satori reads static TTF or OTF only, so these are vendored rather than taken
// from `next/font`, which ships variable woff2.
const ASSETS = path.join(process.cwd(), "app", "og", "_assets");

export interface Card {
  title: string;
  description: string;
  /** Quiet facts under the description, joined by a dot. */
  meta: readonly string[];
}

/**
 * The one social card every generated route renders: the site's URL, then the
 * title, description and meta over the shared background. Routes differ only
 * in where the three come from.
 */
export async function renderCard({
  title,
  description,
  meta,
}: Card): Promise<ImageResponse> {
  const [background, regular, medium] = await Promise.all([
    readFile(path.join(ASSETS, "background.png")),
    readFile(path.join(ASSETS, "Inter-Regular.ttf")),
    readFile(path.join(ASSETS, "Inter-Medium.ttf")),
  ]);

  // Past about two lines at 60px a long title pushes the description into the
  // gradient, so it steps down a size rather than clipping.
  const titleSize = title.length > 44 ? 52 : 60;

  return new ImageResponse(
    <div
      style={{
        position: "relative",
        display: "flex",
        flexDirection: "column",
        width: "100%",
        height: "100%",
        // the bottom padding stops the text block where the gradient starts
        padding: "64px 80px 128px",
        fontFamily: "Inter",
        textTransform: "lowercase",
      }}
    >
      {/* biome-ignore lint/performance/noImgElement: Satori renders plain markup, next/image does not exist here */}
      <img
        alt=""
        src={`data:image/png;base64,${background.toString("base64")}`}
        width={1200}
        height={630}
        style={{ position: "absolute", top: 0, left: 0 }}
      />
      <div style={{ display: "flex", fontSize: 24, color: "#9b9b9b" }}>
        sanyam.sh
      </div>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          marginTop: "auto",
          maxWidth: 960,
        }}
      >
        <div
          style={{
            fontSize: titleSize,
            fontWeight: 500,
            lineHeight: 1.1,
            letterSpacing: "-0.025em",
            color: "#1a1a1a",
            textWrap: "balance",
          }}
        >
          {title}
        </div>
        <div
          style={{
            display: "block",
            marginTop: 22,
            maxWidth: 880,
            fontSize: 25,
            lineHeight: 1.5,
            color: "#6b6b6b",
            lineClamp: 2,
          }}
        >
          {description}
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            marginTop: 28,
            fontSize: 22,
            color: "#9b9b9b",
          }}
        >
          {meta.flatMap((item, index) => [
            ...(index > 0
              ? [
                  <span
                    key={`dot-${item}`}
                    style={{
                      width: 5,
                      height: 5,
                      borderRadius: 999,
                      backgroundColor: "#dcdcdc",
                    }}
                  />,
                ]
              : []),
            // Satori lays out a Fragment's children wrongly in a flex row, so
            // the separators and items are one flat list.
            <span key={item}>{item}</span>,
          ])}
        </div>
      </div>
    </div>,
    {
      width: 1200,
      height: 630,
      fonts: [
        { name: "Inter", data: regular, weight: 400, style: "normal" },
        { name: "Inter", data: medium, weight: 500, style: "normal" },
      ],
    },
  );
}
