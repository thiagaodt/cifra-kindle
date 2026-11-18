from unittest.mock import MagicMock, patch

import pytest
import requests
from fastapi.testclient import TestClient

from main import app

client = TestClient(app)

SOLR_PATH = "cifraclub_search.requests.get"


def _resposta_solr(results):
    resp = MagicMock()
    resp.raise_for_status.return_value = None
    resp.json.return_value = {"query": "x", "results": results, "has_more": False}
    return resp


def _song(slug, artist_slug, score):
    return {
        "artist": {"name": "Coldplay", "slug": artist_slug, "id": 1033},
        "name": "The Scientist",
        "slug": slug,
        "type": "song",
        "score": score,
    }


def test_happy_path_retorna_url_da_musica_de_maior_score():
    resultados = [
        _song("the-scientist-spanish-cover", "coldplay", 2.24),
        _song("the-scientist", "coldplay", 12.40),
    ]
    with patch(SOLR_PATH, return_value=_resposta_solr(resultados)) as mock_get:
        resp = client.get("/buscar", params={"nome": "the scientist coldplay"})

    assert resp.status_code == 200
    assert resp.json() == {
        "cifra_club_url": "https://www.cifraclub.com.br/coldplay/the-scientist/"
    }
    _, kwargs = mock_get.call_args
    assert kwargs["params"] == {"q": "the scientist coldplay", "lang": "pt"}
    assert kwargs["timeout"] == 10


def test_nome_sem_resultado_retorna_404_com_error():
    with patch(SOLR_PATH, return_value=_resposta_solr([])):
        resp = client.get("/buscar", params={"nome": "musica inexistente xyz"})

    assert resp.status_code == 404
    assert isinstance(resp.json()["error"], str)


def test_solr_indisponivel_retorna_502_com_error():
    with patch(SOLR_PATH, side_effect=requests.Timeout("timeout")):
        resp = client.get("/buscar", params={"nome": "the scientist"})

    assert resp.status_code == 502
    assert isinstance(resp.json()["error"], str)


def test_resultado_sem_type_song_retorna_404():
    artista = {
        "artist": {"name": "Coldplay", "slug": "coldplay", "id": 1033},
        "name": "Coldplay",
        "slug": "coldplay",
        "type": "artist",
        "score": 9.9,
    }
    with patch(SOLR_PATH, return_value=_resposta_solr([artista])):
        resp = client.get("/buscar", params={"nome": "coldplay"})

    assert resp.status_code == 404
    assert isinstance(resp.json()["error"], str)


def test_song_malformado_sem_artist_retorna_502_com_error():
    malformado = {"type": "song", "slug": "the-scientist", "score": 12.4}
    with patch(SOLR_PATH, return_value=_resposta_solr([malformado])):
        resp = client.get("/buscar", params={"nome": "the scientist"})

    assert resp.status_code == 502
    assert isinstance(resp.json()["error"], str)


def test_nome_vazio_retorna_400_sem_chamar_solr():
    with patch(SOLR_PATH) as mock_get:
        resp = client.get("/buscar", params={"nome": "   "})

    assert resp.status_code == 400
    assert isinstance(resp.json()["error"], str)
    mock_get.assert_not_called()
