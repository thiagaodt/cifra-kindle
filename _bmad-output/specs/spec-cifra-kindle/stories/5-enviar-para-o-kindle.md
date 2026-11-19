---
title: 'Enviar para o Kindle (orquestração completa + SMTP)'
type: 'feature'
created: '2026-11-18'
status: 'done'
route: 'dispatch'
review_loop_iteration: 1
context: ['{project-root}/_bmad-output/specs/spec-cifra-kindle/SPEC.md', '{project-root}/_bmad-output/specs/spec-cifra-kindle/api-contracts.md', '{project-root}/_bmad-output/specs/spec-cifra-kindle/architecture-diagrams.md', '{project-root}/_bmad-output/specs/spec-cifra-kindle/conventions.md']
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Busca (Story 2), transposição (Story 3) e geração do EPUB (Story 4) existem como peças isoladas, mas nada ainda amarra o fluxo ponta a ponta, persiste o progresso, nem envia o Arquivo pronto para o Kindle — e a UI não tem como disparar nem acompanhar isso (CAP-4).

**Approach:** Expor `POST /musicas` (recebe `nome` ou `link`), que cria/reaproveita a linha em `musicas` e uma linha em `envios`, dispara o pipeline completo (busca → transpõe → gera EPUB → envia) de forma assíncrona atualizando `envios.status` a cada etapa, e envia o EPUB por SMTP via `integrations/kindleMail`. Expor `GET /envios/:id` para a UI acompanhar o progresso.

## Boundaries & Constraints

**Always:**
- `POST /musicas` valida o corpo por Zod antes do controller (C-8); aceita `nome` OU `link`, nunca os dois vazios.
- Responde `202`/`200` só com `{ envioId }` imediatamente; o pipeline roda em background (processo assíncrono, sem bloquear a resposta).
- `envios.status` progride estritamente `pendente → buscando → transpondo → gerando → enviando → concluido`, ou `erro` a partir de qualquer etapa (C-9) — nunca um valor fora do enum Zod.
- `musicas` é deduplicada por `cifra_club_url` (upsert); nem `musicas` nem `envios` guardam a letra/cifra completa (C-10).
- Troca de tom ao vivo nunca aciona este fluxo — só uma música nova dispara `POST /musicas` (C-6).
- Falha de SMTP (ex.: sender não aprovado) grava `erro_mensagem` e `status=erro`, nunca trava silenciosamente em `enviando` (C-11).
- Sem meta numérica de latência travada — só "tempo hábil antes do evento" (C-15).
- SMTP via **Gmail pessoal com App Password** (decisão do usuário, 2026-11-18): `SMTP_HOST=smtp.gmail.com`, `SMTP_PORT=587`, autenticação com App Password (não a senha normal da conta Google) — é o Approved Sender real do PRD §5.

**Never:**
- Nenhuma lógica de scraping/transposição/EPUB reimplementada aqui — reaproveita `integrations/cifraClub` (Stories 2/3) e `services/epubBuilder` (Story 4) como estão.
- Nenhuma autenticação/multiusuário (NG-5).
- Nenhum reenvio automático disparado por troca de tom (C-6) — `POST /musicas` só existe para música nova ou repetição explícita.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Happy path | `POST /musicas` com nome de música válida | `envios.status` progride até `concluido`; SMTP aceita o envio com o EPUB anexado | N/A |
| Música não encontrada | Nome que o Cifra Club não resolve (FR-1) | `status=erro`, `erro_mensagem` explica; resposta inicial já tinha devolvido `{ envioId }` | `GET /envios/:id` reflete o erro |
| SMTP recusa o envio | Sender não é Approved Sender, ou SMTP indisponível | `status=erro`, `erro_mensagem` cita a falha do SMTP | Nunca fica "enviando" indefinidamente |
| `GET /envios/:id` com id inexistente | `id` não existe em `envios` | `404` com `{ error: string }` | N/A |

</frozen-after-approval>

## Code Map

