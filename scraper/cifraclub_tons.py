"""Transposição para os 12 tons via `?keyShape=N` do Cifra Club (CAP-2/FR-2, Story 3).

Nenhuma transposição musical local (C-2): cada conteúdo já vem transposto pelo
próprio Cifra Club. O único cálculo aqui é descobrir qual `keyShape` pedir para
cada tom. O `keyShape` não tem numeração fixa entre músicas, mas o deslocamento
é linear dentro da mesma música (+1 em keyShape = +1 semitom), então calibramos
com dois pontos: a página sem parâmetro e `?keyShape=0`.

Qualidade maior/menor (C-3): o sufixo `m` do botão de tom é preservado; só a
letra é convertida para sustenido (ex.: `Bbm` -> `A#m`).

Capotraste: o botão vem como `F#m(com forma de Em)`; o rótulo é o tom que soa
(`F#m`). Verificado no site real (2026-11-19, Wonderwall e Fix You): o capo fica
fixo entre os `keyShape` e o tom que soa continua subindo +1 semitom por
`keyShape`, então a mesma calibração linear vale.

Usa `curl_cffi` com `impersonate="chrome"` (fingerprint TLS; o host principal
está atrás da Akamai). Sem Selenium/JS (AD-1/AD-2).
"""

import re
from urllib.parse import urljoin, urlsplit

from bs4 import BeautifulSoup
from curl_cffi import requests

REQUEST_TIMEOUT_SECONDS = 15
HOST_PERMITIDO = "cifraclub.com.br"
SCHEME_PERMITIDO = "https"
MAX_REDIRECTS = 3

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
# Texto do botão de tom: 'F', 'Bbm' ou, com capotraste, 'F#m(com forma de Em)' / 'E (com forma de C)'.
PADRAO_TOM = re.compile(r"([A-G][#b]?)(m?)(?:\s*\(com forma de\s+[A-G][#b]?m?\))?")
# Cifra Club redireciona para `<musica>/letra/` quando a página não tem cifra (só letra).
SUFIXO_PAGINA_SO_LETRA = "/letra"
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
    """Separa o texto do botão em (nota em sustenido, sufixo). Ex.: 'Bbm' -> ('A#', 'm'), 'F' -> ('F', '').

    Com capotraste o botão vem como 'F#m(com forma de Em)': o rótulo é o tom que SOA
    (a nota-base, 'F#m'); o trecho '(com forma de X)' é descartado.
    """
    casamento = PADRAO_TOM.fullmatch(texto.strip())
    if casamento is None:
        raise TonsIndisponiveisError(f"Tom não reconhecido no Cifra Club: {texto!r}.")
    letra, sufixo = casamento.group(1), casamento.group(2)
    if letra in NOTAS_EM_SUSTENIDO:
        return letra, sufixo
    if letra in SUBSTITUICOES_ENARMONICAS:
        return SUBSTITUICOES_ENARMONICAS[letra], sufixo
    raise TonsIndisponiveisError(f"Tom não reconhecido no Cifra Club: {texto!r}.")


def _buscar_soup(cifra_club_url: str, key_shape: int | None = None) -> BeautifulSoup:
    """Faz a requisição e parseia o HTML uma única vez; o `soup` é reusado pelos extratores.

    Redirects são seguidos manualmente (`allow_redirects=False`), revalidando o host de
    cada `Location` contra `validar_url_cifra_club` — sem isso, um redirect poderia levar
    a requisição pra fora do domínio permitido mesmo com a URL de entrada validada (SSRF).
    """
    url_atual = cifra_club_url
    params = None if key_shape is None else {"keyShape": key_shape}
    try:
        for _ in range(MAX_REDIRECTS + 1):
            resposta = requests.get(
                url_atual,
                params=params,
                impersonate="chrome",
                timeout=REQUEST_TIMEOUT_SECONDS,
                allow_redirects=False,
            )
            if 300 <= resposta.status_code < 400:
                destino = resposta.headers.get("location")
                if not destino:
                    raise TonsIndisponiveisError(
                        f"Cifra Club respondeu redirect sem 'Location' para {url_atual}."
                    )
                url_atual = urljoin(url_atual, destino)
                validar_url_cifra_club(url_atual)
                if urlsplit(url_atual).path.rstrip("/").endswith(SUFIXO_PAGINA_SO_LETRA):
                    raise TonsIndisponiveisError(
                        f"O Cifra Club não tem cifra (acordes) para {cifra_club_url}: a página "
                        f"redireciona para a versão só com letra ({url_atual}). "
                        "Procure outra URL de cifra da mesma música."
                    )
                if urlsplit(url_atual).query:
                    # o Location já embute sua própria query string; não duplicar/conflitar.
                    params = None
                continue
            resposta.raise_for_status()
            return BeautifulSoup(resposta.text, "lxml")
    except requests.RequestsError as erro:
        raise TonsIndisponiveisError(
            f"Cifra Club indisponível ao buscar tons de {cifra_club_url}: {erro}"
        ) from erro
    raise TonsIndisponiveisError(f"Muitos redirects ao buscar tons de {cifra_club_url}.")


def _extrair_tom(soup: BeautifulSoup) -> tuple[str, str]:
    botao = soup.find("button", attrs={"data-anchor": "--chord-tone"})
    if botao is None:
        raise TonsIndisponiveisError("Botão de tom não encontrado na página do Cifra Club.")
    return _decompor_tom(botao.get_text(strip=True))


def _extrair_capotraste(soup: BeautifulSoup) -> int | None:
    """Casa do capotraste (ex.: '2ª casa' -> 2) ou None quando a página não informa capo.

    Botão ausente, ou texto 'sem capotraste', -> None. Botão presente sem número
    reconhecível levanta erro: nunca esconder um capo.
    """
    botao = soup.find("button", attrs={"data-anchor": "--chord-capo"})
    if botao is None:
        return None
    texto = botao.get_text(strip=True)
    if re.search(r"\bsem\b", texto, re.IGNORECASE):
        return None
    casamento = re.search(r"(\d+)", texto)
    if casamento is None:
        raise TonsIndisponiveisError(f"Capotraste não reconhecido no Cifra Club: {texto!r}.")
    casa = int(casamento.group(1))
    if casa <= 0:
        return None
    return casa


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
    capotraste = _extrair_capotraste(soup_original)

    soup_zero = _buscar_soup(cifra_club_url, key_shape=0)
    nota_zero, sufixo_zero = _extrair_tom(soup_zero)
    conteudo_zero = _extrair_conteudo(soup_zero)
    if _extrair_capotraste(soup_zero) != capotraste:
        raise TonsIndisponiveisError("keyShape=0 mudou o capotraste em relação à página original.")
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
        if _extrair_capotraste(soup) != capotraste:
            raise TonsIndisponiveisError(f"keyShape={key_shape} mudou o capotraste em relação à página original.")
        versoes[indice] = _extrair_conteudo(soup)

    return [
        {
            "tom": NOTAS_EM_SUSTENIDO[indice] + sufixo,
            "semitone_offset": indice,
            "is_original": indice == indice_original,
            "conteudo": versoes[indice],
            "capotraste": capotraste,
        }
        for indice in range(12)
    ]
