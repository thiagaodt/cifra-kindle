---
date: 2026-11-19
verdict: accepted-with-open-items
criteria: declared
headless: false
---

# Retrospectiva — Adaptador de Cifras para Kindle (MVP, Stories 1–5)

## Epic summary

- **Escopo:** épico único do MVP, modo stories. Fonte: `SPEC.md` + `stories.yaml` (ordem 1→5). Todas as 5 stories com `status: done` (`pending_stories` vazio) após o commit `168fe8d`. Sem `sprint-status.yaml`: o gate de completude veio dos frontmatters das stories.
- **Critérios de aceitação:** declarados — as linhas `success` de CAP-1..CAP-4 em `SPEC.md`.
- **Faixas de diff (evidência de git):**

| Story | Faixa | Observação |
|---|---|---|
| 1 | `baseline_commit: NO_VCS` | sem faixa; código entrou no commit-baseline `e370aa7` (raiz, 607 arquivos, mistura skills BMAD + código) |
| 2 | `e370aa7..8d4feec` (registrada) | 1 commit (`8d4feec`) |
| 3 | `8d4feec..5c55dab` (inferida: fim = último commit citando a story) | 2 commits (`d890b8b`, `5c55dab`) |
| 4, 5 | **nenhum baseline registrado** | implementadas fora do repo (Antigravity) antes de `e370aa7`; patches de review em `5c55dab..HEAD` (`b20da39`) |

- **Inventário de evidência:** disponível — SPEC e companions, 5 stories com Review Triage Log, `deferred-work.md`, `.memlog.md`, git. **Ausente:** logs de sessão (Antigravity e sessões anteriores), `sprint-status.yaml`, retro anterior, baselines de 1, 4 e 5.
- **Revisão de diff-scope:** não reexecutei `bmad-review` sobre o épico. Usei os reviews formais já registrados por story (Stories 4 e 5: Blind Hunter + Edge Case Hunter + Verification Gap; Stories 2 e 3 em seus logs) mais as checagens transversais abaixo. Escopo estreitado e registrado.

## Findings

### Visões agregadas

| # | Achado | Fonte | Disposição |
|---|---|---|---|
| A1 | **Camadas (C-7):** `controllers/envioController.ts` importa `EnvioRecord` de `repositories/` (apenas tipo). Violação de forma, sem efeito em runtime; introduzida pelo patch `b20da39`. | `controllers/envioController.ts:2` | fix now (trivial) |
| A2 | **Duplicação:** o scraper tem dois caminhos HTTP independentes. `cifraclub_tons._buscar_soup` valida host e redirects (anti-SSRF, Story 3); `cifraclub_search` faz seu próprio `requests.get` sem essa proteção. A busca bate numa API de busca fixa, risco baixo, mas as duas stories resolveram "falar com o Cifra Club" de formas diferentes. | `scraper/cifraclub_search.py:45`, `scraper/cifraclub_tons.py:78-113` | defer (registrar) |
| A3 | **Crescimento de arquivo:** nenhum candidato a god-class. Maiores arquivos de produção: `services/epubBuilder.ts` 233 linhas, `scraper/cifraclub_tons.py` 182, `services/processarMusicaService.ts` 144. | `git_evidence.py` + `wc -l` | accept |
| A4 | **Divergência de padrão:** snake_case vazando na resposta de `/envios` foi detectada e corrigida (`b20da39`). Mistura PT/EN nos identificadores é convenção do projeto, já aceita. | `controllers/envioController.ts:5-16` | accept |
| A5 | **Reconciliação spec ↔ implementação:** o SPEC é **silencioso sobre capotraste** e sobre a semântica do rótulo de tom (ver B1, B2). Em C-3, "o tom original é o que a URL sem parâmetro retorna" assume que o botão de tom e os acordes impressos concordam. | `SPEC.md` C-2, C-3; `api-contracts.md` | propor reconciliação |
| A6 | **Reconciliação:** no envio por `link`, `musicas.nome` e o filename do EPUB viram a URL crua. Decisão do Thiago (2026-11-19): aceitar no MVP. | `stories/5-…md` (intent_gap resolvido), `deferred-work.md` | accept (registrado) |

### Verificação de comportamento (Phase 2, rodada de verdade em 2026-11-19)

Fluxo ponta a ponta com Cifra Club real, scraper FastAPI, API Node e Postgres; SMTP apontado para um servidor local descartável (sem credenciais reais no `.env`).

