# Local-Model-Friendly Refactor — Plan & Progress

> **Goal.** Make T3MP3ST first-class for **local / self-hosted OpenAI-compatible
> inference** and replace the hardcoded model catalog with **standardized,
> live model discovery** — implemented in the original author's style, fully
> drivable headlessly (Docker), and documented well enough that this fork can be
> delivered as-is without an upstream PR.

**Status:** Planning complete. Implementation not started.
**Owner fork:** `elder-plinius/T3MP3ST` → local fork (delivery target).
**Last updated:** 2026-07-05

---

## 1. Why

Two concrete problems in the current settings surface:

1. **The model list is hardcoded.** `AVAILABLE_MODELS` in `src/config/index.ts`
   is a static, dated snapshot. A model added or pulled by a provider tomorrow
   leaves the operator with no way to select it, and the list is already
   drifting from reality. Model selection must come from the **configured
   provider's own catalog**, fetched after the key/endpoint is validated.

2. **The base URL is not settable from the UI.** Every LLM adapter already reads
   `config.baseUrl`, and an env-var override exists (added in this fork), but
   there is no interactive way to point T3MP3ST at a **local OpenAI-compatible
   server** (e.g. an vLLM/llama.cpp/Ollama-OpenAI endpoint). This is the
   single most important capability for local-model use.

---

## 2. Baseline (verified state before any change)

