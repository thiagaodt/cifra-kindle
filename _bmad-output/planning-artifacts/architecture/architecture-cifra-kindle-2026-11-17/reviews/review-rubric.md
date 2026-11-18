---
title: Review — ARCHITECTURE-SPINE.md (Adaptador de Cifras para Kindle)
reviewed: ARCHITECTURE-SPINE.md (architecture-cifra-kindle-2026-11-17)
against: prd.md (prd-cifra-kindle-2026-11-15)
reviewer: Claude (architecture-spine rubric review)
date: 2026-11-17
---

# Review — Architecture Spine: Adaptador de Cifras para Kindle

**Note on prompt-injection check:** Both source files (ARCHITECTURE-SPINE.md and prd.md) were read in full looking for any text directed at an AI/agent (hidden instructions, "ignore previous instructions," white-on-white text, etc.). None was found. Nothing to report on that front.

## Overall Verdict

Mostly solid and appropriately scoped for a solo hobby MVP — the seven ADs correctly identify and lock down the real divergence points for FR-1 through FR-4 (language boundary, transposition delegation, EPUB shape, live-tone-switch semantics, layered backend flow, validation, data model). The one real structural hole is the **operational/local-runtime envelope**: how Python+Node actually get started together, env var propagation across the two runtimes, and the dev/"prod" split are left as a genuinely silent gap — not decided, not flagged as Deferred, not an Open Question. That's the one finding that should block calling this "final" as-is; everything else is minor/cosmetic.

## Findings

### 1. [Significant] Operational/local-runtime envelope is a silent gap, not a Deferred item

The Structural Seed diagram shows three runtime processes (Next.js :3010, Express :3333, FastAPI :8000) plus Postgres, and only Postgres is explicitly labeled `"Docker"`. Nothing in the spine says:

- How Express and FastAPI are actually started together for local dev (single `docker-compose up`? an npm script with `concurrently`/`turbo`? two manual terminals + `uvicorn`?).
- Whether Express/Next/FastAPI run in containers at all, or only Postgres does, with the Node/Python processes running natively on the host.
- How env vars/secrets are shared across the Node and Python processes — `config/env.ts` is specified for the Node side only (one line under "State & cross-cutting": "config via `.env` + `config/env.ts` tipado"); nothing says whether FastAPI reads the same `.env`, a separate one, or hardcoded config, and nothing covers SMTP credentials / Approved Sender address propagation to whichever service sends mail.
- Bootstrap order/dependencies (Postgres up → migrations run → Express starts) and the command(s) to do it.
- Whether there is any meaningful "prod" for this MVP at all, given cloud deploy is explicitly out of scope — i.e., an explicit one-line statement that "local Docker/laptop *is* the only environment for MVP, dev and prod are the same thing" is never made, even though it's implied by combining the Deferred "VPS deploy" item with the "localhost" framing.

This matters precisely because the project is pipes-and-filters across a language boundary (AD-1) — the exact seam most likely to rot if two future stories each assume a different way to bring the stack up. It should be either a decided AD (e.g., "all services run via one `docker-compose.yml`; FastAPI and Node each read from the same root `.env`") or, at minimum, an explicit **Deferred** entry so a future reader knows it was noticed and punted, rather than simply absent.

### 2. [Minor] Stack table: verification claim is inconsistent across rows, and two entries are floor-only ranges

Only **FastAPI 0.163.0** carries an explicit verification claim: "(verificado em 2026-11-17)". None of the other ten stack rows (Node, TypeScript, Express, Knex, pg, Zod, Vitest, Next.js, React/React DOM, PostgreSQL, Python) carry any verification annotation at all. Per the review brief this reviewer isn't re-verifying versions, but the spine's own claims should be checked for consistency — and the pattern here reads as "one row was actually checked and dated; the rest may or may not have been." Separately, `Node.js >=20` and `Python >=3.12` are floor-only ranges rather than pinned versions, which for an architecture document meant to fix divergence is weaker than the exact-pin style used for everything else (e.g. `Zod ^4.6.7`, `Next.js ^16.4.3`) — two machines building this a year apart could land on meaningfully different Node/Python minors. Worth either dating/verifying all rows the same way, or dropping the single date stamp so the table doesn't imply an uneven level of rigor.

### 3. [Minor] Logging is simultaneously "decided" and "Deferred"

Consistency Conventions states logging is **decided**: "logging via console estruturado (sem lib dedicada no MVP)". The Deferred section then lists "Observabilidade/logging estruturado: **não definido**; console logging básico é aceitável para uso solo no MVP." These two statements aren't contradictory in substance (both land on "plain console logging for MVP") but they're worded as opposite epistemic states (decided vs. not-yet-decided) in two different sections of the same document — a future reader skimming only one section could come away with the wrong impression of whether this is settled.

