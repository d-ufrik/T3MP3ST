# Local Models & Standardized Model Discovery

T3MP3ST talks to any **OpenAI-compatible** inference server — local or hosted —
and pulls its model list **live** from the server instead of a hardcoded table.
This guide covers the `custom` provider, the preconfigured providers, live
discovery/validation, the model cache, headless/Docker use, and migration.

---

## 1. TL;DR

**Point at a local server, three ways:**

```bash
# (a) Env vars — best for headless / Docker
export LLM_PROVIDER=custom
export CUSTOM_BASE_URL=http://your-server.local:8080/v1     # OpenAI-compatible, include /v1
export CUSTOM_MODEL=Nvidia__qwen_qwen3.5-122b-a10b  # any id the server returns
export CUSTOM_API_KEY=sk-...                         # optional; omit for keyless servers

# (b) Interactive — the settings menu
t3mp3st                       # → ⚙️ Settings → Set base URL → (validates + lists models)

# (c) Verify from the CLI
t3mp3st validate custom       # hits /models, exits 0 on success, 1 on failure
t3mp3st models -p custom --refresh   # fetch + print the live catalog
```

---

## 2. Providers

| Provider | Base URL (default) | Key | Model source |
|---|---|---|---|
| `openrouter` | `https://openrouter.ai/api/v1` | required | live `/models` |
| `venice` | `https://api.venice.ai/api/v1` | required | live `/models` |
| `anthropic` | `https://api.anthropic.com` | required | live `/v1/models` |
| `openai` | `https://api.openai.com/v1` | required | live `/models` |
| `nvidia` | `https://integrate.api.nvidia.com/v1` | required | live `/models` |
| **`custom`** | *(you set it)* | **optional** | live `/models` |

All six are OpenAI-compatible on the wire except `anthropic` (its own shape).
Every one supports **live discovery** — the hardcoded lists are fallback only.

