import type { Request, Response } from "express";
import type { MusicaInput } from "../schemas/musicaSchema";
import { processarMusica } from "../services/processarMusicaService";

export async function postMusica(req: Request, res: Response): Promise<void> {
    const input = req.body as MusicaInput;
    const { envioId } = await processarMusica(input);
    res.status(202).json({ envioId });
}

export const musicaController = {
    postMusica,
};

export default musicaController;
