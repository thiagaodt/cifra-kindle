import { z } from "zod";

export const musicaSchema = z
    .object({
        nome: z.string().trim().min(1, "O nome da música não pode ser vazio.").optional(),
        link: z.string().trim().url("O link deve ser uma URL válida.").optional(),
    })
    .refine(
        (data) => Boolean(data.nome) !== Boolean(data.link),
        {
            message: "Informe exatamente um entre 'nome' ou 'link' (nunca ambos e nunca os dois vazios).",
        }
    );

export type MusicaInput = z.infer<typeof musicaSchema>;
