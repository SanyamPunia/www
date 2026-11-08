import { memo } from "react";
import { cn } from "@/lib/utils";
import { type Formula, pad, type Specimen } from "./specimens";

/*
 * One card, two faces, drawn once at its design size and never re-rendered by
 * the stack. The stack moves it with one `transform` and five custom
 * properties a frame: `--l` is how far it is lifted, `--dim` how far back in
 * the fan it is, and `--gx`, `--gy` and `--ga` place the glare.
 *
 * Every length inside is px at a 260 by 390 card, and the stack scales the
 * whole card to the stage. So the back sheet is laid out once and cannot
 * reflow or overflow at a small size, which is the standing `foil-card` gives
 * type printed on a drawn object.
 */

export const CARD = { w: 260, h: 390, r: 18 } as const;

/** a formula with its subscripts as real markup, keeping its casing */
function Chem({ f, className }: { f: Formula; className?: string }) {
  return (
    <span className={cn("normal-case", className)}>
      {f.map((p, i) =>
        typeof p === "string" ? (
          // biome-ignore lint/suspicious/noArrayIndexKey: a fixed formula never reorders
          <span key={i}>{p}</span>
        ) : (
          // biome-ignore lint/suspicious/noArrayIndexKey: a fixed formula never reorders
          <sub key={i} className="align-[-0.25em] text-[0.72em] leading-none">
            {p[0]}
          </sub>
        ),
      )}
    </span>
  );
}

/** ten segments, full up to the low end and half through the high end */
function Mohs({ range: [lo, hi] }: { range: Specimen["mohs"] }) {
  return (
    <span className="flex gap-[3px]">
      {Array.from({ length: 10 }, (_, k) => k + 1).map((k) => (
        <i
          key={k}
          className={cn(
            "block h-[6px] flex-1 rounded-[2px]",
            k <= Math.floor(lo)
              ? "bg-text-primary"
              : k <= Math.ceil(hi)
                ? "bg-text-primary/40"
                : "bg-stroke",
          )}
        />
      ))}
    </span>
  );
}

/** the lift a card casts, deeper as `--l` rises */
const LIFT =
  "inset 0 1px 0 rgb(255 255 255 / 0.5), 0 calc(8px + var(--l) * 36px) calc(24px + var(--l) * 60px) rgb(0 0 0 / calc(0.2 + var(--l) * 0.14)), 0 2px 4px rgb(0 0 0 / 0.14)";

const FACE =
  "absolute inset-0 overflow-hidden [backface-visibility:hidden] [-webkit-backface-visibility:hidden]";

