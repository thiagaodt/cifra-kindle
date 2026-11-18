"""Transposição para os 12 tons via `?keyShape=N` do Cifra Club (CAP-2/FR-2, Story 3).

Nenhuma transposição musical local (C-2): cada conteúdo já vem transposto pelo
próprio Cifra Club. O único cálculo aqui é descobrir qual `keyShape` pedir para
cada tom. O `keyShape` não tem numeração fixa entre músicas, mas o deslocamento
é linear dentro da mesma música (+1 em keyShape = +1 semitom), então calibramos
com dois pontos: a página sem parâmetro e `?keyShape=0`.

Qualidade maior/menor (C-3): o sufixo `m` do botão de tom é preservado; só a
letra é convertida para sustenido (ex.: `Bbm` -> `A#m`).

Usa `curl_cffi` com `impersonate="chrome"` (fingerprint TLS; o host principal
está atrás da Akamai). Sem Selenium/JS (AD-1/AD-2).
"""

from urllib.parse import urlsplit

from bs4 import BeautifulSoup
from curl_cffi import requests

REQUEST_TIMEOUT_SECONDS = 15
HOST_PERMITIDO = "cifraclub.com.br"
SCHEME_PERMITIDO = "https"

NOTAS_EM_SUSTENIDO = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]
# Tons que o Cifra Club pode exibir com bemol/enarmonia; convertidos para sustenido (C-3).
SUBSTITUICOES_ENARMONICAS = {
    "Db": "C#",
    "Eb": "D#",
    "Gb": "F#",
    "Ab": "G#",
    "Bb": "A#",
    "Cb": "B",
    "Fb": "E",
    "E#": "F",
    "B#": "C",
}
SUFIXO_MENOR = "m"
# O Cifra Club insere U+200B no início das linhas do <pre> (anti-cópia); é invisível e não afeta alinhamento.
CARACTERE_INVISIVEL = "​"


class TonsIndisponiveisError(Exception):
    """Não foi possível obter as 12 versões de tom (rede, timeout, HTML inesperado ou tom não reconhecido)."""


class UrlInvalidaError(Exception):
    """`cifra_club_url` fora do domínio `cifraclub.com.br` ou sem scheme https (mitigação de SSRF)."""


def validar_url_cifra_club(cifra_club_url: str) -> None:
    """Garante host `cifraclub.com.br` (ou subdomínio) e scheme https, antes de qualquer requisição."""
    try:
        partes = urlsplit(cifra_club_url)
        host = partes.hostname or ""
    except ValueError as erro:
        raise UrlInvalidaError(f"cifra_club_url malformada: {erro}") from erro

    if partes.scheme != SCHEME_PERMITIDO:
        raise UrlInvalidaError("cifra_club_url deve usar https.")
    if host != HOST_PERMITIDO and not host.endswith("." + HOST_PERMITIDO):
        raise UrlInvalidaError(f"cifra_club_url deve ser do domínio {HOST_PERMITIDO}.")


def _decompor_tom(texto: str) -> tuple[str, str]:
    """Separa o texto do botão em (nota em sustenido, sufixo). Ex.: 'Bbm' -> ('A#', 'm'), 'F' -> ('F', '')."""
    sufixo = SUFIXO_MENOR if texto.endswith(SUFIXO_MENOR) else ""
    letra = texto[: len(texto) - len(sufixo)]
    if letra in NOTAS_EM_SUSTENIDO:
        return letra, sufixo
    if letra in SUBSTITUICOES_ENARMONICAS:
        return SUBSTITUICOES_ENARMONICAS[letra], sufixo
    raise TonsIndisponiveisError(f"Tom não reconhecido no Cifra Club: {texto!r}.")


def _buscar_soup(cifra_club_url: str, key_shape: int | None = None) -> BeautifulSoup:
    """Faz a requisição e parseia o HTML uma única vez; o `soup` é reusado pelos extratores."""
    params = None if key_shape is None else {"keyShape": key_shape}
    try:
        resposta = requests.get(
            cifra_club_url,
            params=params,
            impersonate="chrome",
            timeout=REQUEST_TIMEOUT_SECONDS,
        )
        resposta.raise_for_status()
    except requests.RequestsError as erro:
        raise TonsIndisponiveisError(
            f"Cifra Club indisponível ao buscar tons de {cifra_club_url}: {erro}"
        ) from erro
    return BeautifulSoup(resposta.text, "lxml")


def _extrair_tom(soup: BeautifulSoup) -> tuple[str, str]:
    botao = soup.find("button", attrs={"data-anchor": "--chord-tone"})
    if botao is None:
        raise TonsIndisponiveisError("Botão de tom não encontrado na página do Cifra Club.")
    return _decompor_tom(botao.get_text(strip=True))


def _extrair_conteudo(soup: BeautifulSoup) -> str:
    blocos = soup.find_all("pre", attrs={"data-chord-content": "true"})
    if not blocos:
        raise TonsIndisponiveisError("Bloco de cifra não encontrado na página do Cifra Club.")
    texto = "\n\n".join(bloco.get_text() for bloco in blocos)
    texto = texto.replace(CARACTERE_INVISIVEL, "").replace("\r\n", "\n").strip("\n")
    if not texto.strip():
        raise TonsIndisponiveisError("Bloco de cifra vazio na página do Cifra Club.")
    return texto


def obter_tons(cifra_club_url: str) -> list[dict]:
    """Retorna exatamente 12 versões (ordem cromática C..B), uma com `is_original=True`.

    Valida a URL antes de qualquer requisição. Levanta `UrlInvalidaError` (URL fora do
    domínio) ou `TonsIndisponiveisError` (qualquer outra falha): nunca devolve lista parcial.
    """
    validar_url_cifra_club(cifra_club_url)

    soup_original = _buscar_soup(cifra_club_url)
    nota_original, sufixo = _extrair_tom(soup_original)
    conteudo_original = _extrair_conteudo(soup_original)

    soup_zero = _buscar_soup(cifra_club_url, key_shape=0)
    nota_zero, sufixo_zero = _extrair_tom(soup_zero)
    conteudo_zero = _extrair_conteudo(soup_zero)
    if sufixo_zero != sufixo:
        raise TonsIndisponiveisError(
            "keyShape=0 mudou o modo (maior/menor) em relação à página original (calibração inconsistente)."
        )

    indice_original = NOTAS_EM_SUSTENIDO.index(nota_original)
    indice_zero = NOTAS_EM_SUSTENIDO.index(nota_zero)

    # Calibração: o keyShape que mostra a nota de índice t é (t - indice_zero) mod 12.
    versoes = {indice_original: conteudo_original}
    versoes.setdefault(indice_zero, conteudo_zero)

    for indice in range(12):
        if indice in versoes:
            continue
        key_shape = (indice - indice_zero) % 12
        soup = _buscar_soup(cifra_club_url, key_shape=key_shape)
        nota_obtida, sufixo_obtido = _extrair_tom(soup)
        if NOTAS_EM_SUSTENIDO.index(nota_obtida) != indice or sufixo_obtido != sufixo:
            raise TonsIndisponiveisError(
                f"keyShape={key_shape} devolveu tom {nota_obtida}{sufixo_obtido}, "
                f"esperado {NOTAS_EM_SUSTENIDO[indice]}{sufixo} (calibração inconsistente)."
            )
        versoes[indice] = _extrair_conteudo(soup)

    return [
        {
            "tom": NOTAS_EM_SUSTENIDO[indice] + sufixo,
            "semitone_offset": indice,
            "is_original": indice == indice_original,
            "conteudo": versoes[indice],
        }
        for indice in range(12)
    ]
