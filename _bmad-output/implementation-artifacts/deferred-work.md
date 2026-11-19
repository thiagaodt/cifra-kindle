# Deferred Work

- source_spec: `_bmad-output/specs/spec-cifra-kindle/stories/2-buscar-cifra-por-musica.md`
  summary: `.claude/scheduled_tasks.lock` keeps showing up as an untracked/new file in diffs and commits because `.gitignore` has no rule for it.
  evidence: Confirmed present as runtime/session state (sessionId, pid, procStart, acquiredAt) — not project content. Pre-existing gitignore gap from Story 1, not caused by Story 2; trivial fix is adding a `.claude/*.lock` (or similar) rule to `.gitignore`.

- source_spec: `_bmad-output/specs/spec-cifra-kindle/stories/2-buscar-cifra-por-musica.md`
  summary: No cross-process integration test ties the FastAPI `GET /buscar` response shape to what the Node `integrations/cifraClub.buscarMusica` client parses — both sides are tested against hand-written fixtures, so a field-name drift on either side would ship silently.
  evidence: Verification-gap reviewer confirmed by searching the repo that no test starts the real scraper and calls the real Node client against it; filed its own disposition as `defer` since building a cross-process harness is disproportionate for a solo MVP, and the spec's manual `curl` verification step already covers this boundary at the human-verification level. If `buscarMusica`/`GET /buscar` schema ever drifts, it would fail loudly in production with a clear "Resposta inválida" error — not silently.

- source_spec: `_bmad-output/specs/spec-cifra-kindle/stories/5-enviar-para-o-kindle.md`
  summary: No envio por `link`, `musicas.nome` e o filename do EPUB no Kindle ficam sendo a URL crua, pois o scraper não extrai título a partir de uma URL direta.
  evidence: Decisão do Thiago em 2026-11-19 (intent_gap): aceitar a URL como nome de exibição no MVP. Melhoria futura = rota FastAPI que extrai o título da página + cliente Node.

- source_spec: `_bmad-output/specs/spec-cifra-kindle/stories/5-enviar-para-o-kindle.md`
  summary: `config/env.ts` `toNumber` não rejeita valores negativos/`Infinity` (ex.: `PORT=-1`).
  evidence: Pré-existente da Story 1; Story 5 só reusa o helper. Deferido no review.

- source_spec: `_bmad-output/specs/spec-cifra-kindle/stories/2-buscar-cifra-por-musica.md`
  summary: `scraper/cifraclub_search.py` faz `requests.get` próprio, sem a validação de host/redirect da Story 3 (`_buscar_soup` em `cifraclub_tons.py`); o scraper tem dois caminhos HTTP independentes (achado A2 da retrospectiva).
  evidence: `scraper/cifraclub_search.py:45` vs `scraper/cifraclub_tons.py:78-113`. A busca bate numa API de busca fixa, risco baixo. Melhoria futura = unificar o acesso HTTP num único helper validado.

- source_spec: `_bmad-output/specs/spec-cifra-kindle/stories/6-suporte-a-capotraste.md`
  summary: A busca (`cifraclub_search`) pode devolver o slug de um medley sem cifra (ex.: `legiao-urbana/pais-e-filhos`), que agora falha com 502 claro em `/tons`; a cifra existe em outra URL (`/legiao-urbana/pais-filhos/`).
  evidence: Não verificado: hipótese levantada ao resolver B3 da retrospectiva. Verificar rodando `GET /buscar` com "Legião Urbana Pais e Filhos" contra o Cifra Club real.

- source_spec: `_bmad-output/specs/spec-cifra-kindle/SPEC.md`
  summary: Limitação aceita (B2): o rótulo de tom do Cifra Club não é validado contra os acordes impressos; em Yellow (Coldplay) o botão diz E e o conteúdo está em B, então "Tom C" mostra acordes de G (deslocamento constante nas 12 versões).
  evidence: Decisão por delegação em 2026-11-19 ("mata todos os action items"): manter C-3 (confiar no rótulo), sem heurística de dedução pelos acordes. O Thiago pode sobrescrever. Risco: leitura errada no palco para músicas com rótulo errado na origem.

- source_spec: `_bmad-output/specs/spec-cifra-kindle/SPEC.md`
  summary: Pendente: validar o envio real ao Kindle (CAP-3 e CAP-4 no aparelho), incluindo tom de abertura, links entre tons e alinhamento.
  evidence: Retrospectiva, item de ação 3. A verificação rodou só contra SMTP local descartável. Depende do Thiago: preencher `SMTP_USER`, `SMTP_PASS`, `KINDLE_EMAIL_TO` no `.env` e cadastrar o Approved Sender (C-11).

- source_spec: `_bmad-output/specs/spec-cifra-kindle/stories/5-enviar-para-o-kindle.md`
  summary: Quando o pipeline falha antes de repontar `envios.musica_id`, a linha placeholder `pending:<uuid>` (com `tom_original` falso "C") permanece em `musicas`.
  evidence: Visto no teste real de 2026-11-19 (falha de varchar(2) em Wonderwall): `select` em `musicas` mostrou uma linha `pending:…` órfã. O envio com erro precisa de um `musica_id` válido, então a linha não pode simplesmente sumir; opções: limpar placeholders de envios em `erro` ou tornar `musica_id` anulável.

- source_spec: `_bmad-output/specs/spec-cifra-kindle/stories/5-enviar-para-o-kindle.md`
  summary: `envios.erro_mensagem` (exposto em `GET /api/envios/:id` como `erroMensagem`) devolve o texto cru do driver do banco, incluindo o SQL, em falhas de persistência.
  evidence: Teste real de 2026-11-19: a mensagem trouxe o `insert into "musicas" ...` inteiro. Uso solo e localhost (C-14), sem risco imediato; vale sanitizar antes de qualquer exposição além do localhost.

- source_spec: `_bmad-output/specs/spec-cifra-kindle/stories/6-suporte-a-capotraste.md`
  summary: Os testes do pipeline mockam os repositórios e não pegam restrições do banco (foi assim que `varchar(2)` em `tom_original` passou despercebido até o primeiro envio real com tom menor sustenido).
  evidence: Corrigido pela migration `20261119000100_widen_musicas_tom_original.ts`. Falta um teste de integração contra o banco de teste (`DATABASE_URL_TEST`) que grave um tom como `F#m`.
