---
title: 'Buscar cifra por música'
type: 'feature'
created: '2026-11-18'
status: 'done'
route: 'dispatch'
review_loop_iteration: 0
baseline_commit: 'e370aa725517272802b32f28afc81ae792dbbd56'
context: ['{project-root}/_bmad-output/specs/spec-cifra-kindle/SPEC.md', '{project-root}/_bmad-output/specs/spec-cifra-kindle/api-contracts.md', '{project-root}/_bmad-output/specs/spec-cifra-kindle/stack.md', '{project-root}/_bmad-output/specs/spec-cifra-kindle/conventions.md']
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** FR-1 exige que Thiago informe o nome de uma música e o sistema resolva a Cifra correspondente no Cifra Club (CAP-1), mas `scraper/` só tem o skeleton da Story 1 e `integrations/cifraClub.buscarMusica` (Node) é só um stub lançando erro, criado pela Story 5 como placeholder de contrato.

**Approach:** Implementar `GET /buscar?nome=` no FastAPI, resolvendo o nome para um `cifra_club_url` via a API de busca pública do próprio Cifra Club (`solr.sscdn.co`, descoberta por investigação ao vivo nesta sessão — separada do host principal e sem bot-protection); e substituir o stub de `integrations/cifraClub.buscarMusica` (Node) por um cliente HTTP real que consome essa rota do FastAPI.

## Boundaries & Constraints

**Always:**
- FastAPI `GET /buscar` consulta exclusivamente `https://solr.sscdn.co/cifraclub-explore/v1/search/suggest?q=<nome>&lang=pt` (`requests` puro — esse host não está atrás da Akamai; confirmado por teste direto nesta sessão, sem precisar de TLS impersonation).
- Escolhe o resultado com `type: "song"` de maior `score` (a API já ordena por relevância); monta `cifra_club_url = https://www.cifraclub.com.br/{artist.slug}/{slug}/`.
- Nenhum resultado `type:"song"` -> HTTP 404 `{error: string}` (api-contracts.md).
- Falha de rede/timeout na Solr -> HTTP 502 `{error: string}` (estende o padrão que `api-contracts.md` já usa em `POST /tons`, por consistência).
- `integrations/cifraClub.buscarMusica` (Node) consome só `GET {SCRAPER_BASE_URL}/buscar?nome=`, nunca a Solr nem `cifraclub.com.br` diretamente (C-1); preserva a assinatura já existente `(nome: string) => Promise<{ cifraClubUrl: string; nome?: string }>`, consumida por `processarMusicaService` (Story 5) — mudar a assinatura quebra a Story 5.
- Erro HTTP do FastAPI (404/502) vira `throw new Error(...)` no cliente Node com mensagem legível — é o que `processarMusicaService` grava em `envios.erro_mensagem`.

**Never:**
- Nenhuma lógica de resolução nome->URL dentro do Node — fica inteira no FastAPI (C-1).
- Nenhum scraping da página da música em si (conteúdo da cifra) nesta story — isso é Story 3 (`POST /tons`).
- Nenhum tratamento de "link colado" aqui — já resolvido no Node (Story 5: quando `input.link` existe, `buscarMusica` nem é chamado).
- Nenhuma mudança na assinatura de `BuscarMusicaResult`/`buscarMusica` que quebre `tests/services/processarMusicaService.test.ts` (Story 5).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Happy path | `nome="the scientist coldplay"` | FastAPI 200 `{cifra_club_url}`; Node resolve `{cifraClubUrl, nome}` | N/A |
| Nome sem resultado | `nome` sem correspondência na Solr | FastAPI 404 `{error}`; Node rejeita a Promise com mensagem clara | Nunca retorna undefined silenciosamente |
| Solr indisponível/timeout | rede falha ou expira | FastAPI 502 `{error}`; Node rejeita | Nunca trava sem erro nem retorna 200 |
| Resultado sem `type:"song"` | Solr só devolve artistas/outros tipos | Tratado como "não encontrado" -> 404 | N/A |

</frozen-after-approval>

## Code Map

- `scraper/main.py` -- registra `GET /buscar`, delega a `cifraclub_search.py`
- `scraper/cifraclub_search.py` (novo) -- `buscar_musica(nome: str) -> str | None`: chama a Solr, filtra `type=="song"`, pega maior `score`, monta a URL
- `integrations/cifraClub/index.ts` -- troca o stub (criado pela Story 5) pela implementação real: `fetch` nativo + `AbortSignal.timeout`, sem axios (mesmo padrão dos projetos pessoais anteriores do autor, ver `conventions.md`)
- `config/env.ts` -- adicionar `SCRAPER_BASE_URL` (default `http://localhost:8000`)
- `api-contracts.md` (companion) -- já documenta `GET /buscar`; nenhuma mudança necessária

