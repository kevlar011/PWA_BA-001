/**
 * BRIC's neural link: a thin DeepSeek client.
 *
 * Called straight from the device. The site is static and public, so there is
 * no server that could hold the key on the user's behalf without also handing
 * it to anyone who found the URL — the key is entered once per device, stored
 * beside the ledger it serves, and sent nowhere but DeepSeek.
 *
 * DeepSeek speaks the OpenAI chat-completions dialect. Thinking mode is turned
 * off: BRIC answers in a sentence or two, and a reasoning pass would triple the
 * wait for no visible gain.
 */

export const DEEPSEEK_URL = 'https://api.deepseek.com/chat/completions';

export type AiModel = 'deepseek-flash' | 'deepseek-v4-pro';

export const DEFAULT_MODEL: AiModel = 'deepseek-flash';

export const AI_MODELS: { id: AiModel; label: string; note: string }[] = [
  { id: 'deepseek-flash', label: 'FLASH', note: 'Fast and cheap. Right for almost everything.' },
  { id: 'deepseek-v4-pro', label: 'PRO', note: 'Deeper reasoning, roughly three times the cost.' },
];

export type AiMessage = { role: 'system' | 'user' | 'assistant'; content: string };

export type AiErrorKind = 'auth' | 'balance' | 'rate' | 'network' | 'timeout' | 'server' | 'empty';

export class AiError extends Error {
  kind: AiErrorKind;
  constructor(kind: AiErrorKind, message: string) {
    super(message);
    this.kind = kind;
  }
}

export type CompleteOptions = {
  key: string;
  model: AiModel;
  messages: AiMessage[];
  /** Asks for a single JSON object. The prompt must say "json" and show the shape. */
  json?: boolean;
  maxTokens?: number;
  temperature?: number;
  /** Streams tokens as they arrive. Falls back to one chunk where streams are unavailable. */
  onDelta?: (textSoFar: string) => void;
  signal?: AbortSignal;
  timeoutMs?: number;
};

function describe(status: number, body: string): AiError {
  if (status === 401) return new AiError('auth', 'DeepSeek rejected the key.');
  if (status === 402) return new AiError('balance', 'The DeepSeek account is out of credit.');
  if (status === 429) return new AiError('rate', 'DeepSeek is rate limiting. Try again shortly.');
  if (status >= 500) return new AiError('server', `DeepSeek is having trouble (${status}).`);
  let detail = '';
  try {
    detail = (JSON.parse(body) as { error?: { message?: string } }).error?.message ?? '';
  } catch {
    // Not JSON; the status alone will do.
  }
  return new AiError('server', detail ? `DeepSeek: ${detail}` : `DeepSeek returned ${status}.`);
}

/** Reads an SSE body, handing each accumulated snapshot to `onDelta`. */
async function readStream(res: Response, onDelta: (s: string) => void): Promise<string> {
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let text = '';

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    // Events are separated by blank lines; keep any partial one for next time.
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    for (const raw of lines) {
      const line = raw.trim();
      if (!line.startsWith('data:')) continue;
      const payload = line.slice(5).trim();
      if (payload === '[DONE]') return text;
      try {
        const chunk = JSON.parse(payload) as {
          choices?: { delta?: { content?: string | null } }[];
        };
        const piece = chunk.choices?.[0]?.delta?.content;
        if (piece) {
          text += piece;
          onDelta(text);
        }
      } catch {
        // A keep-alive or a malformed frame. Skip it rather than lose the reply.
      }
    }
  }
  return text;
}

export async function complete(opts: CompleteOptions): Promise<{ text: string; ms: number }> {
  const started = Date.now();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 45_000);
  opts.signal?.addEventListener('abort', () => ctrl.abort());

  const canStream =
    !!opts.onDelta && typeof ReadableStream !== 'undefined' && typeof TextDecoder !== 'undefined';

  try {
    let res: Response;
    try {
      res = await fetch(DEEPSEEK_URL, {
        method: 'POST',
        signal: ctrl.signal,
        headers: {
          Authorization: `Bearer ${opts.key}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: opts.model,
          messages: opts.messages,
          stream: canStream,
          max_tokens: opts.maxTokens ?? 600,
          temperature: opts.temperature ?? 0.8,
          thinking: { type: 'disabled' },
          ...(opts.json ? { response_format: { type: 'json_object' } } : {}),
        }),
      });
    } catch (e) {
      if (ctrl.signal.aborted) throw new AiError('timeout', 'The neural link timed out.');
      throw new AiError('network', 'No connection to DeepSeek.');
    }

    if (!res.ok) throw describe(res.status, await res.text().catch(() => ''));

    let text: string;
    if (canStream && res.body) {
      text = await readStream(res, opts.onDelta!);
    } else {
      const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
      text = json.choices?.[0]?.message?.content ?? '';
      opts.onDelta?.(text);
    }

    if (!text.trim()) throw new AiError('empty', 'BRIC returned nothing. Try again.');
    return { text: text.trim(), ms: Date.now() - started };
  } catch (e) {
    if (e instanceof AiError) throw e;
    if (ctrl.signal.aborted) throw new AiError('timeout', 'The neural link timed out.');
    throw new AiError('network', e instanceof Error ? e.message : String(e));
  } finally {
    clearTimeout(timer);
  }
}

/** Parses a JSON reply, tolerating a stray code fence around it. */
export function parseJson<T>(text: string): T {
  const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
  return JSON.parse(cleaned) as T;
}

/** A single cheap round trip to prove a key works before it is saved. */
export async function testKey(key: string, model: AiModel): Promise<{ ok: true; ms: number } | { ok: false; error: string }> {
  try {
    const { ms } = await complete({
      key,
      model,
      messages: [{ role: 'user', content: 'Reply with the single word ONLINE.' }],
      maxTokens: 5,
      temperature: 0,
      timeoutMs: 20_000,
    });
    return { ok: true, ms };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
