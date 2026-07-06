# 🌩️ T3MP3ST

<!-- ⊰ sharp eye on the raw source. there's a flag for the curious: T3MP3ST{r3c31pt5_n0t_v1b3z} — the one that counts, you earn: run `npm run verify-claims`. LOVE PLINY ⊱ -->

```
 ▄▄▄█████▓▓█████  ███▄ ▄███▓ ██▓███  ▓█████   ██████ ▄▄▄█████▓
 ▓  ██▒ ▓▒▓█   ▀ ▓██▒▀█▀ ██▒▓██░  ██▒▓█   ▀ ▒██    ▒ ▓  ██▒ ▓▒
 ▒ ▓██░ ▒░▒███   ▓██    ▓██░▓██░ ██▓▒▒███   ░ ▓██▄   ▒ ▓██░ ▒░
 ░ ▓██▓ ░ ▒▓█  ▄ ▒██    ▒██ ▒██▄█▓▒ ▒▒▓█  ▄   ▒   ██▒░ ▓██▓ ░
   ▒██▒ ░ ░▒████▒▒██▒   ░██▒▒██▒ ░  ░░▒████▒▒██████▒▒  ▒██▒ ░
   ▒ ░░   ░░ ▒░ ░░ ▒░   ░  ░▒▓▒░ ░  ░░░ ▒░ ░▒ ▒▓▒ ▒ ░  ▒ ░░
     ░     ░ ░  ░░  ░      ░░▒ ░      ░ ░  ░░ ░▒  ░ ░    ░
   ░         ░   ░      ░   ░░          ░   ░  ░  ░    ░
             ░  ░       ░               ░  ░      ░
```

<div align="center">

**A multi-agent offensive-security framework, built to turn the AI coding agent you already run into a zero-day hunter.**

![scores: re-derivable](https://img.shields.io/badge/scores-re--derivable-brightgreen) &nbsp; ![verify-claims 24/24](https://img.shields.io/badge/verify--claims-24%2F24-brightgreen) &nbsp; ![PRs welcome](https://img.shields.io/badge/PRs-welcome-purple) &nbsp; ![License: AGPL-3.0](https://img.shields.io/badge/License-AGPL--3.0-blue)

</div>

Point T3MP3ST at an authorized target and the kill chain is yours — **recon → exploit → report**, from a web War Room or the CLI, driven by the AI coding agent you're already signed into (Claude Code, Codex, Hermes). No new API keys, no cloud, no second bill. Your agent is the brain; T3MP3ST is the war machine you bolt around it. Self-hosted storm, keyless warfare. ⚡

---

## 🔱 What's different in this fork ([d-ufrik/T3MP3ST](https://github.com/d-ufrik/T3MP3ST))

This fork adds **local-inference support and live model discovery** on top of upstream:

- **Use your own local inference.** Point T3MP3ST at anything **OpenAI-compatible** you've already deployed (vLLM, llama.cpp, LM Studio, Ollama's OpenAI shim, an in-house proxy) via a new **`custom`** provider — set a base URL, key optional (keyless servers work).
- **Added NVIDIA as a provider** — NVIDIA NIM (`integrate.api.nvidia.com/v1`), because the API keys are free. 😄
- **Model retrieval instead of hardcoded lists** — fetches the latest model list straight from each provider's own `/models` endpoint, so the catalog is never stale (the old hardcoded list is now just an offline fallback).
- **Fixed the routing bug** where everything defaulted through OpenRouter regardless of the selected provider — now the provider you pick actually drives missions, the Admiral, and chat (incl. your local box). This included a second hardcoded path in **Op Admiral** that forced any `sk-…` key to OpenAI (`401` errors); it honors your selection now too.
- **Active-backbone visibility** — the Admiral panel shows a live `provider · model` badge and logs the exact backbone it's using, so it's always clear which model is running the op.

📖 **Docs:** local setup → [`docs/LOCAL_MODELS.md`](docs/LOCAL_MODELS.md) · the routing fix → [`docs/ROUTING_FIX.md`](docs/ROUTING_FIX.md) · Docker/ops → [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md). No secrets ship in the image — keys are injected at runtime.

