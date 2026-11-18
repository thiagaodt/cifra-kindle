import type { Knex } from "knex";

/**
 * `envios`: cada execução do pipeline busca->transpoe->gera->envia para uma
 * `musica`. Alimenta histórico e progresso na UI (ver api-contracts.md).
 *
 * `status` é `varchar`, nunca enum nativo do Postgres (C-9) — o vocabulário
 * fixo (`pendente | buscando | transpondo | gerando | enviando | concluido | erro`)
 * é validado por um enum Zod da aplicação, introduzido junto com as rotas de
 * negócio (Stories 2-5), não aqui no scaffolding.
 */
export async function up(knex: Knex): Promise<void> {
    await knex.schema.createTable("envios", (table) => {
        table.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
        table
            .uuid("musica_id")
            .notNullable()
            .references("id")
            .inTable("musicas")
            .onDelete("CASCADE");
        table.string("status", 20).notNullable().defaultTo("pendente");
        table.text("erro_mensagem");
        table.timestamp("enviado_em", { useTz: true });
        table.timestamp("criado_em", { useTz: true }).notNullable().defaultTo(knex.fn.now());
        table.timestamp("atualizado_em", { useTz: true }).notNullable().defaultTo(knex.fn.now());

        table.index(["musica_id"], "idx_envios_musica_id");
    });
}

export async function down(knex: Knex): Promise<void> {
    await knex.schema.dropTableIfExists("envios");
}
