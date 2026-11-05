import { describe, expect, it, vi } from 'vitest';
import type { AcpPromptAttachment } from './acp-chat-store';
import { labelImageAttachments } from './acp-image-labels';

vi.mock('./acp-chat-store', () => ({}));

const image = (id: string, name?: string): AcpPromptAttachment => ({
  ref: { type: 'attachment', id, name, mimeType: 'image/png' },
});

describe('labelImageAttachments', () => {
  it('numbers new images after the ones already in the draft', () => {
    const labelled = labelImageAttachments(
      [image('a', 'Image 1'), image('b', 'Image 3')],
      [image('c', 'Screenshot 2026.png'), image('d')]
    );
    expect(labelled.map(({ ref }) => ref.name)).toEqual(['Image 4', 'Image 5']);
    expect(labelled.map(({ ref }) => ref.id)).toEqual(['c', 'd']);
  });

  it('starts at Image 1 for a draft without images', () => {
    expect(labelImageAttachments([], [image('a', 'paste.png')])[0]?.ref.name).toBe('Image 1');
  });
});
