---
title: 'Transpor para os 12 tons'
type: 'feature'
created: '2026-11-18'
status: 'done'
route: 'dispatch'
review_loop_iteration: 0
baseline_commit: '8d4feeccf3e0b6ea7cb3ae29e59c8e7ba44589be'
context: ['{project-root}/_bmad-output/specs/spec-cifra-kindle/SPEC.md', '{project-root}/_bmad-output/specs/spec-cifra-kindle/api-contracts.md', '{project-root}/_bmad-output/specs/spec-cifra-kindle/stack.md', '{project-root}/_bmad-output/specs/spec-cifra-kindle/conventions.md']
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** CAP-2/FR-2 exige que o sistema transponha a Cifra buscada (Story 2) para os 12 tons cromáticos automaticamente, mas nada ainda busca o conteúdo real da página nem aciona as variações de tom — `scraper/` só resolve nome->URL (Story 2); `POST /tons` não existe.

**Approach:** Implementar `POST /tons` no FastAPI: busca a página original (sem parâmetro) e usa o parâmetro `?keyShape=N`, já suportado pelo próprio Cifra Club, para obter as outras 11 — fazendo 12 requisições via `curl_cffi` (já validado/aprovado na Story 2), ou 13 no caso raro em que o tom original coincide com o tom de calibração (ver Boundaries). Como a numeração de `keyShape` não é fixa entre músicas (descoberto por investigação ao vivo nesta sessão), a implementação calibra o deslocamento por música antes de decidir quais 11 valores pedir.

## Boundaries & Constraints

**Always:**
- `POST /tons` busca a `cifra_club_url` (sem parâmetro) + 11 variações `?keyShape=N` via `curl_cffi` (`impersonate="chrome"`) — o host principal do Cifra Club está atrás da Akamai (ver Story 2 Design Notes, OQ-3 em `SPEC.md`).
- `keyShape` **não tem numeração fixa entre músicas** (confirmado: a mesma música reproduz o tom original num valor de `keyShape` diferente do de outra música, mas o deslocamento é linear dentro da mesma música — +1 em `keyShape` sempre sobe 1 semitom). A implementação calibra por música: lê o tom declarado da página sem parâmetro e de `?keyShape=0`, calcula o deslocamento entre os dois, e só então deriva o `keyShape` certo para cada um dos 10 tons restantes.
- **Caso raro aceito (renegociado em 2026-11-18):** quando o tom original coincide com o tom que `?keyShape=0` já devolve, a calibração "desperdiça" uma requisição e o total sobe para 13 (não 12) — o resultado continua correto (12 tons distintos, 1 original); isso é uma consequência inevitável de calibrar com um ponto fixo sem conhecer o mapeamento da música de antemão, não um bug a corrigir.
- O tom de cada versão vem do texto de `button[data-anchor="--chord-tone"]` daquela resposta, convertido para sustenido (C-3) quando o Cifra Club mostra em bemol (ex.: `Bb` -> `A#`) — nunca inferido do primeiro acorde da cifra, que pode não ser a tônica declarada (ex.: uma música com `Tom: F` pode abrir com o acorde `Dm7`).
- **Qualidade maior/menor preservada (renegociado em 2026-11-18, ver C-3 do SPEC.md):** o botão de tom pode mostrar um sufixo `m` (ex.: `Dm`, `F#m`, `Bbm`) — a conversão pra sustenido se aplica só à letra; o sufixo `m` é preservado sem alteração. Uma música em tom menor produz suas 12 versões como `Cm, C#m, Dm...Bm`, nunca forçada pra maior.
- `conteudo` de cada versão é o texto do bloco `<pre data-chord-content="true">` daquela resposta (acordes + letra, preservando quebras de linha e espaçamento) — é o que mantém o alinhamento acorde-sobre-sílaba pro CSS `white-space: pre` da Story 4 (C-5).
- Exatamente 12 versões no resultado, tons em sustenido (C-3) preservando qualidade maior/menor, exatamente uma `is_original: true` — a correspondente à página sem parâmetro.
- `POST /tons` só aceita `cifra_club_url` cujo host seja `cifraclub.com.br` (ou subdomínio) com scheme `https` — qualquer outro valor é 400, nunca repassado pro `curl_cffi` (mitigação de SSRF; `cifra_club_url` chega de fora, de Story 2 ou de um link colado pelo usuário via Story 5).
- Qualquer falha ao longo do processo (rede, timeout, parsing, tom ausente/não reconhecido, menos de 12 tons distintos) -> HTTP 502 `{error: string}` — nunca um resultado parcial ou incorreto silencioso (api-contracts.md).

