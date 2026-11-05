/** @vitest-environment jsdom */
import { act, cleanup, render } from '@testing-library/react';
import type { Editor } from '@tiptap/core';
import { afterEach, describe, expect, it } from 'vitest';
import { PromptEditor } from './prompt-editor';
import { isSnippetPaste, PromptEditorModel, snippetMention } from './prompt-editor-model';
import { serializeDoc } from './serialize';

afterEach(cleanup);

const longText = Array.from({ length: 12 }, (_, i) => `line ${i + 1}`).join('\n');

describe('snippet pastes', () => {
  it('treats long pastes as snippets and short ones as plain text', () => {
    expect(isSnippetPaste(longText)).toBe(true);
    expect(isSnippetPaste('x'.repeat(1000))).toBe(true);
    expect(isSnippetPaste('a short line')).toBe(false);
  });

  it('sends the label followed by the full text in a fence that outlasts any inside it', () => {
    const mention = snippetMention('before\n```js\ncode\n```\nafter\n', 2);
    expect(mention.name).toBe('Snippet 2');
    expect(mention.serializedText).toBe(
      '[Snippet 2]\n````\nbefore\n```js\ncode\n```\nafter\n````\n'
    );
  });

  it('collapses a long paste into a numbered pill that serializes to the full text', () => {
    const model = new PromptEditorModel({ text: '' });
    const result = render(<PromptEditor model={model} />);
    const editor = (
      result.container.querySelector('[data-testid="prompt-editor"]') as HTMLElement & {
        editor: Editor;
      }
    ).editor;
    const paste = (text: string) =>
      act(() => {
        const clipboardData = {
          files: [] as unknown as FileList,
          getData: (type: string) => (type === 'text/plain' ? text : ''),
        };
        const event = Object.assign(new Event('paste', { cancelable: true }), { clipboardData });
        editor.view.someProp('handlePaste', (handle) =>
          handle(editor.view, event as ClipboardEvent, editor.state.doc.slice(0, 0))
        );
      });

    act(() => editor.commands.insertContent('see '));
    paste(longText);
    paste(longText);

    const pills = [...result.container.querySelectorAll('[data-mention-id^="snippet:"]')].map(
      (pill) => pill.textContent
    );
    expect(pills.join(' ')).toContain('Snippet 1');
    expect(pills.join(' ')).toContain('Snippet 2');
    // Compact boxes: just the name, no icon or remove button.
    expect(result.container.querySelectorAll('[data-mention-id^="snippet:"] button')).toHaveLength(
      0
    );
    const sent = serializeDoc(editor.state.doc);
    expect(sent.startsWith('see [Snippet 1]\n```\nline 1\n')).toBe(true);
    expect(sent).toContain('[Snippet 2]\n```\nline 1\n');
  });
});
