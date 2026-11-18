---
name: 'Review de versoes — Stack da Architecture Spine'
type: review
reviewed: '_bmad-output/planning-artifacts/architecture/architecture-cifra-kindle-2026-11-17/ARCHITECTURE-SPINE.md'
reviewer: adversarial-version-check
review-date: '2026-11-17'
method: 'web search (2026-11-17), por item da tabela Stack'
---

# Review adversarial — tabela "Stack" da ARCHITECTURE-SPINE.md

## Veredito resumido

A tabela Stack tem exatamente **um** item com evidência de checagem real (`FastAPI 0.163.0 (verificado em 2026-11-17)` — a própria anotação implica que os outros dez itens **não** foram verificados na mesma data). A checagem externa confirma essa suspeita: pelo menos três pins (Node >=20, Vitest ^1.6.0, PostgreSQL 16) estão claramente desatualizados para um projeto novo em novembro de 2026, um (Express ^4.19.2) é uma escolha deliberadamente antiga para um projeto greenfield, e nenhum dos pins tem uma fonte/data anexada exceto o FastAPI. Isso é o padrão clássico de versões "chutadas" a partir de memória de treinamento, com uma única entrada corrigida manualmente.

## Achados por item

### 1. Node.js `>=20` — DESATUALIZADO (floor muito baixo)
Busca em 2026-11-17 indica que o suporte de segurança do Node 20 já terminou; a linha LTS atual é a Node 26 (lançada em 2026, suporte ativo até out/2027), com Node 22 em manutenção até abr/2027 e Node 24 com suporte ativo até out/2026. Fixar o piso em `>=20` significa que o projeto roda oficialmente numa versão sem patches de segurança. Para um projeto iniciado agora, o piso deveria ser pelo menos `>=22` (LTS ainda suportado) ou, melhor, `>=24`/`>=26`.
**Fonte:** endoflife.date/nodejs, nodejs.org/about/releases.

### 2. TypeScript `^7.0.2` — real, mas com ressalvas não mencionadas na spine
TypeScript 7.0 (porta nativa em Go, "Project Corsa") saiu estável em 2026-07-08 — a versão em si é plausível e existe. Porém:
- A API programática completa só chega na 7.1; ferramentas como Vue/Astro/Svelte/Angular ficam na linha 6.x até lá.
- **Plugins de compilador, `ts-patch` e transformers não funcionam** com o compilador Go.
- Suporte a watch mode é inconsistente entre fontes (uma diz que só chega na 7.1).

Nenhuma dessas ressalvas aparece na spine. Se o projeto depende de algum transformer ou de `ts-node`/`ts-patch` em scripts de build, isso pode quebrar silenciosamente. Vale uma nota explícita confirmando que o pipeline de build/test (Vitest, migrations Knex em TS) foi testado contra o compilador Go.
**Fonte:** devblogs.microsoft.com/typescript/announcing-typescript-7-0, infoq.com/news/2026/08/typescript-7-released.

### 3. Express `^4.19.2` — provavelmente copiado de projeto antigo, não reavaliado
Express 5 é a linha recomendada atualmente (5.2.x é a versão de produção citada por fontes de suporte comercial); Express 4 entrou em manutenção formal em abril/2025 com EOL alvo "não antes de 1/out/2026" — ou seja, a data de corte do Express 4 já passou (ou está passando) no momento em que este projeto está nascendo. Começar um projeto **novo** em novembro de 2026 pinado em Express 4.19.2 é a escolha de uma versão que a própria equipe do framework já está empurrando para fora. Isso tem cheiro forte de valor copiado de um projeto anterior (ou de memória de treinamento desatualizada) sem reconsiderar o encaixe aqui. Se a decisão de ficar em v4 for intencional (ex.: familiaridade do Thiago, convenção pessoal citada no documento), isso deveria estar registrado como trade-off explícito — não está.
**Fonte:** herodevs.com (Express 3/4 EOL reference), expressjs.com/guide/migrating-5.

### 4. Knex `^3.1.0` — mantido, mas não é mais o "default" óbvio para TS+Postgres novo
Knex continua ativo (atualizado em 2026, ~611 contribuidores) e funciona com Postgres sem problema. Mas para um projeto greenfield TypeScript + Postgres em 2026, comparações recentes (dev.to, toolradar, pkgpulse) convergem em que **Drizzle ORM** (ou, para quem quer só um query builder tipado, **Kysely**) tem tipagem TS nativamente mais forte e é hoje a recomendação mais citada para esse caso de uso — Knex é descrito como "sólido mas com história de TS mais fraca que os concorrentes mais novos". A spine não registra ter considerado e descartado essa alternativa; apenas herda Knex (provavelmente da "convenção pessoal do autor" citada na seção de Design Paradigm). Isso não é um erro fatal, mas é uma decisão que parece herdada, não comparada.
**Fonte:** dev.to (Drizzle vs Kysely vs Knex 2026), devtools-vs.pages.dev/drizzle-vs-knex.

### 5. `pg` (node-postgres) `^8.23.1` — não confirmável com precisão
As fontes encontradas discordam entre si sobre a última versão real (8.23.0 vs 8.22.0 vs 8.21.x, dependendo do agregador/data do snapshot); nenhuma confirmou `8.23.1` especificamente. É plausível que seja um patch muito recente não indexado ainda, mas isso não foi verificado de forma independente — está na mesma categoria de "não confirmado" que os outros itens sem anotação de verificação.
**Fonte:** node-postgres.com, packages.ecosyste.ms, tracker.debian.org/pkg/node-postgres.

### 6. Zod `^4.6.7` — confere
Busca encontrou exatamente essa versão (4.6.7) como lançamento mais recente registrado por agregador de releases, datado de ~2026-10-12. É o único item (fora o FastAPI anotado) cuja versão exata bateu com uma fonte externa específica.
**Fonte:** releasebot.io/updates/colinhacks/zod.