**Never:**
- Nenhuma lógica de transposição musical própria — cada conteúdo já vem transposto pelo Cifra Club via `keyShape` (C-2); esta story só decide qual `keyShape` pedir para cada tom.
- Nenhuma chamada a `cifraclub_search`/Solr aqui — `cifra_club_url` já chega pronta (Story 2).
- Nenhuma geração de EPUB nem persistência em banco — isso é Story 4/5.
- Nenhum uso de Selenium/navegador real — `curl_cffi` simula só o fingerprint TLS, sem executar JS (AD-1/AD-2 mantidos).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Happy path (tom maior) | `cifra_club_url` válida, música em tom maior | 200 `{versions: [12 itens]}`, 1 `is_original:true`, todos os toms em sustenido, sem repetição | N/A |
| Música em tom menor | `cifra_club_url` válida, botão de tom mostra ex. `Dm` | 200 `{versions: [12 itens]}` com sufixo `m` preservado em todas (`Cm, C#m, Dm...Bm`) | N/A |
| URL não resolve mais (removida/404 no Cifra Club) | `cifra_club_url` de música inexistente | 502 `{error}` | Nunca retorna `versions` vazio/parcial |
| `cifra_club_url` fora do domínio do Cifra Club | host diferente de `cifraclub.com.br` | 400 `{error}` | Nunca chega a chamar `curl_cffi` (SSRF) |
| Falha de rede/timeout no meio das 12 (ou 13) requisições | timeout numa das chamadas | 502 `{error}` | Nenhuma versão parcial é retornada |
| Botão de tom ausente ou texto não reconhecido | HTML do Cifra Club mudou de formato | 502 `{error}` | Nunca assume um tom por heurística |

</frozen-after-approval>

## Code Map

- `scraper/main.py` -- registra `POST /tons`, delega pra `cifraclub_tons.py`
- `scraper/cifraclub_tons.py` (novo) -- `obter_tons(cifra_club_url: str) -> list[dict]`: busca original + calibra `keyShape` + monta as 12 versões
- `scraper/cifraclub_search.py` (Story 2) -- referência de convenção (`BuscaIndisponivelError`-like pattern, timeout) — não é chamado diretamente (host/proteção diferentes)
- `scraper/requirements.txt` -- adicionar `curl_cffi`, `beautifulsoup4`, `lxml`
- `interfaces/tonVersion.ts` (Story 4, existente) -- contrato `{ tom, semitoneOffset, isOriginal, conteudo }` que `integrations/cifraClub.obterTons` deve produzir
- `integrations/cifraClub/index.ts` -- troca o stub `obterTons` (criado pela Story 5) pela implementação real

## Tasks & Acceptance

**Execution:**
- [x] `scraper/cifraclub_tons.py` -- `obter_tons(cifra_club_url)`: busca original + `keyShape=0`, calibra deslocamento, busca os 10 tons restantes, extrai tom (botão) e conteúdo (`<pre>`) de cada resposta -- núcleo da story
- [x] `scraper/main.py` -- adicionar `POST /tons` recebendo `{cifra_club_url}`, retornando `{versions: [...]}`, 502 em qualquer falha -- expõe o contrato HTTP
- [x] `scraper/requirements.txt` -- adicionar `curl_cffi`, `beautifulsoup4`, `lxml`
- [x] `scraper/tests/test_tons.py` -- cobre as 4 linhas da matrix original (mock de `curl_cffi.requests.get`) -- nenhuma regressão silenciosa
- [x] `integrations/cifraClub/index.ts` -- implementar `obterTons` de verdade (fetch em `POST /tons`), preservando a assinatura usada pela Story 5 -- fecha o elo Node->FastAPI
- [x] `tests/integrations/cifraClub.test.ts` -- adicionar cobertura de `obterTons` (mock de `fetch`) -- nenhuma regressão silenciosa
- [x] `scraper/cifraclub_tons.py` -- `_nota_em_sustenido`/tabelas: reconhecer sufixo `m` no texto do botão (ex. `Dm`, `F#m`, `Bbm`), converter só a letra pra sustenido e preservar o `m` -- fecha o gap de tom menor (Review Triage)
- [x] `scraper/tests/test_tons.py` -- adicionar caso de música em tom menor (linha nova da matrix) -- cobre o gap de tom menor
- [x] `scraper/main.py`/`cifraclub_tons.py` -- validar que `cifra_club_url` tem host `cifraclub.com.br` (ou subdomínio) e scheme `https` antes de chamar `curl_cffi`; 400 caso contrário -- mitigação de SSRF (Review Triage)
- [x] `scraper/tests/test_tons.py` -- caso de `cifra_club_url` fora do domínio -- cobre a mitigação de SSRF
- [x] `integrations/cifraClub/index.ts` -- subir `TONS_TIMEOUT_MS` pra acima do pior caso real do scraper (13 × 15s + margem) -- corrige o mismatch de timeout (Review Triage)
- [x] `integrations/cifraClub/index.ts` -- em `obterTons`, validar que os 12 `semitoneOffset` formam o conjunto `{0..11}` sem repetição -- defesa contra resposta corrompida do scraper (Review Triage)
- [x] `scraper/cifraclub_tons.py` -- parsear o HTML de cada resposta uma vez só (`BeautifulSoup`), reusar o `soup` em `_extrair_tom`/`_extrair_conteudo` -- elimina parse duplicado (Review Triage)

