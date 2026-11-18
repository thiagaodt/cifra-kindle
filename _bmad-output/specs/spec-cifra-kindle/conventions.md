# Convenções — Adaptador de Cifras para Kindle

## Convenções de consistência

| Concern | Convention |
| --- | --- |
| Naming (entidades, arquivos, interfaces) | camelCase para arquivos/variáveis TS; PascalCase para interfaces/tipos; tabelas em snake_case plural (`musicas`, `envios`) |
| Data & formats | ids `uuid`; timestamps `timestamptz`; status de envio como string validada (não enum nativo); erros HTTP como `{ error: string }` |
| State & cross-cutting | sem autenticação/multiusuário no MVP; config via `.env` compartilhado entre os serviços Node + `config/env.ts` tipado; logging via `console.log`/`console.error` diretos, sem lib dedicada e sem agregação estruturada no MVP |

## Organização de pastas

```text
cifra-kindle/
  app.ts            # bootstrap Express (middlewares, rotas)
  server.ts         # entrypoint HTTP
  routes/           # dispatch HTTP -> controllers
  controllers/       # handlers HTTP, sem logica de negocio
  services/          # orquestracao do pipeline (busca->transpoe->gera->envia)
  repositories/       # unico acesso ao Postgres via Knex
  integrations/
    cifraClub/        # cliente HTTP para o FastAPI de scraping
    kindleMail/        # envio SMTP (Send-to-Kindle)
  schemas/            # validacao Zod dos corpos HTTP
  interfaces/          # tipos TS compartilhados
  database/            # conexao Knex/pg
  migrations/           # Knex migrations (musicas, envios)
  config/env.ts          # leitura tipada de variaveis de ambiente
  scripts/                # scripts avulsos (ex: reset de banco)
  tests/                   # Vitest
  apps/
    web/                    # Next.js - UI (buscar/colar link, historico, progresso)
  scraper/                   # servico FastAPI (Python) - scraping do Cifra Club
```

Ambiente de desenvolvimento local: os 4 serviços (Postgres, Express API, Next.js, FastAPI) sobem juntos via `docker-compose.dev.yml` (perfil `app`), com um único `.env`/`.env.example` na raiz compartilhado pelos serviços Node; o FastAPI lê suas próprias variáveis via `.env` equivalente em `scraper/`.
