import { createApp } from "./app";
import { env } from "./config/env";
import db from "./database/db";
import { assertDatabaseMigrated } from "./database/migrationGuard";

/**
 * Nunca migra no boot (convenção do autor): confere que o banco responde e
 * que já foi migrado; se não, falha alto antes de `listen` (ver Edge-Case
 * Matrix da story e `database/migrationGuard.ts`).
 */
async function main(): Promise<void> {
    await db.raw("SELECT 1");
    await assertDatabaseMigrated();

    const app = createApp();
    app.listen(env.port, () => {
        console.log(`[server] API escutando em :${env.port} (nodeEnv=${env.nodeEnv})`);
    });
}

main().catch((error: unknown) => {
    console.error("[server] boot falhou:", error instanceof Error ? error.message : error);
    process.exit(1);
});
