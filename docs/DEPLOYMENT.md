# Deployment — Docker / container ops

How to build and run T3MP3ST against a local OpenAI-compatible backend, with the
gotchas that cost real time in this session.

---

## 1. Build

Non-secret build args bake the default endpoint + model into the image (and the
Hermes config). **No secrets are baked** — the key is a runtime placeholder.

```bash
docker build \
  --build-arg CUSTOM_BASE_URL=http://192.0.2.10:8080/v1 \
  --build-arg CUSTOM_MODEL=Nvidia__qwen_qwen3-next-80b-a3b-instruct \
  -t t3mp3st:local .
```

The build warning `SecretsUsedInArgOrEnv: ENV "CUSTOM_API_KEY"` is **benign** —
the value is the mock placeholder `sk-REPLACE-ME`, not a real secret.

## 2. Run

```bash
docker run -d --name t3mp3st -p 3333:3333 \
  --add-host your-server.local:192.0.2.10 \
  -e LLM_PROVIDER=custom \
  -e CUSTOM_BASE_URL=http://192.0.2.10:8080/v1 \
  -e CUSTOM_MODEL=Nvidia__qwen_qwen3-next-80b-a3b-instruct \
  -e CUSTOM_API_KEY=sk-xxxxxxxx \
  t3mp3st:local
```

- The real `CUSTOM_API_KEY` is injected **at runtime** and patched into the Hermes
  config by `scripts/docker-entrypoint.sh` — it never enters an image layer.
- Leave `CUSTOM_API_KEY` as the placeholder for **keyless** local servers.
- Set `-e T3MP3ST_VALIDATE_ON_START=1` for a **non-blocking** endpoint check on
  boot (logs a warning if unreachable; never blocks startup).

## 3. The two gotchas that waste time

### 3a. `.local` mDNS does not resolve inside a container

`your-server.local` resolves on the **host** (→ `192.0.2.10`) but **not** inside the
container (no mDNS resolver). Options:

- Use the **IP** in `CUSTOM_BASE_URL` (simplest), **or**
- Add `--add-host your-server.local:192.0.2.10` so the container can resolve the name
  (then you may type `http://your-server.local:8080/v1` in the UI too).

OrbStack bridges container networking to the host LAN, so the LAN **IP** is
reachable from the container either way.

### 3b. `192.0.2.99` is a DEAD IP — use `192.0.2.10`

The old `.env`/docs carried `192.0.2.99`. That host does **not** respond.
`your-server.local` = **`192.0.2.10`**. A `fetch failed` / "Could not fetch models"
almost always means the wrong IP, **not** a code bug. Confirm:

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://192.0.2.10:8080/v1/models   # 401 (alive, needs key)
curl -s -o /dev/null -w "%{http_code}\n" http://192.0.2.99:8080/v1/models   # 000 (dead)
```

## 4. Port note

The server listens on **`T3MP3ST_PORT`** (default `3333`). The Dockerfile's
`ENV PORT=3333` is **unused** — set `T3MP3ST_PORT` if you need a different port.

## 5. Verify a running container

```bash
docker ps --filter name=t3mp3st                 # healthy
curl -s -X POST localhost:3333/api/models \
  -H 'Content-Type: application/json' -d '{"provider":"custom"}'   # live model list

# routing proof — real completion from the local model:
curl -s -X POST localhost:3333/api/llm/chat -H 'Content-Type: application/json' \
  -d '{"message":"Reply with exactly OK","provider":"custom","model":"<id>"}'
```

## 6. Env var reference

| Var | Purpose |
|---|---|
| `LLM_PROVIDER` | select the default backbone (`custom` for local) |
| `LLM_MODEL` | override the default model |
| `CUSTOM_BASE_URL` | local OpenAI-compatible endpoint (include `/v1`) |
| `CUSTOM_MODEL` | default model for the custom provider |
| `CUSTOM_API_KEY` | key for the custom endpoint (optional/keyless) |
| `OPENROUTER_BASE_URL`, `VENICE_BASE_URL`, `ANTHROPIC_BASE_URL`, `OPENAI_API_BASE`, `NVIDIA_BASE_URL` | per-provider base-URL overrides |
| `*_API_KEY` | per-provider keys |
| `T3MP3ST_PORT` | server port (default 3333) |
| `T3MP3ST_VALIDATE_ON_START` | `1` = non-blocking endpoint check on boot |
| `T3MP3ST_HOST` | bind host (default `0.0.0.0` in-container) |
