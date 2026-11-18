import { env } from "../../config/env";
import type { TonVersion } from "../../interfaces/tonVersion";

export interface BuscarMusicaResult {
    cifraClubUrl: string;
    nome?: string;
}

const BUSCAR_TIMEOUT_MS = 15_000;

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
 * Assinatura de contrato esperada pela Story 5 para obtenção dos 12 tons (Story 3).
 * A implementação real pertence à Story 3 (Claude Code).
 */
export async function obterTons(_cifraClubUrl: string): Promise<TonVersion[]> {
    throw new Error(
        "integrations/cifraClub.obterTons ainda não implementado (responsabilidade da Story 3)."
    );
}

export const cifraClub = {
    buscarMusica,
    obterTons,
};

export default cifraClub;
