import type { AddressInfo } from "node:net";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TonVersion } from "../../interfaces/tonVersion";
import type { EnvioRecord } from "../../repositories/envioRepository";
import type { MusicaRecord } from "../../repositories/musicaRepository";
import type { EnvioStatus } from "../../schemas/envioIdSchema";

vi.mock("../../database/db", () => ({ default: {} }));

const mockBuscarMusica = vi.fn();
const mockObterTons = vi.fn();
vi.mock("../../integrations/cifraClub", () => ({
    buscarMusica: (...args: unknown[]) => mockBuscarMusica(...args),
    obterTons: (...args: unknown[]) => mockObterTons(...args),
    default: {
        buscarMusica: (...args: unknown[]) => mockBuscarMusica(...args),
        obterTons: (...args: unknown[]) => mockObterTons(...args),
    },
}));

const mockBuildEpub = vi.fn();
vi.mock("../../services/epubBuilder", () => ({
    buildEpub: (...args: unknown[]) => mockBuildEpub(...args),
}));

const mockSendEpub = vi.fn();
vi.mock("../../integrations/kindleMail/sendToKindle", () => ({
    sendEpub: (...args: unknown[]) => mockSendEpub(...args),
}));

const musicasStore = new Map<string, MusicaRecord>();
const enviosStore = new Map<string, EnvioRecord>();
const statusTimeline = new Map<string, EnvioStatus[]>();
let nextIdCounter = 1;

vi.mock("../../repositories/musicaRepository", () => {
    const upsertByCifraClubUrl = vi.fn(
        async (input: { nome: string; cifraClubUrl: string; tomOriginal?: string }) => {
            for (const existing of musicasStore.values()) {
                if (existing.cifra_club_url === input.cifraClubUrl) {
                    existing.nome = input.nome;
                    existing.tom_original = input.tomOriginal ?? existing.tom_original;
                    return existing;
                }
            }
            const record: MusicaRecord = {
                id: `00000000-0000-4000-8000-${String(nextIdCounter++).padStart(12, "0")}`,
                nome: input.nome,
                cifra_club_url: input.cifraClubUrl,
                tom_original: input.tomOriginal ?? "C",
                criado_em: new Date(),
            };
            musicasStore.set(record.id, record);
            return record;
        }
    );

    const getById = vi.fn(async (id: string) => musicasStore.get(id));

    return {
        upsertByCifraClubUrl,
        getById,
        musicaRepository: { upsertByCifraClubUrl, getById },
        default: { upsertByCifraClubUrl, getById },
    };
});

vi.mock("../../repositories/envioRepository", () => {
    const create = vi.fn(
        async (input: string | { musicaId: string; status?: EnvioStatus }) => {
            const musicaId = typeof input === "string" ? input : input.musicaId;
            const status: EnvioStatus =
                typeof input === "string" ? "pendente" : (input.status ?? "pendente");
            const id = `11111111-1111-4111-8111-${String(nextIdCounter++).padStart(12, "0")}`;
            const now = new Date();
            const record: EnvioRecord = {
                id,
                musica_id: musicaId,
                status,
                erro_mensagem: null,
                enviado_em: null,
                criado_em: now,
                atualizado_em: now,
            };
            enviosStore.set(id, record);
            statusTimeline.set(id, [status]);
            return record;
        }
    );

    const updateStatus = vi.fn(
        async (id: string, status: EnvioStatus, erroMensagem?: string) => {
            const existing = enviosStore.get(id);
            if (!existing) return undefined;
            existing.status = status;
            existing.erro_mensagem = erroMensagem ?? null;
            existing.atualizado_em = new Date();
            if (status === "concluido") {
                existing.enviado_em = new Date();
            }
            statusTimeline.get(id)?.push(status);
            return existing;
        }
    );

    const getById = vi.fn(async (id: string) => enviosStore.get(id));

    return {
        create,
        updateStatus,
        getById,
        envioRepository: { create, updateStatus, getById },
        default: { create, updateStatus, getById },
    };
});

import { createApp } from "../../app";
import { aguardarPipelineEnvio } from "../../services/processarMusicaService";

function makeFakeTons(): TonVersion[] {
    const tones = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
    return tones.map((tom, idx) => ({
        tom,
        semitoneOffset: idx,
        isOriginal: tom === "F",
        conteudo: `${tom}\nLetra em ${tom}`,
    }));
}

async function withServer<T>(fn: (baseUrl: string) => Promise<T>): Promise<T> {
    const app = createApp();
    const server = app.listen(0);
    try {
        const { port } = server.address() as AddressInfo;
        return await fn(`http://127.0.0.1:${port}`);
    } finally {
        await new Promise<void>((resolve) => server.close(() => resolve()));
    }
}

