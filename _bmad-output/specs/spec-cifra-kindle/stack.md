# Stack — Adaptador de Cifras para Kindle

Seed, não contrato: o código a assume uma vez que existir. Linhas com evidência direta (projetos pessoais do autor, ou verificação web datada) estão mais confiantes; as demais usam o major mais recente plausível e devem ser reconfirmadas no `npm install`/`pip install`.

| Name | Version | Nota |
| --- | --- | --- |
| Node.js | >=22 | Bump consciente do floor >=20 dos projetos pessoais anteriores do autor (projetos pessoais anteriores) — Node 20 já fora de LTS. |
| TypeScript | ^7.0.2 | |
| Express | ^5.x | Divergência consciente de Express 4, usado nos projetos anteriores do autor — Express 4 está em modo de manutenção/EOL. |
| Knex | ^3.1.0 | Drizzle e Kysely considerados e descartados: familiaridade com a convenção pessoal do autor pesa mais que novidade num projeto solo. |
| pg (node-postgres) | ^8.23.1 | |
| Zod | ^4.6.7 | |
| Vitest | ^3.2.7 | |
| Next.js | ^16.4.3 | |
| React / React DOM | ^19.3.1 | |
| PostgreSQL | 17 (imagem `postgres:17-alpine`) | |
| Python | >=3.12 | |
| FastAPI | 0.163.0 | Verificado via web em 2026-11-17. |
| Pydantic | ^2.x | Exigido pelo FastAPI 0.163+. |
| Uvicorn | última estável compatível com FastAPI 0.163 | Não verificada individualmente — confirmar no `pip install` real antes de travar. |

## Decisões descartadas (contexto)

- **Electron** (app desktop) foi avaliado e descartado como runtime: SQLite seria a convenção natural nesse mundo, conflitando com o Postgres já decidido; abrir para outros usuários via VPS pessoal exigiria reescrever a arquitetura depois. O atrito de inicialização ("subir servidor, abrir navegador") fica para uma solução mais barata (atalho/script), não para a escolha de runtime.
- **Reenvio automatizado** como solução da troca de tom ao vivo foi substituído pelo EPUB multi-tom navegável (ver Constraints C-4/C-6 em SPEC.md).
- **Transposição de acordes local** foi descartada em favor de delegar ao parâmetro de tom da própria URL do Cifra Club (ver Constraints C-2).
