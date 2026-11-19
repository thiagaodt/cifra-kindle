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
    input: MusicaInput,
    placeholderMusicaId?: string
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

        const musica = await musicaRepository.upsertByCifraClubUrl({
            nome: nomeMusica,
            cifraClubUrl,
            tomOriginal,
        });

        // `processarMusica` upsertou um placeholder (URL sintética) antes de resolver a URL real,
        // pra poder responder `{ envioId }` na hora. Com a URL real em mãos, o upsert acima nunca
        // bate no placeholder (URLs diferentes) e cria uma linha nova -- repontar o FK e descartar
        // o placeholder evita órfãos em `musicas` e `envios.musica_id` apontando pra linha errada.
        if (placeholderMusicaId && placeholderMusicaId !== musica.id) {
            await envioRepository.updateMusicaId(envioId, musica.id);
            await musicaRepository.deleteById(placeholderMusicaId);
        }

        await envioRepository.updateStatus(envioId, "gerando");
        const epubBuffer = await buildEpub(versions, { titulo: nomeMusica });

        await envioRepository.updateStatus(envioId, "enviando");
        const filename = toSafeFilename(nomeMusica);
        await sendEpub(epubBuffer, filename);

        await envioRepository.updateStatus(envioId, "concluido");
    } catch (error) {
        const erroMensagem =
            error instanceof Error && error.message
                ? error.message
                : "Erro desconhecido no processamento da música.";
        try {
            await envioRepository.updateStatus(envioId, "erro", erroMensagem);
        } catch (writeError) {
            // Nunca deixa o pipeline rejeitar sem handler: `processarMusica` não aguarda essa
            // promise, então uma rejeição aqui seria unhandled e poderia derrubar o processo.
            console.error(
                `[pipeline] falha ao gravar status de erro para envio ${envioId}:`,
                writeError
            );
        }
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

    const pipelinePromise = executarPipelineEnvio(envio.id, input, musica.id).finally(() => {
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
