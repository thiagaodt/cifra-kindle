---
title: Adaptador de Cifras para Kindle
status: final
created: 2026-11-15
updated: 2026-11-17
---

# PRD: Adaptador de Cifras para Kindle

## 0. Propósito do Documento

Este PRD descreve o MVP do Adaptador de Cifras para Kindle: um projeto pessoal e solo de Thiago, sem prazo fixo. Ele parte do `brief.md` e `addendum.md` já finalizados (pesquisa técnica sobre Send-to-Kindle, navegação em EPUB e scraping do Cifra Club vive no addendum do brief, não é repetida aqui). O documento usa o vocabulário do Glossário (§3) de forma consistente; FRs são numeradas globalmente (FR-N) para servirem de referência estável para arquitetura e stories. Dado o escopo hobby, não há seção de User Journeys — o JTBD (§2.1) já captura o cenário de uso com a especificidade necessária.

## 1. Visão

Hoje, levar uma cifra para o Kindle é manual: abrir o Cifra Club, copiar ou tirar print, ajustar o tom na mão, converter para um formato legível e enviar para o dispositivo — repetindo isso a cada música. O Adaptador de Cifras para Kindle automatiza essa cadeia inteira para uso pessoal: Thiago informa a música, e a ferramenta busca a cifra no Cifra Club, transpõe automaticamente para todos os tons, gera um arquivo pronto para leitura — já navegável entre os tons — e envia para o Kindle via Send-to-Kindle, sem navegador, sem conversão manual e sem precisar reenviar nada quando o tom muda ao vivo.

O recorte deste MVP é deliberadamente estreito: apenas o envio automatizado de uma única cifra já no tom certo. Agregação de coletâneas e navegação por links internos entre músicas (a visão completa descrita no brief) ficam para uma fase posterior, condicionadas ao MVP comprovar valor no uso real.

Sucesso aqui não é a ferramenta funcionar uma vez como prova de conceito — é Thiago de fato substituir o processo manual atual por ela, toda vez que for estudar ou tocar uma música.

## 2. Usuário-Alvo

### 2.1 Jobs To Be Done

- Como estudante de ADS que usa cifras para estudo e prática musical, quero obter uma cifra já no tom certo no meu Kindle sem passar pelo processo manual de copiar/ajustar/converter, para estudar com menos fricção e sem depender de tela de celular ou computador.
- **Cenário crítico confirmado:** em culto, ensaio ou apresentação, o tom de uma música muda de última hora. Como o Arquivo pronto já contém todos os 12 tons cromáticos, navegáveis por link interno, essa troca é resolvida localmente no próprio Kindle, sem depender do notebook ou de reenvio durante o evento — é o JTBD que mais justifica o mecanismo de múltiplos tons (ver FR-2/FR-3 em §4.1).
- Cálculo de transposição em tempo real dentro do Kindle está fora deste job — o dispositivo não suporta isso nativamente. Mas a troca de Tom ao vivo em si *é* resolvida por este projeto: navegando entre as versões já pré-geradas no mesmo arquivo, não por cálculo feito no momento.

*Não há personas externas — uso é solo (entry point Visão+Features, decisão registrada no memlog).*

## 3. Glossário

- **Cifra** — Letra de uma música com os acordes indicados sobre a sílaba onde devem ser tocados. Fonte: Cifra Club.
- **Tom** — A tonalidade musical em que os acordes de uma cifra estão escritos; transpor significa recalcular os acordes para outro Tom mantendo a relação harmônica.
- **Cifra Club** — Site de origem das cifras buscadas por este projeto (cifraclub.com.br).
- **Kindle** — Dispositivo de leitura de destino dos arquivos gerados por este projeto.
- **Send-to-Kindle** — Mecanismo oficial da Amazon para enviar arquivos ao Kindle por e-mail (endereço `@kindle.com`) ou upload manual. Este projeto automatiza a via e-mail/SMTP.
- **Approved Sender** — Endereço de e-mail cadastrado na conta Amazon do usuário como autorizado a enviar arquivos via Send-to-Kindle (limite de até 15 endereços). Ver §5 sobre o pré-requisito de configuração.
- **Arquivo pronto** — O arquivo final gerado pelo projeto: um EPUB reflowable contendo a Cifra buscada já transposta nos 12 tons cromáticos, navegável por links internos entre as versões, abrindo no Tom original. Pronto para envio via Send-to-Kindle sem edição adicional.

