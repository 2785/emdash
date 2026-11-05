/**
 * Window frame tints: colour the title bars and left sidebar (like Chrome's window colours) so a
 * window is easy to spot, while the rest of the UI keeps the light/dark theme. Each tint has a
 * deep variant for dark mode and a bright one for light mode.
 */
export const FRAME_TINTS = [
  { id: 'green', label: 'Green', dark: '#1d3a28', light: '#c4efcf' },
  { id: 'teal', label: 'Teal', dark: '#163a3c', light: '#bdecea' },
  { id: 'blue', label: 'Blue', dark: '#1b2d4b', light: '#cadcff' },
  { id: 'purple', label: 'Purple', dark: '#2c2250', light: '#ddd2ff' },
  { id: 'pink', label: 'Pink', dark: '#451f39', light: '#ffd0e8' },
  { id: 'red', label: 'Red', dark: '#481e1e', light: '#ffcfc9' },
  { id: 'orange', label: 'Orange', dark: '#482b15', light: '#ffd9b8' },
  { id: 'yellow', label: 'Yellow', dark: '#3d3515', light: '#fbeeaa' },
] as const;

export type FrameTintId = (typeof FRAME_TINTS)[number]['id'];
export type FrameTint = FrameTintId | 'none';

export const FRAME_TINT_IDS = FRAME_TINTS.map((tint) => tint.id) as [FrameTintId, ...FrameTintId[]];

/** Class marking the window frame: title bars and the left sidebar. */
export const FRAME_TINTED_CLASS = 'frame-tinted';

/** Attribute on <html> naming the active tint; absent when the frame isn't tinted. */
export const FRAME_TINT_ATTRIBUTE = 'data-frame-tint';

const mix = (pct: number) => `color-mix(in oklch, var(--frame-tint), var(--em-foreground) ${pct}%)`;

/**
 * CSS for all tints. Inside the frame, the background and surface tokens it draws from (and the
 * hover/selected states derived from them) are rebound to the tint, so existing components pick
 * it up without changes. Text keeps the theme's foreground, which reads on both variants.
 */
export function frameTintCss(): string {
  const palette = FRAME_TINTS.flatMap(({ id, dark, light }) => [
    `html.emdark[${FRAME_TINT_ATTRIBUTE}='${id}'] { --frame-tint: ${dark}; }`,
    `html.emlight[${FRAME_TINT_ATTRIBUTE}='${id}'] { --frame-tint: ${light}; }`,
  ]);
  // The app's Tailwind classes read the unprefixed tokens; @emdash/ui components read --em-*.
  const backgrounds = ['', 'em-'].flatMap((prefix) => [
    `--${prefix}background: var(--frame-tint);`,
    `--${prefix}background-secondary: var(--frame-tint);`,
    `--${prefix}background-tertiary: var(--frame-tint);`,
    `--${prefix}background-tertiary-1: ${mix(5)};`,
    `--${prefix}background-tertiary-2: ${mix(9)};`,
    `--${prefix}background-tertiary-3: ${mix(14)};`,
  ]);
  const surfaces = [
    `--em-surface: var(--frame-tint);`,
    `--em-surface-hover: ${mix(7)};`,
    `--em-surface-selected: ${mix(12)};`,
    `--em-surface-sunken: var(--frame-tint);`,
    `--em-surface-sunken-hover: ${mix(7)};`,
    `--em-surface-sunken-selected: ${mix(12)};`,
  ];
  const frame = `html[${FRAME_TINT_ATTRIBUTE}] .${FRAME_TINTED_CLASS} {\n  ${[...backgrounds, ...surfaces].join('\n  ')}\n}`;
  return [...palette, frame].join('\n');
}

export function frameTintSwatch(id: FrameTintId, mode: 'dark' | 'light'): string {
  const tint = FRAME_TINTS.find((candidate) => candidate.id === id);
  if (!tint) throw new Error(`Unknown frame tint '${id}'`);
  return tint[mode];
}
