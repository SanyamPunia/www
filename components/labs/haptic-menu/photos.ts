/**
 * The six photos in the album, drawn as CSS gradients rather than fetched,
 * since `/privacy` promises no image from another origin. Each is one scene
 * with one dominant tone, so a tile reads as a different picture at a glance.
 *
 * The hues are scoped to this experiment and are not tokens: a photo's
 * colours are the photo.
 */

export interface Photo {
  id: string;
  title: string;
  /** a CSS `background`, square, drawn to fill its box */
  art: string;
  favourite: boolean;
  /** quarter turns, cumulative, so a rotation always turns the same way */
  turns: number;
}

const ART: Omit<Photo, "favourite" | "turns">[] = [
  {
    id: "harbour",
    title: "Harbour at dusk",
    art: [
      "radial-gradient(circle at 68% 52%, #ffe3b0 0 8%, #ffcf8a66 9%, transparent 18%)",
      "repeating-linear-gradient(to bottom, transparent 0 7px, #ffffff14 7px 8px)",
      "linear-gradient(to bottom, #f6b07c 0%, #e98b7c 38%, #8c6a96 58%, #2f3d62 60%, #1c2742 100%)",
    ].join(", "),
  },
  {
    id: "lemons",
    title: "Lemon grove",
    art: [
      "radial-gradient(circle at 30% 34%, #f8dc52 0 10%, transparent 11%)",
      "radial-gradient(circle at 66% 52%, #f0c832 0 12%, transparent 13%)",
      "radial-gradient(circle at 42% 74%, #f8dc52 0 8%, transparent 9%)",
      "radial-gradient(circle at 80% 22%, #e9c12e 0 6%, transparent 7%)",
      "radial-gradient(120% 90% at 40% 30%, #7aa262, #2e5638)",
    ].join(", "),
  },
  {
    id: "glacier",
    title: "Glacier",
    art: [
      "linear-gradient(58deg, #7d9fb8 0 36%, transparent 36%)",
      "linear-gradient(-52deg, #5b819e 0 40%, transparent 40%)",
      "linear-gradient(to bottom, transparent 70%, #e8f1f6 70%)",
      "linear-gradient(to bottom, #b4d2e6, #e4eff6)",
    ].join(", "),
  },
  {
    id: "road",
    title: "Desert road",
    art: [
      "conic-gradient(from 166deg at 50% 46%, transparent 0deg, #4b4950 0deg 28deg, transparent 28deg)",
      "linear-gradient(to bottom, #f6dfb8 0 46%, #e2ad70 46%, #c98a4e 100%)",
    ].join(", "),
  },
  {
    id: "market",
    title: "Night market",
    art: [
      "radial-gradient(circle at 22% 30%, #ffb15c 0 5%, #ffb15c55 7%, transparent 13%)",
      "radial-gradient(circle at 58% 22%, #ff7a6b 0 4%, #ff7a6b55 6%, transparent 12%)",
      "radial-gradient(circle at 78% 46%, #ffd36b 0 6%, #ffd36b44 8%, transparent 15%)",
      "radial-gradient(circle at 38% 62%, #ff9d5c 0 4%, #ff9d5c44 6%, transparent 12%)",
      "radial-gradient(circle at 70% 78%, #ffc46b 0 3%, transparent 9%)",
      "linear-gradient(to bottom, #1d1a2e, #3d2342)",
    ].join(", "),
  },
  {
    id: "tidepool",
    title: "Tide pool",
    art: [
      "radial-gradient(circle at 76% 24%, #6f6b5f 0 13%, #4f4c44 14%, transparent 15%)",
      "radial-gradient(circle at 18% 82%, #8a8270 0 10%, transparent 11%)",
      "repeating-radial-gradient(circle at 44% 56%, #46aea6 0 6%, #2f8f8c 6% 12%)",
    ].join(", "),
  },
];

export function album(): Photo[] {
  return ART.map((p) => ({ ...p, favourite: p.id === "glacier", turns: 0 }));
}
