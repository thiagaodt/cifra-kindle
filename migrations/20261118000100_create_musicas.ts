import type { Knex } from "knex";

/**
 * `musicas`: o que foi buscado no Cifra Club, deduplicado pela própria URL.
 * Nunca guarda a letra/cifra completa (C-10) — só metadados.
 */
export async function up(knex: Knex): Promise<void> {
    await knex.schema.createTable("musicas", (table) => {
        table.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
        table.text("nome").notNullable();
        table.text("cifra_club_url").notNullable();
        // Sempre nomeado com sustenido (C, C#, ..., B) — ver C-3. "C#" cabe em 2 chars.
        table.string("tom_original", 2).notNullable();
        table.timestamp("criado_em", { useTz: true }).notNullable().defaultTo(knex.fn.now());

        table.unique(["cifra_club_url"], { indexName: "uq_musicas_cifra_club_url" });
    });
}

export async function down(knex: Knex): Promise<void> {
    await knex.schema.dropTableIfExists("musicas");
}
