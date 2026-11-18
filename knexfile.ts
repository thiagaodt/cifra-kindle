import type { Knex } from "knex";
import { env } from "./config/env";

/**
 * O Knex grava o nome da migration COM extensão. Como o MVP roda só em dev
 * local (C-14, sem deploy em nuvem), não existe um segundo runtime (`dist/.js`)
 * para suportar: a extensão é sempre `.ts`, lida via tsx.
 */
const extension = "ts";

const shared: Knex.Config = {
    client: "pg",
    migrations: {
        directory: env.migrationsDir,
        extension,
        loadExtensions: [`.${extension}`],
        tableName: "knex_migrations",
    },
    pool: {
        min: env.databasePoolMin,
        max: env.databasePoolMax,
    },
};

const config: Record<"development" | "test", Knex.Config> = {
    development: {
        ...shared,
        connection: env.databaseUrl,
    },
    test: {
        ...shared,
        connection: env.databaseUrl,
        pool: { min: 1, max: 5 },
    },
};

export default config;
