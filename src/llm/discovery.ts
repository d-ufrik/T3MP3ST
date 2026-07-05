/**
 * T3MP3ST Model Discovery
 *
 * Standardized, live model listing + endpoint validation. Replaces reliance on
 * the hardcoded AVAILABLE_MODELS catalog — the models an operator can pick come
 * from the configured provider's OWN `/models` route, fetched only after the
 * key/endpoint is reachable.
 *
 * Two wire shapes, mirroring the chat adapters in ./index.ts:
 *   - OpenAI-compatible (openrouter | venice | openai | custom):
 *       GET {baseUrl}/models        Authorization: Bearer <key> (omitted if none)
 *   - Anthropic (anthropic):
 *       GET {baseUrl}/v1/models     x-api-key + anthropic-version
 *
 * Everything here is NON-BLOCKING and defensive: a missing /models route, an
 * unauthenticated 401, or a non-standard payload yields an empty list or a
 * failed validation result — it never throws fatally into a server boot path.
 */

import type { LLMProvider } from '../types/index.js';
import type { ModelInfo } from '../config/index.js';

// =============================================================================
// WIRE-SHAPE ROUTING
// =============================================================================

type WireShape = 'openai' | 'anthropic' | 'none';

/** Which discovery protocol a provider speaks, if any. */
function wireShape(provider: LLMProvider): WireShape {
  switch (provider) {
    case 'openrouter':
    case 'venice':
    case 'openai':
    case 'nvidia':
    case 'custom':
      return 'openai';
    case 'anthropic':
      return 'anthropic';
    default:
      // codex/mock/local/local-agent have no OpenAI-style /models catalog.
      return 'none';
  }
}

/** True when the provider exposes a discoverable model catalog. */
export function supportsDiscovery(provider: LLMProvider): boolean {
  return wireShape(provider) !== 'none';
}

// =============================================================================
// PARAMS + RESULT TYPES
// =============================================================================

export interface DiscoveryParams {
  provider: LLMProvider;
  /** Fully-qualified base URL as the chat adapters use it (openai shapes include /v1). */
  baseUrl: string;
  /** Optional — keyless local servers omit it. */
  apiKey?: string;
  /** Discovery is a cheap call; default 15s (shorter than a chat timeout). */
  timeoutMs?: number;
}

export interface ValidationResult {
  ok: boolean;
  error?: string;
  models: ModelInfo[];
}

// Raw upstream payloads (only the fields we read).
interface OpenAIModelsResponse {
  data?: Array<{
    id: string;
    name?: string;
    owned_by?: string;
    context_length?: number;
    top_provider?: { context_length?: number; max_completion_tokens?: number };
    pricing?: { prompt?: string | number; completion?: string | number };
  }>;
}

interface AnthropicModelsResponse {
  data?: Array<{ id: string; display_name?: string }>;
}

// =============================================================================
// FETCH
// =============================================================================

/**
 * Fetch the live model catalog for a provider. Throws on network / HTTP / parse
 * failure so callers can surface a precise validation error; use validateProvider
 * for the non-throwing variant.
 */
export async function fetchModels(params: DiscoveryParams): Promise<ModelInfo[]> {
  const shape = wireShape(params.provider);
  if (shape === 'none') return [];

  const base = (params.baseUrl || '').replace(/\/+$/, '');
  if (!base) throw new Error('No base URL configured for model discovery');

  const timeoutMs = params.timeoutMs ?? 15000;

  if (shape === 'anthropic') {
    // Anthropic paginates; ask for a large first page (has_more beyond this is rare).
    const url = `${base}/v1/models?limit=1000`;
    const res = await fetch(url, {
      headers: {
        'x-api-key': params.apiKey ?? '',
        'anthropic-version': '2023-06-01',
      },
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) throw await httpError(res, 'Anthropic');
    const json = (await res.json()) as AnthropicModelsResponse;
    return (json.data ?? []).map((m) => ({
      id: m.id,
      name: m.display_name || m.id,
      provider: 'Anthropic',
      contextWindow: 0,
      maxOutput: 0,
      capabilities: [],
    }));
  }

  // OpenAI-compatible
  const url = `${base}/models`;
  const headers: Record<string, string> = {};
  // Omit auth entirely when keyless — some local servers reject an empty Bearer.
  if (params.apiKey) headers.Authorization = `Bearer ${params.apiKey}`;

  const res = await fetch(url, { headers, signal: AbortSignal.timeout(timeoutMs) });
  if (!res.ok) throw await httpError(res, 'Model discovery');
  const json = (await res.json()) as OpenAIModelsResponse;

  return (json.data ?? [])
    .filter((m) => m && typeof m.id === 'string')
    .map((m) => {
      const contextWindow = m.context_length ?? m.top_provider?.context_length ?? 0;
      const pricing =
        m.pricing && (m.pricing.prompt !== undefined || m.pricing.completion !== undefined)
          ? { prompt: toNumber(m.pricing.prompt), completion: toNumber(m.pricing.completion) }
          : undefined;
      return {
        id: m.id,
        name: m.name || m.id,
        provider: m.owned_by || labelFor(params.provider),
        contextWindow,
        maxOutput: m.top_provider?.max_completion_tokens ?? 0,
        pricing,
        capabilities: [],
      } satisfies ModelInfo;
    });
}

/**
 * Reachability + auth check that doubles as a catalog fetch. Never throws — a
 * failure is returned as { ok:false, error }. On success, the freshly-fetched
 * model list rides along so callers can validate and cache in one round-trip.
 */
export async function validateProvider(params: DiscoveryParams): Promise<ValidationResult> {
  if (!supportsDiscovery(params.provider)) {
    return { ok: false, error: `Provider "${params.provider}" has no discoverable model catalog`, models: [] };
  }
  try {
    const models = await fetchModels(params);
    return { ok: true, models };
  } catch (err) {
    return { ok: false, error: errorMessage(err), models: [] };
  }
}

// =============================================================================
// HELPERS
// =============================================================================

async function httpError(res: Response, label: string): Promise<Error> {
  let detail = '';
  try {
    detail = (await res.text()).slice(0, 300);
  } catch {
    /* body unreadable — status alone is enough */
  }
  const hint =
    res.status === 401 || res.status === 403
      ? ' (check the API key)'
      : res.status === 404
        ? ' (endpoint has no /models route)'
        : '';
  return new Error(`${label} failed: HTTP ${res.status}${hint}${detail ? ` — ${detail}` : ''}`);
}

function errorMessage(err: unknown): string {
  if (err instanceof Error) {
    // AbortSignal.timeout surfaces as a TimeoutError / AbortError.
    if (err.name === 'TimeoutError' || err.name === 'AbortError') return 'Request timed out — endpoint unreachable';
    return err.message;
  }
  return String(err);
}

function toNumber(v: string | number | undefined): number {
  if (v === undefined) return 0;
  const n = typeof v === 'number' ? v : parseFloat(v);
  return Number.isFinite(n) ? n : 0;
}

function labelFor(provider: LLMProvider): string {
  switch (provider) {
    case 'openrouter':
      return 'OpenRouter';
    case 'venice':
      return 'Venice';
    case 'openai':
      return 'OpenAI';
    case 'nvidia':
      return 'NVIDIA';
    case 'custom':
      return 'Custom';
    default:
      return provider;
  }
}
