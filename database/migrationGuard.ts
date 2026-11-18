import type { Knex } from "knex";
import db from "./db";

/** Nome da tabela que o Knex cria na primeira migration aplicada. */
export const MIGRATIONS_TABLE = "knex_migrations";

/**
 * Recusa subir contra um banco sem migrations (instalação nova ou DATABASE_URL
 * errada) ou com migrations pendentes. Convenção do autor: a API nunca migra
 * no boot — o ritual é `npm run migrate` antes de `npm run dev`.
 *
 * Sem a complexidade de staging/produção do `migrationGuard` do projeto irmão:
 * aqui só existe dev local (C-14), então a checagem é sempre estrita.
 */
export async function assertDatabaseMigrated(connection: Knex = db): Promise<void> {
    const hasTable = await connection.schema.hasTable(MIGRATIONS_TABLE);
    if (!hasTable) {
        throw new Error(
            `O banco não tem a tabela "${MIGRATIONS_TABLE}": as migrations não foram aplicadas. ` +
                "Rode `npm run migrate` antes de subir a API."
        );
    }

    const [, pending] = (await connection.migrate.list()) as [unknown[], { file: string }[]];
    if (pending.length === 0) return;

    const files = pending.map((row) => row.file);
    throw new Error(
        `O banco tem ${files.length} migration(s) pendente(s): ${files.join(", ")}. ` +
            "Rode `npm run migrate` antes de subir a API."
    );
}
