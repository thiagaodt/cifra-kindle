import express, { Express, NextFunction, Request, Response } from "express";
import envioRoute from "./routes/envioRoute";
import musicaRoute from "./routes/musicaRoute";

/**
 * Bootstrap do Express. Fluxo unidirecional:
 * `routes -> controllers -> services -> repositories/integrations` (C-7).
 */
export function createApp(): Express {
    const app = express();

    app.use(express.json());

    app.get("/api/health", (_req: Request, res: Response) => {
        res.status(200).json({ status: "ok" });
    });

    app.use("/api", musicaRoute);
    app.use("/api", envioRoute);
    app.use(musicaRoute);
    app.use(envioRoute);

    app.use((req: Request, res: Response) => {
        res.status(404).json({ error: `Rota não encontrada: ${req.method} ${req.originalUrl}` });
    });

    // Middleware de erro: sempre `{ error: string }` (ver conventions.md).
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
        console.error("[app] erro não tratado:", error);
        const message = error instanceof Error ? error.message : "Erro interno";
        res.status(500).json({ error: message });
    });

    return app;
}
