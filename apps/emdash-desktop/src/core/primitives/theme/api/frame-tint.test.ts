import { describe, expect, it } from 'vitest';
import { FRAME_TINTS, frameTintCss, frameTintSwatch } from './frame-tint';

describe('frameTintCss', () => {
  const css = frameTintCss();

  it('gives every tint a dark and a light colour keyed off the theme class', () => {
    for (const { id, dark, light } of FRAME_TINTS) {
      expect(css).toContain(`html.emdark[data-frame-tint='${id}'] { --frame-tint: ${dark}; }`);
      expect(css).toContain(`html.emlight[data-frame-tint='${id}'] { --frame-tint: ${light}; }`);
      expect(dark).not.toBe(light);
    }
  });

  it('rebinds the frame background and surface tokens only inside tinted frame elements', () => {
    const frameRule = css.slice(css.indexOf('html[data-frame-tint] .frame-tinted {'));
    for (const token of [
      '--background',
      '--background-secondary',
      '--background-tertiary-2',
      '--em-background',
      '--em-background-secondary',
      '--em-surface',
      '--em-surface-sunken',
      '--em-surface-sunken-hover',
      '--em-background-tertiary-2',
    ]) {
      expect(frameRule).toContain(`${token}:`);
    }
    expect(frameRule).not.toMatch(/--(em-)?foreground:/);
  });
});

describe('frameTintSwatch', () => {
  it('uses the darker variant in dark mode and the brighter one in light mode', () => {
    expect(frameTintSwatch('green', 'dark')).toBe('#1d3a28');
    expect(frameTintSwatch('green', 'light')).toBe('#c4efcf');
  });
});
