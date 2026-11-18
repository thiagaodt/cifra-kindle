import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../config/env", () => ({
    env: { scraperBaseUrl: "http://scraper.test:8000" },
}));

import { buscarMusica } from "../../integrations/cifraClub";

function jsonResponse(status: number, body: unknown): Response {
    return new Response(JSON.stringify(body), {
        status,
        headers: { "Content-Type": "application/json" },
    });
}

describe("integrations/cifraClub.buscarMusica", () => {
    let fetchMock: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        fetchMock = vi.fn();
        vi.stubGlobal("fetch", fetchMock);
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it("happy path: resolve { cifraClubUrl, nome } a partir do GET /buscar do FastAPI", async () => {
        fetchMock.mockResolvedValueOnce(
            jsonResponse(200, { cifra_club_url: "https://www.cifraclub.com.br/coldplay/the-scientist/" })
        );

        const result = await buscarMusica("the scientist coldplay");

        expect(result).toEqual({
            cifraClubUrl: "https://www.cifraclub.com.br/coldplay/the-scientist/",
            nome: "the scientist coldplay",
        });
        const [url] = fetchMock.mock.calls[0] as [string];
        expect(url).toBe("http://scraper.test:8000/buscar?nome=the%20scientist%20coldplay");
    });

    it("nome sem resultado: FastAPI 404 rejeita com a mensagem de erro", async () => {
        fetchMock.mockResolvedValueOnce(
            jsonResponse(404, { error: "Nenhuma música encontrada no Cifra Club para 'xyz'." })
        );

        await expect(buscarMusica("xyz")).rejects.toThrow(
            "Nenhuma música encontrada no Cifra Club para 'xyz'."
        );
    });

    it("solr indisponível: FastAPI 502 rejeita com a mensagem de erro, nunca resolve", async () => {
        fetchMock.mockResolvedValueOnce(
            jsonResponse(502, { error: "Cifra Club indisponível ao buscar 'x'" })
        );

        await expect(buscarMusica("x")).rejects.toThrow("Cifra Club indisponível");
    });

    it("falha de rede do FastAPI: fetch rejeita e vira Error legível", async () => {
        fetchMock.mockRejectedValueOnce(new TypeError("fetch failed"));

        await expect(buscarMusica("qualquer")).rejects.toThrow(
            /Serviço de scraping indisponível.*fetch failed/
        );
    });

    it("resultado sem type song (tratado como 404 pelo FastAPI): rejeita com erro legível", async () => {
        fetchMock.mockResolvedValueOnce(
            jsonResponse(404, { error: "Nenhuma música encontrada no Cifra Club para 'coldplay'." })
        );

        const erro = await buscarMusica("coldplay").catch((e: unknown) => e);
        expect(erro).toBeInstanceOf(Error);
        expect((erro as Error).message).not.toBe("");
    });
});