### 📓 Changelog

Full history: **[`docs/CHANGELOG.md`](docs/CHANGELOG.md)**. Latest:

- **2026-07-05 (patch)** — Op Admiral now routes to the selected provider (was forcing `sk-` keys to OpenAI); added the active-backbone badge + log line.
- **2026-07-05** — Local OpenAI-compatible inference (`custom` provider), NVIDIA NIM provider, live `/models` discovery (no more hardcoded lists), the OpenRouter routing fix, and a secret-free Docker image.

---

The recon engine is live and tool-backed, and the exploit loop is benchmark-proven: **90.1% pass@1 on XBEN** — XBOW's own 104-challenge suite — every solve graded against a committed flag oracle that `verify-claims` recomputes on demand (reproducible below). Then it went hunting COLD on a **held-out set of 10 real CVEs disclosed in 2026, across 7 languages** — post-cutoff bugs the hardened prompts were never tuned on. A single agent **pinned 8/10 to the exact file, line, and CWE** (verified all-exact, stable under re-scoring), and the full pack surfaced all 10 (`verify-claims` recomputes it from the raw findings; small n, reported honestly as directional). Memorization *and* overfitting, both off the table. The full 8-operator swarm is the architecture it grows into; the [status table](#what-ships-today) is exact about what's live, what's scaffolding, and what's still roadmap. Loud about the mission, honest about where the build is.

Three things set it apart:

