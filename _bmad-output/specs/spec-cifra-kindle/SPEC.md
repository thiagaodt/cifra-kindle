---
id: SPEC-cifra-kindle
companions: ['glossary.md', 'stack.md', 'conventions.md', 'api-contracts.md', 'architecture-diagrams.md']
sources: ['../../planning-artifacts/prds/prd-cifra-kindle-2026-11-15/prd.md', '../../planning-artifacts/architecture/architecture-cifra-kindle-2026-11-17/ARCHITECTURE-SPINE.md', '../../planning-artifacts/architecture/architecture-cifra-kindle-2026-11-17/SOLUTION-DESIGN.md']
---

> **Canonical contract.** This SPEC and the files in `companions:` are the complete, preservation-validated contract for what to build, test, and validate. Source documents listed in frontmatter are for traceability — consult them only if you need narrative rationale or prose color this contract intentionally omits.

# Adaptador de Cifras para Kindle

## Why

Hoje, levar uma cifra para o Kindle é manual: abrir o Cifra Club, copiar ou tirar print, ajustar o tom na mão, converter para um formato legível e enviar ao dispositivo — repetindo a cada música. O pior momento para sentir essa dor é durante um culto, ensaio ou apresentação, quando o tom de uma música muda de última hora. Este é um projeto pessoal e solo de Thiago (sem prazo fixo) para resolver essa dor para si mesmo: informar a música e receber, no Kindle, um arquivo já pronto para ler em qualquer um dos 12 tons. Sucesso não é a ferramenta funcionar uma vez como prova de conceito — é Thiago de fato substituir o processo manual por ela, toda vez que for estudar ou tocar uma música.

## Capabilities

- **CAP-1** (FR-1)
  - **intent:** Thiago informa o nome de uma música (ou cola o link da música no Cifra Club) e o sistema busca a Cifra correspondente.
  - **success:** dado um nome de música existente no Cifra Club, o sistema retorna a Cifra (letra + acordes). Se a música não for encontrada, retorna uma mensagem de erro distinta — nunca um arquivo vazio, incorreto ou silêncio sem explicação.

- **CAP-2** (FR-2)
  - **intent:** o sistema transpõe os acordes da Cifra buscada automaticamente para os 12 tons cromáticos, não apenas um tom escolhido manualmente.
  - **success:** o Arquivo pronto contém as 12 versões transpostas, cada uma preservando a relação harmônica original; o tom original (como publicado no Cifra Club) é identificável como a versão de abertura.

- **CAP-3** (FR-3)
  - **intent:** o sistema gera um único Arquivo pronto em EPUB reflowable, reunindo as 12 versões de tom da Cifra buscada, conectadas por links internos de navegação.
  - **success:** o arquivo abre no Kindle sem edição ou conversão manual adicional; abre na versão do tom original; a partir de qualquer versão, um link interno navega para qualquer uma das outras 11 sem reenviar ou sair do arquivo; o alinhamento acorde-sobre-sílaba é preservado de forma legível em cada versão.

- **CAP-4** (FR-4)
  - **intent:** o sistema envia o Arquivo pronto automaticamente para o Kindle via Send-to-Kindle (e-mail/SMTP), sem intervenção manual de Thiago além de informar a música buscada.
  - **success:** o Arquivo pronto chega na biblioteca do Kindle sem passos manuais além dos de CAP-1/CAP-2/CAP-3; trocar de música repete o mesmo fluxo automatizado; trocar de tom durante um evento não depende deste fluxo (resolvido por CAP-3).

## Constraints

