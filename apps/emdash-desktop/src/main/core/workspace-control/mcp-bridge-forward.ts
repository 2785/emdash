/**
 * The stdio-to-HTTP forwarding behind `mcp-bridge` (external MCP clients reaching Emjosh's
 * control endpoint). Kept free of I/O setup so it can be tested.
 */

export type EndpointInfo = { url: string; token: string };

type JsonRpcMessage = { jsonrpc?: string; id?: string | number | null; method?: string };

function errorReply(id: JsonRpcMessage['id'], message: string): string {
  return JSON.stringify({ jsonrpc: '2.0', id: id ?? null, error: { code: -32000, message } });
}

/**
 * Forwards one newline-delimited JSON-RPC message to the endpoint and returns the lines to
 * write back. Notifications get no reply; a request Emjosh can't answer gets a JSON-RPC error.
 */
export async function forwardMessage(
  line: string,
  readEndpoint: () => Promise<EndpointInfo | null>,
  options: { conversationId?: string; fetch?: typeof fetch } = {}
): Promise<string[]> {
  let message: JsonRpcMessage;
  try {
    message = JSON.parse(line);
  } catch {
    return [errorReply(null, 'Invalid JSON')];
  }
  const isRequest = message.id !== undefined && message.id !== null;
  const endpoint = await readEndpoint();
  if (!endpoint) {
    return isRequest ? [errorReply(message.id, 'Emjosh is not running.')] : [];
  }
  try {
    const response = await (options.fetch ?? fetch)(endpoint.url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json, text/event-stream',
        authorization: `Bearer ${endpoint.token}`,
        ...(options.conversationId ? { 'x-emjosh-conversation': options.conversationId } : {}),
      },
      body: line,
    });
    const text = await response.text();
    if (!response.ok) {
      return isRequest ? [errorReply(message.id, `Emjosh responded ${response.status}`)] : [];
    }
    if (!text.trim()) return [];
    const body = JSON.parse(text) as unknown;
    return (Array.isArray(body) ? body : [body]).map((item) => JSON.stringify(item));
  } catch (error) {
    return isRequest
      ? [
          errorReply(
            message.id,
            `Could not reach Emjosh: ${error instanceof Error ? error.message : error}`
          ),
        ]
      : [];
  }
}
