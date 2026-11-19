import type { Request, Response } from "express";
import type { EnvioRecord } from "../repositories/envioRepository";
import { obterEnvioPorId } from "../services/processarMusicaService";

/** Converte `EnvioRecord` (snake_case, vindo do banco) para a convenção camelCase da API (conventions.md). */
function paraEnvioResponse(envio: EnvioRecord) {
    return {
        id: envio.id,
        musicaId: envio.musica_id,
        status: envio.status,
        erroMensagem: envio.erro_mensagem,
        enviadoEm: envio.enviado_em,
        criadoEm: envio.criado_em,
        atualizadoEm: envio.atualizado_em,
    };
}

export async function getEnvioById(req: Request, res: Response): Promise<void> {
    const id = req.params.id as string;
    const envio = await obterEnvioPorId(id);

    if (!envio) {
        res.status(404).json({ error: "Envio não encontrado." });
        return;
    }

    res.status(200).json(paraEnvioResponse(envio));
}

export const envioController = {
    getEnvioById,
};

export default envioController;
