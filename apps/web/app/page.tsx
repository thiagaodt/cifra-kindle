import EnviarForm from "./enviar-form";

export default function Home() {
  return (
    <main className="pagina">
      <header>
        <h1>Adaptador de Cifras para Kindle</h1>
        <p className="sub">
          Busque uma cifra no Cifra Club. Você recebe no Kindle um único EPUB com os 12 tons, e troca de tom
          tocando num link.
        </p>
      </header>

      <EnviarForm />

      <footer>
        <p>
          Uso pessoal e sem fins comerciais. Projeto não afiliado ao Cifra Club nem à Amazon.{" "}
          <a href="https://github.com/thiagaodt/cifra-kindle">Código no GitHub</a>
        </p>
      </footer>
    </main>
  );
}
