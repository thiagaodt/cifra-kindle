import type { TonVersion } from "../../interfaces/tonVersion";

export interface BuscarMusicaResult {
    cifraClubUrl: string;
    nome?: string;
}

/**
 * Assinatura de contrato esperada pela Story 5 para a busca do Cifra Club (Story 2).
 * A implementação real pertence à Story 2 (Claude Code).
 */
export async function buscarMusica(_nome: string): Promise<BuscarMusicaResult> {
    throw new Error(
        "integrations/cifraClub.buscarMusica ainda não implementado (responsabilidade da Story 2)."
    );
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
