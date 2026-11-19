import { env } from "../../config/env";
import type { TonVersion } from "../../interfaces/tonVersion";

export interface BuscarMusicaResult {
    cifraClubUrl: string;
    nome?: string;
}

const BUSCAR_TIMEOUT_MS = 15_000;
// Pior caso do scraper: 13 requisições sequenciais × 15s de timeout cada ≈ 195s; 240s dá margem.
const TONS_TIMEOUT_MS = 240_000;
const TOTAL_VERSOES = 12;

/**
 * Resolve o nome da música para a URL da Cifra Club consumindo `GET /buscar` do
 * FastAPI (C-1: nunca a Solr nem cifraclub.com.br diretamente). Erros viram
 * `Error` com mensagem legível, que o pipeline grava em `envios.erro_mensagem`.
 */
export async function buscarMusica(nome: string): Promise<BuscarMusicaResult> {
    const base = env.scraperBaseUrl.replace(/\/+$/, "");
    const url = `${base}/buscar?nome=${encodeURIComponent(nome)}`;

    let response: Response;
    try {
        response = await fetch(url, { signal: AbortSignal.timeout(BUSCAR_TIMEOUT_MS) });
    } catch (error) {
        const detalhe = error instanceof Error ? error.message : String(error);
        throw new Error(`Serviço de scraping indisponível ao buscar "${nome}": ${detalhe}`);
    }

    const body: unknown = await response.json().catch(() => null);
    const mensagemErro =
        body && typeof body === "object" && "error" in body && typeof body.error === "string"
            ? body.error
            : null;

    if (!response.ok) {
        throw new Error(mensagemErro ?? `Falha ao buscar "${nome}" (HTTP ${response.status}).`);
    }

    const cifraClubUrl =
        body && typeof body === "object" && "cifra_club_url" in body && typeof body.cifra_club_url === "string"
            ? body.cifra_club_url
            : null;

    if (!cifraClubUrl) {
        throw new Error(`Resposta inválida do serviço de scraping ao buscar "${nome}".`);
    }

    return { cifraClubUrl, nome };
}

/**
 * Obtém as 12 versões de tom consumindo `POST /tons` do FastAPI (C-1). O FastAPI faz
 * 12 requisições sequenciais ao Cifra Club, por isso o timeout é bem maior que o do busca.
 * Qualquer falha vira `Error` com mensagem legível; nunca resolve com lista parcial.
 */
export async function obterTons(cifraClubUrl: string): Promise<TonVersion[]> {
    const base = env.scraperBaseUrl.replace(/\/+$/, "");
    const url = `${base}/tons`;

    let response: Response;
    try {
        response = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ cifra_club_url: cifraClubUrl }),
            signal: AbortSignal.timeout(TONS_TIMEOUT_MS),
        });
    } catch (error) {
        const detalhe = error instanceof Error ? error.message : String(error);
        throw new Error(`Serviço de scraping indisponível ao obter tons de "${cifraClubUrl}": ${detalhe}`);
    }

    const body: unknown = await response.json().catch(() => null);
    const mensagemErro =
        body && typeof body === "object" && "error" in body && typeof body.error === "string"
            ? body.error
            : null;

    if (!response.ok) {
        throw new Error(mensagemErro ?? `Falha ao obter tons de "${cifraClubUrl}" (HTTP ${response.status}).`);
    }

    const versions =
        body && typeof body === "object" && "versions" in body && Array.isArray(body.versions)
            ? body.versions
            : null;

    if (!versions || versions.length !== TOTAL_VERSOES) {
        throw new Error(`Resposta inválida do serviço de scraping ao obter tons de "${cifraClubUrl}".`);
    }

    const tonVersions = versions.map(paraTonVersion);
    const originais = tonVersions.filter((version) => version.isOriginal).length;
    if (originais !== 1) {
        throw new Error(`Resposta inválida do serviço de scraping: ${originais} versões marcadas como original.`);
    }

    // Os offsets têm que ser exatamente {0..11}, sem repetição (defesa contra resposta corrompida).
    const offsets = new Set(tonVersions.map((version) => version.semitoneOffset));
    const offsetsValidos = tonVersions.every(
        (version) => Number.isInteger(version.semitoneOffset) && version.semitoneOffset >= 0 && version.semitoneOffset < TOTAL_VERSOES
    );
    if (offsets.size !== TOTAL_VERSOES || !offsetsValidos) {
        throw new Error("Resposta inválida do serviço de scraping: semitoneOffset repetido ou fora de 0..11.");
    }

    return tonVersions;
}

/** Converte um item do JSON do FastAPI (snake_case) para `TonVersion` (camelCase), validando os campos. */
function paraTonVersion(item: unknown): TonVersion {
    if (
        !item ||
        typeof item !== "object" ||
        !("tom" in item) || typeof item.tom !== "string" ||
        !("semitone_offset" in item) || typeof item.semitone_offset !== "number" ||
        !("is_original" in item) || typeof item.is_original !== "boolean" ||
        !("conteudo" in item) || typeof item.conteudo !== "string"
    ) {
        throw new Error("Resposta inválida do serviço de scraping: versão de tom com campos ausentes ou inválidos.");
    }
    let capotraste: number | null = null;
    if ("capotraste" in item && item.capotraste !== null && item.capotraste !== undefined) {
        if (typeof item.capotraste !== "number" || !Number.isInteger(item.capotraste) || item.capotraste <= 0) {
            throw new Error("Resposta inválida do serviço de scraping: capotraste deve ser inteiro positivo ou null.");
        }
        capotraste = item.capotraste;
    }
    return {
        tom: item.tom,
        semitoneOffset: item.semitone_offset,
        isOriginal: item.is_original,
        conteudo: item.conteudo,
        capotraste,
    };
}

export const cifraClub = {
    buscarMusica,
    obterTons,
};

export default cifraClub;
