/**
 * local-agent backbone wiring in getLLMConfig.
 *
 * Regression pin: driving a connected agent CLI (Claude Code / Codex / Hermes) as the
 * backbone — LLM_PROVIDER=local-agent — must RESOLVE, not throw. Before the fix,
 * getLLMConfig had no 'local-agent' case, so a server booted with local-agent as the
 * default provider hit `throw new Error('Unknown provider: local-agent')` in initLLM()
 * and came up with a null backbone even though the CLI was authed and ready.
 *
 * local-agent needs NO api key and NO baseUrl (each CLI uses its own login); the chosen
 * agent id (codex|claude|hermes) travels in `model`.
 *
 * These assertions are deliberately read-only: the `config` singleton is backed by a
 * shared on-disk store, and persisted writes race across vitest's parallel workers.
 * getLLMConfig() is a pure resolver, so reads alone prove the fix.
 */
import { describe, it, expect } from 'vitest';
import { config } from '../config/index.js';

describe('local-agent provider wiring', () => {
  it('resolves without throwing, with no api key and no baseUrl', () => {
    const cfg = config.getLLMConfig('local-agent');
    expect(cfg.provider).toBe('local-agent');
    expect(cfg.apiKey).toBeUndefined();
    expect(cfg.baseUrl).toBeUndefined();
    // model defaults to a known agent id (exercises the known-id fallback branch)
    expect(['codex', 'claude', 'hermes']).toContain(cfg.model);
  });

  it('honors an explicit agent id passed as the model', () => {
    expect(config.getLLMConfig('local-agent', 'codex').model).toBe('codex');
    expect(config.getLLMConfig('local-agent', 'claude').model).toBe('claude');
    expect(config.getLLMConfig('local-agent', 'hermes').model).toBe('hermes');
  });
});