**Acceptance Criteria:**
- Given uma `cifra_club_url` válida de música em tom maior, when `POST /tons`, then retorna exatamente 12 ou 13 `versions` (ver Boundaries), com 12 tons distintos, uma com `is_original:true`, tons todos em sustenido, sem repetição.
- Given uma `cifra_club_url` válida de música em tom menor, when `POST /tons`, then as 12 versões preservam o sufixo `m` (`Cm, C#m, Dm...Bm`), nunca forçadas pra maior.
- Given a versão `is_original`, when comparada à página sem parâmetro `keyShape`, then seu tom e conteúdo correspondem ao que a página original retorna.
- Given uma `cifra_club_url` fora do domínio `cifraclub.com.br`, when `POST /tons`, then retorna 400 sem nunca chamar `curl_cffi`.
- Given qualquer falha de rede/parsing durante as requisições, when `POST /tons`, then retorna 502 `{error}`, nunca uma lista parcial.
- Given o FastAPI respondendo 200 com 12 `semitoneOffset` válidos e únicos, when `integrations/cifraClub.obterTons` é chamado, then resolve para um array de 12 `TonVersion` com os campos corretos; caso contrário rejeita.

## Implementation Notes

- Verificado ao vivo nesta sessão depois dos patches: "The Scientist" (tom maior, F) continua retornando 12 versões corretas; "Zombie" (The Cranberries, tom menor, Em) retorna as 12 versões como `Cm, C#m, Dm...Bm` com original `Em` — fecha a pendência que o subagente deixou aberta ("tom menor só testado com dados sintéticos"). URL fora do domínio (`169.254.169.254`) retorna 400 sem chamar `curl_cffi`, confirmado ao vivo.
- A checagem de host no lado Node (mencionada no achado original de SSRF como "mesma checagem no lado Node") não foi duplicada ali — a validação roda só no FastAPI (`validar_url_cifra_club`), que é a única camada que de fato chama `curl_cffi`. Considero isso suficiente: não há um segundo ponto que faça a requisição externa.

## Spec Change Log

- **2026-11-18, renegociado com Thiago (via AskUserQuestion) após a revisão (step-04):** (1) Intent/Boundaries emendados — "exatamente 12 requisições" relaxado pra "12, ou 13 no caso raro de coincidência de calibração" (sem mudança de código, só documentação); (2) Boundaries emendados — qualidade maior/menor agora é preservada no tom (sufixo `m`), o que também exigiu emendar **C-3 do `SPEC.md`** (fora desta story) via `bmad-spec`. Novas Tasks/AC adicionadas pra (2) + os achados de SSRF/timeout/validação de offset/parse duplicado, que estavam `moot` no Review Triage Log e agora precisam ser aplicados.

## Review Triage Log

