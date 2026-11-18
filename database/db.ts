import knex, { Knex } from "knex";
import { env } from "../config/env";
import knexConfig from "../knexfile";

if (env.isTest && !env.databaseUrl.includes("_test")) {
    throw new Error(
        'Recusando rodar em teste com um banco cujo nome não contém "_test": ' +
            "confira DATABASE_URL_TEST antes de perder dados."
    );
}

const config = knexConfig[env.nodeEnv];

const db: Knex = knex(config);

export default db;
