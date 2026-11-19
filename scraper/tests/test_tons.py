import re
from unittest.mock import MagicMock, patch

import pytest
from curl_cffi import requests
from fastapi.testclient import TestClient

from cifraclub_tons import (
    NOTAS_EM_SUSTENIDO,
    SUBSTITUICOES_ENARMONICAS,
    SUFIXO_MENOR,
    obter_tons,
)
from main import app

client = TestClient(app)

GET_PATH = "cifraclub_tons.requests.get"
URL = "https://www.cifraclub.com.br/coldplay/the-scientist/"


def _html(tom_botao: str | None, conteudo: str | None) -> str:
    botao = (
        f'<button type="button" data-anchor="--chord-tone">{tom_botao}</button>'
        if tom_botao is not None
        else ""
    )
    pre = (
        f'<pre data-chord-content="true">{conteudo}</pre>' if conteudo is not None else ""
    )
    return f"<html><body><div>{botao}</div>{pre}</body></html>"


def _indice(tom: str) -> int:
    letra = tom[:-1] if tom.endswith("m") else tom
    return NOTAS_EM_SUSTENIDO.index(SUBSTITUICOES_ENARMONICAS.get(letra, letra))


def _esperado(tom: str) -> str:
    # O que o parser deve extrair do bloco <pre> de `_conteudo_para(tom)`.
    texto_renderizado = re.sub(r"<[^>]+>", "", _conteudo_para(tom))
    return texto_renderizado.replace("​", "").strip("\n")


def _conteudo_para(tom: str) -> str:
    # Acorde dentro de <b>, linha com espaçamento e U+200B no início (como o Cifra Club faz).
    return (
        f'​<b data-chord-name="{tom}">{tom}</b>        <b data-chord-name="Dm7">Dm7</b>\n'
        f"​    letra no tom de {tom}\n"
    )


class FakeCifraClub:
    """Simula o Cifra Club: a página sem parâmetro está no tom `tom_original` e
    `keyShape=k` sobe k semitons a partir de `keyShape=0`, que é o tom `indice_zero`."""

    def __init__(self, tom_original: str = "F", k_original: int = 8):
        self.nome_original = tom_original  # como o Cifra Club exibe na página original (pode ser bemol)
        self.sufixo = SUFIXO_MENOR if tom_original.endswith(SUFIXO_MENOR) else ""
        self.indice_original = _indice(tom_original)
        self.indice_zero = (self.indice_original - k_original) % 12
        self.chamadas: list[int | None] = []
        self.falhar_na_chamada: int | None = None
        self.tom_forcado: dict[int | None, str] = {}

    def __call__(self, url, params=None, **kwargs):
        key_shape = None if params is None else params["keyShape"]
        self.chamadas.append(key_shape)
        if self.falhar_na_chamada is not None and len(self.chamadas) == self.falhar_na_chamada:
            raise requests.RequestsError("timeout simulado")

        if key_shape is None:
            tom_exibido = self.nome_original
        else:
            indice = (self.indice_zero + key_shape) % 12
            tom_exibido = NOTAS_EM_SUSTENIDO[indice] + self.sufixo
        tom = self.tom_forcado.get(key_shape, tom_exibido)
        resposta = MagicMock()
        resposta.status_code = 200
        resposta.raise_for_status.return_value = None
        resposta.text = _html(tom, _conteudo_para(tom))
        return resposta


def test_happy_path_retorna_12_versoes_com_uma_original():
    site = FakeCifraClub(tom_original="F", k_original=8)
    with patch(GET_PATH, side_effect=site):
        versoes = obter_tons(URL)

    assert len(versoes) == 12
    assert [v["tom"] for v in versoes] == NOTAS_EM_SUSTENIDO
    assert [v["semitone_offset"] for v in versoes] == list(range(12))
    originais = [v for v in versoes if v["is_original"]]
    assert len(originais) == 1
    assert originais[0]["tom"] == "F"
    assert originais[0]["conteudo"] == _esperado("F")
    # 12 requisições: página original, keyShape=0 e os keyShape 1..11 exceto o do tom original (8).
    assert len(site.chamadas) == 12
    assert site.chamadas[0] is None
    assert set(site.chamadas[1:]) == set(range(12)) - {8}


def test_query_string_da_url_colada_e_descartada_antes_de_buscar():
    # Links de songbook trazem `?songbookId=..&key=C`; o `key` faz o site ignorar o keyShape.
    urls = []
    site = FakeCifraClub(tom_original="C", k_original=3)

    def espiao(url, params=None, **kwargs):
        urls.append(url)
        return site(url, params=params, **kwargs)

    with patch(GET_PATH, side_effect=espiao):
        versoes = obter_tons(URL + "?songbookId=23746927&key=C")

    assert len(versoes) == 12
    assert set(urls) == {URL}