describe("processarMusicaService + rotas POST /api/musicas e GET /api/envios/:id", () => {
    beforeEach(() => {
        musicasStore.clear();
        enviosStore.clear();
        statusTimeline.clear();
        nextIdCounter = 1;
        vi.clearAllMocks();
    });

    it("happy path: POST /api/musicas devolve { envioId } e progride pendente -> buscando -> transpondo -> gerando -> enviando -> concluido enviando o EPUB via SMTP", async () => {
        const fakeBuffer = Buffer.from("fake-epub-binary");
        mockBuscarMusica.mockResolvedValue({
            cifraClubUrl: "https://www.cifraclub.com.br/coldplay/the-scientist/",
            nome: "The Scientist",
        });
        mockObterTons.mockResolvedValue(makeFakeTons());
        mockBuildEpub.mockResolvedValue(fakeBuffer);
        mockSendEpub.mockResolvedValue(undefined);

        await withServer(async (baseUrl) => {
            const postRes = await fetch(`${baseUrl}/api/musicas`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ nome: "The Scientist" }),
            });

            expect(postRes.status).toBe(202);
            const body = (await postRes.json()) as { envioId: string };
            expect(body.envioId).toBeDefined();

            await aguardarPipelineEnvio(body.envioId);

            expect(statusTimeline.get(body.envioId)).toEqual([
                "pendente",
                "buscando",
                "transpondo",
                "gerando",
                "enviando",
                "concluido",
            ]);

            expect(mockSendEpub).toHaveBeenCalledTimes(1);
            expect(mockSendEpub).toHaveBeenCalledWith(fakeBuffer, "the-scientist.epub");

            const getRes = await fetch(`${baseUrl}/api/envios/${body.envioId}`);
            expect(getRes.status).toBe(200);
            const envio = (await getRes.json()) as EnvioRecord;
            expect(envio.status).toBe("concluido");
            expect(envio.erro_mensagem).toBeNull();
        });
    });

    it("música não encontrada: resposta inicial devolve { envioId } e GET /api/envios/:id reflete status=erro com erro_mensagem explicando a causa", async () => {
        mockBuscarMusica.mockRejectedValue(
            new Error("Música não encontrada no Cifra Club: musica-inexistente-xyz")
        );

        await withServer(async (baseUrl) => {
            const postRes = await fetch(`${baseUrl}/api/musicas`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ nome: "musica-inexistente-xyz" }),
            });

            expect(postRes.status).toBe(202);
            const { envioId } = (await postRes.json()) as { envioId: string };
            expect(envioId).toBeDefined();

            await aguardarPipelineEnvio(envioId);

            const getRes = await fetch(`${baseUrl}/api/envios/${envioId}`);
            expect(getRes.status).toBe(200);
            const envio = (await getRes.json()) as EnvioRecord;
            expect(envio.status).toBe("erro");
            expect(envio.erro_mensagem).toMatch(/Música não encontrada no Cifra Club/);
            expect(statusTimeline.get(envioId)).toEqual(["pendente", "buscando", "erro"]);
        });
    });

    it("SMTP recusa o envio: falha na etapa de envio grava status=erro e erro_mensagem citando a falha do SMTP (nunca trava em enviando)", async () => {
        mockBuscarMusica.mockResolvedValue({
            cifraClubUrl: "https://www.cifraclub.com.br/coldplay/yellow/",
            nome: "Yellow",
        });
        mockObterTons.mockResolvedValue(makeFakeTons());
        mockBuildEpub.mockResolvedValue(Buffer.from("epub-yellow"));
        mockSendEpub.mockRejectedValue(
            new Error("SMTP error 550: Sender not approved for Send-to-Kindle")
        );

        await withServer(async (baseUrl) => {
            const postRes = await fetch(`${baseUrl}/api/musicas`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ nome: "Yellow" }),
            });

            expect(postRes.status).toBe(202);
            const { envioId } = (await postRes.json()) as { envioId: string };

            await aguardarPipelineEnvio(envioId);

            const getRes = await fetch(`${baseUrl}/api/envios/${envioId}`);
            expect(getRes.status).toBe(200);
            const envio = (await getRes.json()) as EnvioRecord;
            expect(envio.status).toBe("erro");
            expect(envio.erro_mensagem).toContain("SMTP error 550");
            expect(statusTimeline.get(envioId)).toEqual([
                "pendente",
                "buscando",
                "transpondo",
                "gerando",
                "enviando",
                "erro",
            ]);
        });
    });

    it("GET /api/envios/:id com id inexistente: responde 404 com { error: string }", async () => {
        await withServer(async (baseUrl) => {
            const res = await fetch(
                `${baseUrl}/api/envios/99999999-9999-4999-8999-999999999999`
            );

            expect(res.status).toBe(404);
            const body = (await res.json()) as { error: string };
            expect(typeof body.error).toBe("string");
            expect(body.error.length).toBeGreaterThan(0);
        });
    });
});
