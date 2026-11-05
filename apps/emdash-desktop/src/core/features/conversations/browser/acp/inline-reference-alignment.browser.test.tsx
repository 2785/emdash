import { ChatComposer, PromptEditorModel } from '@emdash/ui/react/components';
import '@emdash/ui/style.css';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';

beforeAll(() => {
  (
    globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
});

describe('inline [Image N] references in the composer', () => {
  let host: HTMLDivElement;
  let root: Root;

  afterEach(async () => {
    await act(async () => root.unmount());
    host.remove();
  });

  it('read as part of the sentence instead of a box floating on the line', async () => {
    host = document.createElement('div');
    host.style.width = '600px';
    document.body.appendChild(host);
    root = createRoot(host);
    await act(async () =>
      root.render(
        <ChatComposer
          model={
            new PromptEditorModel({
              text: 'thing thing [Image 1] screenshot thing',
              mentions: [
                {
                  id: 'img-1',
                  label: 'Image 1',
                  name: 'Image 1',
                  kind: 'custom',
                  compact: true,
                  serializedText: '[Image 1]',
                },
              ],
            })
          }
          onSubmit={() => {}}
        />
      )
    );

    await expect.poll(() => host.querySelector('[data-mention-id="img-1"]')).toBeTruthy();
    const pill = host.querySelector<HTMLElement>('[data-mention-id="img-1"]')!;
    const textNode = Array.from(host.querySelectorAll('p'))
      .flatMap((p) => Array.from(p.childNodes))
      .find((node) => node.nodeType === Node.TEXT_NODE && node.textContent?.includes('thing'))!;
    const range = document.createRange();
    range.selectNodeContents(textNode);
    const text = range.getBoundingClientRect();
    const box = pill.getBoundingClientRect();

    // Same type as the sentence it sits in, centered on the same line.
    expect(getComputedStyle(pill).fontSize).toBe(getComputedStyle(pill.closest('p')!).fontSize);
    const center = (rect: DOMRect) => rect.top + rect.height / 2;
    expect(Math.abs(center(box) - center(text))).toBeLessThan(2);
  });
});