1. **Reproducible.** Every number in this README recomputes from committed data — `npm run verify-claims` re-derives all of them, 24/24 green. A claim that can't be reproduced doesn't ship. No trust-me numbers, ever.
2. **Keyless.** The AI coding agent already on your machine is the backbone. No API keys, no second bill, no gatekeeper.
3. **Honest about scope.** The [status table](#what-ships-today) marks exactly what's stable, experimental, or roadmap — because red-teaming shouldn't be a priesthood, and it damn sure shouldn't run on vibes.

## ⚠️ Authorized use only

T3MP3ST is an **offensive** security tool, built for **authorized** testing, research, and education. Point it **only** at systems you own or have **explicit, written permission** to test. Unauthorized access to computers, networks, or data is illegal in most jurisdictions — **you alone are responsible** for how you use this software and for staying inside the law and your rules of engagement. Bring the storm to *your* targets, not someone else's.

T3MP3ST is provided **as-is under the AGPL-3.0 license, with no warranty and no liability** for any damage, loss, or misuse. The authors do not endorse, support, or condone unauthorized activity. Get permission. Stay in scope. Don't be a menace. 🫡

## Why it exists

Offensive security sits behind years of practice and expensive tooling. The bet behind T3MP3ST is that a coordinated agent swarm puts real bug-hunting in reach of people who never got the invite, across web apps, CTFs, smart contracts, source code, and embedded/robotics OSS. That is an ambitious bet, and the sections below are careful to separate what already works from what is still a bet.

## What it hunts

| Domain | What it does | Status |
|---|---|---|
| 🕸️ **Web apps** | Black-box, external-attacker recon → exploit (XBEN suite) | ✅ Stable |
| 🚩 **CTF** | Hint-free, sandbox-jailed solves (Cybench) | ✅ Stable |
| 🤖 **Robotics / OT / embedded** | Coordinated-disclosure pipeline for OSS vuln hunting (OSV + live-PoC + refuter) | ✅ Pipeline stable |
| 📂 **Source code** | White-box repo analysis with blind master-builder decomposition | ⚠️ Python-only ingest |
| 💰 **Smart contracts** | Damn Vulnerable DeFi | ⚠️ reproduction, not novel discovery |

## Quick start

Fastest path to a running War Room (keyless, ~2 min to set up; mission time depends on the target):

```bash
npm install
npm run server        # War Room → http://127.0.0.1:3333/ui/
```

In the War Room, open **Settings** and connect a local agent (Claude Code / Codex / Hermes). Then describe a target to **Op Admiral** in plain English and launch. The agent you connected is the brain. No key required.

Prefer to bring a key? Set one and skip the connect step:

```bash
export OPENROUTER_API_KEY=...     # or VENICE_API_KEY / ANTHROPIC_API_KEY
```

Check the numbers for yourself:

```bash
npm run verify-claims             # re-derives every headline from committed JSON in bench/
```

Library/SDK usage, the full HTTP API, and MCP setup live in [docs/](docs/).

## What ships today

The framework is an 8-operator kill chain, and this table won't blow smoke about it. **Recon is a live, tool-backed engine** — and the teeth are already real: 90.1% pass@1 on XBEN, 8/10 held-out post-cutoff CVEs pinned to exact file/line/CWE, and a coordinated-disclosure pipeline that's live enough to have drafts held for vendor coordination right now. What's *not* proven is the swarm. Each downstream operator — Exploiter, Infiltrator, Exfiltrator, Ghost — runs the **same real, tool-backed ReAct loop as recon** (real exploit tools, not stubs), but the headline numbers came from a single agent, not the coordinated 8-operator cell, and end-to-end swarm exploitation is unbenchmarked and still unreliable. The engine is real; the swarm is the part still earning its stripes. Loud where we've earned it, blunt about the rest.

| Component | Status | Notes |
|---|---|---|
| Re-derivable measurement (`verify-claims`) | ✅ Stable | every headline recomputes from committed artifacts |
| Recon engine | ✅ Stable | drives nmap / DNS / HTTP / fingerprinting; every finding traces to real tool output |
| Mission engine + War Room + Op Admiral | ✅ Stable | keyless through a connected local agent |
| Arsenal, MCP server, HTTP API | ✅ Stable | 35 built-in tools by default; 83 with the opt-in `T3MP3ST_FULL_ARSENAL` (+48 adapters, with the dangerous post-ex drivers — metasploit, hydra — behind a human-approval gate) — both counts re-derive via `verify-claims`. `security_recon` over MCP |
| Egress-scope containment | ✅ Stable (on by default) | once a mission target is set, built-in networked tools refuse off-scope public hosts — not the target/subdomains, not loopback/private (`SCOPE DENIED`) — a tightened default, not a bare tool runner |
| Coordinated-disclosure pipeline | ✅ Stable | OSV novelty + live PoC + refuter panel + CVSS; drafts only, a human sends |
| White-box source analysis | ⚠️ Experimental | Python-only regex ingest; multi-model decomposition costs more tokens, not fewer |
| DeFi (Damn Vulnerable DeFi) | ⚠️ Experimental | reproduces known exploit classes; not novel discovery |
| Exploiter / Infiltrator / Exfiltrator / Ghost | ⚠️ Experimental | run the real tool-backed ReAct loop (same engine as recon); unproven as a coordinated swarm — single-agent is the benchmarked path, live swarm exploitation still unreliable |
| Advanced modules (cloud, persistence, swarm, cognition) | 🚧 Planned | interface-only in `src/stubs/` |
| Self-improvement loop | 🧪 Research | records lessons + proposals today; feeding them back into planning is roadmap |

Full feature-by-feature breakdown: [FEATURES.md](FEATURES.md).

## Coverage by domain

Where the storm reaches today — and where it's headed. Same discipline as everything else: a domain is ✅ only when there's a receipt behind it.

| Domain | What it covers | Status |
|---|---|---|
| 🕸️ **Web** | apps, APIs, auth flows, OWASP Top 10 | ✅ **Core** — XBEN 90.1% pass@1 |
| 📂 **Code** | white-box source audits, SAST-style vuln hunting | ✅ **Proven (hunt result)** — held-out CVE-Zero: single-agent 8/10 exact file/line/CWE, 10/10 found (7 languages); the repo-ingest *engine* itself is still ⚠️ experimental |
| 🚩 **CTF** | wargames, practice ranges, challenges | ✅ **Proven** — Cybench 23/40 hint-free |
| 🔌 **Network / Infra** | recon, service/stack fingerprinting; lateral + privesc | ✅ recon (live nmap/DNS/HTTP engine) · ⚠️ lateral/privesc experimental |
| 🤖 **Embedded / IoT / OT** | firmware, robotics, ICS/SCADA OSS | ✅ **CVE pipeline live** — coordinated-disclosure drafts held for vendors |
| 📦 **Supply chain** | dependency audits, install-without-confirmation | ⚠️ **Real** — dedicated class; hit a CWE-829 on the held-out set |
| 💰 **Blockchain** | smart contracts, DeFi, Solidity | ⚠️ **Reproduction only** — Damn Vulnerable DeFi, not novel discovery |
| ☁️ **Cloud** | AWS/GCP/Azure misconfig, IAM, serverless | 🚧 **In development** |
| 📱 **Mobile** | Android/iOS app security | 🚧 **In development** |
| 🏢 **Identity / AD** | Kerberos, pass-the-hash, AD attacks | 🚧 **In development** |
| 🔐 **Binary / RE** | overflows, ROP, exploit dev | 🚧 **In development** — needs specialized tooling |

The class/squad architecture means new domains *compose* rather than fork — each is a loadout (specialist classes + arsenal + target adapter + a benchmark). 🚧 domains ship dark until they have a number.

## Benchmarks

Headline results. Each recomputes from the committed JSON with `npm run verify-claims`; full methodology and caveats are in the linked docs.

| Suite | Result | Context |
|---|---|---|
| **XBEN** — XBOW's 104-challenge suite, black-box | **pass@1 mean 90.1%** (Wilson-95 86.2–92.9), floor 91/104 · gpt-5.5 | XBOW self-reports 85% on the same suite; ours re-derives the graded verdict from committed artifacts (raw transcripts stripped for privacy) |
| **XBEN** — white-box (reported separately) | pass@1 98.7%, best-ball 104/104 · gpt-5.5 | never blended with the black-box number |
| **Cybench** — 40-task academic bench, Opus 4.8, no hints | **23/40 (58%) hint-free, single-run pass@1** (`verify-claims`-enforced) | not the raw-score record (Anthropic: 76.5% pass@10); every flag graded against the committed oracle |
| **CVE-Zero** — 10 real post-cutoff (2026) CVEs, **held-out**, 7 languages | **single-agent 8/10 exact file/line/CWE** (verified all-exact, stable) · **10/10 found** (full pack) | **memorization- & fitting-proof**: post-cutoff, and the hardened prompts were never tuned on these; `verify-claims` recomputes it. n=10, directional; the swarm's edge here is recall, not a coordination-beats-solo proof |

**How to read these:**

- Every solved flag is graded against a committed ground-truth oracle — not a self-report — and `verify-claims` recomputes the pass/fail. Raw per-step transcripts are stripped for operator privacy, so you re-check the **graded verdict**, not the raw tool output. Zero fabricated, enforced by an anti-fitting guard that runs on every push.
- Black-box (source withheld) and white-box (source staged) are reported separately and never blended.
- These ran a **single-agent ReAct loop, not the 8-operator swarm.** The swarm is framework architecture; it is not what scored these numbers.
- Results are system-vs-system: this harness driving a strong current model, not an isolated-harness claim.

XBOW self-reports 85% on its own suite; T3MP3ST scores **90.1%** on that same suite — mean, with a Wilson-95 floor of 86.2%. But the number isn't the flex — the **receipt** is. Every point recomputes from committed artifacts with one command: `npm run verify-claims`, each solve graded against a committed flag oracle (raw transcripts are stripped for operator privacy, so you re-check the verdict, not the tool output). A keyless, open-source harness that hands you the re-run instead of asking you to trust it. Clone it, run `verify-claims`, and re-check every verdict against its committed oracle yourself (verdicts recompute from committed data; raw transcripts are stripped for privacy).

Deeper reading: [WALL_FORENSICS](docs/WALL_FORENSICS.md) (per-challenge misses), [CYBENCH](docs/CYBENCH.md), [INTEGRITY_LEDGER](docs/INTEGRITY_LEDGER.md) (contamination audit and every retraction), [OBSIDIVM](docs/OBSIDIVM.md) (our own live web range).

## Documentation

| Doc | Contents |
|---|---|
| [FEATURES.md](FEATURES.md) | feature-by-feature status (`[x]` shipped / `[~]` partial / `[ ]` planned) |
| [SCOPE_AND_AUTHORIZATION](docs/SCOPE_AND_AUTHORIZATION.md) | authority model, scope receipts, evidence and retest rules |
| [TEAM_PREVIEW](docs/TEAM_PREVIEW.md) | first-run path and review script |
| [INSTALL_MATRIX](docs/INSTALL_MATRIX.md) | macOS / Linux readiness table |
| [ARSENAL_ACTIVATION_PLAN](docs/ARSENAL_ACTIVATION_PLAN.md) | optional external-tool setup |
| [CYBENCH](docs/CYBENCH.md) · [WALL_FORENSICS](docs/WALL_FORENSICS.md) · [INTEGRITY_LEDGER](docs/INTEGRITY_LEDGER.md) · [COGNITIVE_ARCHITECTURE](docs/COGNITIVE_ARCHITECTURE.md) | benchmark methodology |
| [RELEASE_CHECKLIST](docs/RELEASE_CHECKLIST.md) | the gates a release must pass |

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        T3MP3ST COMMAND                          │
├─────────────────────────────────────────────────────────────────┤
│   MISSION CONTROL  ◄──  TARGET MODEL  ──►  ARSENAL (TOOLS)       │
│                          ▲                                       │
│   AGENT CELL:  RECON · SCANNER · EXPLOITER · INFILTRATOR ·       │
│                EXFILTRATOR · GHOST · COORDINATOR · ANALYST       │
│                          ▲                                       │
│   EVIDENCE VAULT  ·  CREDENTIAL STORE  ·  FINDINGS LEDGER        │
│                          ▲                                       │
│   OPSEC LAYER  ·  COMMS CHANNEL  ·  LLM BACKBONE                 │
└─────────────────────────────────────────────────────────────────┘
```

Operators map to MITRE ATT&CK and Cyber Kill Chain phases (recon is live; later phases are scaffolded):

| Operator | Phase | MITRE | Function |
|---|---|---|---|
| **Recon** | Reconnaissance | TA0043 | OSINT, network discovery, asset enumeration |
| **Scanner** | Discovery | TA0007 | vulnerability scanning, service fingerprinting |
| **Exploiter** | Initial Access | TA0001 | exploitation, payload delivery |
| **Infiltrator** | Lateral Movement | TA0008 | post-exploitation, privilege escalation |
| **Exfiltrator** | Collection / Exfil | TA0009/10 | data extraction, credential harvesting |
| **Ghost** | Persistence | TA0003 | persistence, stealth, cleanup |
| **Coordinator** | Command & Control | TA0011 | mission control, orchestration |
| **Analyst** | Analysis | — | pattern analysis, reporting |

**Providers:** OpenRouter, Venice, Anthropic, OpenAI, or a keyless local agent (Claude Code / Codex / Hermes). Set `OPENROUTER_API_KEY` / `VENICE_API_KEY` / `ANTHROPIC_API_KEY`, or connect an agent in Settings.

**Integrations:** `node dist/mcp-server.js` exposes `security_recon` to MCP-aware agents. `npm run server` starts the HTTP API (`POST /api/mission/start`, `GET /api/mission/status`, and more). Full reference in [docs/](docs/).

## Contributing — join the swarm

Red-teaming shouldn't be a priesthood. Bring an adapter, a prompt pack, a runbook, a new arsenal tool, or a bug report.

**One rule, non-negotiable:** everything here is for **authorized testing only**. Owned, scoped, or consenting targets. Build for defenders, or don't build it here.

1. Fork it, branch it.
2. Open a PR with tests. If you touch a headline number, `npm run verify-claims` has to stay green.

Release process and gates: [RELEASE_CHECKLIST](docs/RELEASE_CHECKLIST.md).

## License

AGPL-3.0. See [LICENSE](LICENSE).

---

<div align="center">

*Fortes fortuna iuvat* — fortune favors the bold.

⊰•-•✧ LOVE PLINY ✧•-•⊱ 🌩️

</div>
