/**
 * Custom (local OpenAI-compatible) + NVIDIA provider wiring, plus the model cache.
 * Pins: NVIDIA resolves like the other preconfigured providers; `custom` is
 * configured on baseUrl alone (keyless) and resolves end-to-end; getModels falls
 * back to the seed with a flag; refreshModels caches live models and the cache is
 * keyed by baseUrl; and a base-URL-less custom refresh fails without throwing.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { config } from '../config/index.js';

function fakeRes(body: unknown, init: { ok?: boolean; status?: number } = {}): Response {
  return {
    ok: init.ok ?? true,
    status: init.status ?? 200,
    json: async () => body,
    text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
    headers: { get: () => null },
  } as unknown as Response;
}

describe('custom + nvidia provider wiring', () => {
  // Snapshot the persisted bits these tests mutate, and restore them afterwards
  // so the run never pollutes the operator's real config store.
  let origCustom: { baseUrl: string; defaultModel: string };
  let origCache: Record<string, unknown>;
  let origApiKeys: Record<string, string | undefined>;
  let origEnvCustomKey: string | undefined;

  beforeEach(() => {
    origCustom = { ...config.get('custom') };
    origCache = { ...config.get('modelCache') };
    origApiKeys = { ...config.get('apiKeys') };
    // A repo .env may inject CUSTOM_API_KEY into process.env (env wins over the
    // store); neutralize it so these tests control the key state deterministically.
    origEnvCustomKey = process.env.CUSTOM_API_KEY;
    delete process.env.CUSTOM_API_KEY;
  });

  afterEach(() => {
    config.set('custom', origCustom);
    config.set('modelCache', origCache as never);
    config.set('apiKeys', origApiKeys as never);
    if (origEnvCustomKey === undefined) delete process.env.CUSTOM_API_KEY;
    else process.env.CUSTOM_API_KEY = origEnvCustomKey;
    delete process.env.NVIDIA_API_KEY;
    vi.unstubAllGlobals();
  });

  it('NVIDIA resolves baseUrl + default model + key from NVIDIA_API_KEY', () => {
    process.env.NVIDIA_API_KEY = 'nvapi-abcdef123456';
    const cfg = config.getLLMConfig('nvidia');
    expect(cfg.provider).toBe('nvidia');
    expect(cfg.baseUrl).toBe('https://integrate.api.nvidia.com/v1');
    expect(cfg.model).toBe('meta/llama-3.3-70b-instruct');
    expect(cfg.apiKey).toBe('nvapi-abcdef123456');
    expect(config.getConfiguredProviders()).toContain('nvidia');
  });

  it('custom is configured on baseUrl alone (keyless) and resolves', () => {
    config.removeApiKey('custom'); // ensure the keyless path
    config.setBaseUrl('custom', 'http://localhost:8080/v1');
    config.setDefaultModel('custom', 'my-local-model');
    const cfg = config.getLLMConfig('custom');
    expect(cfg.baseUrl).toBe('http://localhost:8080/v1');
    expect(cfg.model).toBe('my-local-model');
    expect(cfg.apiKey).toBeUndefined();
    expect(config.getConfiguredProviders()).toContain('custom');
  });

  it('getModels falls back to the hardcoded seed with fromFallback=true when the cache is empty', () => {
    const { models, fromFallback } = config.getModels('nvidia');
    expect(fromFallback).toBe(true);
    expect(models.length).toBeGreaterThan(0); // nvidia seed
  });

  it('refreshModels caches the live catalog; the cache invalidates when baseUrl changes', async () => {
    config.setBaseUrl('custom', 'http://a:8080/v1');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(fakeRes({ data: [{ id: 'live-1' }, { id: 'live-2' }] })));

    const r = await config.refreshModels('custom');
    expect(r.ok).toBe(true);

    const cached = config.getModels('custom');
    expect(cached.fromFallback).toBe(false);
    expect(cached.models.map(m => m.id)).toEqual(['live-1', 'live-2']);

    // Point at a different endpoint — the cached entry no longer matches, so we
    // must NOT serve the stale catalog.
    config.setBaseUrl('custom', 'http://b:8080/v1');
    expect(config.getModels('custom').fromFallback).toBe(true);
  });

  it('refreshModels on a custom endpoint with no baseUrl fails without throwing', async () => {
    config.setBaseUrl('custom', '');
    const r = await config.refreshModels('custom');
    expect(r.ok).toBe(false);
    expect(r.models).toEqual([]);
  });
});
