import type { Request, Response } from "express";
import { obterEnvioPorId } from "../services/processarMusicaService";

export async function getEnvioById(req: Request, res: Response): Promise<void> {
    const id = req.params.id as string;
    const envio = await obterEnvioPorId(id);

    if (!envio) {
        res.status(404).json({ error: "Envio não encontrado." });
        return;
    }

    res.status(200).json(envio);
}

export const envioController = {
    getEnvioById,
};

export default envioController;
