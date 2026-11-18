---
title: Adaptador de Cifras para Kindle
status: final
created: 2026-11-15
updated: 2026-11-15
---

# Product Brief: Adaptador de Cifras para Kindle

## Resumo Executivo

Hoje, levar uma cifra para o Kindle é um processo manual e chato: abrir o Cifra Club no navegador, copiar/printar, ajustar o tom na mão, converter para um formato legível, enviar para o dispositivo. Este projeto automatiza essa cadeia inteira para uso pessoal: você escolhe a música e o tom desejado, e a ferramenta busca a cifra, transpõe, gera um arquivo pronto para leitura no Kindle e envia automaticamente — sem passar pelo navegador nem por conversão manual.

A versão completa da ideia inclui três capacidades: (1) envio automatizado de uma cifra já no tom certo, (2) agregação de coletâneas do Cifra Club em um único arquivo, e (3) navegação dentro desse arquivo pensada para a leitura ao vivo (ex: ensaio, culto, apresentação) — pular entre partes da mesma música e entre músicas de uma coletânea sem precisar desbloquear o dispositivo ou sair do modo leitura.

Este é um projeto pessoal (só para uso do próprio Thiago, por ora), sem prazo fixo, com potencial de evoluir depois para portfólio.

## O Problema

Quem estuda ou toca música usando cifras do Cifra Club normalmente lê pelo celular ou pelo computador. Isso tem custos reais: tela pequena ou luz de tela ligada por longos períodos (ensaio, estudo, apresentação), nenhuma forma fácil de levar uma cifra já no tom que o instrumento/voz pede, e nenhuma forma de levar uma lista inteira de músicas (um repertório) como um único material de leitura.

O processo manual hoje é: abrir o site, copiar ou tirar print da cifra, ajustar o tom "na mão" (mentalmente ou reescrevendo os acordes), converter para algum formato legível, e enviar para o Kindle — repetindo isso para cada música. É lento, propenso a erro na hora de transpor, e não escala para uma lista de músicas.

## A Solução

Uma ferramenta pessoal (CLI ou app simples) que automatiza a cadeia "cifra → tom certo → arquivo pronto → Kindle":

1. **Envio automatizado com tom ajustado.** O usuário informa a música e o tom desejado numa interface antes do envio; a ferramenta busca a cifra, transpõe os acordes automaticamente e envia o arquivo já pronto para o Kindle (via Send-to-Kindle, automatizado por e-mail/SMTP). Não há nenhum ajuste "ao vivo" dentro do Kindle — o tom é decidido antes de enviar, e reenviar com outro tom é uma operação rápida, sem passos manuais adicionais.
2. **Coletâneas em um arquivo só.** Listas do Cifra Club (repertórios) são convertidas em um único arquivo (EPUB) reunindo várias músicas, em vez de um envio por música.
3. **Navegação por toque em links internos.** Dentro desse arquivo, links internos permitem pular entre partes da mesma música (ex: "ir para o refrão") e entre músicas de uma coletânea (ex: sumário → próxima música). Essa decisão substitui a ideia original de "gestos físicos diferenciados" (swipe para baixo vs. swipe lateral), que **não é possível em um Kindle de fábrica** — ver `addendum.md` para o detalhe da pesquisa que levou a essa mudança.

## Quem Isso Serve

Só o próprio Thiago, por enquanto — estudante de ADS que usa cifras para estudo/prática musical e quer substituir o processo manual atual por um fluxo automatizado. Não há personas externas neste momento; se o projeto crescer para outros usuários (colegas, portfólio), isso será revisitado como uma mudança de escopo, não uma suposição antecipada.

## Critérios de Sucesso

O MVP é bem-sucedido se passar a ser **usado de forma real e recorrente** — ou seja, se Thiago de fato substituir o processo manual atual por essa ferramenta no seu dia a dia (toda vez que for estudar ou tocar uma música), em vez de funcionar apenas uma vez como prova de conceito.

## Escopo

**Dentro do MVP (primeiro recorte):**
- Buscar uma cifra do Cifra Club a partir de uma música informada.
- Transpor os acordes para o tom escolhido antes do envio.
- Gerar um arquivo (formato a confirmar na arquitetura — ver Riscos) e enviar automaticamente para o Kindle via Send-to-Kindle.

**Fora do MVP, para uma fase posterior:**
- Agregação de coletâneas/listas do Cifra Club em um único arquivo.
- Navegação por links internos entre partes da música e entre músicas da coletânea (depende da fase anterior).

**Explicitamente fora de escopo (não faz parte da visão deste projeto, pelo menos por agora):**
- Gestos customizados no Kindle via jailbreak/KOReader — rejeitado por fragilidade (depende de brechas de firmware que a Amazon corrige) e por não ser necessário dado o caminho de links internos.
- Qualquer interface interativa rodando dentro do próprio Kindle (o dispositivo não suporta isso nativamente).
- Múltiplos usuários, autenticação, ou uso por terceiros.
- Redistribuição pública do conteúdo coletado do Cifra Club (uso é pessoal).

## Restrições e Riscos Técnicos Conhecidos

- **Cifra Club bloqueia acesso automatizado ao `robots.txt`** (retornou 403 na pesquisa) — não há termos de uso públicos confirmados sobre scraping, mas existem projetos open-source conhecidos fazendo isso (ex: `code4music/cifraclub-api`) sem histórico de problema legal para uso pessoal. Risco baixo para uso pessoal; redistribuição seria mais sensível.
- **Formato do arquivo final ainda é uma decisão aberta de arquitetura**: PDF com fonte fixa preserva melhor o alinhamento acorde-sobre-sílaba das cifras, mas EPUB reflowable é o que habilita os links internos de navegação da Fase 2. Pode ser necessário usar EPUB com fonte monoespaçada forçada via CSS para ter os dois benefícios — isso precisa ser validado tecnicamente antes de travar a decisão.
- **Envio automatizado depende de configuração manual única**: o e-mail remetente da automação precisa ser cadastrado como "approved sender" na conta Amazon do usuário (até 15 endereços permitidos) — não é algo que o software resolve por si só.
- Detalhes completos da pesquisa que fundamentou essas restrições estão em `addendum.md`.

## Visão

Se isso funcionar bem no uso pessoal, o próximo passo natural seria estender para coletâneas (Fase 2) e, mais adiante, considerar se outras pessoas (colegas de banda, de igreja, de curso) teriam uso real para a mesma ferramenta — nesse caso, provavelmente como um projeto de portfólio do curso de ADS, com os requisitos de usabilidade multiusuário que isso implicaria. Isso não é um compromisso do MVP, apenas a direção em que o projeto pode crescer.
