/** Nature and play: weather, fire, hearts and the card suits. Path data is on the 24 unit grid, see `../icon.tsx`. */
import { type IconProps, LINE, SOLID, Svg } from "../icon";

export function SunIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path
        d="M8.4 12A3.6 3.6 0 1 1 15.6 12A3.6 3.6 0 1 1 8.4 12Z"
        {...SOLID}
      />
      <path
        d="M19.3 12L20.85 12M17.16 17.16L18.26 18.26M12 19.3L12 20.85M6.84 17.16L5.74 18.26M4.7 12L3.15 12M6.84 6.84L5.74 5.74M12 4.7L12 3.15M17.16 6.84L18.26 5.74"
        {...LINE}
      />
    </Svg>
  );
}

export function CloudRainIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path
        d="M7.87 13.3L16.04 13.3A3.23 3.23 0 0 0 16.59 6.9A4.73 4.73 0 0 0 7.52 6.88A3.23 3.23 0 0 0 7.87 13.3Z"
        {...SOLID}
      />
      <path
        d="M8.75 17L7.75 20.25M12.75 17L11.75 20.25M16.75 17L15.75 20.25"
        {...LINE}
      />
    </Svg>
  );
}

export function CloudFogIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path
        d="M7.87 13.3L16.04 13.3A3.23 3.23 0 0 0 16.59 6.9A4.73 4.73 0 0 0 7.52 6.88A3.23 3.23 0 0 0 7.87 13.3Z"
        {...SOLID}
      />
      <path d="M5.25 17L14.75 17M9.25 20.5L18.75 20.5" {...LINE} />
    </Svg>
  );
}

export function CloudLightningIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path
        d="M7.87 13.3L16.04 13.3A3.23 3.23 0 0 0 16.59 6.9A4.73 4.73 0 0 0 7.52 6.88A3.23 3.23 0 0 0 7.87 13.3Z"
        {...SOLID}
      />
      <path
        d="M12.54 16.62L10.52 18.33A0.44 0.44 0 0 0 10.8 19.1L11.51 19.1A0.3 0.3 0 0 1 11.78 19.53L11.45 20.2A0.23 0.23 0 0 0 11.82 20.48L13.84 18.67A0.44 0.44 0 0 0 13.55 17.9L12.89 17.9A0.3 0.3 0 0 1 12.62 17.47L12.9 16.9A0.23 0.23 0 0 0 12.54 16.62Z"
        {...SOLID}
      />
    </Svg>
  );
}

export function SnowflakeIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path
        d="M12 3.25L12 20.75M14.2 4L12 6.5L9.8 4M9.8 20L12 17.5L14.2 20M19.58 7.63L4.42 16.38M20.03 9.91L16.76 9.25L17.83 6.09M3.97 14.09L7.24 14.75L6.17 17.91M19.58 16.38L4.42 7.62M17.83 17.91L16.76 14.75L20.03 14.09M6.17 6.09L7.24 9.25L3.97 9.91"
        {...LINE}
      />
    </Svg>
  );
}

export function HeartIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path
        d="M12 18.9C7.2 16.1 4.4 13.3 4.4 9.7A3.87 3.87 0 0 1 12 8.1A3.87 3.87 0 0 1 19.6 9.7C19.6 13.3 16.8 16.1 12 18.9Z"
        {...SOLID}
      />
    </Svg>
  );
}

export function HeartOutlineIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path
        d="M12 18.9C7.2 16.1 4.4 13.3 4.4 9.7A3.87 3.87 0 0 1 12 8.1A3.87 3.87 0 0 1 19.6 9.7C19.6 13.3 16.8 16.1 12 18.9Z"
        {...LINE}
      />
    </Svg>
  );
}

export function FlameIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path
        d="M11.6 19.77C8.4 19.77 5.73 17.63 5.73 14.17C5.73 11.9 6.67 10.17 7.73 8.83C8.13 10.7 8.93 12.03 10.27 12.7C10 9.23 11.07 6.17 13.33 4.17C14 7.37 15.87 8.97 17.07 10.7C17.87 11.9 18.27 13.23 18.27 14.57C18.27 17.9 15.47 19.77 11.6 19.77Z"
        {...SOLID}
      />
    </Svg>
  );
}