def test_conteudo_de_cada_versao_corresponde_ao_tom_da_propria_resposta():
    site = FakeCifraClub(tom_original="F", k_original=8)
    with patch(GET_PATH, side_effect=site):
        versoes = obter_tons(URL)

    for versao in versoes:
        assert versao["conteudo"] == _esperado(versao["tom"])
        assert "​" not in versao["conteudo"]
        assert "    letra no tom de" in versao["conteudo"]


def test_tom_bemol_no_botao_e_convertido_para_sustenido():
    site = FakeCifraClub(tom_original="Bb", k_original=3)
    with patch(GET_PATH, side_effect=site):
        versoes = obter_tons(URL)

    original = next(v for v in versoes if v["is_original"])
    assert original["tom"] == "A#"
    assert all("b" not in v["tom"] for v in versoes)
    assert [v["tom"] for v in versoes] == NOTAS_EM_SUSTENIDO


def test_original_igual_a_keyshape_zero_ainda_retorna_12_tons_distintos():
    site = FakeCifraClub(tom_original="A", k_original=0)
    with patch(GET_PATH, side_effect=site):
        versoes = obter_tons(URL)

    assert [v["tom"] for v in versoes] == NOTAS_EM_SUSTENIDO
    assert sum(v["is_original"] for v in versoes) == 1


def test_url_nao_resolve_retorna_502_sem_versions():
    resposta_404 = MagicMock()
    resposta_404.status_code = 404
    resposta_404.raise_for_status.side_effect = requests.RequestsError("404 Not Found")
    with patch(GET_PATH, return_value=resposta_404):
        resp = client.post("/tons", json={"cifra_club_url": URL})

    assert resp.status_code == 502
    assert isinstance(resp.json()["error"], str)
    assert "versions" not in resp.json()


def test_falha_de_rede_no_meio_das_requisicoes_retorna_502_sem_parcial():
    site = FakeCifraClub(tom_original="F", k_original=8)
    site.falhar_na_chamada = 5
    with patch(GET_PATH, side_effect=site):
        resp = client.post("/tons", json={"cifra_club_url": URL})

    assert resp.status_code == 502
    assert isinstance(resp.json()["error"], str)
    assert "versions" not in resp.json()


def test_botao_de_tom_ausente_retorna_502():
    html_sem_botao = _html(None, _conteudo_para("F"))
    resposta = MagicMock()
    resposta.status_code = 200
    resposta.raise_for_status.return_value = None
    resposta.text = html_sem_botao
    with patch(GET_PATH, return_value=resposta):
        resp = client.post("/tons", json={"cifra_club_url": URL})

    assert resp.status_code == 502
    assert "versions" not in resp.json()


def test_texto_de_tom_nao_reconhecido_retorna_502_sem_heuristica():
    site = FakeCifraClub(tom_original="F", k_original=8)
    site.tom_forcado[None] = "Xyz"
    with patch(GET_PATH, side_effect=site):
        resp = client.post("/tons", json={"cifra_club_url": URL})

    assert resp.status_code == 502
    assert "Xyz" in resp.json()["error"]
    assert "versions" not in resp.json()


def test_tom_devolvido_diferente_do_calibrado_retorna_502():
    site = FakeCifraClub(tom_original="F", k_original=8)
    # keyShape=9 deveria mostrar F#; forçamos o Cifra Club a mostrar G.
    site.tom_forcado[9] = "G"
    with patch(GET_PATH, side_effect=site):
        resp = client.post("/tons", json={"cifra_club_url": URL})

    assert resp.status_code == 502
    assert "calibração inconsistente" in resp.json()["error"]
    assert "versions" not in resp.json()


def test_post_tons_happy_path_responde_formato_do_contrato():
    site = FakeCifraClub(tom_original="F", k_original=8)
    with patch(GET_PATH, side_effect=site):
        resp = client.post("/tons", json={"cifra_club_url": URL})

    assert resp.status_code == 200
    corpo = resp.json()
    assert set(corpo.keys()) == {"versions"}
    assert len(corpo["versions"]) == 12
    assert set(corpo["versions"][0].keys()) == {"tom", "semitone_offset", "is_original", "conteudo", "capotraste"}


@pytest.mark.parametrize("corpo", [{}, {"cifra_club_url": "   "}, {"cifra_club_url": 42}])
def test_post_tons_sem_url_valida_retorna_400_sem_chamar_cifra_club(corpo):
    with patch(GET_PATH) as mock_get:
        resp = client.post("/tons", json=corpo)

    assert resp.status_code == 400
    assert isinstance(resp.json()["error"], str)
    mock_get.assert_not_called()


