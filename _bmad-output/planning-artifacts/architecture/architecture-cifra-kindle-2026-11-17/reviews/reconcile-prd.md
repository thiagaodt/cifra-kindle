---
title: Reconciliação PRD/Brief/Addendum × Architecture Spine
project: Adaptador de Cifras para Kindle
reviewed:
  - prd.md (prd-cifra-kindle-2026-11-15, status: final)
  - brief.md (brief-cifra-kindle-2026-11-15)
  - addendum.md (brief-cifra-kindle-2026-11-15)
  - ARCHITECTURE-SPINE.md (architecture-cifra-kindle-2026-11-17)
date: 2026-11-17
---

# Reconciliação: PRD/Brief/Addendum × Architecture Spine

## Método

Leitura integral dos quatro documentos. Checagem item a item: (a) cobertura de FR-1..FR-4 no Capability Map,
(b) restrições/guardrails do §5 do PRD, (c) nuances qualitativas do JTBD (§2.1), (d) contradições com os
Non-Goals (§6), (e) pesquisa técnica do addendum (EPUB vs PDF, limites de Send-to-Kindle, risco legal de
scraping) referenciada (ou não) pela spine.

## Achados

### 1. [GAP] Approved Sender (pré-requisito de §5 e NOTE FOR PM de FR-4) — ausente da spine

