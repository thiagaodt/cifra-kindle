# Contratos de API — Adaptador de Cifras para Kindle

## `scraper/` (FastAPI, consumido por `integrations/cifraClub`)

### `GET /buscar?nome=`
Resolve um nome de música para a URL canônica no Cifra Club (cobre a busca por nome de CAP-1).
- Sucesso: retorna `cifra_club_url`.
- Erro: HTTP 404 se a música não for encontrada.

### `POST /tons`
Recebe `{ cifra_club_url }`; faz 12 requisições à URL do Cifra Club variando o parâmetro de tom.
- Sucesso: `{ versions: [{ tom, semitone_offset, is_original, conteudo }] }`, com **exatamente 12 itens**, um deles com `is_original: true`.
- Erro: HTTP 502 em falha de scraping.
- Todas as respostas de erro (de ambas as rotas) seguem `{ error: string }`.

## Backend Express — leitura de progresso (apoia CAP-4/UI)

### `GET /envios/:id`
Usado pelo `apps/web` para acompanhar o progresso de um envio em andamento (polling), consultando `repositories/envios`. Retorna o `status` atual do envio (ver enum em Constraints C-9 do `SPEC.md`).