- **Observado e OK:** `POST /api/musicas {nome:"Coldplay Yellow"}` → `202 {envioId}`; `GET /api/envios/:id` → `concluido`; `musicaId` repontado para a música real, sem placeholder órfão; e-mail capturado com assunto/anexo `coldplay-yellow.epub`; EPUB com `mimetype` primeiro e sem compressão, `dc:identifier` UUID, `dc:title` correto, spine abrindo no tom original e 12 páginas com seletor de tom e `<pre>`.
- **Não verificado:** envio real Gmail→Kindle; abertura no aparelho; links entre tons e alinhamento no Kindle (CAP-3 e CAP-4 "no Kindle").
- Primeiro disparo falhou com "SMTP incompleto" por um processo antigo na porta 3333 (artefato do ambiente de teste, não defeito do código); reiniciado, passou.

### Achados novos da verificação comportamental

| # | Achado | Evidência | Disposição |
|---|---|---|---|
| B1 | **Músicas com capotraste falham por completo.** O botão de tom vem como `F#m(com forma de Em)` / `E(com forma de C)`; `_decompor_tom` não reconhece o formato e levanta `TonsIndisponiveisError`. Falha alta e clara (nunca arquivo errado), mas CAP-2 não vale para essa classe de músicas. Amostra: Wonderwall e Fix You falharam; The Scientist, Tempo Perdido e Yellow passaram (2 de 5 com capotraste). | `scraper/cifraclub_tons.py:_decompor_tom`; execução real de `obter_tons` (erros literais acima); nenhum teste ou menção a "capo" no repo (`grep`) | **fix now** (story nova) |
| B2 | **Rótulo de tom ≠ acordes impressos em Yellow.** Botão e `keyShape` dizem original = E, mas o conteúdo está em B (`B/F#  F#11/C#  E/B`). O deslocamento é constante (+7) nas 12 páginas: "Tom C" mostra acordes de G. É dado de origem do Cifra Club (a página não tem capotraste). O app segue C-3 ao pé da letra, então o rótulo está errado mas coerente. Risco de leitura errada no palco. | execução real da página `coldplay/yellow` com `keyShape` None/0/5; EPUB extraído, páginas `tom-C` e `tom-E` | decisão do Thiago (ver Open questions) |
| B3 | **Página sem botão de tom:** `legiao-urbana/pais-e-filhos` falha com "Botão de tom não encontrado". Causa não investigada (layout diferente, bloqueio ou URL). | execução real de `obter_tons` | investigar |

### Achados herdados dos reviews por story (já resolvidos ou registrados)

- Story 4: `dc:identifier`/`dc:title` fixos entre músicas (`bad_spec`, corrigido em `b20da39`). Story 5: placeholder órfão em `musicas`, unhandled rejection, id sem `.uuid()`, resposta em snake_case, branch de `link` sem teste (todos corrigidos em `b20da39`). Fonte: Review Triage Log das stories 4 e 5.
- Story 3: bypass de SSRF via redirect corrigido depois do commit da feature (`5c55dab`), mesmo com `review_loop_iteration: 0` na story.
- Aberto, deferido: `toNumber` aceita `PORT=-1`; sem teste cross-process scraper↔cliente Node; OQ-3 (termos de uso do Cifra Club). Fonte: `deferred-work.md`, `SPEC.md`.

## Previous-retro follow-through

Nada a acompanhar: não existe retrospectiva anterior e não existe `sprint-status.yaml` (modo stories, nenhuma chamada a `sprint_status.py`). Não é "nenhum item em aberto"; é "não há onde ler itens".

## Action items

Propostos, não aplicados. Remediações e reconciliações aguardam decisão humana.