- `api-contracts.md` (companion) -- `GET /envios/:id` já documentado; esta story introduz `POST /musicas` (não documentado ainda na spec-kernel — registrado aqui como decisão de implementação, não exige reabrir `bmad-spec`).
- `integrations/cifraClub` (Stories 2/3, já existente) -- busca + 12 tons.
- `services/epubBuilder.ts` (Story 4, já existente) -- gera o `Buffer` do EPUB.
- `repositories/`, `schemas/`, `interfaces/` (vazias desde a Story 1) -- entram os novos arquivos desta story.
- `integrations/kindleMail` (pasta vazia desde a Story 1) -- cliente SMTP entra aqui.

## Tasks & Acceptance

**Execution:**
- [x] `package.json` -- adicionar dependência `nodemailer` -- cliente SMTP padrão do ecossistema Node
- [x] `config/env.ts` -- adicionar `SMTP_HOST` (default `smtp.gmail.com`), `SMTP_PORT` (default `587`), `SMTP_USER`, `SMTP_PASS` (App Password do Gmail), `KINDLE_EMAIL_TO` -- config do Gmail como Approved Sender
- [x] `schemas/musicaSchema.ts` -- valida `{ nome?: string; link?: string }`, exatamente um dos dois presente -- C-8
- [x] `repositories/musicaRepository.ts` -- `upsertByCifraClubUrl`, `getById` -- acesso a `musicas`
- [x] `repositories/envioRepository.ts` -- `create`, `updateStatus(id, status, erroMensagem?)`, `getById` -- acesso a `envios` (C-9)
- [x] `integrations/kindleMail/sendToKindle.ts` -- `sendEpub(buffer: Buffer, filename: string): Promise<void>` via `nodemailer` -- envio SMTP
- [x] `services/processarMusicaService.ts` -- orquestra busca (Story 2) → tons (Story 3) → `epubBuilder` (Story 4) → `sendToKindle`, atualizando `envioRepository.updateStatus` a cada etapa -- núcleo da story
- [x] `schemas/envioIdSchema.ts` + `controllers/musicaController.ts` + `routes/musicaRoute.ts` -- `POST /api/musicas`
- [x] `controllers/envioController.ts` + `routes/envioRoute.ts` -- `GET /api/envios/:id`
- [x] `tests/services/processarMusicaService.test.ts` -- cobre as 4 linhas da I/O & Edge-Case Matrix (mocks de `integrations/cifraClub`, `epubBuilder` e `sendToKindle`)

**Acceptance Criteria:**
- Given um nome de música válido, when `POST /api/musicas`, then responde com `{ envioId }` e, eventualmente, `envios.status` chega a `concluido`.
- Given uma música não encontrada pelo Cifra Club, when o pipeline roda, then `envios.status` vira `erro` com `erro_mensagem` explicando a causa.
- Given uma falha de SMTP, when a etapa de envio roda, then `envios.status` vira `erro` (nunca trava em `enviando`).
- Given um `id` de envio inexistente, when `GET /api/envios/:id`, then responde `404`.

## Implementation Notes

- Implementado pela Antigravity (handoff via `_bmad-output/implementation-artifacts/antigravity-prompts/5-enviar-para-o-kindle.md`). `integrations/cifraClub` ainda não existia no momento da implementação (Stories 2/3 pendentes) — a Antigravity respeitou o aviso do prompt e criou um stub tipado (`buscarMusica`/`obterTons` lançando erro explícito "responsabilidade da Story 2/3"), em vez de simular a lógica real. `processarMusicaService.test.ts` usa mocks desse contrato. Verificado nesta sessão (Claude Code): `npm run typecheck` limpo, `npm test` 11/11 (incluindo as 4 da matrix). Review formal (step-04) ainda não rodou. **Pendência real:** o stub precisa ser substituído pela implementação de verdade quando Story 2/3 forem concluídas.

## Spec Change Log

## Review Triage Log

Revisão formal (3 camadas: Blind Hunter + Edge Case Hunter + Verification Gap) rodada nesta sessão, retroativa ao código já implementado pela Antigravity.

