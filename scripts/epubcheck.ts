/**
 * Valida com o EPUBCheck oficial (W3C) os EPUBs que o `buildEpub` gera, em cenários que
 * cobrem o que costuma variar entre aparelhos: capotraste, tom menor com sustenido e linhas
 * largas (cifras reais chegam a ~60 colunas; 80 é teste de estresse).
 *
 * Uso: `npm run epubcheck`
 * Pré-requisitos: Java e o jar do EPUBCheck (padrão: tools/epubcheck/epubcheck-5.4.0/epubcheck.jar,
 * ou defina EPUBCHECK_JAR). Download: gh release download v5.4.0 --repo w3c/epubcheck
 *
 * Também grava os EPUBs em `tools/epubcheck/amostras/` para abrir no Kindle Previewer.
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { TonVersion } from "../interfaces/tonVersion";
import { buildEpub } from "../services/epubBuilder";

const RAIZ = path.resolve(__dirname, "..");
const JAR =
    process.env.EPUBCHECK_JAR ??
    path.join(RAIZ, "tools", "epubcheck", "epubcheck-5.4.0", "epubcheck.jar");
const SAIDA = path.join(RAIZ, "tools", "epubcheck", "amostras");

/** Avisos conhecidos e aceitos: o sumário segue a ordem cromática, o spine abre no tom original. */
const AVISOS_ACEITOS = new Set(["NAV-011"]);

const NOTAS = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

function linhaDeAcordes(largura: number): string {
    const acordes = ["C", "G/B", "Am7", "F#m7(b5)", "D#sus4", "Bb", "E/G#"];
    let linha = "";
    let i = 0;
    for (;;) {
        const acorde = acordes[i % acordes.length] ?? "C";
        if (linha.length + acorde.length + 2 > largura) break;
        linha += `${acorde}  `;
        i += 1;
    }
    return linha.trimEnd().padEnd(largura - 1, " ") + "G";
}

function conteudo(larguraMax: number, linhas: number): string {
    const partes: string[] = ["[Intro] C  G  Am  F"];
    for (let i = 0; i < linhas; i++) {
        if (i % 12 === 0) partes.push("", `[Parte ${Math.floor(i / 12) + 1}]`);
        partes.push(linhaDeAcordes(i % 3 === 0 ? larguraMax : Math.max(20, larguraMax - 15)));
        partes.push("Letra com acentuação, aspas \"duplas\", & <sinais> e ção ão õe".slice(0, larguraMax));
    }
    return partes.join("\n");
}

function versoes(opts: { menor: boolean; larguraMax: number; linhas: number; capotraste: number | null }): TonVersion[] {
    const originalIdx = 6; // F# (ou F#m): exercita o sustenido e o sufixo de tom menor
    return NOTAS.map((nota, idx) => ({
        tom: nota + (opts.menor ? "m" : ""),
        semitoneOffset: idx,
        isOriginal: idx === originalIdx,
        conteudo: conteudo(opts.larguraMax, opts.linhas),
        capotraste: opts.capotraste,
    }));
}

const CENARIOS = [
    { nome: "sem-capo-maior", titulo: "Cenário sem capo", larguraMax: 45, linhas: 40, menor: false, capotraste: null },
    { nome: "capo-menor", titulo: "Cenário capo & tom menor", larguraMax: 45, linhas: 40, menor: true, capotraste: 2 },
    { nome: "pior-caso-60-colunas", titulo: "Pior caso real 60 colunas", larguraMax: 60, linhas: 120, menor: true, capotraste: 4 },
    { nome: "estresse-80-colunas", titulo: "Estresse 80 colunas", larguraMax: 80, linhas: 120, menor: false, capotraste: null },
] as const;

function verificar(arquivo: string): { fatais: number; erros: number; avisos: number; texto: string } {
    let texto = "";
    try {
        texto = execFileSync("java", ["-jar", JAR, arquivo], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
    } catch (erro) {
        // EPUBCheck sai com código != 0 quando há erros; a saída ainda traz o resumo.
        const e = erro as { stdout?: string; stderr?: string };
        texto = `${e.stdout ?? ""}${e.stderr ?? ""}`;
    }
    const resumo = texto.match(/Messages:\s*(\d+) fatals \/ (\d+) errors? \/ (\d+) warnings?/);
    if (!resumo) throw new Error(`Não consegui ler o resumo do EPUBCheck:\n${texto}`);
    const avisosInesperados = [...texto.matchAll(/^WARNING\(([A-Z]+-\d+)\)/gm)]
        .map((m) => m[1] ?? "")
        .filter((codigo) => !AVISOS_ACEITOS.has(codigo)).length;
    return { fatais: Number(resumo[1]), erros: Number(resumo[2]), avisos: avisosInesperados, texto };
}

async function main(): Promise<void> {
    if (!existsSync(JAR)) {
        console.error(`EPUBCheck não encontrado em ${JAR}.`);
        console.error("Baixe: gh release download v5.4.0 --repo w3c/epubcheck --pattern 'epubcheck-5.4.0.zip' --dir tools/epubcheck && unzip (dentro dessa pasta)");
        process.exit(1);
    }
    mkdirSync(SAIDA, { recursive: true });

    let falhou = false;
    for (const c of CENARIOS) {
        const buffer = await buildEpub(versoes(c), { titulo: c.titulo });
        const arquivo = path.join(SAIDA, `${c.nome}.epub`);
        writeFileSync(arquivo, buffer);
        const r = verificar(arquivo);
        const ok = r.fatais === 0 && r.erros === 0 && r.avisos === 0;
        falhou ||= !ok;
        console.log(`${ok ? "OK   " : "FALHA"} ${c.nome.padEnd(22)} fatais=${r.fatais} erros=${r.erros} avisos_inesperados=${r.avisos}`);
        if (!ok) console.log(r.texto);
    }
    console.log(`\nAmostras gravadas em ${SAIDA} (abra no Kindle Previewer).`);
    process.exit(falhou ? 1 : 0);
}

main().catch((erro) => {
    console.error(erro);
    process.exit(1);
});