### 7. Vitest `^1.6.0` — FORTE SUSPEITA DE VERSÃO OBSOLETA (achado mais grave)
Vitest 1.6.0 é uma versão de ~2024. Em novembro de 2026 a linha atual é **Vitest 5.x** (5.0.0 lançado em 2026-09-03, com patches até pelo menos 5.0.4 em 2026-10-12), exigindo Node >=22.12 e Vite >=6.4. Entre a 1.x e a 5.x houve pelo menos três majors (incluindo Vitest 4, com suporte a Vite 8). Pinar `^1.6.0` para testes num projeto que nasce hoje é, isoladamente, o sinal mais claro de que essa linha da tabela foi copiada de memória de treinamento/projeto antigo sem nenhuma checagem — é quase dois anos e múltiplos majors defasada, e nem é compatível com o restante do stack (Node >=20 vs. Vitest 5 pedindo Node >=22.12).
**Fonte:** vitest.dev/blog (vitest-5), releases.sh/vitest.

### 8. Next.js `^16.4.3` — plausível, não totalmente confirmável
Next.js 16 foi lançado estável em 2025-10-21 e está em Active LTS. Agregadores de terceiros mostram 16.4.1 em meados de outubro/2026; `16.4.3` em 17/nov/2026 é uma progressão plausível de patches, mas não foi confirmado num snapshot exato. Risco baixo.
**Fonte:** netlify.com/changelog/next-js-16-deploy-on-netlify, nextjs.org/support-policy, versio.io.

### 9. React / React DOM `^19.3.1` — plausível
React 19.3 (minor sem breaking changes) saiu em 2026-09-09; não há React 20 lançado ou com RC confirmado até a data de hoje (algumas páginas de SEO afirmam o contrário, mas são inconsistentes entre si e tratadas como não confiáveis pela própria busca). `19.3.1` como patch é razoável. Risco baixo.
**Fonte:** devx.com (React 19.3 view transitions), dev.to (react-20-is-coming — ainda não lançado).

### 10. PostgreSQL 16 (`postgres:16-alpine`) — DESATUALIZADO, achado grave
A versão major atual estável é a **PostgreSQL 18** (18.6), lançada em 2025-09-22, e a **PostgreSQL 19** está com RC1 desde 2026-10-15 e GA prevista para **2026-11-19** — ou seja, dois dias depois da data deste documento. Postgres 16 já é dois majors atrás do estável e um atrás do "quase-lançado". Além disso, o PostgreSQL 14 perde suporte de segurança em 2026-11-12 (cinco dias antes de hoje), o que mostra como o calendário de EOL do Postgres é rápido — reforça que escolher a imagem `postgres:16-alpine` para um projeto novo sem checar isso é arriscado: fica confortável hoje, mas entra em journey de upgrade mais cedo do que necessário. Recomendação mínima seria Postgres 17 ou 18 para um projeto greenfield de 2026.
**Fonte:** versio.io (PostgreSQL EOL dates), docs.postgresql.org/docs/19/release-19.html, aws.amazon.com (RDS minor versions).

### 11. Python `>=3.12` — piso aceitável, mas datado
Não é "errado" (é só um piso mínimo), mas a linha atual é Python 3.14/3.15 (3.15.0 lançado em 2026-10-09; 3.14.9 em 2026-10-21), e a 3.13 está perto do fim do ciclo de manutenção plena. Para um `scraper/` novo, vale considerar subir o piso para `>=3.13`.
**Fonte:** python.org/downloads/release/python-3150, python.org/downloads/release/python-3149.

### 12. FastAPI `0.163.0 (verificado em 2026-11-17)` — o único item realmente checado, e confere
As release notes oficiais listam `0.163.0` datado de 2026-11-14 (três dias antes da data da spine), o que é consistente com a anotação "verificado em 2026-11-17". Este é o único item da tabela com evidência de ter sido efetivamente reality-checked.

**Lacuna de compatibilidade não coberta pela spine:** a tabela não nomeia nem `pydantic` nem `uvicorn`, que são dependências que fazem diferença real de comportamento no `scraper/` (FastAPI 0.163 roda sobre Pydantic v2 — não é compatível com Pydantic v1 — e normalmente se serve com `uvicorn[standard]`). Como a spine faz questão de documentar versões exatas para todo o resto do stack, omitir essas duas é uma inconsistência: ou a tabela deveria fixar `pydantic ^2.x` e `uvicorn` explicitamente, ou deveria declarar que ficam livres por serem transitivas — hoje fica implícito.

## Itens com cheiro mais forte de "copiado sem reverificar"

Em ordem de severidade:
1. **Vitest ^1.6.0** — ~2 anos e 3+ majors defasado; incompatível com o piso de Node declarado.
2. **PostgreSQL 16** — dois majors atrás do estável, com PG19 GA a dois dias da data do documento.
3. **Node.js >=20** — piso já sem suporte de segurança.
4. **Express ^4.19.2** — escolha de uma versão que o próprio mantenedor está descontinuando, para um projeto que começa agora.
5. **Knex ^3.1.0** — não inválido, mas herdado de convenção pessoal sem registrar que alternativas (Drizzle/Kysely) foram consideradas e descartadas.

## Recomendação

Tratar a tabela Stack como não verificada exceto a linha do FastAPI, e repetir a mesma checagem (web search com data) para Node, Vitest e PostgreSQL antes de considerar a spine "final" — hoje o status do documento é `final`, mas pelo menos três pins de infraestrutura central (runtime, test runner, banco de dados) parecem vir de memória de treinamento, não de verificação ativa.
