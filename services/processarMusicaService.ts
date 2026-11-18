import { randomUUID } from "node:crypto";
import { buscarMusica, obterTons } from "../integrations/cifraClub";
import { sendEpub } from "../integrations/kindleMail/sendToKindle";
import envioRepository, { EnvioRecord } from "../repositories/envioRepository";
import musicaRepository from "../repositories/musicaRepository";
import type { MusicaInput } from "../schemas/musicaSchema";
import { buildEpub } from "./epubBuilder";

const pendingPipelines = new Map<string, Promise<void>>();

function toSafeFilename(title: string): string {
    const slug = title
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-zA-Z0-9_-]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .toLowerCase();

    return `${slug || "cifra"}.epub`;
}

/**
 * Executa as etapas do pipeline em background atualizando `envios.status`
 * estritamente: pendente -> buscando -> transpondo -> gerando -> enviando -> concluido
 * (ou `erro` a partir de qualquer etapa, C-9/C-11).
 */
export async function executarPipelineEnvio(
    envioId: string,
    input: MusicaInput
): Promise<void> {
    try {
        await envioRepository.updateStatus(envioId, "buscando");
        let cifraClubUrl: string;
        let nomeMusica: string;

        if (input.link) {
            cifraClubUrl = input.link;
            nomeMusica = input.nome ?? input.link;
        } else {
            const busca = await buscarMusica(input.nome!);
            cifraClubUrl = busca.cifraClubUrl;
            nomeMusica = busca.nome ?? input.nome!;
        }

        await envioRepository.updateStatus(envioId, "transpondo");
        const versions = await obterTons(cifraClubUrl);
        const original = versions.find((version) => version.isOriginal);
        const tomOriginal = original?.tom ?? "C";

        await musicaRepository.upsertByCifraClubUrl({
            nome: nomeMusica,
            cifraClubUrl,
            tomOriginal,
        });

        await envioRepository.updateStatus(envioId, "gerando");
        const epubBuffer = await buildEpub(versions);

        await envioRepository.updateStatus(envioId, "enviando");
        const filename = toSafeFilename(nomeMusica);
        await sendEpub(epubBuffer, filename);

        await envioRepository.updateStatus(envioId, "concluido");
    } catch (error) {
        const erroMensagem =
            error instanceof Error && error.message
                ? error.message
                : "Erro desconhecido no processamento da música.";
        await envioRepository.updateStatus(envioId, "erro", erroMensagem);
    }
}

/**
 * Cria o registro inicial em `musicas`/`envios` (`status = pendente`),
 * dispara o pipeline assíncrono em background e devolve `{ envioId }` imediatamente.
 */
export async function processarMusica(
    input: MusicaInput
): Promise<{ envioId: string }> {
    const initialUrl = input.link ?? `pending:${randomUUID()}`;
    const initialNome = input.nome ?? input.link!;

    const musica = await musicaRepository.upsertByCifraClubUrl({
        nome: initialNome,
        cifraClubUrl: initialUrl,
        tomOriginal: "C",
    });

    const envio = await envioRepository.create({
        musicaId: musica.id,
        status: "pendente",
    });

    const pipelinePromise = executarPipelineEnvio(envio.id, input).finally(() => {
        pendingPipelines.delete(envio.id);
    });
    pendingPipelines.set(envio.id, pipelinePromise);

    return { envioId: envio.id };
}

/**
 * Aguarda a conclusão do pipeline em background de um `envioId` (útil em testes).
 */
export async function aguardarPipelineEnvio(envioId: string): Promise<void> {
    const pending = pendingPipelines.get(envioId);
    if (pending) {
        await pending;
    }
}

export async function obterEnvioPorId(
    id: string
): Promise<EnvioRecord | undefined> {
    return envioRepository.getById(id);
}

export const processarMusicaService = {
    processarMusica,
    executarPipelineEnvio,
    aguardarPipelineEnvio,
    obterEnvioPorId,
};

export default processarMusicaService;