- **`high` → `patch`:** `processarMusica` cria uma linha placeholder em `musicas` (`cifra_club_url = "pending:<uuid>"`) e aponta `envios.musica_id` pra ela antes do pipeline rodar. Quando o input é por `nome`, `executarPipelineEnvio` faz um segundo `upsertByCifraClubUrl` com a URL real (linha 50-54) — como a URL real nunca bate com o placeholder, o `onConflict("cifra_club_url")` nunca encontra a linha placeholder e insere uma linha nova e separada; `envios.musica_id` nunca é repontado pra ela. Confirmado lendo `services/processarMusicaService.ts:77-100` + `repositories/musicaRepository.ts:18-37`: toda busca por nome deixa (a) uma linha placeholder órfã em `musicas` para sempre e (b) `envios.musica_id` permanentemente apontando pra essa linha falsa, nunca pra linha com nome/tom reais. Achado independentemente por Blind Hunter, Edge Case Hunter e Verification Gap (com rastreio de evidência) nas duas stories — mesma causa raiz.
- **`medium` → `patch`:** se o `catch` de `executarPipelineEnvio` (que grava `status=erro`) ele mesmo lançar (ex.: blip transitório de DB), a promise retornada rejeita; como `processarMusica` nunca aguarda `pipelinePromise` (só guarda em `pendingPipelines`, sem `.catch`), isso é uma unhandled rejection que pode derrubar o processo Node inteiro — não só aquele envio. Confirmado lendo `services/processarMusicaService.ts:64-69,94-97`; nenhum handler global de `unhandledRejection` existe em `server.ts`.
- **`low` → `patch`:** `schemas/envioIdSchema.ts` valida só string não-vazia, sem `.uuid()`. Um id malformado (`GET /api/envios/abc`) passa a validação e quebra no Postgres com "invalid input syntax for type uuid", que o middleware de erro de `app.ts` transforma num `500` com a mensagem crua do driver, em vez de um `400` limpo. Achado por Edge Case Hunter + Verification Gap (evidência rastreada) + Blind Hunter.
- **`low` → `patch`:** `routes/envioRoute.ts`'s `validateEnvioIdParams` nunca reatribui `req.params = parsed.data` (diferente de `musicaRoute`, que faz `req.body = parsed.data`) — um id com espaço em branco incidental passa a validação (que usa `.trim()`) mas chega não-trimado no controller/repository, podendo causar um "não encontrado" espúrio.
- **`low` → `patch`:** sem teste cobrindo `POST /api/musicas` com corpo inválido (400 esperado) nem `GET /api/envios/:id` com id malformado (400 esperado depois do fix acima) — a lógica de validação já existe e funciona, só falta a cobertura.
- **`medium` → `patch`:** `conventions.md` (companion da spec-kernel) declara "camelCase para arquivos/variáveis TS" para a camada de API; `controllers/envioController.ts` devolve `res.json(envio)` com o `EnvioRecord` cru do banco (`musica_id`, `erro_mensagem`, `enviado_em`, `criado_em`, `atualizado_em` em snake_case), violando essa convenção já documentada e consistente em outros pontos do código (ex.: `paraTonVersion` em `integrations/cifraClub` já faz esse mapeamento snake_case→camelCase).
- **`medium` → `patch`:** Verification Gap Reviewer confirmou (com teste + rastreio) que o branch de `link` (em vez de `nome`) em `executarPipelineEnvio`/`processarMusica` não tem nenhum teste cobrindo — uma regressão isolada nesse branch (ex.: inverter a condição, ou enviar a URL errada pra `obterTons`) passaria despercebida pelos 4 testes existentes, que só exercitam o caminho por `nome`.
- **`intent_gap`:** **[RESOLVIDO 2026-11-19: Thiago escolheu aceitar a URL como nome de exibição no caminho por link; sem mudança de código, registrado em deferred-work.]** quando o input é `link` (não `nome`), `nomeMusica` cai pra `input.link` — o nome literal da música gravado em `musicas.nome` e usado no filename do EPUB enviado ao Kindle vira a URL crua, não o título real da música. Verificado que o scraper (`scraper/main.py`) não tem nenhuma rota que extraia título a partir de uma URL direta — só `buscar_musica(nome)` resolve nome→URL. A Intent congelada da story diz "aceita `nome` OU `link`" como igualmente válidos, mas é silente sobre como derivar um nome legível quando só o link é dado — não há uma única leitura óbvia (aceitar a URL como nome de exibição vs. adicionar extração de título ao scraper são ambos razoáveis, com custos bem diferentes). Loop back para o Thiago — ver pergunta abaixo.
- **`false`:** sem migrations/mount de rotas no diff revisado — artefato do escopo do diff que construí pra essa revisão (excluí `migrations/`, `app.ts`, `server.ts` por já pertencerem à Story 1); confirmado que ambos já existem e funcionam (`migrations/202611180001*`, `app.ts:14-15`).
- **`false`:** `musicaSchema.link` aceita qualquer URL, não só `cifraclub.com.br` — sem risco de SSRF real: `obterTons` manda a URL pro scraper FastAPI, que já valida o host antes de qualquer requisição de rede (Story 3, `validar_url_cifra_club`) e responde 400 pra URL fora do domínio. Defesa já existe, só numa camada mais interna.
- **`false`:** `typescript: "^7.0.2"` em `package.json` suspeito de erro de digitação — confirmado via `npm view typescript versions` que 7.0.2 é uma versão real publicada; `node_modules/typescript/package.json` já reflete essa versão instalada e `tsc --noEmit` roda limpo.
- **`false`:** `nodemailer@^10.6.0` + `@types/nodemailer@^8.0.2` (major desalinhado) — `tsc --noEmit` limpo, nenhum dano demonstrado.
- **`false`:** `processarMusica`/`executarPipelineEnvio` chamados diretamente (fora da rota) com `nome`/`link` undefined quebrariam as non-null assertions — inalcançável: o único chamador real (`musicaController.postMusica`) só recebe `req.body` depois do middleware Zod já ter garantido exatamente um dos dois presentes.
- **`false`:** sem mecanismo de recuperação pra `envios` travados em status não-terminal se o processo cair — já é um trade-off conscientemente documentado nas Design Notes desta story ("sem fila dedicada... dado o uso solo e local, C-14"), não um defeito desta implementação.
- **`defer`:** `config/env.ts`'s `toNumber` não rejeita valores negativos/`Infinity` (ex.: `PORT=-1`) — pré-existente da Story 1 (Story 5 só reusa o helper pra novas variáveis SMTP), não causado por esta story.

## Design Notes

- **`POST /musicas` é novo e não está em `api-contracts.md`:** a spec-kernel documentava só os contratos do FastAPI e a leitura (`GET /envios/:id`); o endpoint de escrita que dispara o pipeline não tinha sido nomeado ainda. Decisão de implementação (não uma mudança de capability): `POST /musicas`, assíncrono, devolve `envioId` na hora.
- **Processamento assíncrono sem fila dedicada:** dado o uso solo e local (C-14), `processarMusicaService` roda em background no próprio processo Node (sem Redis/BullMQ) — a UI acompanha via polling em `GET /envios/:id`, mesmo padrão de polling já usado nos projetos anteriores do autor (TanStack Query).

## Verification

**Commands:**
- `npm run typecheck` -- expected: sem erros
- `npm run test -- processarMusicaService` -- expected: os 4 casos da matrix passam (com mocks)
- `curl -X POST http://localhost:3333/api/musicas -d '{"nome":"..."}'` seguido de `curl http://localhost:3333/api/envios/<id>` -- expected: status progride até `concluido` (ambiente com Approved Sender já configurado)

**Manual checks (if no CLI):**
- Confirmar no app Kindle (ou na biblioteca Send-to-Kindle) que o EPUB realmente chega e abre no tom original.
