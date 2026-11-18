import type { Knex } from "knex";
import db from "../database/db";
import { EnvioStatus, envioStatusSchema } from "../schemas/envioIdSchema";

export interface EnvioRecord {
    id: string;
    musica_id: string;
    status: EnvioStatus;
    erro_mensagem: string | null;
    enviado_em: Date | null;
    criado_em: Date;
    atualizado_em: Date;
}

export interface CreateEnvioInput {
    musicaId: string;
    status?: EnvioStatus;
}

export async function create(
    input: string | CreateEnvioInput,
    connection: Knex = db
): Promise<EnvioRecord> {
    const musicaId = typeof input === "string" ? input : input.musicaId;
    const status = envioStatusSchema.parse(
        typeof input === "string" ? "pendente" : (input.status ?? "pendente")
    );

    const rows = await connection<EnvioRecord>("envios")
        .insert({
            musica_id: musicaId,
            status,
        })
        .returning("*");

    return rows[0]!;
}

export async function updateStatus(
    id: string,
    status: EnvioStatus,
    erroMensagem?: string,
    connection: Knex = db
): Promise<EnvioRecord | undefined> {
    const parsedStatus = envioStatusSchema.parse(status);

    const updatePayload: Record<string, unknown> = {
        status: parsedStatus,
        erro_mensagem: erroMensagem ?? null,
        atualizado_em: connection.fn.now(),
    };

    if (parsedStatus === "concluido") {
        updatePayload.enviado_em = connection.fn.now();
    }

    const rows = await connection<EnvioRecord>("envios")
        .where({ id })
        .update(updatePayload)
        .returning("*");

    return rows[0];
}

export async function getById(
    id: string,
    connection: Knex = db
): Promise<EnvioRecord | undefined> {
    return connection<EnvioRecord>("envios").where({ id }).first();
}

export const envioRepository = {
    create,
    updateStatus,
    getById,
};

export default envioRepository;
