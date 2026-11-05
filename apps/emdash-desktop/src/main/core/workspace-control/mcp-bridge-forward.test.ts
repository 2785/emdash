import { describe, expect, it, vi } from 'vitest';
import { forwardMessage } from './mcp-bridge-forward';

const endpoint = async () => ({ url: 'http://127.0.0.1:9/mcp', token: 'secret' });

describe('mcp bridge forwarding', () => {
  it('posts the message with the token and caller, and relays the reply', async () => {
    const fetch = vi.fn(
      async () => new Response(JSON.stringify({ jsonrpc: '2.0', id: 1, result: { ok: true } }))
    );

    const replies = await forwardMessage(
      '{"jsonrpc":"2.0","id":1,"method":"tools/list"}',
      endpoint,
      {
        conversationId: 'conv-1',
        fetch: fetch as never,
      }
    );

    expect(replies).toEqual(['{"jsonrpc":"2.0","id":1,"result":{"ok":true}}']);
    expect(fetch).toHaveBeenCalledWith(
      'http://127.0.0.1:9/mcp',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          authorization: 'Bearer secret',
          'x-emjosh-conversation': 'conv-1',
        }),
      })
    );
  });

  it('answers requests with an error when Emjosh is not running, and drops notifications', async () => {
    const notRunning = async () => null;

    expect(
      await forwardMessage('{"jsonrpc":"2.0","id":7,"method":"tools/list"}', notRunning)
    ).toEqual([
      '{"jsonrpc":"2.0","id":7,"error":{"code":-32000,"message":"Emjosh is not running."}}',
    ]);
    expect(
      await forwardMessage('{"jsonrpc":"2.0","method":"notifications/initialized"}', notRunning)
    ).toEqual([]);
  });

  it('passes through accepted notifications without output', async () => {
    const fetch = vi.fn(async () => new Response('', { status: 202 }));

    expect(
      await forwardMessage('{"jsonrpc":"2.0","method":"notifications/initialized"}', endpoint, {
        fetch: fetch as never,
      })
    ).toEqual([]);
  });
});
