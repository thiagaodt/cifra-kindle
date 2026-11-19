"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { criarEnvio, ETAPAS, obterEnvio, ROTULO_STATUS, terminou, type Envio } from "@/lib/api";

const INTERVALO_MS = 1500;

interface Item {
  id: string;
  entrada: string;
  envio: Envio | null;
  erroRede: string | null;
}

function emAndamento(item: Item): boolean {
  return !item.erroRede && !(item.envio && terminou(item.envio.status));
}

function Progresso({ item }: { item: Item }) {
  const status = item.envio?.status ?? "pendente";
  const falhou = status === "erro";
  const indice = ETAPAS.indexOf(falhou ? "pendente" : status);

  return (
    <li className={`item ${falhou ? "item-erro" : status === "concluido" ? "item-ok" : ""}`}>
      <div className="item-topo">
        <strong className="item-nome">{item.entrada}</strong>
        <span className="selo">{ROTULO_STATUS[status]}</span>
      </div>
      {!falhou && (
        <ol className="etapas" aria-label="Progresso do envio">
          {ETAPAS.map((etapa, i) => (
            <li
              key={etapa}
              className={i <= indice ? "etapa feita" : "etapa"}
              aria-current={i === indice ? "step" : undefined}
            >
              {ROTULO_STATUS[etapa]}
            </li>
          ))}
        </ol>
      )}
      {status === "concluido" && (
        <p className="dica">Pronto! O EPUB chega ao Kindle em alguns minutos (precisa de Wi-Fi).</p>
      )}
      {falhou && <p className="mensagem-erro">{item.envio?.erroMensagem ?? "O envio falhou sem detalhes."}</p>}
      {item.erroRede && <p className="mensagem-erro">{item.erroRede}</p>}
    </li>
  );
}

export default function EnviarForm() {
  const [entrada, setEntrada] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [itens, setItens] = useState<Item[]>([]);
  const itensRef = useRef<Item[]>([]);

  useEffect(() => {
    itensRef.current = itens;
  }, [itens]);

  // Polling dos envios em andamento; o intervalo para sozinho quando todos terminam.
  const alguemEmAndamento = itens.some(emAndamento);
  useEffect(() => {
    if (!alguemEmAndamento) return;
    const timer = setInterval(async () => {
      const pendentes = itensRef.current.filter(emAndamento);
      const resultados = await Promise.all(
        pendentes.map(async (i) => {
          try {
            return { id: i.id, envio: await obterEnvio(i.id), erroRede: null };
          } catch (e) {
            const msg = e instanceof Error ? e.message : "Falha ao consultar o envio.";
            return { id: i.id, envio: i.envio, erroRede: msg };
          }
        }),
      );
      setItens((atuais) =>
        atuais.map((i) => {
          const r = resultados.find((x) => x.id === i.id);
          return r ? { ...i, envio: r.envio, erroRede: r.erroRede } : i;
        }),
      );
    }, INTERVALO_MS);
    return () => clearInterval(timer);
  }, [alguemEmAndamento]);

  async function aoEnviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const texto = entrada.trim();
    if (!texto || enviando) return;
    setErro(null);
    setEnviando(true);
    try {
      const id = await criarEnvio(texto);
      setItens((atuais) => [{ id, entrada: texto, envio: null, erroRede: null }, ...atuais]);
      setEntrada("");
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não consegui falar com a API.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <>
      <form onSubmit={aoEnviar} className="form">
        <label htmlFor="entrada" className="rotulo">
          Nome da música ou link do Cifra Club
        </label>
        <div className="linha">
          <input
            id="entrada"
            name="entrada"
            type="text"
            value={entrada}
            onChange={(e) => setEntrada(e.target.value)}
            placeholder="the scientist coldplay  ou  https://www.cifraclub.com.br/..."
            autoComplete="off"
            required
          />
          <button type="submit" disabled={enviando || !entrada.trim()}>
            {enviando ? "Enviando…" : "Enviar ao Kindle"}
          </button>
        </div>
        {erro && (
          <p className="mensagem-erro" role="alert">
            {erro}
          </p>
        )}
      </form>

      {itens.length > 0 && (
        <section aria-labelledby="titulo-envios">
          <h2 id="titulo-envios">Envios desta sessão</h2>
          <ul className="lista">
            {itens.map((item) => (
              <Progresso key={item.id} item={item} />
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
