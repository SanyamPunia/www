/** Media: the transport and the speaker. Path data is on the 24 unit grid, see `../icon.tsx`. */
import { type IconProps, Line, Solid, Svg } from "../icon";

export function PlayIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <Solid d="M11.15 6.83L16.81 10.29A2 2 0 0 1 16.81 13.71L11.15 17.17A2.4 2.4 0 0 1 7.5 15.12L7.5 8.88A2.4 2.4 0 0 1 11.15 6.83Z" />
    </Svg>
  );
}

export function PauseIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <Solid d="M7.75 5L8.25 5A1.5 1.5 0 0 1 9.75 6.5L9.75 17.5A1.5 1.5 0 0 1 8.25 19L7.75 19A1.5 1.5 0 0 1 6.25 17.5L6.25 6.5A1.5 1.5 0 0 1 7.75 5Z" />
      <Solid d="M15.75 5L16.25 5A1.5 1.5 0 0 1 17.75 6.5L17.75 17.5A1.5 1.5 0 0 1 16.25 19L15.75 19A1.5 1.5 0 0 1 14.25 17.5L14.25 6.5A1.5 1.5 0 0 1 15.75 5Z" />
    </Svg>
  );
}

export function StopIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <Solid d="M8.5 5.75L15.5 5.75A2.75 2.75 0 0 1 18.25 8.5L18.25 15.5A2.75 2.75 0 0 1 15.5 18.25L8.5 18.25A2.75 2.75 0 0 1 5.75 15.5L5.75 8.5A2.75 2.75 0 0 1 8.5 5.75Z" />
    </Svg>
  );
}

export function SpeakerHighIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <Solid d="M4.5 9L6.53 9A0.6 0.6 0 0 0 6.92 8.85L9.68 6.47A1.1 1.1 0 0 1 11.5 7.3L11.5 16.7A1.1 1.1 0 0 1 9.68 17.53L6.92 15.15A0.6 0.6 0 0 0 6.53 15L4.5 15A1.25 1.25 0 0 1 3.25 13.75L3.25 10.25A1.25 1.25 0 0 1 4.5 9Z" />
      <Line d="M14.47 9.32A4 4 0 0 1 14.47 14.68M17.43 6.27A8.25 8.25 0 0 1 17.43 17.73" />
    </Svg>
  );
}

export function SpeakerSlashIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <Solid d="M4.5 9L6.53 9A0.6 0.6 0 0 0 6.92 8.85L9.68 6.47A1.1 1.1 0 0 1 11.5 7.3L11.5 16.7A1.1 1.1 0 0 1 9.68 17.53L6.92 15.15A0.6 0.6 0 0 0 6.53 15L4.5 15A1.25 1.25 0 0 1 3.25 13.75L3.25 10.25A1.25 1.25 0 0 1 4.5 9Z" />
      <Line d="M15.5 9.5L20.5 14.5M20.5 9.5L15.5 14.5" />
    </Svg>
  );
}
