import type { AcpPromptAttachment } from './acp-chat-store';

/**
 * Names new images "Image N", continuing after the draft's highest number so labels stay
 * unique when images are removed. The prompt refers to them as "[Image N]".
 */
export function labelImageAttachments(
  existing: readonly AcpPromptAttachment[],
  added: readonly AcpPromptAttachment[]
): AcpPromptAttachment[] {
  let last = Math.max(
    0,
    ...existing.map(({ ref }) => Number(/^Image (\d+)$/.exec(ref.name ?? '')?.[1] ?? 0))
  );
  return added.map((attachment) => ({
    ...attachment,
    ref: { ...attachment.ref, name: `Image ${++last}` },
  }));
}
