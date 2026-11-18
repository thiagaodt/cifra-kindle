import { z } from "zod";

export const envioStatusSchema = z.enum([
    "pendente",
    "buscando",
    "transpondo",
    "gerando",
    "enviando",
    "concluido",
    "erro",
]);

export type EnvioStatus = z.infer<typeof envioStatusSchema>;

export const envioIdSchema = z.object({
    id: z.string().trim().min(1, "O id do envio é obrigatório."),
});

export type EnvioIdParams = z.infer<typeof envioIdSchema>;
