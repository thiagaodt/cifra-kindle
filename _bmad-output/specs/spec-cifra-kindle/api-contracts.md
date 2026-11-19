# Contratos de API — Adaptador de Cifras para Kindle

## `scraper/` (FastAPI, consumido por `integrations/cifraClub`)

### `GET /buscar?nome=`
Resolve um nome de música para a URL canônica no Cifra Club (cobre a busca por nome de CAP-1).
- Sucesso: retorna `cifra_club_url`.
- Erro: HTTP 404 se a música não for encontrada (nenhum resultado `type: "song"`).
- Erro: HTTP 400 se `nome` vier vazio ou só com espaços.
- Erro: HTTP 502 em falha de rede/timeout na Solr do Cifra Club, ou em resposta com formato inesperado.
- Todas as respostas de erro seguem `{ error: string }`.

### `POST /tons`
Recebe `{ cifra_club_url }`; faz 12 requisições à URL do Cifra Club variando o parâmetro de tom.
- Sucesso: `{ versions: [{ tom, semitone_offset, is_original, capotraste, conteudo }] }`, com **exatamente 12 itens**, um deles com `is_original: true`.
- `capotraste`: inteiro com a casa do capotraste, ou `null` quando não há; igual nas 12 versões. Com capotraste, `tom` é o tom que soa e `conteudo` traz os acordes na forma (ver C-16 do `SPEC.md`). O cliente Node expõe isso como `TonVersion.capotraste?: number | null`.
- Erro: HTTP 502 em falha de scraping.
- Erro: HTTP 502 com mensagem "Cifra Club não tem cifra para esta URL..." quando o Cifra Club redireciona (307) para `.../letra/` (ex.: medley sem cifra, como `legiao-urbana/pais-e-filhos`; a cifra pode existir em outra URL, como `/legiao-urbana/pais-filhos/`).
- Todas as respostas de erro (de ambas as rotas) seguem `{ error: string }`.

## Backend Express — leitura de progresso (apoia CAP-4/UI)

### `GET /envios/:id`
Usado pelo `apps/web` para acompanhar o progresso de um envio em andamento (polling), consultando `repositories/envios`. Retorna o `status` atual do envio (ver enum em Constraints C-9 do `SPEC.md`).