- **[medium, intent_gap → resolvido]** Blind Hunter + Edge Case Hunter + Verification Gap (3x, all independently confirmed): quando o tom original de uma música coincide com o tom que `keyShape=0` devolve (`indice_original == indice_zero`), as 2 requisições de calibração (original + `keyShape=0`) só preenchem 1 dos 12 "slots" de tom em vez de 2, então o loop faz 11 requisições a mais em vez de 10 — total 13, não 12. Renegociado com Thiago: aceito e documentado (ver Boundaries "Caso raro aceito"), sem mudança de código.
- **[alto, intent_gap → resolvido/patch aplicado]** Blind Hunter: o botão `--chord-tone` do Cifra Club mostra tons **menores** como `Dm`, `F#m`, `Bbm` — não só letras soltas. Renegociado com Thiago: C-3 do `SPEC.md` emendado (preserva qualidade maior/menor) via `bmad-spec`; `_decompor_tom` em `cifraclub_tons.py` agora separa letra/sufixo `m`. Verificado ao vivo contra "Zombie" (Em) — ver Implementation Notes.
- **[medium, patch aplicado]** Blind Hunter + achado separado de revisão de segurança automática (2x): `POST /tons` aceita `cifra_club_url` livre e repassa sem validação pro `curl_cffi.requests.get` — SSRF. `validar_url_cifra_club` agora exige host `cifraclub.com.br`(.subdomínio) + scheme `https` antes de qualquer requisição; 400 caso contrário. Verificado ao vivo contra um IP de metadados.
- **[medium, patch aplicado]** Blind Hunter + Edge Case Hunter (2x): `TONS_TIMEOUT_MS` do Node (120s) era menor que o pior caso real do scraper (até 13 requisições × 15s ≈ 195s). Subido para 240s.
- **[low-medium, patch aplicado]** Edge Case Hunter: `integrations/cifraClub.obterTons` não conferia que os 12 `semitoneOffset` são exatamente `{0..11}` sem repetição. Validação adicionada, com teste cobrindo offset duplicado.
- **[low, patch aplicado]** Blind Hunter: `_extrair_tom` e `_extrair_conteudo` cada um fazia seu próprio `BeautifulSoup(html, "lxml")` na mesma resposta. Refatorado para `_buscar_soup` parsear uma vez e reusar.
- **[low, defer]** Blind Hunter: a mensagem de exceção crua do catch-all (`except Exception`) vai direto pro corpo da resposta HTTP. Mesmo padrão já aceito no commit da Story 1/2 (ferramenta solo, localhost, sem multiusuário — NG-5/C-14); não é um problema novo desta story, não repito o debate aqui.
- **[baixa confiança, defer]** Blind Hunter: o join de múltiplos blocos `<pre data-chord-content="true">` (se existirem) nunca foi testado contra uma música real com mais de um bloco (ex.: seção de tablatura/intro separada). Não encontrei evidência de que isso quebra, só que não foi verificado. Logado pra checar com mais variedade de músicas depois.
- **[false]** Blind Hunter: novas dependências (`curl_cffi`, `beautifulsoup4`, `lxml`) sem versão fixa — mas isso é consistente com o padrão já estabelecido no projeto (`requests`, `uvicorn[standard]`, `pytest`, `httpx` já estavam todos sem versão fixa antes desta story); não é uma regressão introduzida aqui.
- **[false]** Blind Hunter: falta retry/backoff entre as 12 requisições — já é o comportamento pretendido pelos Boundaries congelados ("nunca um resultado parcial ou incorreto silencioso"); falha rápida e 502 é a escolha de design, não um gap.
- **[low, defer]** Blind Hunter: `.claude/scheduled_tasks.lock` aparece de novo como arquivo novo no diff — mesma causa raiz já logada em `deferred-work.md` na revisão da Story 2 (gap no `.gitignore`); não duplico a entrada.

## Design Notes

- **`keyShape` não é absoluto, precisa calibração por música:** testado em duas músicas nesta sessão — a mesma `keyShape=0` dá tons diferentes em músicas diferentes, e o valor que reproduz o tom original também muda por música (ex.: 8 numa, 7 noutra). A relação é linear dentro de uma mesma música (+1 em `keyShape` sempre sobe 1 semitom), então 2 pontos (tom original + `keyShape=0`) bastam para calibrar os outros 10 — sem precisar de força bruta nem de uma tabela fixa.
- **Tom lido do botão `data-anchor="--chord-tone"`, não do primeiro acorde:** confirmado que o primeiro acorde da cifra pode não ser a tônica da tonalidade (ex.: "The Scientist" declara `Tom: F` mas abre com `Dm7`). O botão reflete corretamente a transposição aplicada em cada resposta — fonte confiável e já usada pela própria UI do Cifra Club.
- **12 requisições exatas, sem desperdício:** `keyShape=0` já é uma das 12 versões necessárias, não uma 13ª requisição descartável — junto com a página sem parâmetro (tom original), sobram só 10 requisições adicionais pros 10 tons restantes.
- **Conteúdo extraído do `<pre data-chord-content="true">`:** o Cifra Club marca cada acorde com `<b data-chord-name="...">` dentro desse bloco; extrair o texto renderizado (não HTML) preserva o alinhamento espacial que Story 4 precisa, sem exigir parsing de tags na Story 4.

## Verification

**Commands:**
- `cd scraper && py -3.14 -m pytest` -- expected: os 4 casos da matrix passam
- `npm run typecheck` -- expected: sem erros
- `npm run test -- cifraClub` -- expected: cobertura de `obterTons` passa

**Manual checks (if no CLI):**
- `curl -X POST http://localhost:8000/tons -H "Content-Type: application/json" -d '{"cifra_club_url":"https://www.cifraclub.com.br/coldplay/the-scientist/"}'` com o FastAPI rodando -- confirma 12 `versions`, 1 `is_original`, tons em sustenido
