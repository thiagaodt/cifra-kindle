"""Testes de contrato sobre HTML reduzido fiel à estrutura real do Cifra Club.

As fixtures em `fixtures/` têm a marcação real (botão `--chord-tone`, seção de
capotraste, `<pre data-chord-content>` com U+200B e `<!-- -->` do React), mas letra e
acordes genéricos e truncados (NG-6). As tabelas de rótulo por `keyShape` abaixo são
as observadas no site real em 2026-11-19.
"""

from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest
from bs4 import BeautifulSoup
from fastapi.testclient import TestClient

from cifraclub_tons import (
    NOTAS_EM_SUSTENIDO,
    TonsIndisponiveisError,
    _decompor_tom,
    _extrair_capotraste,
    _extrair_conteudo,
    _extrair_tom,
    obter_tons,
)
from main import app

client = TestClient(app)

GET_PATH = "cifraclub_tons.requests.get"
URL = "https://www.cifraclub.com.br/artista-exemplo/musica-exemplo/"
FIXTURES = Path(__file__).parent / "fixtures"
HTML_SEM_CAPO = (FIXTURES / "cifra_sem_capo.html").read_text(encoding="utf-8")
HTML_COM_CAPO = (FIXTURES / "cifra_com_capo.html").read_text(encoding="utf-8")

BOTAO_SEM_CAPO = ">F</button>"
BOTAO_COM_CAPO = ">F#m<!-- --> (com forma de Em)</button>"
LINHA_LETRA = "letra de exemplo, linha um"

# Rótulos reais observados (keyShape -> (tom que soa, forma)). None = página sem parâmetro.
WONDERWALL_CAPO_2 = {
    None: ("F#m", "Em"),
    0: ("Bm", "Am"), 1: ("Cm", "Bbm"), 2: ("C#m", "Bm"), 3: ("Dm", "Cm"),
    4: ("Ebm", "C#m"), 5: ("Em", "Dm"), 6: ("Fm", "Ebm"), 7: ("F#m", "Em"),
    8: ("Gm", "Fm"), 9: ("G#m", "F#m"), 10: ("Am", "Gm"), 11: ("Bbm", "G#m"),
}
FIX_YOU_CAPO_4 = {
    None: ("E", "C"),
    0: ("Db", "A"), 1: ("D", "Bb"), 2: ("Eb", "B"), 3: ("E", "C"),
    4: ("F", "Db"), 5: ("F#", "D"), 6: ("G", "Eb"), 7: ("Ab", "E"),
    8: ("A", "F"), 9: ("Bb", "F#"), 10: ("B", "G"), 11: ("C", "Ab"),
}
# Sem capo: tom F na página original, que é keyShape=8 (nomes como o site exibe, com bemol).
SEM_CAPO_F = {None: "F", **{k: n for k, n in enumerate(
    ["A", "Bb", "B", "C", "Db", "D", "Eb", "E", "F", "F#", "G", "Ab"])}}


def _resposta(html: str) -> MagicMock:
    resposta = MagicMock()
    resposta.status_code = 200
    resposta.raise_for_status.return_value = None
    resposta.text = html
    return resposta


def _marcador(key_shape) -> str:
    return f"{LINHA_LETRA} [keyShape={key_shape}]"


class SiteDeFixture:
    """Serve a fixture trocando só o texto do botão de tom (como o site real faz entre
    keyShapes) e marcando a letra com o keyShape, para provar de qual resposta veio cada conteúdo."""

    def __init__(self, html: str, botao_original: str, rotulos: dict):
        self.html = html
        self.botao_original = botao_original
        self.rotulos = rotulos
        self.chamadas: list = []

    def __call__(self, url, params=None, **kwargs):
        key_shape = None if params is None else params["keyShape"]
        self.chamadas.append(key_shape)
        rotulo = self.rotulos[key_shape]
        if isinstance(rotulo, tuple):
            botao = f">{rotulo[0]}<!-- --> (com forma de {rotulo[1]})</button>"
        else:
            botao = f">{rotulo}</button>"
        html = self.html.replace(self.botao_original, botao).replace(LINHA_LETRA, _marcador(key_shape))
        return _resposta(html)


# --- _extrair_tom / _extrair_conteudo direto sobre as fixtures ---------------------------


def test_extrair_tom_fixture_sem_capo():
    assert _extrair_tom(BeautifulSoup(HTML_SEM_CAPO, "lxml")) == ("F", "")


