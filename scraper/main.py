"""Serviço FastAPI de scraping do Cifra Club.

Isolado do Node (C-1): o Express consome este serviço exclusivamente via HTTP,
nunca via child_process ou import cross-linguagem. Scraping via HTTP simples
(requests), sem Selenium/browser automation (ver Boundaries & Constraints da
story 1 e AD-1/AD-2 em architecture-diagrams.md).

Nenhuma rota de negócio (FR-1 a FR-4) nesta story — só o esqueleto e o health
check. A busca de cifras chega nas próximas stories.
"""

from fastapi import FastAPI

app = FastAPI(title="cifra-kindle-scraper")


@app.get("/")
def health() -> dict[str, str]:
    return {"status": "ok"}
