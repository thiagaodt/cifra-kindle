---
title: 'Setup do projeto — scaffolding do ambiente'
type: 'chore'
created: '2026-11-18'
status: 'done'
route: 'dispatch'
review_loop_iteration: 0
baseline_commit: 'NO_VCS'
context: ['{project-root}/_bmad-output/specs/spec-cifra-kindle/SPEC.md', '{project-root}/_bmad-output/specs/spec-cifra-kindle/stack.md', '{project-root}/_bmad-output/specs/spec-cifra-kindle/conventions.md', '{project-root}/_bmad-output/specs/spec-cifra-kindle/architecture-diagrams.md']
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** O repositório está vazio — não há código, containers nem schema de banco. As próximas 4 stories (buscar, transpor, gerar EPUB, enviar) dependem de uma base comum já de pé: camadas Express/TS, serviço FastAPI, Next.js, Postgres com migrations.

**Approach:** Criar o scaffolding dos 4 serviços decididos na arquitetura (Express/TS, FastAPI, Next.js, Postgres), seguindo a convenção pessoal mais recente do autor (projeto `projeto irmão`, 11/11/2026): camadas unidirecionais, `config/env.ts` tipado, Knex com migrations de `musicas`/`envios`, `docker-compose.dev.yml` com perfil `app`, git inicializado. Nenhuma rota de negócio (FR-1 a FR-4) nesta story — só o esqueleto e health checks.

## Boundaries & Constraints

**Always:**
- Versões exatas de `stack.md`: Node >=22, Express ^5.x, TypeScript ^7.0.2, Knex ^3.1.0, Zod ^4.6.7, Next.js ^16.4.3, Python >=3.12, FastAPI 0.163.0.
- Camadas unidirecionais `routes → controllers → services → repositories/integrations` (SPEC.md C-7); todo corpo HTTP validado por Zod antes do controller (C-8).
- Duas tabelas Postgres (`musicas`, `envios`) ligadas por `musica_id`; `status` de envio é `varchar` validado por enum Zod da aplicação, nunca enum nativo do Postgres (C-9); nenhuma das duas guarda a letra/cifra completa (C-10).
- Portas fixas por `architecture-diagrams.md`: Next.js 3010, Express 3333, FastAPI 8000, Postgres 5433 (host).
- `docker-compose.dev.yml` com perfil `app` (postgres fora do perfil; api/web/scraper dentro), replicando `projeto-irmao/docker-compose.dev.yml`.
- MVP 100% localhost, sem deploy em nuvem (C-14).
- Git inicializado com `.gitignore` cobrindo Node + Python + Next.js.

**Never:**
- Nenhuma rota de FR-1 a FR-4 (CAP-1 a CAP-4) — isso é Stories 2 a 5.
- Nunca migrar automaticamente no boot da API (convenção do autor: boot falha alto em banco não migrado, não migra sozinho).
- Nenhum uso de Selenium/browser automation no skeleton do FastAPI — contraria AD-1/AD-2 (scraping via HTTP simples).
- Nenhum enum nativo do Postgres para `status` de `envios` (C-9).
- Nenhuma autenticação, CORS cross-origin ou multi-tenant (NG-5) — `apps/web` fala com a API via proxy same-origin.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Boot normal | Postgres com as 2 migrations aplicadas | API escuta em :3333, `GET /api/health` → 200 | N/A |
| Banco vazio | Postgres sem nenhuma migration aplicada | Boot falha antes de `listen`, processo sai com código != 0 | Mensagem explícita no log, nunca sobe "mesmo assim" |
| Scraper isolado | `docker compose --profile app up scraper` | `GET /` do FastAPI → 200 | N/A |

</frozen-after-approval>

## Code Map

- `conventions.md` (companion) -- árvore de pastas alvo e nomenclatura já decididas; seguir à risca.
- `stack.md` (companion) -- versões exatas de cada dependência.
- `architecture-diagrams.md` (companion) -- portas por serviço e ER diagram de `musicas`/`envios`.
- Referência de padrão, só leitura (projeto irmão do mesmo autor, fora deste repo, convenção mais recente): `config/env.ts`, `database/db.ts`, `scripts/migrate.ts`, `knexfile.ts`, `app.ts`, `server.ts`, `docker-compose.dev.yml`, `Dockerfile.dev` -- adaptar removendo tudo de auth/JWT/CORS/multi-tenant/R2 (não existe aqui).

## Tasks & Acceptance

