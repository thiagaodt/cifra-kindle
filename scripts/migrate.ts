import { env } from "../config/env";
import db from "../database/db";

/**
 * CLI de migrations. Usamos este script (tsx) em vez do binário do Knex
 * porque o `knex` CLI exigiria um segundo runtime de TypeScript (ts-node).
 *
 *   npm run migrate            -> latest
 *   npm run migrate:status
 *   npm run migrate:rollback
 *   npm run migrate:make -- nome_da_migration
 *
 * NUNCA rode migration no boot da API: o ritual é migrate -> dev.
 */
type Command = "latest" | "status" | "rollback" | "make";

async function main(): Promise<void> {
    const command = (process.argv[2] ?? "latest") as Command;
    const argument = process.argv[3];

    console.log(`[migrate] ambiente ${env.nodeEnv}`);

    switch (command) {
        case "latest": {
            const [batch, applied] = (await db.migrate.latest()) as [number, string[]];
            if (applied.length === 0) console.log("[migrate] nada a aplicar.");
            else console.log(`[migrate] lote ${batch}:\n  ${applied.join("\n  ")}`);
            break;
        }
        case "status": {
            const [completed, pending] = (await db.migrate.list()) as [{ name: string }[], { file: string }[]];
            console.log(`[migrate] aplicadas (${completed.length}):`);
            completed.forEach((row) => console.log(`  ok  ${row.name ?? row}`));
            console.log(`[migrate] pendentes (${pending.length}):`);
            pending.forEach((row) => console.log(`  --  ${row.file ?? row}`));
            break;
        }
        case "rollback": {
            const [batch, reverted] = (await db.migrate.rollback()) as [number, string[]];
            if (reverted.length === 0) console.log("[migrate] nada a reverter.");
            else console.log(`[migrate] lote ${batch} revertido:\n  ${reverted.join("\n  ")}`);
            break;
        }
        case "make": {
            if (!argument) throw new Error('Informe o nome: npm run migrate:make -- "nome_da_migration"');
            const file = await db.migrate.make(argument, { extension: "ts" });
            console.log(`[migrate] criada ${file}`);
            break;
        }
        default:
            throw new Error(`Comando desconhecido: ${command}`);
    }
}

main()
    .then(async () => {
        await db.destroy();
    })
    .catch(async (error: unknown) => {
        console.error("[migrate] falhou:", error);
        await db.destroy();
        process.exit(1);
    });
