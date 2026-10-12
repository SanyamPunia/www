/** Marks: checks, crosses, badges and the small signs. Path data is on the 24 unit grid, see `../icon.tsx`. */
import { type IconProps, Line, Solid, Svg } from "../icon";

export function CheckIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <Line d="M4.75 12.75L9.5 17.25L19.25 6.75" />
    </Svg>
  );
}

export function XIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <Line d="M6 6L18 18M18 6L6 18" />
    </Svg>
  );
}

export function PlusIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <Line d="M12 5L12 19M5 12L19 12" />
    </Svg>
  );
}

export function MinusIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <Line d="M5 12L19 12" />
    </Svg>
  );
}

export function CircleIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <Line d="M3.13 12A8.88 8.88 0 1 1 20.88 12A8.88 8.88 0 1 1 3.13 12Z" />
    </Svg>
  );
}

export function CheckCircleIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <Solid d="M3 12A9 9 0 1 1 21 12A9 9 0 1 1 3 12ZM9.23 10.72L10.56 12.01L14.73 7.76A2.13 2.13 0 0 1 17.77 10.74L12.12 16.49A2.13 2.13 0 0 1 9.12 16.53L6.27 13.78A2.13 2.13 0 0 1 9.23 10.72Z" />
    </Svg>
  );
}

export function XCircleIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <Solid d="M3 12A9 9 0 1 1 21 12A9 9 0 1 1 3 12ZM15.01 12L15.91 12.9A2.13 2.13 0 0 1 12.9 15.91L12 15.01L11.1 15.91A2.13 2.13 0 0 1 8.09 12.9L8.99 12L8.09 11.1A2.13 2.13 0 0 1 11.1 8.09L12 8.99L12.9 8.09A2.13 2.13 0 0 1 15.91 11.1Z" />
    </Svg>
  );
}

export function CircleNotchIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <Line d="M12 3.13A8.88 8.88 0 1 1 3.13 12" />
    </Svg>
  );
}

export function InfoIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <Solid d="M3 12A9 9 0 1 1 21 12A9 9 0 1 1 3 12ZM9.6 7.4A2.4 2.4 0 1 1 14.4 7.4A2.4 2.4 0 1 1 9.6 7.4ZM14.13 11.6L14.13 16.6A2.13 2.13 0 0 1 9.88 16.6L9.88 11.6A2.13 2.13 0 0 1 14.13 11.6Z" />
    </Svg>
  );
}

export function WarningIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <Solid d="M13.97 5.97L19.2 15.44A2.5 2.5 0 0 1 17.01 19.15L6.99 19.15A2.5 2.5 0 0 1 4.8 15.44L10.03 5.97A2.25 2.25 0 0 1 13.97 5.97ZM14.13 8.65L14.13 11.9A2.13 2.13 0 0 1 9.88 11.9L9.88 8.65A2.13 2.13 0 0 1 14.13 8.65ZM9.75 15.8A2.25 2.25 0 1 1 14.25 15.8A2.25 2.25 0 1 1 9.75 15.8Z" />
    </Svg>
  );
}

export function SealCheckIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <Solid d="M12.9 3.5L13.93 4.36A1.4 1.4 0 0 0 14.92 4.69L16.27 4.6A1.4 1.4 0 0 1 17.72 5.65L18.05 6.96A1.4 1.4 0 0 0 18.66 7.8L19.81 8.52A1.4 1.4 0 0 1 20.36 10.23L19.86 11.48A1.4 1.4 0 0 0 19.86 12.52L20.36 13.77A1.4 1.4 0 0 1 19.81 15.48L18.66 16.2A1.4 1.4 0 0 0 18.05 17.04L17.72 18.35A1.4 1.4 0 0 1 16.27 19.4L14.92 19.31A1.4 1.4 0 0 0 13.93 19.64L12.9 20.5A1.4 1.4 0 0 1 11.1 20.5L10.07 19.64A1.4 1.4 0 0 0 9.08 19.31L7.73 19.4A1.4 1.4 0 0 1 6.28 18.35L5.95 17.04A1.4 1.4 0 0 0 5.34 16.2L4.19 15.48A1.4 1.4 0 0 1 3.64 13.77L4.14 12.52A1.4 1.4 0 0 0 4.14 11.48L3.64 10.23A1.4 1.4 0 0 1 4.19 8.52L5.34 7.8A1.4 1.4 0 0 0 5.95 6.96L6.28 5.65A1.4 1.4 0 0 1 7.73 4.6L9.08 4.69A1.4 1.4 0 0 0 10.07 4.36L11.1 3.5A1.4 1.4 0 0 1 12.9 3.5ZM9.47 10.72L10.65 11.85L14.48 7.92A2.13 2.13 0 0 1 17.52 10.88L12.22 16.33A2.13 2.13 0 0 1 9.23 16.38L6.53 13.78A2.13 2.13 0 0 1 9.47 10.72Z" />
    </Svg>
  );
}

export function HashIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <Line d="M4.75 9L19.25 9M4.75 15L19.25 15M10.25 4.5L8.75 19.5M15.25 4.5L13.75 19.5" />
    </Svg>
  );
}

export function DotsThreeIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <Solid d="M3.9 12A1.1 1.1 0 1 1 6.1 12A1.1 1.1 0 1 1 3.9 12Z" />
      <Solid d="M10.9 12A1.1 1.1 0 1 1 13.1 12A1.1 1.1 0 1 1 10.9 12Z" />
      <Solid d="M17.9 12A1.1 1.1 0 1 1 20.1 12A1.1 1.1 0 1 1 17.9 12Z" />
    </Svg>
  );
}
