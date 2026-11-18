import { NextFunction, Request, Response, Router } from "express";
import { getEnvioById } from "../controllers/envioController";
import { envioIdSchema } from "../schemas/envioIdSchema";

const router = Router();

function validateEnvioIdParams(req: Request, res: Response, next: NextFunction): void {
    const parsed = envioIdSchema.safeParse(req.params);
    if (!parsed.success) {
        const message =
            parsed.error.issues[0]?.message ?? "Parâmetro 'id' inválido.";
        res.status(400).json({ error: message });
        return;
    }
    next();
}

router.get("/envios/:id", validateEnvioIdParams, getEnvioById);

export default router;