1. **Story 6 — suporte a capotraste** (fix now, bloqueia adoção). Aceitar `X(com forma de Y)` em `_decompor_tom`, com teste usando HTML real. Decidir antes qual tom vira o rótulo (ver Open questions). Dono: Thiago decide; dev loop executa. Fonte: B1.
2. **Teste de contrato com HTML real do Cifra Club.** Fixtures gravadas (com e sem capotraste, ao menos) para `_extrair_tom`/`obter_tons`; fecha também o item cross-process de `deferred-work.md`. Dono: dev loop. Fonte: B1 (os testes passavam em fixtures escritas à mão e a classe de falha só apareceu rodando de verdade).
3. **Validar no Kindle de verdade.** Preencher `SMTP_USER`, `SMTP_PASS`, `KINDLE_EMAIL_TO` no `.env`, cadastrar Approved Sender, enviar uma música e conferir tom de abertura, links e alinhamento. Dono: Thiago. Fonte: Verificação de comportamento.
4. **Investigar B3** (`pais-e-filhos` sem botão de tom). Dono: dev loop. Fonte: B3.
5. **Reconciliar o SPEC** (proposta, aplicada só por Thiago): acrescentar em C-3 a regra do rótulo de tom e uma restrição sobre capotraste; refletir em `api-contracts.md`. Fonte: A5.
6. **Corrigir A1:** mover o tipo da resposta para `interfaces/` ou usar `ReturnType` do mapper, sem importar `repositories/` no controller. Dono: dev loop. Fonte: A1.
7. **Registrar A2** em `deferred-work.md`: busca sem a validação de host/redirect da Story 3.
8. **Lição de processo — baseline obrigatório.** Stories 1, 4 e 5 não têm faixa de diff; a revisão foi retroativa e achou um defeito `high`. Exigir `baseline_commit` real antes de despachar para outra ferramenta (Antigravity) e rodar o review antes do commit-baseline. Dono: Thiago. Fonte: frontmatters das stories 1, 4, 5; `git log`.
9. **Lição de processo — verificação real por story.** Cada story foi aceita só com testes sobre fixtures; o primeiro uso real revelou B1 e B2. Incluir um passo de "rodar contra o serviço real" no critério de pronto das stories de scraping. Dono: Thiago. Fonte: B1, B2.
10. **Ambiente:** `scraper/requirements.txt` usa `uvicorn[standard]`, que puxa `pyyaml` e não instala no Python 3.15; `uv` não está instalado (scripts do BMAD usam `uv run`). Fixar versão de Python suportada ou ajustar o requirements. Fonte: instalação do venv desta sessão.
11. **Higiene:** `apps/web/package.json` ganhou `"cifra-kindle": "file:../.."` sem origem conhecida; revertido nesta sessão. Se reaparecer, achar quem roda `npm install` com esse alvo. Fonte: `git diff` antes do revert.

## Acceptance verdict

**accepted-with-open-items** (critérios declarados). Interativo: o Thiago pode sobrescrever.

| Critério | Evidência | Situação |
|---|---|---|
| CAP-1 | busca por nome e erro distinto testados; fluxo real passou | atendido |
| CAP-2 | 12 versões e original identificável para músicas sem capotraste; **falha explícita para músicas com capotraste (B1)**; rótulo questionável em Yellow (B2) | **parcial** |
| CAP-3 | estrutura do EPUB validada por inspeção do arquivo real; **abertura no Kindle não verificada** | atendido na estrutura, pendente no aparelho |
| CAP-4 | pipeline e anexo validados contra SMTP local; **chegada na biblioteca do Kindle não verificada** | pendente |

Por que não "accepted": CAP-2 é parcial e CAP-3/CAP-4 dependem do aparelho. Por que não "rejected": todas as stories estão `done`, nada falha silenciosamente (B1 e B3 erram em voz alta), e o que falta é uma story e uma verificação manual. Se a prioridade do Thiago for "funciona para qualquer música que eu tocar", B1 pesa como bloqueio e o veredito sobe para rejected até a Story 6.

## Open questions

1. **Qual tom é o rótulo quando há capotraste?** O tom que soa (E) ou a forma dos acordes impressos (C com capo na 4ª casa)? Muda a navegação entre tons e o que o músico enxerga no Kindle.
2. **Rótulo errado de origem (B2):** aceitar o rótulo do Cifra Club como verdade (C-3 atual), ou derivar/validar o tom a partir dos acordes e avisar quando divergirem?
3. **B3:** a página realmente não tem botão ou o Cifra Club bloqueou a requisição?

## Assumptions

Interativo: as decisões estão registradas onde o Thiago as tomou (Epic summary e Findings, itens A6 e a decisão do `intent_gap`). Esta seção só registra o que fiz sem confirmação: rodei o epic como um único épico (a pasta tem um `stories.yaml`), tratei o fim da faixa da Story 3 como `5c55dab` (inferido) e usei a amostra de 5 músicas escolhidas por mim para B1, sem pretensão de representatividade estatística.