def test_extrair_tom_fixture_com_capo_usa_tom_que_soa():
    # botão real: 'F#m<!-- --> (com forma de Em)' + seção 'Capotraste: 2ª casa'
    assert _extrair_tom(BeautifulSoup(HTML_COM_CAPO, "lxml")) == ("F#", "m")


@pytest.mark.parametrize("html", [HTML_SEM_CAPO, HTML_COM_CAPO])
def test_extrair_conteudo_fixture_remove_u200b_e_preserva_alinhamento(html):
    conteudo = _extrair_conteudo(BeautifulSoup(html, "lxml"))
    assert "​" not in conteudo
    assert conteudo.startswith("[Intro] ")
    assert f"   {LINHA_LETRA}" in conteudo
    assert "<b" not in conteudo


def test_fixtures_tem_u200b_como_o_site_real():
    # garante que a fixture continua exercitando a limpeza do caractere invisível
    assert "​" in HTML_SEM_CAPO and "​" in HTML_COM_CAPO


# --- _decompor_tom: formato com capotraste ---------------------------------------------


@pytest.mark.parametrize(
    "texto,esperado",
    [
        ("F#m(com forma de Em)", ("F#", "m")),
        ("F#m (com forma de Em)", ("F#", "m")),
        ("E(com forma de C)", ("E", "")),
        ("Ebm(com forma de C#m)", ("D#", "m")),
        ("Bbm(com forma de G#m)", ("A#", "m")),
        ("Bb(com forma de F#)", ("A#", "")),
        ("Db(com forma de A)", ("C#", "")),
        ("F", ("F", "")),
        ("Bbm", ("A#", "m")),
    ],
)
def test_decompor_tom_aceita_capotraste_e_descarta_forma(texto, esperado):
    assert _decompor_tom(texto) == esperado


@pytest.mark.parametrize(
    "texto",
    [
        "Xyz",
        "",
        "m",
        "(com forma de Em)",
        "F#m(com capo)",
        "F#m(com forma de)",
        "F#m(com forma de Xm)",
        "F#m(com forma de Em) extra",
        "F#maj",
    ],
)
def test_decompor_tom_rejeita_texto_desconhecido(texto):
    with pytest.raises(TonsIndisponiveisError, match="Tom não reconhecido"):
        _decompor_tom(texto)


# --- obter_tons sobre as fixtures -------------------------------------------------------


@pytest.mark.parametrize(
    "html,botao,rotulos,original,sufixo,k_original",
    [
        (HTML_COM_CAPO, BOTAO_COM_CAPO, WONDERWALL_CAPO_2, "F#m", "m", 7),
        (HTML_COM_CAPO, BOTAO_COM_CAPO, FIX_YOU_CAPO_4, "E", "", 3),
        (HTML_SEM_CAPO, BOTAO_SEM_CAPO, SEM_CAPO_F, "F", "", 8),
    ],
    ids=["capo-2-menor", "capo-4-maior", "sem-capo"],
)
def test_obter_tons_sobre_fixture_real(html, botao, rotulos, original, sufixo, k_original):
    site = SiteDeFixture(html, botao, rotulos)
    with patch(GET_PATH, side_effect=site):
        versoes = obter_tons(URL)

    assert [v["tom"] for v in versoes] == [n + sufixo for n in NOTAS_EM_SUSTENIDO]
    assert [v["semitone_offset"] for v in versoes] == list(range(12))
    originais = [v for v in versoes if v["is_original"]]
    assert len(originais) == 1 and originais[0]["tom"] == original
    assert all("com forma" not in v["tom"] for v in versoes)

    # cada conteúdo veio da resposta cujo botão mostrava exatamente aquele tom
    def _tom_que_soa(rotulo):
        return rotulo[0] if isinstance(rotulo, tuple) else rotulo

    key_shape_por_indice = {
        NOTAS_EM_SUSTENIDO.index(_decompor_tom(_tom_que_soa(r))[0]): k
        for k, r in rotulos.items()
        if k is not None
    }
    for versao in versoes:
        origem = None if versao["is_original"] else key_shape_por_indice[versao["semitone_offset"]]
        assert _marcador(origem) in versao["conteudo"]

    assert len(site.chamadas) == 12
    assert set(site.chamadas[1:]) == set(range(12)) - {k_original}