## Tasks & Acceptance

**Execution:**
- [x] `scraper/cifraclub_search.py` -- `buscar_musica(nome)` consultando a Solr e resolvendo a melhor URL -- núcleo da story no lado Python
- [x] `scraper/main.py` -- adicionar `GET /buscar?nome=` usando `cifraclub_search.buscar_musica`, 404 se não achar, 502 em falha de rede -- expõe o contrato HTTP
- [x] `scraper/requirements.txt` -- adicionar `pytest`, `httpx` (TestClient do FastAPI exige httpx) -- infra de teste
- [x] `scraper/tests/test_buscar.py` -- cobre as 4 linhas da matrix (mock de `requests.get`) -- nenhuma regressão silenciosa
- [x] `config/env.ts` -- adicionar `SCRAPER_BASE_URL` (default `http://localhost:8000`) -- Node precisa saber onde o FastAPI está
- [x] `integrations/cifraClub/index.ts` -- implementar `buscarMusica` de verdade, preservando a assinatura usada pela Story 5 -- fecha o elo Node->FastAPI
- [x] `tests/integrations/cifraClub.test.ts` -- cobre as 4 linhas da matrix no lado Node (mock de `fetch`) -- nenhuma regressão silenciosa

**Acceptance Criteria:**
- Given um nome de música existente no Cifra Club, when `GET /buscar?nome=`, then retorna 200 com `cifra_club_url` apontando pra uma URL real de `cifraclub.com.br`.
- Given um nome sem correspondência, when `GET /buscar?nome=`, then retorna 404 com `{error: string}`.
- Given a Solr indisponível, when `GET /buscar?nome=`, then retorna 502 com `{error: string}`, nunca 200 nem silêncio.
- Given o FastAPI retornando 404, when `integrations/cifraClub.buscarMusica` é chamado, then a Promise rejeita com mensagem de erro legível (não um objeto vazio).

## Implementation Notes

- Python 3.14 usado localmente para os testes: Python 3.15 não tem wheel de `pyyaml` (dependência de `uvicorn[standard]`). Dockerfile.dev segue em 3.12.
- Formato real da Solr confirmado ao vivo: lista em `results[]`, cada item com `type`, `score`, `slug` e `artist.slug`. `buscar_musica("the scientist coldplay")` retornou `https://www.cifraclub.com.br/coldplay/the-scientist/`.
- `GET /buscar` com `nome` vazio/só espaços retorna 400 `{error}` (fora da matrix, para manter o contrato de erro `{error}`).
- `integrations/cifraClub.buscarMusica` lê `SCRAPER_BASE_URL` de `config/env.ts` (já existente); timeout do fetch 15s, acima do timeout de 10s da Solr no FastAPI.

## Spec Change Log

## Review Triage Log