`custom` is the one to use for a **local / self-hosted** server (vLLM,
llama.cpp, LM Studio, Ollama's OpenAI shim, an in-house proxy, …). It is
"configured" the moment a base URL is set — the API key is **optional**, so
keyless local servers work with no key at all.

---

## 3. How discovery works

1. **Validate** — T3MP3ST calls the provider's model-listing route:
   - OpenAI-compatible: `GET {baseUrl}/models`
   - Anthropic: `GET {baseUrl}/v1/models` (with `x-api-key` + `anthropic-version`)
   A non-empty API key is sent as `Authorization: Bearer …`; a keyless `custom`
   server gets **no** auth header (so it isn't rejected for a bogus `Bearer`).
2. **Cache** — on success the catalog is cached in the config store, tagged with
   the `baseUrl` it came from and a timestamp. TTL is **24h**. Switching the base
   URL invalidates the cache immediately (you never see a stale catalog).
3. **Pick** — the settings/setup model picker shows the live list. If the cache
   is empty/expired it shows the hardcoded seed **with a "not recommended —
   refresh for live models" warning**, and always offers manual model-id entry.

Discovery is **non-blocking and never throws**: an unreachable endpoint, a 401,
or a server with no `/models` route degrades to the fallback + manual entry. It
can never crash the CLI or a server boot.

### Commands

| Command | What it does |
|---|---|
| `t3mp3st models [-p <provider>] [--refresh]` | List models (cache, or live with `--refresh`) |
| `t3mp3st refresh-models [-p <provider>]` | Fetch + cache the live catalog; exit 0/1 |
| `t3mp3st validate [<provider>]` | Reachability/auth check via `/models`; exit 0/1 |
| Settings → **↻ Refresh model list from server** | Same, interactively |

---

## 4. Settings UI

`t3mp3st` → **⚙️ Settings**:

- **View current configuration** — provider, model, and per-provider key + base URL.
- **Change default provider** — pick from configured providers.
- **Change default model** — dynamic picker: live list, `↻ Refresh`, or `✎ Enter model ID manually`.
- **Add/update API key** — for `custom`, the key can be left blank (keyless).
- **Set base URL** — point any provider at a local/self-hosted endpoint; validates + lists on save.
- **↻ Refresh model list from server** — re-fetch on demand.

---

## 4b. Web dashboard (`/ui`)

The dashboard (served at `http://<host>:3333/ui`) has its own settings surface:

- **Settings → API Keys**: OpenRouter, Venice, Anthropic, OpenAI, **NVIDIA**, and a
  **Custom / Local Server** card (editable base URL + optional key, "Save & Test").
- **Settings → Model Selection**: a **provider dropdown** + **↻ Refresh models**
  that fetches the live catalog via `POST /api/models`, a status line
  (`✓ N live model(s)` vs `⚠ hardcoded fallback`), and manual model-id entry.

The selected provider + model drives mission dispatch, the Admiral, and chat —
routed through the server so a **local server the browser can't reach directly**
(CORS) still works. See `docs/ROUTING_FIX.md` for how routing was wired end-to-end.

> Note: `.local` mDNS does not resolve inside the container. Use the LAN **IP**
> (e.g. `http://192.0.2.10:8080/v1`) or deploy with
> `--add-host your-server.local:192.0.2.10`. See `docs/DEPLOYMENT.md`.

## 5. Headless / Docker

The container is driven **entirely by env vars** — there is no interactive TUI:

```bash
docker run \
  -e LLM_PROVIDER=custom \
  -e CUSTOM_BASE_URL=http://host.docker.internal:8080/v1 \
  -e CUSTOM_MODEL=my-local-model \
  -e CUSTOM_API_KEY=sk-real-key \        # omit / leave placeholder for keyless
  -p 3333:3333 t3mp3st
```

- **No secrets in the image.** The Dockerfile ships **mock placeholders**
  (`CUSTOM_API_KEY=sk-REPLACE-ME`). The real key is injected at **runtime** by
  `scripts/docker-entrypoint.sh`, which never writes it into an image layer.
- **Non-blocking startup.** If the endpoint is down or has no `/models`, the
  server still boots on `CUSTOM_MODEL`. Set `T3MP3ST_VALIDATE_ON_START=1` for a
  one-shot, non-fatal endpoint check on launch.
- **On Linux**, reach the host with `--add-host=host.docker.internal:host-gateway`.

Env knobs: `LLM_PROVIDER`, `LLM_MODEL`, `CUSTOM_BASE_URL`, `CUSTOM_MODEL`,
`CUSTOM_API_KEY`, plus per-provider base-URL overrides (`OPENROUTER_BASE_URL`,
`VENICE_BASE_URL`, `ANTHROPIC_BASE_URL`, `OPENAI_API_BASE`, `NVIDIA_BASE_URL`)
and keys (`*_API_KEY`). Real env vars always win over the stored config.

---

## 6. Migration notes

- **`OPENAI_API_BASE` → `custom` provider.** Previously the only way to reach a
  local server was to override the `openai` provider's base URL via
  `OPENAI_API_BASE`. That still works, but the clean path is now the `custom`
  provider: set `LLM_PROVIDER=custom` + `CUSTOM_BASE_URL` (+ optional
  `CUSTOM_MODEL`/`CUSTOM_API_KEY`). `openai` stays pinned to `api.openai.com`.
- **Model ids are no longer hardcoded.** Don't rely on the built-in list being
  current — run `--refresh`. The static seed exists only for offline fallback.
- **Two config surfaces remain distinct.** This system configures the T3MP3ST
  **core** (`src/config` + `.env`). The **Hermes agent** is still configured by
  its own `~/.hermes/config.yaml`; the Docker entrypoint keeps them aligned by
  injecting the same `CUSTOM_*` values into both.

---

## 7. Wire-shape reference (for maintainers)

`src/llm/discovery.ts` routes by wire shape, not by provider name:

- `openai` shape → `openrouter | venice | openai | nvidia | custom`
- `anthropic` shape → `anthropic`
- `none` (no catalog) → `codex | mock | local | local-agent`

Adding a new OpenAI-compatible provider = add it to the `openai` case in
`wireShape()`, a config section + defaults, and an adapter subclass of
`OpenRouterAdapter`. See `CustomAdapter` / `NvidiaAdapter` for the pattern.
