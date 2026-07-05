# Testing & Verification — Local-Model + Routing work (2026-07-05)

How this change set was verified: automated unit tests, plus live end-to-end runs
against a real local server. Everything here is reproducible.

---

## 1. Automated (Vitest + tsc + eslint)

```bash
npm run build        # tsc — clean
npx tsc --noEmit     # typecheck — clean
npx vitest run src   # 304 passed (24 files)
```

- **304 tests pass** — 292 pre-existing + **12 new**.
- New files lint clean (`npx eslint src/llm/discovery.ts src/__tests__/*.test.ts`).
- Pre-existing lint warnings/errors in `server.ts` / `llm/index.ts` (`eqeqeq`,
  `no-useless-escape`) were left untouched — not introduced by this work.

### New test files

**`src/__tests__/model-discovery.test.ts`** — the discovery module (pure, `fetch`
mocked):
- `supportsDiscovery` true for openrouter/venice/openai/nvidia/custom/anthropic,
  false for codex/mock/local/local-agent.
- OpenAI-compatible `/models` parse + `Authorization: Bearer` header.
- Keyless custom: **no** Authorization header.
- Anthropic `/v1/models?limit=1000` + `x-api-key` + `anthropic-version`,
  `display_name` → name.
- `validateProvider` returns `{ok:false}` (never throws) on unreachable endpoint.
- 401 → "check the API key" hint; 404 → "/models route" hint.
- Empty base URL / non-discoverable provider → `{ok:false}` without throwing.

**`src/__tests__/custom-provider.test.ts`** — config wiring + cache:
- NVIDIA resolves baseUrl + default model + key from `NVIDIA_API_KEY`.
- `custom` configured on baseUrl alone (keyless), resolves end-to-end.
- `getModels` falls back to the seed with `fromFallback:true` when cache empty.
- `refreshModels` caches the live catalog; **cache invalidates when baseUrl
  changes** (no stale catalog across endpoints).
- `refreshModels` with no baseUrl fails without throwing.
- Snapshots/restores the persisted `custom`/`modelCache`/`apiKeys` and neutralizes
  a repo `.env` `CUSTOM_API_KEY` so the run never pollutes the operator's store.

---

## 2. Live end-to-end (real local OpenAI-compatible server)

Host: `your-server.local` = **`192.0.2.10`** (note: `.29` in the old `.env` is a **dead
IP** — a frequent false alarm; see `docs/DEPLOYMENT.md`).

### CLI

```bash
t3mp3st validate custom                 # ✔ custom OK — 63 model(s) reachable
t3mp3st models -p custom --refresh      # live table of 63 models
```

### Server endpoint (discovery)

```bash
# 63 models via the UI's server-side discovery endpoint:
curl -s -X POST localhost:3333/api/models -H 'Content-Type: application/json' \
  -d '{"provider":"custom","baseUrl":"http://your-server.local:8080/v1","apiKey":"<key>"}'
# → {"ok":true,"models":[... 63 ...]}

# dead IP proves the failure mode is the endpoint, not the code:
#   baseUrl http://192.0.2.99:8080/v1 → {"ok":false,"error":"... fetch failed"}
```

### Routing (the real proof)

```bash
# chat routed UI→server→custom→local model, NO creds in body
# (server uses the env-injected key/baseUrl):
curl -s -X POST localhost:3333/api/llm/chat -H 'Content-Type: application/json' \
  -d '{"message":"Reply with exactly CONTAINER_ROUTED","provider":"custom",
       "model":"Nvidia__qwen_qwen3-next-80b-a3b-instruct"}'
# → {"success":true,"response":"CONTAINER_ROUTED"}
```

`CONTAINER_ROUTED` came back from the **local model**, confirming the selected
provider drives execution (not OpenRouter).

### Headless boot (non-blocking contract)

```bash
LLM_PROVIDER=custom CUSTOM_BASE_URL=http://127.0.0.1:59999/v1 \
CUSTOM_MODEL=mock-local CUSTOM_API_KEY= node dist/server.js
# → "[T3MP3ST] LLM initialized: custom/mock-local" — boots even with the endpoint
#   down and no key; never crashes.
```

---

## 3. Manual UI smoke (dashboard at `/ui`)

1. Reload `localhost:3333/ui/` (static file — hard reload after a redeploy).
2. Settings → **Custom / Local Server**: base URL `http://your-server.local:8080/v1`
   (or `http://192.0.2.10:8080/v1`), key, **Save & Test** → 63 models listed.
3. Settings → **Model Selection**: provider = Custom, **↻ Refresh models** →
   status shows `✓ 63 live model(s)`; pick one.
4. Run a mission / Admiral plan / chat → executes against the local model.

---

## 4. Known gaps / follow-ups

- Live routing verified for **chat** and via the shared resolver used by
  mission/admiral. A full multi-operator mission run against a local model was not
  executed end-to-end in this session (operators use the same
  `createTempestCommandInstance` path, which now carries `baseUrl`).
- Anthropic `/v1/models` pagination beyond the first 1000 is not followed
  (`has_more` ignored) — irrelevant for current catalogs.
