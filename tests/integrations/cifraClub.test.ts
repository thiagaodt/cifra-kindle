import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../config/env", () => ({
    env: { scraperBaseUrl: "http://scraper.test:8000" },
}));

import { buscarMusica, obterTons } from "../../integrations/cifraClub";

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

const CHROMATIC_TONES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"] as const;

function scraperTonsBody(originalTone: string = "F", capotraste?: number | null) {
    return {
        versions: CHROMATIC_TONES.map((tom, index) => ({
            tom,
            semitone_offset: index,
            is_original: tom === originalTone,
            conteudo: `${tom}        Dm7\n    letra no tom de ${tom}`,
            ...(capotraste === undefined ? {} : { capotraste }),
        })),
    };
}

describe("integrations/cifraClub.obterTons", () => {
    let fetchMock: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        fetchMock = vi.fn();
        vi.stubGlobal("fetch", fetchMock);
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it("happy path: POST /tons com cifra_club_url e resolve 12 TonVersion em camelCase", async () => {
        fetchMock.mockResolvedValueOnce(jsonResponse(200, scraperTonsBody("F")));
        const cifraClubUrl = "https://www.cifraclub.com.br/coldplay/the-scientist/";

        const result = await obterTons(cifraClubUrl);

        const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
        expect(url).toBe("http://scraper.test:8000/tons");
        expect(init.method).toBe("POST");
        expect(JSON.parse(init.body as string)).toEqual({ cifra_club_url: cifraClubUrl });

        expect(result).toHaveLength(12);
        expect(result.map((version) => version.tom)).toEqual([...CHROMATIC_TONES]);
        expect(result.filter((version) => version.isOriginal)).toHaveLength(1);
        expect(result.find((version) => version.isOriginal)?.tom).toBe("F");
        expect(result[5]).toEqual({
            tom: "F",
            semitoneOffset: 5,
            isOriginal: true,
            conteudo: "F        Dm7\n    letra no tom de F",
            capotraste: null,
        });
    });

    it("capotraste: mapeia o inteiro das 12 versões", async () => {
        fetchMock.mockResolvedValueOnce(jsonResponse(200, scraperTonsBody("F", 2)));
        const result = await obterTons("https://www.cifraclub.com.br/oasis/wonderwall/");
        expect(result.map((version) => version.capotraste)).toEqual(Array(12).fill(2));
    });

    it("capotraste null explícito: mapeia para null", async () => {
        fetchMock.mockResolvedValueOnce(jsonResponse(200, scraperTonsBody("F", null)));
        const result = await obterTons("https://www.cifraclub.com.br/coldplay/the-scientist/");
        expect(result.every((version) => version.capotraste === null)).toBe(true);
    });

    it("capotraste inválido (string/zero/fracionário): rejeita", async () => {
        for (const invalido of ["2", 0, 1.5]) {
            const body = scraperTonsBody("F", 2);
            (body.versions[0] as Record<string, unknown>).capotraste = invalido;
            fetchMock.mockResolvedValueOnce(jsonResponse(200, body));
            await expect(obterTons("https://www.cifraclub.com.br/x/y/")).rejects.toThrow(/capotraste/);
        }
    });

    it("FastAPI 502 com error: rejeita com a mensagem de erro, nunca resolve parcial", async () => {
        fetchMock.mockResolvedValueOnce(
            jsonResponse(502, { error: "Cifra Club indisponível ao buscar tons de x" })
        );

        await expect(obterTons("https://www.cifraclub.com.br/x/y/")).rejects.toThrow(
            "Cifra Club indisponível ao buscar tons"
        );
    });

    it("falha de rede do FastAPI: fetch rejeita e vira Error legível", async () => {
        fetchMock.mockRejectedValueOnce(new TypeError("fetch failed"));

        await expect(obterTons("https://www.cifraclub.com.br/x/y/")).rejects.toThrow(
            /Serviço de scraping indisponível.*fetch failed/
        );
    });

    it("resposta 200 com menos de 12 versões: rejeita (nunca lista parcial)", async () => {
        const body = scraperTonsBody("F");
        body.versions = body.versions.slice(0, 11);
        fetchMock.mockResolvedValueOnce(jsonResponse(200, body));

        await expect(obterTons("https://www.cifraclub.com.br/x/y/")).rejects.toThrow(
            /Resposta inválida/
        );
    });

    it("resposta 200 sem nenhuma versão is_original: rejeita", async () => {
        const body = scraperTonsBody("F");
        body.versions = body.versions.map((version) => ({ ...version, is_original: false }));
        fetchMock.mockResolvedValueOnce(jsonResponse(200, body));

        await expect(obterTons("https://www.cifraclub.com.br/x/y/")).rejects.toThrow(/original/);
    });

    it("resposta 200 com semitone_offset duplicado: rejeita (conjunto deve ser exatamente {0..11})", async () => {
        const body = scraperTonsBody("F");
        const [primeira, segunda, ...restantes] = body.versions;
        if (!primeira || !segunda) throw new Error("fixture sem versões");
        const duplicada = { ...segunda, semitone_offset: primeira.semitone_offset };
        fetchMock.mockResolvedValueOnce(jsonResponse(200, { versions: [primeira, duplicada, ...restantes] }));

        await expect(obterTons("https://www.cifraclub.com.br/x/y/")).rejects.toThrow(/semitoneOffset/);
    });

    it("resposta 200 com campo ausente (semitone_offset): rejeita", async () => {
        const { versions } = scraperTonsBody("F");
        const [primeira, ...restantes] = versions;
        if (!primeira) throw new Error("fixture sem versões");
        const { semitone_offset: _omitido, ...semOffset } = primeira;
        fetchMock.mockResolvedValueOnce(jsonResponse(200, { versions: [semOffset, ...restantes] }));

        await expect(obterTons("https://www.cifraclub.com.br/x/y/")).rejects.toThrow(
            /campos ausentes ou inválidos/
        );
    });
});
