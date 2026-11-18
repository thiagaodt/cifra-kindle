"""Resolução nome -> URL canônica da Cifra no Cifra Club (CAP-1, FR-1).

Consulta exclusivamente o endpoint de autocomplete do próprio Cifra Club, que
fica num host separado (`solr.sscdn.co`) sem a proteção Akamai do site
principal, então `requests` puro basta (ver Design Notes da Story 2).
"""

import requests

SOLR_SUGGEST_URL = "https://solr.sscdn.co/cifraclub-explore/v1/search/suggest"
CIFRA_CLUB_BASE_URL = "https://www.cifraclub.com.br"
REQUEST_TIMEOUT_SECONDS = 10


class BuscaIndisponivelError(Exception):
    """A Solr do Cifra Club não respondeu de forma utilizável (rede, timeout, JSON ou formato inesperado)."""


def _formato_inesperado(detalhe: str) -> BuscaIndisponivelError:
    return BuscaIndisponivelError(f"Resposta inesperada do Cifra Club: {detalhe}")


def _validar_musica(item: dict) -> tuple[str, str, float]:
    """Confere o formato de um item `type: "song"` e devolve (artist_slug, song_slug, score)."""
    artista = item.get("artist")
    if not isinstance(artista, dict) or not isinstance(artista.get("slug"), str):
        raise _formato_inesperado("item 'song' sem 'artist.slug' válido")
    musica_slug = item.get("slug")
    if not isinstance(musica_slug, str):
        raise _formato_inesperado("item 'song' sem 'slug' válido")
    score = item.get("score", 0)
    if isinstance(score, bool) or not isinstance(score, (int, float)):
        raise _formato_inesperado("item 'song' com 'score' não numérico")
    return artista["slug"], musica_slug, score


def buscar_musica(nome: str) -> str | None:
    """Retorna a `cifra_club_url` da música mais relevante, ou None se não houver `type: "song"`.

    Levanta `BuscaIndisponivelError` em falha de rede/timeout/resposta inválida
    ou de formato inesperado, para o chamador distinguir "não encontrado" de
    "serviço fora do ar / resposta inutilizável".
    """
    try:
        resposta = requests.get(
            SOLR_SUGGEST_URL,
            params={"q": nome, "lang": "pt"},
            timeout=REQUEST_TIMEOUT_SECONDS,
        )
        resposta.raise_for_status()
        dados = resposta.json()
    except (requests.RequestException, ValueError) as erro:
        raise BuscaIndisponivelError(
            f"Cifra Club indisponível ao buscar '{nome}': {erro}"
        ) from erro

    if not isinstance(dados, dict):
        raise _formato_inesperado("corpo não é um objeto JSON")
    resultados = dados.get("results") or []
    if not isinstance(resultados, list):
        raise _formato_inesperado("'results' não é uma lista")
    if not all(isinstance(item, dict) for item in resultados):
        raise _formato_inesperado("item de 'results' não é um objeto")

    musicas = [item for item in resultados if item.get("type") == "song"]
    if not musicas:
        return None

    validadas = [_validar_musica(item) for item in musicas]
    # A API já ordena por relevância; `max` com score garante o maior mesmo se não ordenar.
    artista_slug, musica_slug, score = max(validadas, key=lambda v: v[2])
    print(
        f"[cifraclub_search] nome={nome!r} -> artist={artista_slug} song={musica_slug} score={score}",
        flush=True,
    )
    return f"{CIFRA_CLUB_BASE_URL}/{artista_slug}/{musica_slug}/"
