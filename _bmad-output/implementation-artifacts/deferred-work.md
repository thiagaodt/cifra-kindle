# Deferred Work

- source_spec: `_bmad-output/specs/spec-cifra-kindle/stories/2-buscar-cifra-por-musica.md`
  summary: `.claude/scheduled_tasks.lock` keeps showing up as an untracked/new file in diffs and commits because `.gitignore` has no rule for it.
  evidence: Confirmed present as runtime/session state (sessionId, pid, procStart, acquiredAt) — not project content. Pre-existing gitignore gap from Story 1, not caused by Story 2; trivial fix is adding a `.claude/*.lock` (or similar) rule to `.gitignore`.

- source_spec: `_bmad-output/specs/spec-cifra-kindle/stories/2-buscar-cifra-por-musica.md`
  summary: No cross-process integration test ties the FastAPI `GET /buscar` response shape to what the Node `integrations/cifraClub.buscarMusica` client parses — both sides are tested against hand-written fixtures, so a field-name drift on either side would ship silently.
  evidence: Verification-gap reviewer confirmed by searching the repo that no test starts the real scraper and calls the real Node client against it; filed its own disposition as `defer` since building a cross-process harness is disproportionate for a solo MVP, and the spec's manual `curl` verification step already covers this boundary at the human-verification level. If `buscarMusica`/`GET /buscar` schema ever drifts, it would fail loudly in production with a clear "Resposta inválida" error — not silently.
