import type { Knex } from "knex";
import db from "../database/db";

export interface MusicaRecord {
    id: string;
    nome: string;
    cifra_club_url: string;
    tom_original: string;
    criado_em: Date;
}

export interface UpsertMusicaInput {
    nome: string;
    cifraClubUrl: string;
    tomOriginal?: string;
}

export async function upsertByCifraClubUrl(
    input: UpsertMusicaInput,
    connection: Knex = db
): Promise<MusicaRecord> {
    const tomOriginal = input.tomOriginal ?? "C";
    const rows = await connection<MusicaRecord>("musicas")
        .insert({
            nome: input.nome,
            cifra_club_url: input.cifraClubUrl,
            tom_original: tomOriginal,
        })
        .onConflict("cifra_club_url")
        .merge({
            nome: input.nome,
            tom_original: tomOriginal,
        })
        .returning("*");

    return rows[0]!;
}

export async function getById(
    id: string,
    connection: Knex = db
): Promise<MusicaRecord | undefined> {
    return connection<MusicaRecord>("musicas").where({ id }).first();
}

export async function deleteById(
    id: string,
    connection: Knex = db
): Promise<void> {
    await connection<MusicaRecord>("musicas").where({ id }).delete();
}

export const musicaRepository = {
    upsertByCifraClubUrl,
    getById,
    deleteById,
};

export default musicaRepository;
