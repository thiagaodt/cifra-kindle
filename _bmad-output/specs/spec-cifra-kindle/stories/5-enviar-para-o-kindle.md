---
title: 'Enviar para o Kindle (orquestração completa + SMTP)'
type: 'feature'
created: '2026-11-18'
status: 'in-review'
route: 'dispatch'
review_loop_iteration: 0
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
