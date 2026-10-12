/** Arrows, carets and the controls that point somewhere. Path data is on the 24 unit grid, see `../icon.tsx`. */
import { type IconProps, LINE, Svg } from "../icon";

export function ArrowRightIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4.75 12L19.25 12M14.83 7.58L19.25 12L14.83 16.42" {...LINE} />
    </Svg>
  );
}

export function ArrowLeftIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M19.25 12L4.75 12M9.17 16.42L4.75 12L9.17 7.58" {...LINE} />
    </Svg>
  );
}

export function ArrowUpIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 19.25L12 4.75M7.58 9.17L12 4.75L16.42 9.17" {...LINE} />
    </Svg>
  );
}

export function ArrowDownIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 4.75L12 19.25M16.42 14.83L12 19.25L7.58 14.83" {...LINE} />
    </Svg>
  );
}

export function ArrowUpRightIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path
        d="M6.25 17.75L17.75 6.25M8.5 6.25L17.75 6.25L17.75 15.5"
        {...LINE}
      />
    </Svg>
  );
}

export function ArrowSquareOutIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path
        d="M10.75 4.75H7.25A2.5 2.5 0 0 0 4.75 7.25V16.75A2.5 2.5 0 0 0 7.25 19.25H16.75A2.5 2.5 0 0 0 19.25 16.75V13.25M11.5 12.5L19.25 4.75M13.75 4.75L19.25 4.75L19.25 10.25"
        {...LINE}
      />
    </Svg>
  );
}

export function ArrowUUpLeftIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path
        d="M4.75 8.75H14.25A5.25 5.25 0 0 1 14.25 19.25H10.5M8.5 5L4.75 8.75L8.5 12.5"
        {...LINE}
      />
    </Svg>
  );
}

export function ArrowsClockwiseIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path
        d="M4.25 12A7.75 7.75 0 0 1 17.48 6.52L19.75 8.75M19.75 4.25L19.75 8.75L15.25 8.75M19.75 12A7.75 7.75 0 0 1 6.52 17.48L4.25 15.25M4.25 19.75L4.25 15.25L8.75 15.25"
        {...LINE}
      />
    </Svg>
  );
}

export function ArrowCounterClockwiseIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path
        d="M4.25 12A7.75 7.75 0 1 0 6.52 6.52L4.25 8.75M4.25 4.25L4.25 8.75L8.75 8.75"
        {...LINE}
      />
    </Svg>
  );
}

export function ArrowsLeftRightIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path
        d="M4.75 7.75L19.25 7.75M15.5 4L19.25 7.75L15.5 11.5M19.25 16.25L4.75 16.25M8.5 12.5L4.75 16.25L8.5 20"
        {...LINE}
      />
    </Svg>
  );
}

export function ArrowsHorizontalIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path
        d="M3.75 12L20.25 12M7.75 8L3.75 12L7.75 16M16.25 8L20.25 12L16.25 16"
        {...LINE}
      />
    </Svg>
  );
}

export function ArrowsOutLineHorizontalIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path
        d="M12 4.5L12 19.5M8.25 12L3.75 12M6.22 14.47L3.75 12L6.22 9.53M15.75 12L20.25 12M17.78 9.53L20.25 12L17.78 14.47"
        {...LINE}
      />
    </Svg>
  );
}

export function ArrowsOutLineVerticalIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path
        d="M4.5 12L19.5 12M12 8.25L12 3.75M9.53 6.22L12 3.75L14.47 6.22M12 15.75L12 20.25M14.47 17.78L12 20.25L9.53 17.78"
        {...LINE}
      />
    </Svg>
  );
}

export function CaretDownIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M6 9L12 15L18 9" {...LINE} />
    </Svg>
  );
}

export function CaretUpIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M6 15L12 9L18 15" {...LINE} />
    </Svg>
  );
}

export function CaretLeftIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M15 6L9 12L15 18" {...LINE} />
    </Svg>
  );
}

export function CaretRightIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M9 6L15 12L9 18" {...LINE} />
    </Svg>
  );
}

export function CornersInIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path
        d="M4.25 9.25L9.25 9.25L9.25 4.25M19.75 9.25L14.75 9.25L14.75 4.25M4.25 14.75L9.25 14.75L9.25 19.75M19.75 14.75L14.75 14.75L14.75 19.75"
        {...LINE}
      />
    </Svg>
  );
}

export function SignOutIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path
        d="M10.25 4.75H7A2.5 2.5 0 0 0 4.5 7.25V16.75A2.5 2.5 0 0 0 7 19.25H10.25M10.5 12L19.5 12M16.14 8.64L19.5 12L16.14 15.36"
        {...LINE}
      />
    </Svg>
  );
}

export function ShuffleIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path
        d="M3.75 7.5H6.5C10.25 7.5 11.5 16.5 15.5 16.5H19.75M3.75 16.5H6.5C10.25 16.5 11.5 7.5 15.5 7.5H19.75M16.75 4.5L19.75 7.5L16.75 10.5M16.75 13.5L19.75 16.5L16.75 19.5"
        {...LINE}
      />
    </Svg>
  );
}

export function DownloadSimpleIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path
        d="M12 4.25L12 14.25M15.18 11.07L12 14.25L8.82 11.07M4.5 14.75V17A2.25 2.25 0 0 0 6.75 19.25H17.25A2.25 2.25 0 0 0 19.5 17V14.75"
        {...LINE}
      />
    </Svg>
  );
}