## 4. Features

### 4.1 Envio Automatizado de Cifra com Tons Navegáveis

**Descrição:** a interface pela qual Thiago informa a música (CLI ou app simples) não é travada neste PRD. O Arquivo pronto gerado por FR-3 contém a Cifra em todos os 12 tons cromáticos, navegáveis por links internos, abrindo no Tom original da Cifra. A troca de Tom "ao vivo" (culto/show com mudança de última hora) é resolvida por navegação local dentro do próprio arquivo já carregado no Kindle — não por reenvio. O reenvio automatizado (FR-4) cobre o cenário de trocar de música, decidido antes do evento, não o de trocar de Tom durante o evento. O mecanismo de transposição reaproveita o parâmetro de tom já suportado pela própria URL do Cifra Club, uma busca por tom, repetida para os 12 tons (decisão de arquitetura).

**Requisitos Funcionais:**

#### FR-1: Buscar cifra por música informada

Thiago pode informar o nome de uma música (ou colar o link da música no Cifra Club) e a ferramenta busca a Cifra correspondente.

**Consequências (testáveis):**
- Dado um nome de música existente no Cifra Club, o sistema retorna a Cifra correspondente (letra + acordes).
- Se a música não for encontrada, o sistema retorna uma mensagem de erro distinta indicando que a busca falhou — nunca um arquivo vazio, incorreto ou silêncio sem explicação.

#### FR-2: Transpor para todos os Tons

A ferramenta transpõe os acordes da Cifra buscada automaticamente para os 12 tons cromáticos possíveis, não apenas um Tom escolhido manualmente.

**Consequências (testáveis):**
- O Arquivo pronto gerado contém as 12 versões transpostas da Cifra, cada uma preservando a relação harmônica original.
- O Tom original da Cifra (como publicado no Cifra Club) é identificável como a versão de abertura do Arquivo pronto (ver FR-3).

#### FR-3: Gerar Arquivo pronto

O sistema gera um único Arquivo pronto em EPUB reflowable, reunindo as 12 versões de Tom da Cifra buscada, conectadas por links internos de navegação, em formato aceito por Send-to-Kindle.

**Consequências (testáveis):**
- O Arquivo pronto abre corretamente no Kindle sem exigir edição ou conversão manual adicional.
- Ao abrir o Arquivo pronto, a versão exibida é a do Tom original da Cifra.
- A partir de qualquer versão de Tom, um link interno permite navegar para qualquer uma das outras 11 versões, sem precisar reenviar ou sair do arquivo.
- O alinhamento acorde-sobre-sílaba da Cifra é preservado de forma legível em cada versão de Tom do Arquivo pronto.

**Out of Scope:** Tablaturas (riffs/solos em notação de tablatura) não são suportadas — apenas Cifra no formato acorde-sobre-sílaba.

#### FR-4: Enviar automaticamente para o Kindle

O sistema envia o Arquivo pronto automaticamente para o Kindle via Send-to-Kindle (e-mail/SMTP), sem intervenção manual de Thiago além de informar a música buscada.

**Consequências (testáveis):**
- O Arquivo pronto chega na biblioteca do Kindle sem passos manuais além dos de FR-1/FR-2/FR-3.
- Trocar de música é uma repetição do mesmo fluxo automatizado; trocar de Tom durante um evento não depende deste fluxo (ver FR-3).

**Feature-specific NFRs:**
- **Tempo de geração:** o ciclo busca → transpõe (12 tons) → gera EPUB → envia deve completar em tempo hábil antes do evento (ensaio, culto, apresentação). Sem meta numérica travada — a troca de Tom durante o evento não depende deste ciclo (ver acima), então não há pressão de latência ao vivo sobre ele.

