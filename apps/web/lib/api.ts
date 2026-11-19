/** Cliente da API Express. O front chama `/api/*` na mesma origem; o Next repassa via rewrite (next.config.ts). */

export const ETAPAS = ["pendente", "buscando", "transpondo", "gerando", "enviando", "concluido"] as const;
export type StatusEnvio = (typeof ETAPAS)[number] | "erro";

export interface Envio {
  id: string;
  status: StatusEnvio;
  erroMensagem: string | null;
  enviadoEm: string | null;
}

export const ROTULO_STATUS: Record<StatusEnvio, string> = {
  pendente: "Na fila",
  buscando: "Buscando a cifra",
  transpondo: "Transpondo para os 12 tons",
  gerando: "Montando o EPUB",
  enviando: "Enviando ao Kindle",
  concluido: "Enviado",
  erro: "Falhou",
};

async function lerErro(resposta: Response): Promise<string> {
  try {
    const corpo = (await resposta.json()) as { error?: unknown };
    if (typeof corpo.error === "string") return corpo.error;
  } catch {
    // corpo não-JSON: cai na mensagem genérica
  }
  return `A API respondeu ${resposta.status}.`;
}

/** Um link do Cifra Club vira `link`; qualquer outro texto vira `nome`. */
export function montarCorpo(entrada: string): { link: string } | { nome: string } {
  const texto = entrada.trim();
  return /^https?:\/\//i.test(texto) ? { link: texto } : { nome: texto };
}

export async function criarEnvio(entrada: string): Promise<string> {
  const resposta = await fetch("/api/musicas", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(montarCorpo(entrada)),
  });
  if (!resposta.ok) throw new Error(await lerErro(resposta));
  const { envioId } = (await resposta.json()) as { envioId: string };
  return envioId;
}

export async function obterEnvio(id: string): Promise<Envio> {
  const resposta = await fetch(`/api/envios/${encodeURIComponent(id)}`, { cache: "no-store" });
  if (!resposta.ok) throw new Error(await lerErro(resposta));
  return (await resposta.json()) as Envio;
}

export function terminou(status: StatusEnvio): boolean {
  return status === "concluido" || status === "erro";
}
