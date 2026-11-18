import JSZip from "jszip";
import { describe, expect, it, vi } from "vitest";
import type { TonVersion } from "../../interfaces/tonVersion";
import { buildEpub, toTomFilename, toTomId } from "../../services/epubBuilder";

const CHROMATIC_TONES = [
    "C",
    "C#",
    "D",
    "D#",
    "E",
    "F",
    "F#",
    "G",
    "G#",
    "A",
    "A#",
    "B",
] as const;

function makeTwelveVersions(originalTone: string = "F#"): TonVersion[] {
    return CHROMATIC_TONES.map((tom, index) => ({
        tom,
        semitoneOffset: index,
        isOriginal: tom === originalTone,
        conteudo: `${tom}              ${tom}m\nMinha canção no tom de ${tom}`,
    }));
}

describe("buildEpub", () => {
    it("happy path: gera EPUB válido com mimetype sem compressão na primeira entrada, spine abrindo no tom original e links para os outros 11 tons", async () => {
        const versions = makeTwelveVersions("F#");
        const buffer = await buildEpub(versions);

        expect(Buffer.isBuffer(buffer)).toBe(true);

        // Inspeciona o primeiro Local File Header do ZIP (PK\x03\x04):
        // bytes 0..3 = 0x04034b50, bytes 8..9 = compression method (0 = STORE),
        // bytes 26..27 = filename length, bytes 28..29 = extra field length, bytes 30.. = filename
        expect(buffer.subarray(0, 4).toString("binary")).toBe("PK\x03\x04");
        const compressionMethod = buffer.readUInt16LE(8);
        const fileNameLength = buffer.readUInt16LE(26);
        const extraFieldLength = buffer.readUInt16LE(28);
        const firstEntryName = buffer
            .subarray(30, 30 + fileNameLength)
            .toString("utf8");
        const dataStart = 30 + fileNameLength + extraFieldLength;
        const firstEntryContent = buffer
            .subarray(dataStart, dataStart + "application/epub+zip".length)
            .toString("utf8");

        expect(firstEntryName).toBe("mimetype");
        expect(compressionMethod).toBe(0);
        expect(firstEntryContent).toBe("application/epub+zip");

        const zip = await JSZip.loadAsync(buffer);
        const entryNames = Object.keys(zip.files);
        expect(entryNames[0]).toBe("mimetype");
        expect(await zip.file("mimetype")?.async("string")).toBe("application/epub+zip");

        // CSS deve forçar white-space: pre
        const css = await zip.file("OEBPS/style.css")?.async("string");
        expect(css).toBeDefined();
        expect(css).toContain("white-space: pre");

        // nav.xhtml lista as 12 seções
        const nav = await zip.file("OEBPS/nav.xhtml")?.async("string");
        expect(nav).toBeDefined();
        for (const tom of CHROMATIC_TONES) {
            expect(nav).toContain(`href="${toTomFilename(tom)}"`);
        }

        // content.opf tem o primeiro itemref do spine apontando pro tom original (F# -> tom-Fsharp)
        const opf = await zip.file("OEBPS/content.opf")?.async("string");
        expect(opf).toBeDefined();
        const spineMatch = opf!.match(/<spine[^>]*>([\s\S]*?)<\/spine>/);
        expect(spineMatch).not.toBeNull();
        const itemrefs = [...spineMatch![1]!.matchAll(/<itemref\s+idref="([^"]+)"/g)].map(
            (match) => match[1]
        );
        expect(itemrefs).toHaveLength(12);
        expect(itemrefs[0]).toBe("tom-Fsharp");

        // Cada um dos 12 XHTML tem id raiz tom-<slug> e linka os outros 11 arquivos
        for (const tom of CHROMATIC_TONES) {
            const filename = toTomFilename(tom);
            const xhtml = await zip.file(`OEBPS/${filename}`)?.async("string");
            expect(xhtml).toBeDefined();
            expect(xhtml).toContain(`id="${toTomId(tom)}"`);

            for (const otherTom of CHROMATIC_TONES) {
                const otherFilename = toTomFilename(otherTom);
                if (otherTom === tom) {
                    expect(xhtml).not.toContain(`href="${otherFilename}"`);
                } else {
                    expect(xhtml).toContain(`href="${otherFilename}"`);
                }
            }
        }
    });

    it("isOriginal ausente ou duplicado: lança erro explícito antes de escrever qualquer arquivo no zip", async () => {
        const fileSpy = vi.spyOn(JSZip.prototype, "file");

        const noneOriginal = makeTwelveVersions("C").map((version) => ({
            ...version,
            isOriginal: false,
        }));
        await expect(buildEpub(noneOriginal)).rejects.toThrow(/isOriginal=true/);
        expect(fileSpy).not.toHaveBeenCalled();

        const twoOriginals = makeTwelveVersions("C").map((version) => ({
            ...version,
            isOriginal: version.tom === "C" || version.tom === "G",
        }));
        await expect(buildEpub(twoOriginals)).rejects.toThrow(/isOriginal=true/);
        expect(fileSpy).not.toHaveBeenCalled();

        fileSpy.mockRestore();
    });

    it("conteúdo vazio numa versão: gera a seção vazia daquele tom normalmente sem falhar o EPUB", async () => {
        const versions = makeTwelveVersions("C").map((version) =>
            version.tom === "D#" ? { ...version, conteudo: "" } : version
        );

        const buffer = await buildEpub(versions);
        const zip = await JSZip.loadAsync(buffer);

        const dSharpXhtml = await zip.file("OEBPS/tom-Dsharp.xhtml")?.async("string");
        expect(dSharpXhtml).toBeDefined();
        expect(dSharpXhtml).toContain('<pre id="tom-Dsharp" class="cifra-block"></pre>');
    });

    it("caracteres especiais: preserva acentos/UTF-8 e escapa entidades XML com charset UTF-8 declarado", async () => {
        const specialLyrics =
            "C7M(9)          F#m7(b5)\nCanção de coração, fé & esperança — manhã de sol <3";
        const versions = makeTwelveVersions("A").map((version) =>
            version.tom === "A" ? { ...version, conteudo: specialLyrics } : version
        );

        const buffer = await buildEpub(versions);
        const zip = await JSZip.loadAsync(buffer);

        const aXhtml = await zip.file("OEBPS/tom-A.xhtml")?.async("string");
        expect(aXhtml).toBeDefined();
        expect(aXhtml).toContain('encoding="UTF-8"');
        expect(aXhtml).toContain('<meta charset="UTF-8" />');
        expect(aXhtml).toContain(
            "Canção de coração, fé &amp; esperança — manhã de sol &lt;3"
        );
    });
});