**Notes:**
- `[NOTE FOR PM]` Pré-requisito único: Approved Sender configurado — ver §5.

## 5. Restrições e Guardrails

- **Legal/scraping:** `cifraclub.com.br/robots.txt` retornou 403 em tentativa de acesso automatizado — postura restritiva a bots, mas sem termos de uso públicos confirmados sobre scraping. Avaliação de risco (detalhada no addendum do brief): uso pessoal/privado do conteúdo tem risco baixo; redistribuição pública seria mais sensível e está fora de escopo (§6). Recomenda-se checagem manual dos termos antes de travar a arquitetura de scraping (ver OQ-3).
- **Configuração de conta Amazon:** o envio automatizado só funciona depois que Thiago cadastra manualmente o e-mail remetente como Approved Sender — é um passo de setup único, fora do controle do software.
- **Direitos autorais do conteúdo:** letra/cifra são protegidas por direito autoral da composição; por isso este projeto não redistribui nem publiciza conteúdo coletado (ver §6).

## 6. Non-Goals (Explícito)

- Gestos customizados no Kindle via jailbreak/KUAL/KOReader — rejeitados por depender de brechas de firmware que a Amazon tende a corrigir (detalhe da pesquisa no addendum do brief).
- Qualquer interface interativa rodando dentro do próprio Kindle — o dispositivo não suporta isso nativamente.
- Cálculo de transposição em tempo real dentro do Kindle — o dispositivo não suporta isso. A troca de Tom ao vivo é resolvida por navegação entre as 12 versões pré-geradas (ver §4.1/FR-2/FR-3), não por cálculo feito no momento.
- Tablaturas (notação de riffs/solos) — fora de escopo por poluição visual e complexidade de formatação responsiva no Kindle.
- Múltiplos usuários, autenticação ou uso por terceiros — projeto é estritamente solo.
- Redistribuição pública ou publicização do conteúdo coletado do Cifra Club — uso é estritamente pessoal.

## 7. Escopo do MVP

### 7.1 Dentro do MVP

Todo o conteúdo de §4 (FR-1 a FR-4) está dentro do MVP — é a única feature do projeto.

### 7.2 Fora do MVP (fase posterior)

- Agregação de coletâneas/listas do Cifra Club em um único arquivo — adiada para Fase 2, não descartada.
- Navegação por links internos entre partes da música e entre músicas da coletânea — depende da fase anterior, também Fase 2.

## 8. Métricas de Sucesso

**Primária**
- **SM-1:** Thiago substitui o processo manual atual pela ferramenta no uso real e recorrente (toda vez que for estudar ou tocar uma música), não apenas uma execução de prova de conceito. Valida FR-1 a FR-4.

**Contra-métrica (não otimizar)**
- **SM-C1:** Número de vezes que a ferramenta é executada não é, por si só, sinal de sucesso — uma única sessão de testes gerando várias execuções não equivale a adoção real. O que importa é uso recorrente *em vez do* processo manual, não volume de execuções.

## 9. Open Questions

1. **OQ-3 — Termos de uso do Cifra Club:** `robots.txt` bloqueado (403) e termos de uso não confirmados publicamente; recomenda-se checagem manual antes de travar a arquitetura de scraping.

_OQ-1 (formato do Arquivo pronto), OQ-2 (mecanismo de transposição) e OQ-4 (meta de latência) foram resolvidas na fase de arquitetura — ver §4.1/FR-2/FR-3/FR-4. Numeração mantida estável; os IDs resolvidos não são reaproveitados. Histórico da decisão no `.memlog.md` da arquitetura._

## 10. Índice de Assumptions

Nenhuma. Decisões deliberadamente deixadas abertas (mecanismo de transposição, formato do arquivo, meta de latência) estão registradas como Open Questions (§9), não como assumptions inferidas.
