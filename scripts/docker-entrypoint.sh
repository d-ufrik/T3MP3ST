#!/bin/sh
# T3MP3ST container entrypoint.
#
# SECURITY: the image contains NO real secrets. The API key (if any) is injected
# HERE, at runtime, from the environment — it never lands in an image layer.
# Everything is optional so the container also boots in mock/dev mode out of the box.
set -e

HERMES_CONF="${HERMES_HOME:-/root/.hermes}/config.yaml"

# Patch the Hermes agent config at runtime from env, only when a value is provided
# and is not the mock placeholder. Missing tools/config are non-fatal.
patch_conf() {
  key="$1"; val="$2"
  [ -n "$val" ] || return 0
  [ -f "$HERMES_CONF" ] || return 0
  # Temp-file rewrite instead of `sed -i` — portable across busybox/GNU/BSD sed.
  tmp="${HERMES_CONF}.tmp"
  if sed "s|${key}: \".*\"|${key}: \"${val}\"|" "$HERMES_CONF" > "$tmp" 2>/dev/null; then
    mv "$tmp" "$HERMES_CONF"
  else
    rm -f "$tmp"
  fi
}

if [ -n "${CUSTOM_API_KEY}" ] && [ "${CUSTOM_API_KEY}" != "sk-REPLACE-ME" ]; then
  patch_conf "api_key" "${CUSTOM_API_KEY}"
fi
patch_conf "base_url" "${CUSTOM_BASE_URL}"
patch_conf "default"  "${CUSTOM_MODEL}"

# Optional endpoint check — mirrors the old build-time verification but at runtime.
# NON-BLOCKING by design: a failure logs and continues so a mock/keyless or
# not-yet-up backend never prevents the server from starting.
if [ "${T3MP3ST_VALIDATE_ON_START}" = "1" ]; then
  echo "[entrypoint] validating ${LLM_PROVIDER:-custom} endpoint…"
  node dist/cli.js validate "${LLM_PROVIDER:-custom}" \
    || echo "[entrypoint] endpoint not reachable — continuing (non-blocking)."
fi

exec "$@"