**Execution:**
- [x] `git init` + `.gitignore` -- inicializar VCS -- nenhum existe ainda
- [x] `.env.example` -- `NODE_ENV`, `PORT=3333`, `DATABASE_URL`, `DATABASE_URL_TEST`, `SCRAPER_BASE_URL=http://localhost:8000` -- fonte única de config (placeholders usados pelas próximas stories)
- [x] `package.json` (raiz) -- scripts `dev`/`build`/`start`/`typecheck`/`test`/`migrate*`/`services:up`/`services:down`/`docker:dev`/`docker:down`; deps Express ^5, Knex ^3.1.0, pg ^8.23.1, Zod ^4.6.7, dotenv; devDeps TypeScript ^7.0.2, tsx, vitest ^3.2.7 -- base do backend Node
- [x] `tsconfig.json` -- strict, `noUncheckedIndexedAccess`, module CommonJS, target ES2022, moduleResolution bundler -- alinhado à convenção pessoal
- [x] `config/env.ts` -- leitura tipada única do `.env` -- nenhum outro arquivo lê `process.env` direto
- [x] `knexfile.ts` -- client `pg`, migrations por `directory`/`extension` derivados do ambiente, pool -- config Knex
- [x] `database/db.ts` -- conexão Knex exportada; guarda contra `DATABASE_URL_TEST` sem `_test` no nome
- [x] `migrations/<ts>_create_musicas.ts` -- tabela `musicas` (id uuid PK, nome, cifra_club_url, tom_original, criado_em) -- C-9
- [x] `migrations/<ts>_create_envios.ts` -- tabela `envios` (id uuid PK, musica_id FK, status varchar, erro_mensagem, enviado_em, criado_em, atualizado_em) -- C-9
- [x] `scripts/migrate.ts` -- CLI `latest`/`status`/`rollback`/`make` sobre `db.migrate.*` -- evita exigir ts-node no binário do Knex
- [x] `app.ts` -- `createApp()`: `express.json()`, error middleware, `GET /api/health` -- sem rotas de negócio ainda
- [x] `server.ts` -- `SELECT 1` + checagem de migrations aplicadas antes de `listen` -- nunca migra no boot
- [x] `routes/`, `controllers/`, `services/`, `repositories/`, `integrations/`, `schemas/`, `interfaces/` -- criar pastas vazias prontas para Stories 2-5 -- scaffolding de camadas (C-7)
- [x] `Dockerfile.dev` (raiz) -- `node:22-alpine`, `npm ci`, `tsx watch` -- imagem dev da API
- [x] `scraper/main.py` -- app FastAPI, `GET /` (health) -- skeleton do serviço Python, sem rotas de negócio
- [x] `scraper/requirements.txt` -- `fastapi==0.163.0`, uvicorn, `pydantic>=2`, `requests` -- dependências mínimas
- [x] `scraper/Dockerfile.dev` -- `python:3.12-slim`, `pip install -r requirements.txt`, `uvicorn main:app --reload --host 0.0.0.0 --port 8000`
- [x] `apps/web` -- `create-next-app` (TS, App Router) com página inicial placeholder -- skeleton do frontend
- [x] `docker-compose.dev.yml` -- `postgres:17-alpine` (porta 5433, fora do perfil) + `api`/`web`/`scraper` (perfil `app`, Compose Watch) -- ambiente de dev completo
- [x] `README.md` -- passos de setup (`.env`, `npm run services:up`, `npm run migrate`, `npm run docker:dev`)

**Acceptance Criteria:**
- Given o repositório recém-criado, when se roda `npm run services:up` seguido de `npm run migrate`, then as duas migrations aplicam sem erro.
- Given o banco migrado, when se roda `npm run dev` e `GET /api/health`, then responde 200.
- Given `npm run docker:dev` (perfil `app`), when os 3 serviços sobem, then API e scraper respondem aos seus health checks e `apps/web` carrega em `:3010`.
- Given um Postgres vazio (sem migrations), when a API tenta subir, then o boot falha com mensagem explícita, nunca sobe silenciosamente.

## Implementation Notes

## Spec Change Log

## Review Triage Log

## Design Notes

- **Nunca migrar no boot:** `server.ts` faz `SELECT 1` e confere se as migrations esperadas já estão em `knex_migrations` antes de `app.listen`; se não, `process.exit(1)` com mensagem clara. Mesmo espírito do `migrationGuard` do projeto irmão, sem a complexidade de staging/produção (aqui só existe dev local).
- **Knex sem `migrationSource` customizado:** usar as opções nativas `directory`/`extension`/`loadExtensions`. O projeto não precisa suportar dois runtimes de migration (dev `.ts` vs prod `dist/.js`) porque não há deploy em nuvem (C-14) — só dev existe.
- **Perfil `app` do compose:** `services:up` sobe só o Postgres (quando API/web/scraper rodam no host via `npm run dev`); `docker:dev` sobe tudo (perfil `app`, com `develop.watch` em vez de bind mount, que não propaga eventos no Windows).

## Verification

**Commands:**
- `npm run typecheck` -- expected: sem erros
- `npm run migrate` -- expected: aplica as 2 migrations sem erro
- `npm run dev` + `curl http://localhost:3333/api/health` -- expected: HTTP 200
- `docker compose -f docker-compose.dev.yml --profile app up --build` -- expected: os 3 serviços sobem saudáveis

**Manual checks (if no CLI):**
- Abrir `http://localhost:3010` no navegador e confirmar que a página placeholder do Next.js carrega.