def test_obter_tons_com_capo_e_rotulo_fora_da_calibracao_falha_sem_parcial():
    rotulos = dict(WONDERWALL_CAPO_2)
    rotulos[2] = ("Dm", "Cm")  # deveria ser C#m
    site = SiteDeFixture(HTML_COM_CAPO, BOTAO_COM_CAPO, rotulos)
    with patch(GET_PATH, side_effect=site):
        resp = client.post("/tons", json={"cifra_club_url": URL})

    assert resp.status_code == 502
    assert "calibração inconsistente" in resp.json()["error"]
    assert "versions" not in resp.json()


# --- B3: página só de letra -------------------------------------------------------------


def test_url_que_redireciona_para_pagina_so_de_letra_falha_com_causa_real():
    # Observado em 2026-11-19: legiao-urbana/pais-e-filhos (medley) responde
    # 307 Location: /legiao-urbana/pais-e-filhos/letra/ (sem botão de tom nem <pre>).
    url = "https://www.cifraclub.com.br/legiao-urbana/pais-e-filhos/"
    redirect = MagicMock()
    redirect.status_code = 307
    redirect.headers = {"location": "/legiao-urbana/pais-e-filhos/letra/"}
    with patch(GET_PATH, return_value=redirect) as mock_get:
        resp = client.post("/tons", json={"cifra_club_url": url})

    assert resp.status_code == 502
    assert "só com letra" in resp.json()["error"]
    assert "versions" not in resp.json()
    mock_get.assert_called_once()  # não segue para a página de letra


# --- capotraste -------------------------------------------------------------------------


def test_extrair_capotraste_fixture_com_capo():
    assert _extrair_capotraste(BeautifulSoup(HTML_COM_CAPO, "lxml")) == 2


def test_extrair_capotraste_fixture_sem_capo_e_null():
    assert _extrair_capotraste(BeautifulSoup(HTML_SEM_CAPO, "lxml")) is None


def _html_com_botao_capo(texto: str) -> BeautifulSoup:
    html = HTML_COM_CAPO.replace(">2ª casa</button>", f">{texto}</button>")
    return BeautifulSoup(html, "lxml")


@pytest.mark.parametrize("texto,esperado", [("2ª casa", 2), ("10ª casa", 10), ("Sem capotraste", None)])
def test_extrair_capotraste_textos(texto, esperado):
    assert _extrair_capotraste(_html_com_botao_capo(texto)) == esperado


def test_extrair_capotraste_botao_presente_sem_numero_levanta_erro():
    with pytest.raises(TonsIndisponiveisError, match="Capotraste não reconhecido"):
        _extrair_capotraste(_html_com_botao_capo("casa alta"))


def test_post_tons_com_capo_devolve_capotraste_nas_12_versoes():
    site = SiteDeFixture(HTML_COM_CAPO, BOTAO_COM_CAPO, WONDERWALL_CAPO_2)
    with patch(GET_PATH, side_effect=site):
        resp = client.post("/tons", json={"cifra_club_url": URL})

    assert resp.status_code == 200
    versoes = resp.json()["versions"]
    assert len(versoes) == 12
    assert [v["capotraste"] for v in versoes] == [2] * 12


def test_post_tons_sem_capo_devolve_capotraste_null_nas_12_versoes():
    site = SiteDeFixture(HTML_SEM_CAPO, BOTAO_SEM_CAPO, SEM_CAPO_F)
    with patch(GET_PATH, side_effect=site):
        resp = client.post("/tons", json={"cifra_club_url": URL})

    assert resp.status_code == 200
    versoes = resp.json()["versions"]
    assert all("capotraste" in v and v["capotraste"] is None for v in versoes)


def test_capo_que_muda_entre_keyshapes_falha_sem_parcial():
    site = SiteDeFixture(HTML_COM_CAPO, BOTAO_COM_CAPO, WONDERWALL_CAPO_2)

    def servir(url, params=None, **kwargs):
        resposta = site(url, params=params, **kwargs)
        if params is not None and params["keyShape"] == 3:
            resposta.text = resposta.text.replace(">2ª casa</button>", ">3ª casa</button>")
        return resposta

    with patch(GET_PATH, side_effect=servir):
        resp = client.post("/tons", json={"cifra_club_url": URL})

    assert resp.status_code == 502
    assert "capotraste" in resp.json()["error"]