- **C-1:** o scraping do Cifra Club roda isolado num serviço FastAPI próprio (`scraper/`); o Node consome exclusivamente via HTTP, nunca `child_process` nem import cross-linguagem. Contratos exatos em `api-contracts.md`.
- **C-2:** nenhuma transposição de acordes é implementada localmente — delegada ao parâmetro de tom já suportado pela própria URL do Cifra Club, requisitado uma vez por tom (12x).
- **C-3:** os 12 tons são sempre nomeados/ordenados com sustenidos (C, C#, D, D#, E, F, F#, G, G#, A, A#, B), nunca bemóis, independente de como o Cifra Club exibe o tom na página de origem; o tom original é o que a URL sem parâmetro de tom retorna. A regra de sustenido vale só pra letra — qualidade maior/menor é preservada do tom declarado pelo Cifra Club (ex.: uma música em tom menor gera suas 12 versões como Cm, C#m, Dm...Bm, nunca forçada pra maior).
- **C-4:** exatamente um EPUB reflowable por música, com as 12 versões de tom como seções ligadas por links internos, abrindo na seção do tom original; PDF é excluído por não suportar navegação interna.
- **C-5:** o CSS do EPUB força fonte monoespacada (`white-space: pre` ou equivalente) em todo bloco de cifra, para não quebrar o alinhamento acorde-sobre-sílaba ao refluir; âncoras internas usam o nome do tom em sustenido como id (ex.: `#tom-C`, `#tom-Csharp`).
- **C-6:** a troca de tom ao vivo é resolvida só por navegação local dentro do EPUB já carregado; nenhum endpoint trata troca de tom como gatilho de rede — o pipeline completo só é acionado para uma música nova.
- **C-7:** fluxo de dependência unidirecional no backend: `routes → controllers → services → repositories/integrations`; `controllers` nunca acessam `repositories` ou `integrations` diretamente.
- **C-8:** todo corpo de requisição HTTP é validado por um schema Zod em `schemas/` antes de chegar ao controller.
- **C-9:** duas tabelas Postgres separadas (`musicas`, `envios`) relacionadas por `musica_id`; o status de envio é `varchar` validado por um enum Zod fixo na aplicação (`pendente | buscando | transpondo | gerando | enviando | concluido | erro`) — nunca enum nativo do Postgres nem vocabulário ad-hoc por camada. Modelo completo em `architecture-diagrams.md`.
- **C-10:** nem `musicas` nem `envios` armazenam a letra/cifra completa — só metadados; o conteúdo da cifra só existe em memória durante o pipeline e dentro do EPUB final entregue ao Kindle.
- **C-11:** o envio automatizado (CAP-4) só funciona depois que Thiago cadastra manualmente o e-mail remetente como Approved Sender na conta Amazon — passo de setup único, fora do controle do software.
- **C-12:** tablaturas (notação de riffs/solos) não são suportadas — apenas cifra no formato acorde-sobre-sílaba.
- **C-13:** Node.js >=22 e Express ^5.x são divergências conscientes das convenções dos projetos pessoais anteriores do autor (floor >=20 e Express 4) — ver `stack.md` para o porquê.
- **C-14:** o MVP roda inteiramente em localhost (notebook do autor), sem deploy em nuvem; os 4 serviços (Postgres, Express, Next.js, FastAPI) sobem juntos via `docker-compose.dev.yml`.
- **C-15:** o ciclo busca → transpõe → gera → envia deve completar em tempo hábil antes do evento (ensaio/culto/show); não há meta numérica de latência travada, porque a troca de tom ao vivo é resolvida localmente (C-6) e não depende deste ciclo.

## Non-goals

- **NG-1:** gestos customizados no Kindle via jailbreak/KUAL/KOReader.
- **NG-2:** qualquer interface interativa rodando dentro do próprio Kindle.
- **NG-3:** cálculo de transposição em tempo real dentro do Kindle (resolvido por navegação entre as 12 versões pré-geradas, ver CAP-2/CAP-3).
- **NG-4:** tablaturas (notação de riffs/solos).
- **NG-5:** múltiplos usuários, autenticação ou uso por terceiros — projeto estritamente solo.
- **NG-6:** redistribuição pública ou publicização do conteúdo coletado do Cifra Club.
- **NG-7:** agregação de coletâneas/listas do Cifra Club num único arquivo e navegação entre músicas de uma coletânea — adiado para Fase 2, fora deste MVP.

## Success signal

Thiago substitui de fato o processo manual atual pela ferramenta no uso real e recorrente — toda vez que for estudar ou tocar uma música, não apenas numa execução de prova de conceito. Contra-métrica: número de execuções da ferramenta não é, por si só, sinal de sucesso — uma sessão de testes gerando várias execuções não equivale a adoção real.

## Assumptions

- A versão exata do Uvicorn não foi verificada individualmente (assumida como a última estável compatível com FastAPI 0.163) — confirmar no `pip install` real antes de travar.

## Open Questions

- **OQ-3:** os termos de uso do Cifra Club não foram confirmados publicamente (`robots.txt` retornou 403 em tentativa automatizada). Recomenda-se checagem manual antes de travar ou ampliar a arquitetura de scraping além do uso pessoal atual.
