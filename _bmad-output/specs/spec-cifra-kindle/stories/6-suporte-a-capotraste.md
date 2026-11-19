---
title: 'Suporte a capotraste'
type: 'feature'
created: '2026-11-19'
status: 'done'
route: 'dispatch'
baseline_commit: '484932ba943370449f4657bafabdf20b2f312bfb'
review_loop_iteration: 0
context: ['{project-root}/_bmad-output/specs/spec-cifra-kindle/SPEC.md', '{project-root}/_bmad-output/specs/spec-cifra-kindle/api-contracts.md', '{project-root}/_bmad-output/specs/spec-cifra-kindle/RETROSPECTIVE.md']
---

> Story de registro: o trabalho foi feito na sessão de 2026-11-19, depois da retrospectiva do MVP, e ainda não foi commitado. O `baseline_commit` é o HEAD no momento do registro.

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problema:** músicas com capotraste falhavam por completo: o botão de tom do Cifra Club vem como `F#m(com forma de Em)` e `_decompor_tom` não reconhecia o formato, então `POST /tons` devolvia erro e CAP-2 não valia para essa classe de músicas (achado B1 da retrospectiva). Além disso, uma URL que o Cifra Club redireciona para `.../letra/` (medley sem cifra) falhava com a mensagem confusa "Botão de tom não encontrado" (B3).

**Abordagem:** aceitar o formato `X(com forma de Y)` no scraper, usando o tom que SOA como rótulo, expor a casa do capotraste no contrato e mostrá-la em cada página do EPUB; tratar o redirect para `/letra/` como erro 502 claro.

## Boundaries & Constraints

**Always:**
- O rótulo do tom é o tom que SOA: nota-base do botão `--chord-tone` (`F#m(com forma de Em)` vira `F#m`); o trecho `(com forma de X)` é descartado.
- Com capotraste, o conteúdo traz os acordes da forma, não do tom que soa; a calibração `keyShape` continua linear (verificada em Wonderwall e Fix You).
- Cada item de `POST /tons` ganha `capotraste` (inteiro da casa ou `null`), igual nas 12 versões; `TonVersion` ganha `capotraste?: number | null`.
- Quando `capotraste` não é `null`, cada página do EPUB mostra no seletor de tom a linha "Capotraste na Nª casa — os acordes abaixo estão na forma, não no tom que soa".
- Os 12 tons continuam em sustenidos (C-3) e `exatamente 12 itens` com um `is_original` (api-contracts).

**Never:**
- Nenhuma heurística de dedução do tom a partir dos acordes impressos (decisão B2: confiar no rótulo do Cifra Club).
- Nenhuma transposição local de acordes (C-2).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Música com capotraste | Botão `F#m(com forma de Em)` (ex.: Wonderwall, Fix You) | 12 versões; rótulos em sustenido a partir de `F#m`; `capotraste` = casa em todas; EPUB mostra a linha do capo | N/A |
| Música sem capotraste | Botão `E` | 12 versões com `capotraste: null`; EPUB sem a linha do capo | N/A |
| Redirect para letra | Cifra Club responde 307 para `.../letra/` (ex.: `legiao-urbana/pais-e-filhos`) | HTTP 502 `{ error }` "Cifra Club não tem cifra para esta URL..." | Nunca "Botão de tom não encontrado" |

</frozen-after-approval>

## Code Map

- `scraper/cifraclub_tons.py` -- `_decompor_tom` aceita `X(com forma de Y)`; extrai a casa do capotraste; erro 502 claro para redirect `/letra/`.
- `scraper/tests/test_contrato_html_real.py` e `scraper/tests/fixtures/` -- testes de contrato com HTML real gravado (com e sem capotraste).
- `interfaces/tonVersion.ts` e `integrations/cifraClub/index.ts` -- `TonVersion.capotraste?: number | null`; o cliente mapeia o campo (ausente vira `null`) e rejeita valor que não seja inteiro positivo.
- `scraper/cifraclub_tons.py` (`_extrair_capotraste`) -- além do pedido, erro se o capotraste mudar entre a página original, `keyShape=0` e os demais (nunca esconde capo inconsistente).
- `services/epubBuilder.ts` -- linha de aviso do capotraste no seletor de tom de cada página.
- `api-contracts.md`, `SPEC.md` (C-16, nota em C-3), `glossary.md` -- reconciliação documental.

## Tasks & Acceptance

**Execution:**
- [x] `scraper/cifraclub_tons.py` -- aceitar `X(com forma de Y)` em `_decompor_tom`, rótulo = tom que soa -- B1
- [x] `scraper/cifraclub_tons.py` -- expor `capotraste` (inteiro ou `null`, igual nas 12 versões) em cada item de `POST /tons`
- [x] `scraper/cifraclub_tons.py` -- redirect 307 para `/letra/` levanta 502 "Cifra Club não tem cifra para esta URL..." -- B3
- [x] `scraper/tests/test_contrato_html_real.py` + `fixtures/` -- teste de contrato com HTML real, com e sem capotraste
- [x] `integrations/cifraClub` -- `TonVersion.capotraste?: number | null`
- [x] `services/epubBuilder.ts` -- linha "Capotraste na Nª casa — ..." no seletor de tom quando não é `null`
- [x] `controllers/envioController.ts` -- sem import de `repositories/` (A1, C-7)
- [x] `SPEC.md`, `api-contracts.md`, `glossary.md`, `conventions.md`, `deferred-work.md`, `RETROSPECTIVE.md` -- reconciliação e registro dos itens de ação

**Acceptance Criteria:**
- Given uma música com capotraste (Wonderwall, Fix You), when `POST /tons`, then responde 12 versões, rotuladas pelo tom que soa, com `capotraste` preenchido e igual nas 12.
- Given uma música sem capotraste, when `POST /tons`, then `capotraste` é `null` nas 12 versões.
- Given um EPUB de música com capotraste, when aberto em qualquer tom, then o seletor mostra a linha do capotraste; sem capotraste, a linha não aparece.
- Given uma URL que redireciona para `/letra/`, when `POST /tons`, then 502 com mensagem clara.

## Spec Change Log

- 2026-11-19: acrescentada a restrição C-16 em `SPEC.md` e a limitação conhecida do rótulo (B2, exemplo Yellow) em C-3; `success` de CAP-2/CAP-3 não foi alterado.

## Design Notes

- **Rótulo = tom que soa (Open question 1 da retrospectiva):** decisão por delegação do Thiago em 2026-11-19; mantém a navegação entre tons coerente com o que o músico ouve, e a linha do capo no EPUB informa a forma.
- **B2 aceito (Open question 2):** manter C-3, confiar no rótulo do Cifra Club; em Yellow o rótulo diz E e os acordes estão em B. Limitação documentada, sem heurística; o Thiago pode sobrescrever.
- **B3:** `legiao-urbana/pais-e-filhos` é um medley sem cifra; a cifra existe em outra URL (`/legiao-urbana/pais-filhos/`). Possibilidade não verificada: a busca (`cifraclub_search`) pode devolver o slug do medley (ver `deferred-work.md`).
- **Fora desta story:** teste real no Kindle (CAP-3/CAP-4 no aparelho) segue pendente e depende do Thiago.

## Verification

**Commands:**
- `pytest scraper/tests` -- expected: contrato com HTML real passa (com e sem capotraste)
- `npm run typecheck` e `npm test` -- expected: sem erros

**Manual checks:**
- Rodar `obter_tons` contra o Cifra Club real com Wonderwall (capo) e Yellow (sem capo) e conferir os rótulos e a linha do capo no EPUB.
