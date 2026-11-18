import { NextFunction, Request, Response, Router } from "express";
import { postMusica } from "../controllers/musicaController";
import { musicaSchema } from "../schemas/musicaSchema";

const router = Router();

function validateMusicaBody(req: Request, res: Response, next: NextFunction): void {
    const parsed = musicaSchema.safeParse(req.body);
    if (!parsed.success) {
        const message =
            parsed.error.issues[0]?.message ?? "Corpo de requisição inválido.";
        res.status(400).json({ error: message });
        return;
    }
    req.body = parsed.data;
    next();
}

router.post("/musicas", validateMusicaBody, postMusica);

export default router;