O PRD trata isso como restrição formal (§5: "o envio automatizado só funciona depois que Thiago cadastra
manualmente o e-mail remetente como Approved Sender — é um passo de setup único, fora do controle do
software") e repete como nota explícita em FR-4 (`[NOTE FOR PM] Pré-requisito único: Approved Sender
configurado — ver §5`). O addendum também documenta o limite de 15 endereços.

A spine não menciona "Approved Sender" em nenhum lugar — nem como AD, nem em `Deferred`, nem na seção
`Consistency Conventions` (onde `config/env.ts` e variáveis de ambiente são discutidas), nem como nota
operacional junto de `integrations/kindleMail/`. Isso é exatamente o tipo de pré-requisito "fora do controle
do software" que merece uma linha em `Deferred` ou um comentário no `AD-1`/estrutura de `integrations/kindleMail`
dizendo algo como "assume que o remetente SMTP configurado em `.env` já está cadastrado como Approved Sender
na conta Amazon; isso não é validado nem resolvido pelo software." Sem isso, um futuro leitor da spine (ou o
próprio Thiago, revisitando o projeto meses depois) não tem como saber, só pela arquitetura, que FR-4 tem essa
dependência externa — a informação só existe no PRD.

**Severidade:** média — não é um erro de design, é uma lacuna de rastreabilidade/documentação de uma restrição
explicitamente marcada como importante pelo PM no próprio PRD.

### 2. [GAP] Risco técnico do addendum sobre EPUB reflowable × alinhamento acorde-sobre-sílaba não endereçado em AD-3

O addendum é explícito: "EPUB reflui (bom para texto corrido e para links internos, mas quebra alinhamento de
colunas a menos que se force o uso de fonte monoespaçada via CSS `white-space: pre`)." O brief já havia
sinalizado isso como decisão técnica aberta ("Pode ser necessário usar EPUB com fonte monoespaçada forçada via
CSS para ter os dois benefícios — isso precisa ser validado tecnicamente antes de travar a decisão").

O PRD fecha a decisão de formato (EPUB reflowable, ver §9 "OQ-1 ... resolvida na fase de arquitetura") e
mantém, como critério testável de FR-3, que "o alinhamento acorde-sobre-sílaba da Cifra é preservado de forma
legível em cada versão de Tom do Arquivo pronto." Ou seja: a decisão de formato (EPUB) e o requisito de
alinhamento preservado coexistem no mesmo FR, e o addendum já apontou que isso exige uma técnica específica
(fonte monoespaçada / `white-space: pre`) para não se contradizerem.

`AD-3` da spine ("Um EPUB multi-tom por musica, navegavel") resolve a escolha de formato e exclui PDF, mas não
menciona a técnica de fonte monoespaçada/CSS necessária para que esse EPUB reflowable não quebre o alinhamento
— que é precisamente o risco técnico que o addendum levantou sobre essa mesma escolha. Isso deixa um critério
testável de FR-3 (alinhamento preservado) sem solução arquitetural registrada; hoje ele depende de alguém
lembrar do addendum na hora de implementar o template do EPUB.

**Severidade:** média-alta — é um requisito testável explícito de uma FR do MVP (não um nice-to-have), e a
spine é o lugar correto para fixar essa decisão técnica (ex.: "o template HTML/CSS de cada seção de tom usa
fonte monoespaçada e `white-space: pre` para preservar colunas", como uma regra dentro de AD-3 ou um AD-3b).

### 2b. Nota à parte — a rejeição de "múltiplas tonalidades no mesmo arquivo" no addendum está superada pelo PRD, não é uma contradição

A tabela "Alternativas descartadas" do addendum registra que, na época do brief, bundlar as 12 tonalidades no
mesmo arquivo foi *rejeitado* ("multiplica o tamanho do arquivo... pode ser revisitado como incremento
futuro"). O PRD final (mais recente, status `final`) reverteu essa decisão explicitamente em FR-2/FR-3,
tornando os 12 tons num único arquivo o núcleo do MVP. A spine (`AD-2`, `AD-3`) segue corretamente o PRD, que é
a fonte autoritativa mais recente. Isso não é um gap — é só importante registrar que o addendum está parcialmente
desatualizado nesse ponto específico, para que ninguém o leia isoladamente e reabra uma decisão já substituída.

### 3. [GAP leve] Guardrail de direitos autorais (§5) não tem salvaguarda arquitetural explícita

O PRD é explícito: "letra/cifra são protegidas por direito autoral da composição; por isso este projeto não
redistribui nem publiciza conteúdo coletado." O Non-Goal correspondente (§6) proíbe redistribuição pública.

A spine, por sorte/bom design, não persiste o conteúdo da cifra em si: o ER diagram de `musicas` guarda apenas
`nome`, `cifra_club_url`, `tom_original` — não guarda letra/acordes. Isso é consistente com o guardrail, mas
não está declarado como uma decisão deliberada ligada a esse guardrail; parece um efeito colateral do modelo de
dados, não uma regra protegida. Não há nenhum AD ou linha em `Deferred` dizendo algo como "o conteúdo da cifra
nunca é persistido no Postgres nem exposto por endpoint público, por restrição de direitos autorais (§5 do
PRD)". Sem essa frase explícita, um incremento futuro (ex.: cache de cifras, mencionado no próprio `Deferred`
da spine: "Cache de cifras já buscadas: não implementado") poderia reintroduzir exatamente o problema que o
guardrail quer evitar — justamente porque nada na arquitetura marca esse limite como intencional.

**Severidade:** baixa — comportamento atual está correto, mas a intenção não está documentada, criando risco
de regressão silenciosa se "cache de cifras" (já listado como item futuro no Deferred) for implementado sem
reler o PRD.

### 4. [Observação, não é gap crítico] Note sobre tablatura (FR-3, Out of Scope) não é citada na spine

FR-3 tem uma nota explícita "Out of Scope: Tablaturas ... não são suportadas". A spine não contradiz isso (nada
na spine implementa tablatura), mas também não carrega essa nota para o Capability Map ou para `AD-3`. É uma
perda de detalhe menor — não uma contradição — mas como FR-3 é o único lugar no PRD com uma cláusula de
out-of-scope *dentro* de uma FR (em vez de só em §6), vale considerar repetir isso junto de AD-3 para que
alguém implementando o parser de HTML do Cifra Club saiba que deve ignorar/descartar blocos de tablatura
deliberadamente, não por omissão.

### 5. [Observação, não é gap] Complexidade de stack vs. enquadramento "projeto hobby solo" do PRD/Brief

O PRD (§0) descreve o projeto como "pessoal e solo... sem prazo fixo" e o §4.1 deixa a interface
deliberadamente "não travada" ("CLI ou app simples"). O brief reforça: "projeto pessoal (só para uso do
próprio Thiago, por ora)". A spine comete a uma stack relativamente pesada para esse enquadramento: Express +
Next.js + React 19 + FastAPI (Python) + Postgres via Knex + Zod + Vitest — dois processos de longa duração,
dois runtimes de linguagem, banco relacional com migrations, e uma UI dedicada de "histórico e progresso de
envio" que nenhuma FR do PRD pede.

Isso não contradiz nenhum Non-Goal explícito (o PRD não proíbe isso, só não pede), e o cabeçalho da spine marca
AD-5/AD-6 como `[ADOPTED]` — sugerindo que vêm de convenção pessoal pré-existente do autor (citada como "convenção pessoal do autor"
), não de uma decisão nova motivada pelas FRs. Ainda assim, vale sinalizar: o tom do
PRD é de mínimo indispensável para um projeto solo sem prazo, e a spine adiciona capacidade (UI de
histórico/progresso) e complexidade operacional (multi-serviço, multi-linguagem, banco com schema) que vai além
do que qualquer FR exige. Não é uma contradição factual — é um ponto que vale uma confirmação consciente de
Thiago de que esse nível de engenharia é intencional e não scope creep silencioso.

## Itens checados e sem problema (para não serem re-investigados)

- **Cobertura de FR-1 a FR-4 no Capability Map:** todas as quatro presentes, cada uma com AD(s) associado(s).
- **OQ-3 (termos de uso do Cifra Club):** corretamente carregado para `Deferred` na spine, com a mesma
  recomendação de checagem manual do PRD.
- **Non-Goals de transposição ao vivo no Kindle / interface interativa no Kindle / multiusuário:** nenhuma
  contradição encontrada; a spine resolve tudo no notebook do Thiago (localhost), nunca no dispositivo.
- **Nuance do JTBD (troca de tom ao vivo = navegação local, nunca reenvio):** bem capturada em `AD-4`, inclusive
  com a mesma distinção do PRD entre "trocar de tom" (não aciona pipeline) e "trocar de música" (aciona pipeline
  completo).
- **Limite de anexos/tamanho do Send-to-Kindle (addendum: 25 anexos, 50MB):** não é um problema prático aqui
  porque o MVP sempre envia um único arquivo EPUB por envio; não há violação, só ausência de menção — baixa
  prioridade.

## Resumo para ação

Dois itens merecem edição na spine antes de considerá-la pronta para orientar stories:
1. Adicionar nota/AD sobre o pré-requisito de Approved Sender (ligado a `integrations/kindleMail` e/ou
   `Deferred`).
2. Adicionar a regra de fonte monoespaçada/`white-space: pre` dentro de `AD-3` (ou um `AD-3b`), amarrando
   explicitamente a escolha de EPUB reflowable ao requisito testável de alinhamento acorde-sobre-sílaba de FR-3.

Os demais pontos (direitos autorais sem salvaguarda explícita, nota de tablatura, complexidade de stack) são de
severidade baixa e podem ser decisões conscientes já tomadas por Thiago fora deste documento — vale só uma
confirmação rápida.
