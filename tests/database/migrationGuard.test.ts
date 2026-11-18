import type { Knex } from "knex";
import { describe, expect, it, vi } from "vitest";
import { assertDatabaseMigrated } from "../../database/migrationGuard";

// `migrationGuard.ts` importa `database/db.ts` (que lê o .env no load). Aqui a
// conexão vem injetada, então o módulo real não precisa ser carregado.
vi.mock("../../database/db", () => ({ default: {} }));

interface FakeConnectionOptions {
    hasTable: boolean;
    pending?: { file: string }[];
}

function fakeConnection({ hasTable, pending = [] }: FakeConnectionOptions): Knex {
    return {
        schema: { hasTable: vi.fn().mockResolvedValue(hasTable) },
        migrate: { list: vi.fn().mockResolvedValue([[], pending]) },
    } as unknown as Knex;
}

describe("assertDatabaseMigrated (Banco vazio)", () => {
    it("falha com mensagem explícita quando a tabela knex_migrations não existe", async () => {
        const connection = fakeConnection({ hasTable: false });

        await expect(assertDatabaseMigrated(connection)).rejects.toThrow(
            /não tem a tabela "knex_migrations".*npm run migrate/
        );
    });

    it("falha quando há migrations pendentes, listando os arquivos", async () => {
        const connection = fakeConnection({
            hasTable: true,
            pending: [{ file: "20261118000100_create_musicas.ts" }, { file: "20261118000200_create_envios.ts" }],
        });

        await expect(assertDatabaseMigrated(connection)).rejects.toThrow(
            /2 migration\(s\) pendente\(s\): 20261118000100_create_musicas\.ts, 20261118000200_create_envios\.ts/
        );
    });

    it("resolve quando a tabela existe e nenhuma migration está pendente", async () => {
        const connection = fakeConnection({ hasTable: true, pending: [] });

        await expect(assertDatabaseMigrated(connection)).resolves.toBeUndefined();
    });
});
