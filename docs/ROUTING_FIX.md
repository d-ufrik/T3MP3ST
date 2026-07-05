# The Routing Bug — everything went through OpenRouter

> **Date:** 2026-07-05 · **Severity:** critical (feature-defeating)
>
> After the provider/discovery refactor, selecting a provider + model in the UI
> **did nothing** — every LLM call still hit OpenRouter (or failed). The `custom`
> / local provider could be *configured and discovered* but never actually *ran*.
> This is the full root-cause analysis and the fix, so the fork can be patched
> confidently.

---

## 1. Symptom

- UI: pick **Custom / Local**, save base URL + key, select a model → run a mission
  or chat.
- Actual: the call went to `openrouter.ai` (or errored with a missing-key /
  wrong-endpoint failure). The selected provider was ignored end-to-end.

## 2. Why — five independent defects on the request path

The settings/discovery layer was correct; the **request path** (UI → server →
adapter) never carried the selection through. Five separate breaks:

| # | Layer | Defect | File |
|---|-------|--------|------|
| 1 | server | `resolveGeneralLLMConfig` resolved `baseUrl` via `config.getLLMConfig` but **omitted it from the returned object** → `custom` reached the adapter with `baseUrl: undefined` and failed `validateConfig`. | `src/server.ts` |
| 2 | server | `createTempestCommandInstance` had no `baseUrl` param → mission **operators'** LLM never got the local endpoint. | `src/server.ts` |
| 3 | server | `/api/mission/start` and `/api/llm/chat` ignored request-body `provider`/`baseUrl`; `/api/llm/chat` always used the default singleton; mission-start's key fallback used the **default** provider's key, not the selected one. | `src/server.ts` |
| 4 | client | `getApiKey()` returned only `openrouterKey`; `getGeneralConfig()` ignored the selected provider; the mission path **inferred** provider from the key prefix (`sk-ant-` → anthropic, else openrouter). | `docs/index.html` |
| 5 | client | `_safeLLMCallOnce` (the chat path) called **`https://openrouter.ai/api/v1/chat/completions` hardcoded** directly from the browser — bypassing both the selected provider and the server. | `docs/index.html` |

Any one of these alone would break custom routing. Together, the selection was
cosmetic.

## 3. The fix

### Server (`src/server.ts`)

- `resolveGeneralLLMConfig(provider, model, apiKey, baseUrl?)` now:
  - **returns `baseUrl`** (`caller override → config.getLLMConfig(provider).baseUrl`);
  - accepts an optional `baseUrl` override from the request.
- `createTempestCommandInstance(..., baseUrl?)` threads `baseUrl` into the
  operators' `llm` config; resolves it from server config when the caller omits it.
- `/api/mission/start` reads `baseUrl` from the body, passes it through, and its
  key fallback now uses **`config.getLLMConfig(provider)`** (the selected
  provider), not the default.
- `/api/llm/chat` accepts `{provider, model, apiKey, baseUrl}` and builds a
  **per-request** `LLMBackbone` via `resolveGeneralLLMConfig` when a provider is
  sent; otherwise falls back to the default singleton. (This is also the CORS-free
  path for local servers the browser can't reach.)

### Client (`docs/index.html`)

- New **`llmRequestConfig()`** — single source of truth: returns the **selected**
  provider (`state.settings.modelProvider`), its key (`getProviderKey`), the
  selected model, and `baseUrl` (for `custom`).
- `getApiKey()` is now **provider-aware** (was openrouter-only).
- Mission dispatch: the key-prefix inference block was **replaced** with
  `llmRequestConfig()`; `baseUrl` flows through `startMission(...)` into the body.
  (A connected local agent still wins only when there's no key *and* no explicit
  selection.)
- Admiral/General routes (`plan`/`execute`/`auto`/`sitrep`/`assess`) send
  `{apiKey, provider, model, baseUrl}`.
- `_safeLLMCallOnce`: when the backend is connected, routes through
  `POST /api/llm/chat` with the selected provider (CORS-free); only in standalone
  (no-backend) mode does it fall back to the direct OpenRouter call.

## 4. Proof it now routes

Run against a real local OpenAI-compatible server (`your-server.local` = `192.0.2.10`):

```
# chat through the container to the LOCAL model, no creds in body
# (server uses the env-injected key):
$ curl -s -X POST localhost:3333/api/llm/chat -H 'Content-Type: application/json' \
    -d '{"message":"Reply with exactly CONTAINER_ROUTED","provider":"custom",
         "model":"Nvidia__qwen_qwen3-next-80b-a3b-instruct"}'
{"success":true,"response":"CONTAINER_ROUTED"}     # ← from the local model
```

## 5. Lesson for the fork

The refactor's *settings/discovery* surface and its *request* surface are
separate. When adding a provider, grep the request path for every place
`provider`/`baseUrl`/`apiKey` are read or defaulted — **both** client and server:

```
# client
grep -nE "openrouter\.ai|provider = 'openrouter'|getApiKey|getGeneralConfig" docs/index.html
# server
grep -nE "resolveGeneralLLMConfig|createTempestCommandInstance|new LLMBackbone" src/server.ts
```

A provider that "appears in settings" is not the same as a provider that
"executes requests." Verify with a real completion, not just a model list.