| Fact | Location | Notes |
|---|---|---|
| Fork of upstream | `git remote` → `elder-plinius/T3MP3ST` | on `main` |
| Hardcoded model catalog | `src/config/index.ts` `AVAILABLE_MODELS` | consumed in `cli.ts:550`, `cli.ts:689`, `setup.ts:249` |
| Base URL already flows to adapters | `src/llm/index.ts` (`this.config.baseUrl` at `:185,:262,:415,:549,:721`) | no adapter change needed to support custom endpoints |
| Env base-URL override (this fork's only code diff) | `src/config/index.ts:493-518` | `OPENROUTER_BASE_URL` / `VENICE_BASE_URL` / `ANTHROPIC_BASE_URL` / `OPENAI_API_BASE` |
| Local endpoint config | `.env` → `OPENAI_API_BASE=http://192.0.2.99:8080/v1` | **not** hardcoded in source |
| Two wire shapes | `src/llm/index.ts` | OpenAI-compatible (`POST /chat/completions`) vs Anthropic (`POST /v1/messages`) |
| Two **separate** config surfaces | core (`config/index.ts` + `.env`) vs Hermes agent (`/root/.hermes/config.yaml`) | the Dockerfile only configures Hermes |
| Docker configures Hermes only | `Dockerfile:39-42` (`sed` patches) | T3MP3ST core in-container is driven purely by **env vars** |

**Implication of the two config surfaces:** this refactor targets the **core**
config/LLM layer. Hermes remains configured by its own `config.yaml`. Where it
makes sense, the core `custom` provider is aligned to mirror the Hermes values
(same base_url, same model) so both point at the same local server.

---

## 3. Confirmed decisions

1. **New `custom` provider.** Model a local OpenAI-compatible server as a
   dedicated `custom` provider (own baseUrl + key + model), reusing the existing
   OpenAI-compatible adapter. Keeps `openai` == `api.openai.com` and avoids the
   confusing "openai provider pointing at a LAN box" semantics.

2. **Live discovery is the source of truth; the static list is fallback only.**
   `AVAILABLE_MODELS` is retained **only** for offline / no-`/models`-route
   cases, and the UI must **visibly mark it as "hardcoded fallback — not
   recommended, refresh to get live models."**

3. **Inline validate → fetch, plus an explicit refresh.** After a key or base
   URL is entered, validate the endpoint and fetch models in the same step; also
   expose a persistent **"↻ Refresh models"** action (and a scriptable command)
   for on-demand refresh.

---

## 4. Design

### 4.1 Model discovery (standardized, keyed by wire shape)

| Wire shape | Providers | Endpoint | Auth |
|---|---|---|---|
| OpenAI-compatible | `openrouter`, `venice`, `openai`, `custom` | `GET {baseUrl}/models` → `{data:[{id,...}]}` | `Authorization: Bearer <key>` (omitted if no key, for keyless local servers) |
| Anthropic | `anthropic` | `GET {baseUrl}/v1/models` → `{data:[{id,display_name,...}]}` | `x-api-key` + `anthropic-version` |

- OpenRouter's `/models` returns `context_length` + pricing for free — mapped
  into `ModelInfo` when present; otherwise `ModelInfo` fields degrade gracefully.
- Local servers that lack a `/models` route → discovery returns empty → UI
  falls back to the static seed **and** always offers manual model-id entry.

### 4.2 Validation gate

`validateProvider(provider)` hits the cheapest authenticated route (`/models`).
Flow: **enter key/baseUrl → validate → on success fetch + cache the live list →
present as choices.** On failure: show the error, do not cache, keep prior state.

### 4.3 Caching (fast + offline-capable)

Persist live lists in the `conf` store:

```
modelCache: { [provider]: { models: ModelInfo[], baseUrl: string, fetchedAt: number } }
```

- Keyed by `baseUrl` so switching endpoints never shows the wrong catalog.
- TTL ~24h; a stale or missing cache triggers a background refresh in the CLI.
- Explicit refresh always bypasses the TTL.

### 4.4 Base URL as a first-class setting

Add "Set base URL" to the interactive settings menu and the setup wizard,
writing the existing schema fields. **No adapter changes.** The env override
(this fork's patch) stays as the headless path and continues to win over stored
config.

### 4.5 Headless / Docker (hard requirement)

- The `custom` provider is fully env-drivable: `LLM_PROVIDER=custom` +
  `CUSTOM_BASE_URL` / `CUSTOM_API_KEY` / `CUSTOM_MODEL`.
- **Discovery/validation must never gate server startup.** If `/models` fails or
  is absent, the server logs a warning and falls back to `CUSTOM_MODEL` (or the
  static seed). It must not crash.
- Add a Docker build/run-time endpoint check that mirrors the existing Hermes
  `sed` pattern, so the container "checks exactly like that."

### 4.6 Boundary — network code lives in `llm/`, not `config/`

`config/index.ts` stays a store. All HTTP (validate/listModels) lives in the
`llm` layer; config calls into it and persists results. This keeps
`config/index.ts` from taking on a fetch dependency.

---

## 5. Phased plan (maps 1:1 to the task list)

| Phase | Task | Deliverable | Blocked by |
|---|---|---|---|
| **0** | #1 | This document + verified baseline | — |
| **1** | #2 | `custom` in `LLMProvider`; `custom` config section + defaults; `modelCache` schema; `CUSTOM_*` env keys | #1 |
| **2** | #3 | `listModels()` + `validateProvider()` in `llm/` for both wire shapes; non-blocking | #2 |
| **3** | #4 | `custom` wired into `getLLMConfig` / `getConfiguredProviders` / fallback chain / setters; cache read/write + TTL + refresh | #2, #3 |
| **4** | #5 | CLI + setup: editable base URL, dynamic model choices, inline validate→fetch, refresh action, manual-entry escape hatch, "not recommended" fallback notice; `validate` + `refresh-models` commands | #4 |
| **5** | #6 | Env-driven `custom` verified in container; non-blocking startup; Docker endpoint check; baked-key remediation | #4 |
| **6** | #7 | Vitest: discovery parsing (both shapes), validation success/fail, cache TTL + baseUrl keying, custom resolution, headless fallback | #4 |
| **7** | #8 | Delivery docs: `LOCAL_MODELS.md`, `MODEL_DISCOVERY.md`, CHANGELOG, PROJECT.md reconciliation, migration note | #5, #6, #7 |

### Definition of done (the goal, made verifiable) — ✅ COMPLETE

- [x] `t3mp3st` can be pointed at a local OpenAI-compatible server entirely from
      the settings UI **and** entirely from env vars, with no code edit.
- [x] The model picker shows the **live** catalog from that server; the static
      list appears only as a clearly-labelled fallback.
- [x] A key/endpoint is validated before its models are offered; a refresh
      action re-fetches on demand.
- [x] The container starts and serves even when the endpoint has no `/models`
      route, using `CUSTOM_MODEL`.
- [x] No live secret is baked into an image layer.
- [x] Docs are complete enough to hand off the fork without further explanation.

**Verified live (2026-07-05):** against a real local OpenAI-compatible server, `t3mp3st validate
custom` and `models -p custom --refresh` returned 63 models from `/v1/models`.
304 unit tests pass (12 new). Also delivered beyond the original scope: the
`nvidia` provider, and a generic `exportConfig` key-redaction fix.

---

## 6. Known risks / open items

- **Baked API key** at `Dockerfile:41` (`sk-…`) is embedded in an image
  layer. **Decision (confirmed):** remove it entirely. Highest-security standard —
  **no keys, no secrets in the image**. All sensitive values become `ENV`/`ARG`
  with obvious **mock placeholders** (`CUSTOM_API_KEY=sk-REPLACE-ME`,
  `CUSTOM_BASE_URL=http://host.docker.internal:8080/v1`, `CUSTOM_MODEL=your-local-model`),
  overridden at runtime via `docker run -e`. The Hermes `config.yaml` is baked
  **without** the key; the key is injected at runtime. The image must run
  out-of-the-box in mock mode and contain zero real secrets.
- Some local runtimes return non-standard `/models` payloads; parser must be
  defensive (id-only is enough).
- OpenRouter rate-limits unauthenticated `/models`; validation uses the key when
  present.

---

## 6b. Follow-on phases (discovered mid-session)

The original 8 phases covered config/CLI/discovery/Docker. Two more surfaced once
the app was exercised:

| Phase | Deliverable | Status |
|---|---|---|
| **UI-1** | `POST /api/models` server-side discovery endpoint | ✅ |
| **UI-2** | NVIDIA + Custom sections in the dashboard (`docs/index.html`) | ✅ |
| **UI-3** | Live model selector (provider dropdown, refresh, manual, fallback) | ✅ |
| **UI-4** | Rebuild image + redeploy + verify UI | ✅ |
| **ROUTING** | Wire client→server→adapter so the selected provider actually runs (was all OpenRouter) — see `ROUTING_FIX.md` | ✅ |

- **NVIDIA provider** was added on user request (preconfigured, base URL
  `integrate.api.nvidia.com/v1`).
- The **routing fix** was the critical one: settings/discovery worked but every
  request still went to OpenRouter. Full analysis in `docs/ROUTING_FIX.md`.

## 7. Changelog of this plan

- **2026-07-05** — Initial plan (8 phases). Decisions confirmed: custom provider,
  static list as fallback-only with notice, inline validate+fetch with refresh.
- **2026-07-05 (later)** — Added NVIDIA provider; added UI phases (dashboard did
  not reflect the backend); added the ROUTING phase after discovering all LLM
  traffic still routed to OpenRouter. All verified live (63 models; real
  `CONTAINER_ROUTED` completion from the local model). See
  `docs/SESSION_2026-07-05.md`.
