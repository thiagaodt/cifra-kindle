---
title: 'Gerar Arquivo pronto (EPUB multi-tom)'
type: 'feature'
created: '2026-11-18'
status: 'in-review'
route: 'dispatch'
review_loop_iteration: 0
context: ['{project-root}/_bmad-output/specs/spec-cifra-kindle/SPEC.md', '{project-root}/_bmad-output/specs/spec-cifra-kindle/api-contracts.md', '{project-root}/_bmad-output/specs/spec-cifra-kindle/architecture-diagrams.md', '{project-root}/_bmad-output/specs/spec-cifra-kindle/conventions.md']
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Depois de buscar a cifra (Story 2) e obter as 12 versões de tom (Story 3), nada ainda transforma esse conteúdo num arquivo que o Kindle aceite e navegue localmente entre tons (CAP-3).

**Approach:** Implementar um service puro (`services/epubBuilder.ts`) que recebe as 12 versões já buscadas e monta um EPUB reflowable válido manualmente (zip via `jszip`, sem framework de geração de EPUB) — 12 arquivos XHTML (um por tom), CSS forçando `white-space: pre` nos blocos de cifra, nav.xhtml de TOC, e o spine começando no tom original. Sem rotas HTTP nem orquestração do pipeline completo aqui — isso é Story 5.

## Boundaries & Constraints

**Always:**
- 12 arquivos XHTML (um por tom), não um único arquivo com fragmentos internos — ver Design Notes sobre confiabilidade de "abrir no tom original".
- Cada XHTML tem o elemento raiz do bloco de cifra com `id` = nome do tom em sustenido (C-3/C-5): `tom-C`, `tom-Csharp`, etc. — único esquema aceito.
- CSS (`style.css` dentro do EPUB) aplica `white-space: pre` (ou equivalente) a todo bloco de cifra, preservando alinhamento acorde-sobre-sílaba (C-5).
- `nav.xhtml` (TOC EPUB3) lista as 12 seções; o `content.opf` tem o spine com o primeiro `itemref` apontando pro XHTML do tom marcado `is_original` (C-4).
- `mimetype` é a primeira entrada do zip, sem compressão — requisito do formato EPUB.
- Nenhum conteúdo de cifra é persistido em banco — a função só recebe e devolve dados em memória (C-10).

**Never:**
- Nenhuma rota HTTP nesta story — a ligação com `POST /musicas` e a UI é Story 5.
- Nenhuma chamada real a `integrations/cifraClub` ou ao FastAPI aqui — a função recebe as 12 versões já prontas como parâmetro (testável isoladamente).
- Nenhuma lógica de transposição — os acordes já chegam prontos de Story 2/3 (C-2).
- Nenhuma seção de tablatura (C-12, fora de escopo do produto).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Happy path | 12 `TonVersion` válidas, uma com `isOriginal: true` | `Buffer` de um EPUB válido; spine abre no tom original; cada XHTML linka os outros 11 | N/A |
| `isOriginal` ausente ou duplicado | 0 ou 2+ versões marcadas `isOriginal` | Lança erro explícito antes de gerar qualquer arquivo | Nunca escolhe uma por heurística própria |
| Conteúdo vazio numa versão | Uma das 12 `conteudo` é string vazia | Gera a seção daquele tom normalmente (vazia), não falha o EPUB inteiro | N/A |
| Caracteres especiais | Letra com acentos/UTF-8 | Preservado corretamente no XHTML (charset UTF-8 declarado) | N/A |

</frozen-after-approval>

## Code Map

- `api-contracts.md` (companion) -- formato de entrada: `POST /tons` devolve `versions: [{ tom, semitone_offset, is_original, conteudo }]`, 12 itens.
- `architecture-diagrams.md` (companion) -- ids em sustenido (C, C#, D...), CSS `white-space: pre`.
- `services/` (criada vazia na Story 1) -- aqui entra `epubBuilder.ts`.
- `interfaces/` (criada vazia na Story 1) -- tipo `TonVersion` compartilhado.

## Tasks & Acceptance

**Execution:**
- [x] `package.json` -- adicionar dependência `jszip` -- zip de baixo nível, com controle total sobre `mimetype` sem compressão e ordem do spine (bibliotecas de geração de EPUB prontas não dão esse controle fino)
- [x] `interfaces/tonVersion.ts` -- `{ tom: string; semitoneOffset: number; isOriginal: boolean; conteudo: string }` -- tipo compartilhado com Stories 2/3/5
- [x] `services/epubBuilder.ts` -- `buildEpub(versions: TonVersion[]): Promise<Buffer>`: valida exatamente 1 `isOriginal`; monta `mimetype`, `META-INF/container.xml`, `OEBPS/content.opf` (spine começando no original), `OEBPS/nav.xhtml`, `OEBPS/style.css`, `OEBPS/tom-<nome>.xhtml` x12 -- núcleo da story
- [x] `tests/services/epubBuilder.test.ts` -- cobre as 4 linhas da I/O & Edge-Case Matrix -- nenhuma regressão silenciosa

**Acceptance Criteria:**
- Given 12 `TonVersion` válidas com uma `isOriginal: true`, when `buildEpub` é chamado, then retorna um `Buffer` cujo zip tem `mimetype` como primeira entrada, sem compressão, com valor `application/epub+zip`.
- Given o `content.opf` gerado, when inspecionado, then o primeiro `itemref` do spine aponta pro XHTML do tom original.
- Given qualquer um dos 12 XHTML gerados, when inspecionado, then contém um link relativo para cada um dos outros 11 arquivos de tom.
- Given nenhuma ou mais de uma versão marcada `isOriginal`, when `buildEpub` é chamado, then lança erro explícito antes de escrever qualquer arquivo no zip.

## Implementation Notes

- Implementado pela Antigravity (handoff via `_bmad-output/implementation-artifacts/antigravity-prompts/4-gerar-arquivo-pronto-epub.md`). Verificado nesta sessão (Claude Code): `npm run typecheck` limpo, `npm test` 4/4 em `epubBuilder.test.ts`. Review formal (step-04) ainda não rodou.

## Spec Change Log

## Review Triage Log

## Design Notes

- **12 arquivos XHTML, não 1 arquivo com fragmentos:** "abrir no tom original" (C-4) via fragmento (`#tom-C`) no primeiro item do spine não é confiável em todos os leitores EPUB, incluindo o Kindle — o fragmento no `itemref` inicial é tratado de forma inconsistente entre reading systems. Usar 12 arquivos com o spine apontando o arquivo correto como primeiro item é 100% confiável (é o comportamento padrão de qualquer leitor compatível) e mais simples de testar. Links entre tons usam `href` relativo normal (`tom-Csharp.xhtml`), com o `id` do elemento raiz de cada arquivo seguindo o esquema de C-3/C-5 por completude e para eventuais âncoras internas futuras.
- **`jszip` em vez de um gerador de EPUB pronto (`epub-gen`, `nodepub`):** essas libs assumem o modelo "capítulo por arquivo" com TOC simples e não dão controle fino sobre a ordem exata do spine nem sobre forçar `mimetype` sem compressão como primeira entrada — exigências diretas de C-4/C-5. Montar manualmente com `jszip` é mais previsível aqui.

## Verification

**Commands:**
- `npm run typecheck` -- expected: sem erros
- `npm run test -- epubBuilder` -- expected: os 4 casos da matrix passam

**Manual checks (if no CLI):**
- Extrair o `Buffer` gerado para um `.epub` e abrir num leitor (Calibre ou Kindle Previewer) para confirmar visualmente o reflow, o alinhamento acorde-sobre-sílaba e a navegação entre os 12 tons.
