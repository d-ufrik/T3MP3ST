/**
 * Model discovery — the standardized /models fetch that replaces the hardcoded
 * catalog. Pins both wire shapes (OpenAI-compatible + Anthropic), the keyless
 * path, auth headers, and the non-throwing validation contract that keeps a
 * headless boot alive when an endpoint is down.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { fetchModels, validateProvider, supportsDiscovery } from '../llm/discovery.js';

// Minimal fake fetch Response covering only what discovery reads.
function fakeRes(body: unknown, init: { ok?: boolean; status?: number } = {}): Response {
  return {
    ok: init.ok ?? true,
    status: init.status ?? 200,
    json: async () => body,
    text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
    headers: { get: () => null },
  } as unknown as Response;
}

describe('model discovery', () => {
  afterEach(() => { vi.unstubAllGlobals(); });

  it('supportsDiscovery: true for OpenAI-compatible + anthropic, false otherwise', () => {
    for (const p of ['openrouter', 'venice', 'openai', 'nvidia', 'custom', 'anthropic'] as const) {
      expect(supportsDiscovery(p)).toBe(true);
    }
    for (const p of ['codex', 'mock', 'local', 'local-agent'] as const) {
      expect(supportsDiscovery(p)).toBe(false);
    }
  });

  it('parses an OpenAI-compatible /models payload and sends Bearer auth', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      fakeRes({ data: [{ id: 'a', context_length: 2048 }, { id: 'b', name: 'Bee' }] }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const models = await fetchModels({ provider: 'openai', baseUrl: 'https://x/v1', apiKey: 'k' });
    expect(models.map(m => m.id)).toEqual(['a', 'b']);
    expect(models[0].contextWindow).toBe(2048);
    expect(models[1].name).toBe('Bee');

    const [url, opts] = fetchMock.mock.calls[0];
    expect(url).toBe('https://x/v1/models');
    expect((opts.headers as Record<string, string>).Authorization).toBe('Bearer k');
  });

  it('omits Authorization entirely for a keyless custom server', async () => {
    const fetchMock = vi.fn().mockResolvedValue(fakeRes({ data: [{ id: 'local-1' }] }));
    vi.stubGlobal('fetch', fetchMock);

    await fetchModels({ provider: 'custom', baseUrl: 'http://local:8080/v1' });
    const opts = fetchMock.mock.calls[0][1];
    expect((opts.headers as Record<string, string>).Authorization).toBeUndefined();
  });

  it('uses the Anthropic /v1/models route with x-api-key + version, mapping display_name', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      fakeRes({ data: [{ id: 'claude-x', display_name: 'Claude X' }] }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const models = await fetchModels({ provider: 'anthropic', baseUrl: 'https://api.anthropic.com', apiKey: 'k' });
    expect(models[0].name).toBe('Claude X');

    const [url, opts] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.anthropic.com/v1/models?limit=1000');
    const headers = opts.headers as Record<string, string>;
    expect(headers['x-api-key']).toBe('k');
    expect(headers['anthropic-version']).toBe('2023-06-01');
  });

  it('validateProvider returns ok:false (never throws) when the endpoint is unreachable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('ECONNREFUSED')));
    const r = await validateProvider({ provider: 'openai', baseUrl: 'https://x/v1', apiKey: 'k' });
    expect(r.ok).toBe(false);
    expect(r.models).toEqual([]);
    expect(r.error).toBeTruthy();
  });

  it('surfaces a key hint on 401 and a route hint on 404', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(fakeRes('nope', { ok: false, status: 401 })));
    const unauth = await validateProvider({ provider: 'openai', baseUrl: 'https://x/v1', apiKey: 'bad' });
    expect(unauth.ok).toBe(false);
    expect(unauth.error).toMatch(/check the API key/i);

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(fakeRes('missing', { ok: false, status: 404 })));
    const missing = await validateProvider({ provider: 'custom', baseUrl: 'http://local/v1', apiKey: '' });
    expect(missing.error).toMatch(/\/models route/i);
  });

  it('rejects an empty base URL and a non-discoverable provider without throwing', async () => {
    const noUrl = await validateProvider({ provider: 'custom', baseUrl: '' });
    expect(noUrl.ok).toBe(false);

    const noDisc = await validateProvider({ provider: 'mock', baseUrl: 'http://x/v1' });
    expect(noDisc.ok).toBe(false);
    expect(noDisc.models).toEqual([]);
  });
});