### 4. [Minor] PRD's OQ-4 (latency goal) claimed resolved "na fase de arquitetura" but has no corresponding AD

The PRD (§9) states: "OQ-1 (formato do Arquivo pronto), OQ-2 (mecanismo de transposição) e **OQ-4 (meta de latência)** foram resolvidas na fase de arquitetura." OQ-1 and OQ-2 map cleanly to AD-3 and AD-2 respectively. OQ-4 (no numeric latency target locked) has no explicit counterpart anywhere in the spine — not an AD, not a line in Consistency Conventions, not in Deferred. The "resolution" may simply be "architecture made no latency commitment, consistent with the PRD's NFR," but the spine never says so explicitly, leaving a small traceability gap between what the PRD claims was resolved and what the spine actually shows.

### 5. [Cosmetic] Mechanical nits
- **AD field ordering inconsistency:** AD-1 orders its bullets Binds → Prevents → Rule; every other AD (AD-2 through AD-7) orders Binds → Rule → Prevents. Purely cosmetic, but worth normalizing for a document meant to be a stable reference pattern.
- **Undefined jargon:** Design Paradigm section references "convencao pessoal do autor (projetos pessoais anteriores)" — this shorthand isn't defined anywhere in the spine or PRD. Presumably refers to prior personal projects/conventions, but as written it's opaque to anyone (including a future Thiago) without that context.
- Mermaid diagrams (both flowcharts and the `erDiagram`) all look syntactically valid, including the `[("...")]` cylinder/database node shape used twice and the `erDiagram` relationship cardinality `||--o{`.
- AD IDs (AD-1 … AD-7) are sequential and not reused.
- No empty or placeholder sections — Design Paradigm, Invariants & Rules, Consistency Conventions, Stack, Structural Seed, Capability → Architecture Map, and Deferred are all substantively filled in.

## Checklist Walkthrough

| Checklist item | Verdict |
| --- | --- |
| Fixes real divergence points for the level below, misses none | Mostly yes — the 7 ADs cover the real seams (language boundary, transposition source of truth, EPUB shape/navigation, live-tone-switch semantics, backend layering, validation, data model). Misses the local multi-service runtime/env-var seam (Finding 1). |
| Every AD's Rule is enforceable and prevents its stated divergence | Yes for all 7 — each rule is concrete enough to check by code review/grep (no `child_process`/cross-language import; no local transposition engine; exactly one EPUB with 12 linked sections; no network-triggered tone switch; strict layer call direction; Zod-before-controller; two tables with app-level status validation, not a native enum). None are vague puffery. |
| Nothing under Deferred could silently let two independently-built units diverge on something that matters | The listed Deferred items (ToS check, Fase 2 repertoire, multiuser/VPS, observability, cache) are all safe to defer for this scope. The actual risk is the item that is **not** in Deferred at all — the local-runtime/env-var seam (Finding 1) — which is a bigger problem than anything that *is* deferred. |
| Named tech versions plausible as currently-verified; flag unpinned/guess-looking entries | Only FastAPI carries an explicit "verificado em" claim; the rest don't carry that claim either way (Finding 2). `Node >=20` and `Python >=3.12` are floor ranges, not pins. |
| Ratifies existing personal conventions (routes→controllers→services→repositories, apps/web Next.js, Knex+Postgres, Zod) rather than inventing something incompatible | Yes, explicitly — AD-5 and AD-6 are marked `[ADOPTED]` and match the stated convention precisely; `apps/web` and repository-only Postgres access are both present and consistent. |
| Covers FR-1 to FR-4 via Capability → Architecture Map | Yes — all four FRs have their own row with code location and governing AD(s), plus an extra row for history/progress UI. |
| Every dimension this spine should own is decided/deferred/flagged, nothing silently unaddressed | Mostly, with the one exception being Finding 1 (local multi-service orchestration, cross-runtime env var sharing, dev/prod split for an MVP that has no real "prod"). |
| Mechanical quality: no empty sections, valid mermaid, stable/sequential/non-reused AD IDs | Yes, with only cosmetic nits (Finding 5). |

## Bottom line

One real gap worth fixing before calling this spine final: add either a decided AD or an explicit Deferred line covering how the Node and Python processes are actually brought up together locally and how env vars/secrets are shared between them. Everything else is polish (version-verification consistency, one wording contradiction on logging, a missing OQ-4 cross-reference, and a couple of cosmetic formatting nits).
