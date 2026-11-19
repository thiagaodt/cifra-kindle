import type { Knex } from "knex";

/**
 * `tom_original` guardava só a letra do tom ("C#" cabia em 2 chars), mas o C-3 preserva o
 * sufixo de tom menor ("F#m", "A#m" = 3 chars). Com varchar(2), qualquer música em tom menor
 * com sustenido falhava no upsert (achado no teste real com Wonderwall, F#m).
 */
export async function up(knex: Knex): Promise<void> {
    await knex.raw('ALTER TABLE "musicas" ALTER COLUMN "tom_original" TYPE varchar(4)');
}

export async function down(knex: Knex): Promise<void> {
    await knex.raw('ALTER TABLE "musicas" ALTER COLUMN "tom_original" TYPE varchar(2)');
}