def test_musica_em_tom_menor_preserva_sufixo_m_nas_12_versoes():
    site = FakeCifraClub(tom_original="Bbm", k_original=3)
    with patch(GET_PATH, side_effect=site):
        versoes = obter_tons(URL)

    tons = [v["tom"] for v in versoes]
    assert tons == [nota + "m" for nota in NOTAS_EM_SUSTENIDO]
    assert tons[0] == "Cm" and tons[1] == "C#m" and tons[2] == "Dm" and tons[-1] == "Bm"
    assert all(tom.endswith("m") for tom in tons)
    assert "b" not in "".join(tons)
    original = next(v for v in versoes if v["is_original"])
    assert original["tom"] == "A#m"
    assert original["conteudo"] == _esperado("Bbm")


def test_botao_menor_com_sufixo_trocado_por_maior_retorna_502():
    site = FakeCifraClub(tom_original="Dm", k_original=8)
    site.tom_forcado[9] = "F#"  # keyShape=9 deveria ser F#m
    with patch(GET_PATH, side_effect=site):
        resp = client.post("/tons", json={"cifra_club_url": URL})

    assert resp.status_code == 502
    assert "versions" not in resp.json()


@pytest.mark.parametrize(
    "url_fora",
    [
        "https://evil.example.com/coldplay/the-scientist/",
        "https://cifraclub.com.br.evil.com/coldplay/the-scientist/",
        "https://evilcifraclub.com.br/coldplay/the-scientist/",
        "https://cifraclub.com.br@evil.example.com/coldplay/",
        "http://www.cifraclub.com.br/coldplay/the-scientist/",
        "file:///etc/passwd",
        "http://169.254.169.254/latest/meta-data/",
    ],
)
def test_url_fora_do_dominio_retorna_400_sem_chamar_curl_cffi(url_fora):
    with patch(GET_PATH) as mock_get:
        resp = client.post("/tons", json={"cifra_club_url": url_fora})

    assert resp.status_code == 400
    assert isinstance(resp.json()["error"], str)
    mock_get.assert_not_called()


def test_validar_url_aceita_dominio_e_subdominio_https():
    from cifraclub_tons import validar_url_cifra_club

    validar_url_cifra_club("https://cifraclub.com.br/coldplay/the-scientist/")
    validar_url_cifra_club("https://www.cifraclub.com.br/coldplay/the-scientist/")
    validar_url_cifra_club("https://m.cifraclub.com.br/coldplay/the-scientist/")


def _resposta_redirect(location: str) -> MagicMock:
    resposta = MagicMock()
    resposta.status_code = 302
    resposta.headers = {"location": location}
    return resposta


def test_redirect_para_host_permitido_e_seguido_e_revalidado():
    # Simula o redirect real observado (cifraclub.com.br -> www.cifraclub.com.br):
    # toda chamada à URL sem "www." redireciona antes de chegar ao conteúdo.
    url_bare = "https://cifraclub.com.br/coldplay/the-scientist/"
    site = FakeCifraClub(tom_original="F", k_original=8)

    def get_com_redirect(url, params=None, **kwargs):
        if url == url_bare:
            return _resposta_redirect(URL)
        return site(url, params=params, **kwargs)

    with patch(GET_PATH, side_effect=get_com_redirect):
        versoes = obter_tons(url_bare)

    assert len(versoes) == 12
    assert sum(v["is_original"] for v in versoes) == 1


def test_redirect_para_host_fora_do_dominio_e_rejeitado_sem_seguir():
    with patch(GET_PATH, return_value=_resposta_redirect("https://evil.example.com/pwn")):
        resp = client.post("/tons", json={"cifra_club_url": URL})

    # a mesma validação de domínio da URL de entrada se aplica ao destino do redirect
    assert resp.status_code == 400
    assert "versions" not in resp.json()


def test_redirect_sem_location_e_rejeitado():
    resposta = MagicMock()
    resposta.status_code = 302
    resposta.headers = {}
    with patch(GET_PATH, return_value=resposta):
        resp = client.post("/tons", json={"cifra_club_url": URL})

    assert resp.status_code == 502
    assert "versions" not in resp.json()


def test_muitos_redirects_em_cadeia_retorna_502():
    chamada = {"n": 0}

    def sempre_redireciona(url, params=None, **kwargs):
        chamada["n"] += 1
        return _resposta_redirect(f"https://www.cifraclub.com.br/loop-{chamada['n']}/")

    with patch(GET_PATH, side_effect=sempre_redireciona):
        resp = client.post("/tons", json={"cifra_club_url": URL})

    assert resp.status_code == 502
    assert "versions" not in resp.json()
