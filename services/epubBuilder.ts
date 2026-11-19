import { randomUUID } from "node:crypto";
import JSZip from "jszip";
import type { TonVersion } from "../interfaces/tonVersion";

const EPUB_MIMETYPE = "application/epub+zip";

export interface EpubMetadata {
    /** Título real da música -- usado em `dc:title`, nunca um valor genérico fixo. */
    titulo: string;
}

/**
 * Converte o nome do tom em sustenido (C, C#, D, ...) no sufixo de id/arquivo
 * exigido por C-3 e C-5 (`C` -> `C`, `C#` -> `Csharp`).
 */
export function toTomSlug(tom: string): string {
    return tom.replace(/#/g, "sharp");
}

export function toTomId(tom: string): string {
    return `tom-${toTomSlug(tom)}`;
}

export function toTomFilename(tom: string): string {
    return `${toTomId(tom)}.xhtml`;
}

function escapeXml(value: string): string {
    return value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&apos;");
}

function buildContainerXml(): string {
    return [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">',
        "  <rootfiles>",
        '    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>',
        "  </rootfiles>",
        "</container>",
    ].join("\n");
}

function buildStyleCss(): string {
    return [
        "body {",
        '  font-family: "Courier New", Courier, monospace;',
        "  margin: 0;",
        "  padding: 0.5em;",
        "}",
        "",
        "nav.tom-selector {",
        "  font-family: sans-serif;",
        "  margin-bottom: 1em;",
        "}",
        "",
        "nav.tom-selector a {",
        "  margin-right: 0.5em;",
        "}",
        "",
        "pre.cifra-block {",
        '  font-family: "Courier New", Courier, monospace;',
        "  white-space: pre;",
        "  overflow-x: auto;",
        "  line-height: 1.3;",
        "  margin: 0;",
        "}",
    ].join("\n");
}

function buildNavXhtml(versions: TonVersion[]): string {
    const items = versions
        .map((version) => {
            const href = toTomFilename(version.tom);
            const label = escapeXml(version.tom);
            return `      <li><a href="${href}">Tom ${label}</a></li>`;
        })
        .join("\n");

    return [
        '<?xml version="1.0" encoding="UTF-8"?>',
        "<!DOCTYPE html>",
        '<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="pt-BR" lang="pt-BR">',
        "<head>",
        '  <meta charset="UTF-8" />',
        "  <title>Sumário de Tons</title>",
        '  <link rel="stylesheet" type="text/css" href="style.css" />',
        "</head>",
        "<body>",
        '  <nav epub:type="toc" id="toc">',
        "    <h1>Tons</h1>",
        "    <ol>",
        items,
        "    </ol>",
        "  </nav>",
        "</body>",
        "</html>",
    ].join("\n");
}

function buildTomXhtml(current: TonVersion, allVersions: TonVersion[]): string {
    const rootId = toTomId(current.tom);
    const currentLabel = escapeXml(current.tom);

    const otherLinks = allVersions
        .filter((version) => version.tom !== current.tom)
        .map((version) => {
            const href = toTomFilename(version.tom);
            const label = escapeXml(version.tom);
            return `    <a href="${href}">${label}</a>`;
        })
        .join("\n");

    // O capo é fixo entre os 12 tons; cada versão carrega o mesmo valor.
    const capoLine =
        current.capotraste != null
            ? `    <span class="capotraste">Capotraste na ${escapeXml(String(current.capotraste))}ª casa — os acordes abaixo estão na forma, não no tom que soa</span>`
            : null;

    return [
        '<?xml version="1.0" encoding="UTF-8"?>',
        "<!DOCTYPE html>",
        '<html xmlns="http://www.w3.org/1999/xhtml" xml:lang="pt-BR" lang="pt-BR">',
        "<head>",
        '  <meta charset="UTF-8" />',
        `  <title>Tom: ${currentLabel}</title>`,
        '  <link rel="stylesheet" type="text/css" href="style.css" />',
        "</head>",
        "<body>",
        '  <nav class="tom-selector" aria-label="Trocar tom">',
        `    <span class="tom-atual">Tom atual: <strong>${currentLabel}</strong></span>`,
        otherLinks,
        ...(capoLine ? [capoLine] : []),
        "  </nav>",
        `  <pre id="${rootId}" class="cifra-block">${escapeXml(current.conteudo)}</pre>`,
        "</body>",
        "</html>",
    ].join("\n");
}

function buildContentOpf(
    versions: TonVersion[],
    original: TonVersion,
    metadata: EpubMetadata
): string {
    const manifestItems = versions
        .map((version) => {
            const id = toTomId(version.tom);
            const href = toTomFilename(version.tom);
            return `    <item id="${id}" href="${href}" media-type="application/xhtml+xml"/>`;
        })
        .join("\n");

    const orderedForSpine = [
        original,
        ...versions.filter((version) => version !== original),
    ];

    const spineItems = orderedForSpine
        .map((version) => {
            const idref = toTomId(version.tom);
            return `    <itemref idref="${idref}"/>`;
        })
        .join("\n");

    // `dc:identifier` único por chamada e `dcterms:modified` real -- um valor fixo faria leitores
    // (potencialmente o próprio Kindle) tratarem EPUBs de músicas diferentes como "o mesmo livro".
    return [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="book-id" xml:lang="pt-BR">',
        '  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">',
        `    <dc:identifier id="book-id">urn:uuid:${randomUUID()}</dc:identifier>`,
        `    <dc:title>${escapeXml(metadata.titulo)}</dc:title>`,
        "    <dc:language>pt-BR</dc:language>",
        `    <meta property="dcterms:modified">${new Date().toISOString().replace(/\.\d+Z$/, "Z")}</meta>`,
        "  </metadata>",
        "  <manifest>",
        '    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>',
        '    <item id="style" href="style.css" media-type="text/css"/>',
        manifestItems,
        "  </manifest>",
        "  <spine>",
        spineItems,
        "  </spine>",
        "</package>",
    ].join("\n");
}

/**
 * Monta em memória um EPUB reflowable válido com as 12 versões de tom,
 * abrindo no tom marcado como `isOriginal` e interligando cada tom aos outros 11.
 */
export async function buildEpub(
    versions: TonVersion[],
    metadata: EpubMetadata
): Promise<Buffer> {
    const originals = versions.filter((version) => version.isOriginal);
    if (originals.length !== 1) {
        throw new Error(
            `Exatamente uma versão deve ter isOriginal=true (recebido: ${originals.length}).`
        );
    }

    if (versions.length !== 12) {
        throw new Error(
            `São esperadas exatamente 12 versões de tom (recebido: ${versions.length}).`
        );
    }

    if (new Set(versions.map((version) => version.tom)).size !== versions.length) {
        throw new Error("Os 12 tons devem ser todos distintos entre si.");
    }

    const original = originals[0]!;
    // Defensivo: ordena por semitoneOffset antes de montar nav/manifest/links -- hoje o único
    // produtor real já entrega ordenado, mas nada aqui dependia disso explicitamente.
    const ordered = [...versions].sort((a, b) => a.semitoneOffset - b.semitoneOffset);

    const zip = new JSZip();

    // Requisito EPUB: `mimetype` deve ser a primeira entrada e sem compressão (STORE).
    zip.file("mimetype", EPUB_MIMETYPE, { compression: "STORE" });
    zip.file("META-INF/container.xml", buildContainerXml(), { compression: "DEFLATE" });
    zip.file("OEBPS/content.opf", buildContentOpf(ordered, original, metadata), { compression: "DEFLATE" });
    zip.file("OEBPS/nav.xhtml", buildNavXhtml(ordered), { compression: "DEFLATE" });
    zip.file("OEBPS/style.css", buildStyleCss(), { compression: "DEFLATE" });

    for (const version of ordered) {
        const filename = toTomFilename(version.tom);
        zip.file(`OEBPS/${filename}`, buildTomXhtml(version, ordered), {
            compression: "DEFLATE",
        });
    }

    return zip.generateAsync({ type: "nodebuffer" });
}