export const Card = memo(function Card({
  s,
  index,
  inspected,
}: {
  s: Specimen;
  index: number;
  inspected: boolean;
}) {
  const no = `No. ${pad(index + 1)}`;
  return (
    <>
      <span
        className={cn(FACE, "bg-fill-active")}
        style={{ borderRadius: CARD.r, boxShadow: LIFT }}
      >
        {/* biome-ignore lint/performance/noImgElement: a 640px still already on disk, painted into a card a fraction of that, is not worth an image pipeline */}
        <img
          src={`/assets/specimen-stack/${s.img}.webp`}
          alt=""
          draggable={false}
          className="pointer-events-none absolute inset-0 block size-full select-none object-cover"
        />
        <span className="absolute top-[14px] right-[16px] font-mono text-[10px] text-text-secondary tracking-[0.04em]">
          {no}
        </span>
        <span className="absolute inset-x-[18px] bottom-[16px] flex flex-col text-left text-text-primary">
          <span className="font-medium text-[19px] leading-[1.1] tracking-[-0.02em]">
            {s.name}
          </span>
          <Chem
            f={s.formula}
            className="mt-[4px] font-mono text-[11px] text-text-secondary"
          />
        </span>
        {/* how far back in the fan this card is, as a fade toward the stage,
            since a card further off is closer to the ground behind it */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-fill"
          style={{ opacity: "var(--dim)" }}
        />
        <Glare />
        <Edge />
      </span>

      <span
        aria-hidden={!inspected}
        className={cn(
          FACE,
          "flex flex-col gap-[14px] bg-surface px-[18px] pt-[18px] pb-[16px] text-left text-text-primary",
        )}
        style={{
          borderRadius: CARD.r,
          boxShadow: LIFT,
          transform: "rotateY(180deg)",
        }}
      >
        <span className="flex items-center justify-between font-mono text-[10px] text-text-secondary tracking-[0.04em]">
          <span className="flex items-center gap-[6px]">
            {no}
            <span
              aria-hidden="true"
              className="inline-block size-[3px] rounded-full bg-stroke-strong"
            />
            Specimen
          </span>
          <span
            aria-hidden="true"
            className="size-[12px] rounded-full shadow-[inset_0_0_0_1px_rgb(0_0_0/0.15)]"
            style={{ background: s.hue }}
          />
        </span>
        <span className="flex flex-col">
          <span className="font-medium text-[26px] leading-none tracking-[-0.03em] text-balance">
            {s.name}
          </span>
          <Chem
            f={s.formula}
            className="mt-[6px] font-mono text-[12px] text-text-secondary"
          />
        </span>
        <span className="flex flex-col gap-[6px]">
          <span className="flex justify-between font-mono text-[10px] text-text-secondary tracking-[0.04em]">
            <span>Mohs hardness</span>
            <span className="font-medium text-text-primary">
              {s.mohs[0] === s.mohs[1]
                ? s.mohs[0]
                : `${s.mohs[0]}–${s.mohs[1]}`}
            </span>
          </span>
          <Mohs range={s.mohs} />
        </span>
        <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-[14px] gap-y-[7px] border-stroke border-t pt-[12px] text-[12px]">
          <dt className="text-text-secondary">System</dt>
          <dd className="m-0 text-right font-medium normal-case">{s.system}</dd>
          <dt className="text-text-secondary">Luster</dt>
          <dd className="m-0 text-right font-medium normal-case">{s.luster}</dd>
          <dt className="text-text-secondary">Density</dt>
          <dd className="m-0 text-right font-medium font-mono normal-case">
            {s.sg} g/cm³
          </dd>
          <dt className="text-text-secondary">Locality</dt>
          <dd className="m-0 text-right font-medium normal-case">
            {s.locality}
          </dd>
        </dl>
        {/* the specimen again, close up, since the back is where it is studied */}
        <span
          aria-hidden="true"
          className="min-h-[40px] flex-1 shadow-[inset_0_0_0_1px_rgb(0_0_0/0.06)]"
          style={{
            borderRadius: CARD.r * 0.55,
            backgroundImage: `url(/assets/specimen-stack/${s.img}.webp)`,
            backgroundSize: "260%",
            backgroundPosition: "50% 58%",
          }}
        />
        <span className="mt-auto text-[12.5px] text-text-secondary leading-[1.45] text-pretty">
          {s.note}
        </span>
        <Glare back />
        <Edge />
      </span>
    </>
  );
});

/** a hairline of light inside the edge, and a little weight at the foot */
function Edge() {
  return (
    <span
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 rounded-[inherit]"
      style={{
        boxShadow:
          "inset 0 0 0 1px rgb(255 255 255 / 0.35), inset 0 -40px 60px -40px rgb(0 0 0 / 0.12)",
      }}
    />
  );
}

/** a light that follows the tilt, mirrored on the back since it faces away */
function Glare({ back = false }: { back?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute inset-0 rounded-[inherit]",
        back ? "mix-blend-soft-light" : "mix-blend-overlay",
      )}
      style={{
        opacity: "var(--ga)",
        background: back
          ? "radial-gradient(circle at calc(100% - var(--gx) * 1%) calc(var(--gy) * 1%), rgb(255 255 255 / 0.8) 0%, rgb(255 255 255 / 0) 50%)"
          : "radial-gradient(circle at calc(var(--gx) * 1%) calc(var(--gy) * 1%), rgb(255 255 255 / 0.7) 0%, rgb(255 255 255 / 0) 52%), linear-gradient(calc(110deg + var(--gx) * 0.6deg), rgb(255 255 255 / 0) 35%, rgb(255 255 255 / 0.22) 50%, rgb(255 255 255 / 0) 65%)",
      }}
    />
  );
}
