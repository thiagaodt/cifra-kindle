# Adaptador de Cifras para Kindle

Projeto pessoal e solo de Thiago: buscar uma música no Cifra Club, transpor
automaticamente para os 12 tons e receber um único EPUB navegável no Kindle
via Send-to-Kindle. Ver `_bmad-output/specs/spec-cifra-kindle/SPEC.md` para o
contrato completo (capabilities, constraints, non-goals).

Esta story (1) entrega só o scaffolding: 4 serviços de pé (Postgres, Express,
Next.js, FastAPI) com health checks, sem nenhuma rota de negócio ainda.

## Setup

1. Copie o `.env` de exemplo e ajuste se precisar:

   ```sh
   cp .env.example .env
   ```

2. Suba o Postgres (só o banco; API/front/scraper rodam no host):

   ```sh
   npm run services:up
   ```

3. Instale as dependências e aplique as migrations:

   ```sh
   npm install
   npm run migrate
   ```

4. Suba a API (`:3333`) e, em outro terminal, o front (`:3010`):

   ```sh
   npm run dev
   npm --prefix apps/web install
   npm --prefix apps/web run dev
   ```

5. Suba o scraper FastAPI (`:8000`) — veja `scraper/` (requer Python 3.12; no Windows, veja a seção Solução de problemas abaixo):

   ```sh
   cd scraper
   pip install -r requirements.txt
   uvicorn main:app --reload --host 0.0.0.0 --port 8000
   ```

### Tudo em Docker (alternativa ao passo 4/5)

Com o `.env` já criado (passo 1), sobe os 4 serviços com autoreload:

```sh
npm run docker:dev
```

Front em `http://localhost:3010`, API em `http://localhost:3333/api/health`,
scraper em `http://localhost:8000/`.

## Solução de problemas

### Scraper fora do Docker: versão do Python

A imagem do scraper usa `python:3.12-slim` (ver `scraper/Dockerfile.dev`), então
use Python 3.12 no venv local.

Python 3.15 ainda não funciona: `uvicorn[standard]` puxa `pyyaml`, que não compila
nessa versão, e `pip install -r requirements.txt` falha. O Docker não é afetado,
porque usa a própria imagem Python.

1. Crie o venv a partir da raiz do projeto (com Python 3.12 instalado no Windows):

   ```powershell
   py -3.12 -m venv scraper/.venv
   ```

2. Ative o venv:

   ```powershell
   scraper\.venv\Scripts\Activate.ps1
   ```

   No cmd, use `scraper\.venv\Scripts\activate.bat`. Se o PowerShell bloquear o
   script, rode uma vez `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`.

3. Instale as dependências e suba o scraper:

   ```powershell
   cd scraper
   pip install -r requirements.txt
   uvicorn main:app --port 8000
   ```

**Contorno** se o `pip install -r requirements.txt` continuar falhando: instale
as dependências sem o extra `[standard]` do uvicorn:

```powershell
pip install fastapi uvicorn "pydantic>=2" requests curl_cffi beautifulsoup4 lxml
```

Sem `uvicorn[standard]`, o `--reload` usa o StatReload, que detecta mudanças
mais devagar.

### BMAD: scripts com `uv`

Os scripts do BMAD em `.claude/skills/*/scripts` rodam com `uv run`. Se o `uv`
não estiver instalado, instale no PowerShell:

```powershell
powershell -c "irm https://astral.sh/uv/install.ps1 | iex"
```

Documentação: https://docs.astral.sh/uv/

## Verificação

- `npm run typecheck` — sem erros.
- `npm run migrate` — aplica as 2 migrations (`musicas`, `envios`) sem erro.
- `npm run dev` + `curl http://localhost:3333/api/health` — HTTP 200.
- `docker compose -f docker-compose.dev.yml --profile app up --build` — os 3
  serviços (api/web/scraper) sobem saudáveis; Postgres sobe sempre (fora do
  perfil `app`).

Boot da API contra um Postgres sem migrations falha alto (nunca migra
sozinho) — ver `database/migrationGuard.ts`.