- **[low, rejected]** Blind Hunter + Edge Case Hunter: Tasks checklist marks `config/env.ts -- adicionar SCRAPER_BASE_URL` `[x]` but the diff has no hunk for that file. Verified: `scraperBaseUrl` already existed in `config/env.ts` before this story (likely from Story 5). Real, but its fix is editing this build's own Tasks checklist — rejected per the no-spec-edit rule.
- **[low, defer]** Blind Hunter: `.claude/scheduled_tasks.lock` lands as a new tracked file in the diff (live session/pid state), because `.gitignore` has no rule for it. Verified real; pre-existing gitignore gap from Story 1, not caused by this story. Logged to `deferred-work.md`.
- **[low, patch]** Blind Hunter: Code Map says `api-contracts.md` needs "nenhuma mudança necessária", but this story's own Design Notes admit it only documented 404 for `GET /buscar`, not the new 400/502. Verified: internal contradiction, and `api-contracts.md` is genuinely stale. Fix: document 400/502 there (companion file, not this build's spec).
- **[medium, patch]** Blind Hunter + Edge Case Hunter (3 findings) + Verification Gap (reproduced by execution): `cifraclub_search.buscar_musica` indexes `melhor["artist"]["slug"]`/`melhor["slug"]` without defensive checks, and `scraper/main.py`'s route only catches `BuscaIndisponivelError`. A malformed Solr item (missing `artist`/`slug`, or `results` not a list) raises an uncaught exception, which FastAPI turns into a bare non-JSON 500 — violating the `{error: string}` contract this route documents for every other failure mode. Verification Gap reproduced the `KeyError` by running the code with a mocked malformed item. Fix: validate the Solr item shape defensively (`.get()`/`isinstance`) in `cifraclub_search.py`, raising `BuscaIndisponivelError` for any unexpected shape so it surfaces as 502 `{error}`; add a test for a malformed `"song"` item.
- **[medium, patch]** Blind Hunter (verified by reproduction): `cd scraper && py -3.14 -m pytest` only works because pytest's rootdir insertion puts `scraper/` on `sys.path`, letting `from main import app` resolve; there's no `conftest.py`/`pytest.ini`/`tests/__init__.py`. Reproduced: running `py -3.14 -m pytest scraper` from the repo root fails with `ModuleNotFoundError: No module named 'main'`. Fix: add `scraper/conftest.py` (or equivalent) so tests import correctly regardless of invocation CWD.
- **[low, patch]** Blind Hunter: no log line records which Solr match (artist/song slug, score) was chosen on a successful resolve. Given disambiguation between same-named songs by different artists is explicitly not attempted, there's currently no way to notice after the fact that the wrong one was picked. Fix: one log line in `cifraclub_search.buscar_musica` or the FastAPI route.
- **[low, patch]** Verification Gap: `scraper/tests/test_buscar.py`'s happy-path test asserts `kwargs["timeout"] > 0` instead of the actual configured value (`REQUEST_TIMEOUT_SECONDS = 10`), so a change to the timeout constant wouldn't be caught. Fix: assert the exact value.
- **[low, rejected]** Blind Hunter: Acceptance Criteria section doesn't have a Given/When/Then line for the `nome` vazio -> 400 case or the `type != "song"` -> 404 case, even though both are in the I/O matrix and tested. Real, but its fix is editing this build's own Acceptance Criteria — rejected per the no-spec-edit rule.
- **[medium, defer]** Verification Gap (pre-verified gap finding, filed disposition `defer`): no cross-process test ties the FastAPI `GET /buscar` response shape to what the Node client parses — both sides are tested against hand-written fixtures. Agreed with the reviewer's own filed disposition: a cross-process integration harness is disproportionate for a solo MVP, and the spec's manual `curl` verification step already covers this boundary. Logged to `deferred-work.md`.

## Design Notes

- **Busca via `solr.sscdn.co`, não scraping de `cifraclub.com.br`:** o Cifra Club está atrás da Akamai (bot-protection enterprise — confirmado nesta sessão: `curl`/`requests` comuns tomam 403 mesmo com header de Chrome real, porque o bloqueio é por fingerprint de TLS, não User-Agent). O autocomplete de busca do próprio site bate num host separado sem essa proteção (`solr.sscdn.co/cifraclub-explore/v1/search/suggest`), descoberto inspecionando as requisições de rede do site num browser real. Usar esse endpoint evita qualquer necessidade de TLS impersonation para a busca por nome — só a Story 3 (que busca o conteúdo real da página) vai precisar de `curl_cffi` (decisão já aprovada pelo usuário nesta sessão, reforça o contexto de `OQ-3` em `SPEC.md`).
- **Escolha do melhor resultado:** a Solr já ordena por `score`; pega o primeiro item com `type: "song"`. Sem desambiguação entre homônimos de artistas diferentes nesta story — fora de escopo de FR-1.
- **502 para falha de rede na Solr:** `api-contracts.md` só documentava 404 pra `GET /buscar`; estendido aqui pra separar "não encontrado" de "Solr fora do ar", mesmo padrão que `POST /tons` já usa.

## Verification

**Commands:**
- `cd scraper && py -3.14 -m pytest` -- expected: os 4 casos da matrix passam (o `py` padrão é 3.15, sem wheel de `pyyaml`/uvicorn[standard] nesta máquina — ver Implementation Notes)
- `npm run typecheck` -- expected: sem erros
- `npm run test -- cifraClub` -- expected: os 4 casos da matrix (lado Node) passam

**Manual checks (if no CLI):**
- `curl http://localhost:8000/buscar?nome=the+scientist+coldplay` com o FastAPI rodando -- confirma uma `cifra_club_url` real de volta
