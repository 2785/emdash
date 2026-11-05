import { afterEach, describe, expect, it } from 'vitest';
import { frameTintCss } from '@core/primitives/theme/api/frame-tint';

const rgb = (hex: string) => {
  const n = Number.parseInt(hex.slice(1), 16);
  return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`;
};

describe('window frame tint', () => {
  const root = document.documentElement;
  const cleanup: (() => void)[] = [];

  afterEach(() => {
    while (cleanup.length) cleanup.pop()!();
  });

  function mount(theme: 'emdark' | 'emlight', tint: string | null) {
    const style = document.createElement('style');
    // Theme tokens as the app defines them on <html>, plus the frame tint rules.
    style.textContent = `
      html.${theme} { --background-secondary: #777777; --em-surface: #777777; --em-foreground: #eeeeee; }
      ${frameTintCss()}`;
    document.head.append(style);
    root.classList.add(theme);
    if (tint) root.setAttribute('data-frame-tint', tint);

    const frame = document.createElement('header');
    frame.className = 'frame-tinted surface-sunken';
    frame.style.backgroundColor = 'var(--background-secondary)';
    const sidebarItem = document.createElement('div');
    sidebarItem.style.backgroundColor = 'var(--em-surface)';
    frame.append(sidebarItem);
    const content = document.createElement('main');
    content.style.backgroundColor = 'var(--background-secondary)';
    document.body.append(frame, content);

    cleanup.push(() => {
      style.remove();
      frame.remove();
      content.remove();
      root.classList.remove(theme);
      root.removeAttribute('data-frame-tint');
    });
    return { frame, sidebarItem, content };
  }

  const bg = (el: Element) => getComputedStyle(el).backgroundColor;

  it('tints the frame with the dark variant in dark mode, leaving content alone', () => {
    const { frame, sidebarItem, content } = mount('emdark', 'green');

    expect(bg(frame)).toBe(rgb('#1d3a28'));
    expect(bg(sidebarItem)).toBe(rgb('#1d3a28'));
    expect(bg(content)).toBe(rgb('#777777'));
  });

  it('uses the bright variant in light mode', () => {
    const { frame } = mount('emlight', 'green');

    expect(bg(frame)).toBe(rgb('#c4efcf'));
  });

  it('keeps the theme colours when no tint is chosen', () => {
    const { frame } = mount('emdark', null);

    expect(bg(frame)).toBe(rgb('#777777'));
  });
});