export function FlameOutlineIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path
        d="M11.6 19.77C8.4 19.77 5.73 17.63 5.73 14.17C5.73 11.9 6.67 10.17 7.73 8.83C8.13 10.7 8.93 12.03 10.27 12.7C10 9.23 11.07 6.17 13.33 4.17C14 7.37 15.87 8.97 17.07 10.7C17.87 11.9 18.27 13.23 18.27 14.57C18.27 17.9 15.47 19.77 11.6 19.77Z"
        {...LINE}
      />
    </Svg>
  );
}

export function StarIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path
        d="M13.28 6.09L14.41 8.64A0.75 0.75 0 0 0 15.02 9.08L17.8 9.37A1.4 1.4 0 0 1 18.59 11.81L16.51 13.67A0.75 0.75 0 0 0 16.28 14.39L16.86 17.11A1.4 1.4 0 0 1 14.79 18.62L12.38 17.22A0.75 0.75 0 0 0 11.62 17.22L9.21 18.62A1.4 1.4 0 0 1 7.14 17.11L7.72 14.39A0.75 0.75 0 0 0 7.49 13.67L5.41 11.81A1.4 1.4 0 0 1 6.2 9.37L8.98 9.08A0.75 0.75 0 0 0 9.59 8.64L10.72 6.09A1.4 1.4 0 0 1 13.28 6.09Z"
        {...SOLID}
      />
    </Svg>
  );
}

export function CloverIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path
        d="M8.4 7.4A3.6 3.6 0 1 1 15.6 7.4A3.6 3.6 0 1 1 8.4 7.4Z"
        {...SOLID}
      />
      <path d="M13 12A3.6 3.6 0 1 1 20.2 12A3.6 3.6 0 1 1 13 12Z" {...SOLID} />
      <path
        d="M8.4 16.6A3.6 3.6 0 1 1 15.6 16.6A3.6 3.6 0 1 1 8.4 16.6Z"
        {...SOLID}
      />
      <path d="M3.8 12A3.6 3.6 0 1 1 11 12A3.6 3.6 0 1 1 3.8 12Z" {...SOLID} />
    </Svg>
  );
}

export function CherriesIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path
        d="M4 16.75A3.5 3.5 0 1 1 11 16.75A3.5 3.5 0 1 1 4 16.75Z"
        {...SOLID}
      />
      <path
        d="M13 16.75A3.5 3.5 0 1 1 20 16.75A3.5 3.5 0 1 1 13 16.75Z"
        {...SOLID}
      />
      <path
        d="M7.75 12.75C8.25 8.75 10.5 5.75 14 4.25M16.25 12.75C15.75 9.25 15 6.5 14 4.25"
        {...LINE}
      />
    </Svg>
  );
}

export function CrownIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path
        d="M5.62 8.19L7.23 9.44A1.25 1.25 0 0 0 9.1 9.04L10.9 5.67A1.25 1.25 0 0 1 13.1 5.67L14.9 9.04A1.25 1.25 0 0 0 16.77 9.44L18.38 8.19A1.1 1.1 0 0 1 20.13 9.29L18.96 14.86A1.25 1.25 0 0 1 17.74 15.85L6.26 15.85A1.25 1.25 0 0 1 5.04 14.86L3.87 9.29A1.1 1.1 0 0 1 5.62 8.19Z"
        {...SOLID}
      />
      <path d="M6.25 18.85L17.75 18.85" {...LINE} />
    </Svg>
  );
}

export function DiamondIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path
        d="M13.89 4.94L18.59 10.36A2.5 2.5 0 0 1 18.59 13.64L13.89 19.06A2.5 2.5 0 0 1 10.11 19.06L5.41 13.64A2.5 2.5 0 0 1 5.41 10.36L10.11 4.94A2.5 2.5 0 0 1 13.89 4.94Z"
        {...SOLID}
      />
    </Svg>
  );
}
