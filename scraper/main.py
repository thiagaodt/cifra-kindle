"""Serviço FastAPI de scraping do Cifra Club.

Isolado do Node (C-1): o Express consome este serviço exclusivamente via HTTP,
nunca via child_process ou import cross-linguagem. Scraping via HTTP simples
(requests), sem Selenium/browser automation (ver Boundaries & Constraints da
story 1 e AD-1/AD-2 em architecture-diagrams.md).

Rotas: health check e `GET /buscar` (Story 2). Erros seguem `{ error: string }`.
"""

from fastapi import FastAPI, Query
from fastapi.responses import JSONResponse

from cifraclub_search import BuscaIndisponivelError, buscar_musica

app = FastAPI(title="cifra-kindle-scraper")


@app.get("/")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/buscar")
def buscar(nome: str = Query(default="")):
    if not nome.strip():
        return JSONResponse(status_code=400, content={"error": "Parâmetro 'nome' é obrigatório."})

    try:
        cifra_club_url = buscar_musica(nome.strip())
    except BuscaIndisponivelError as erro:
        return JSONResponse(status_code=502, content={"error": str(erro)})

    if cifra_club_url is None:
        return JSONResponse(
            status_code=404,
            content={"error": f"Nenhuma música encontrada no Cifra Club para '{nome}'."},
        )

    return {"cifra_club_url": cifra_club_url}
