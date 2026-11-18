# Notas de workflow de desenvolvimento — Claude x Antigravity

> Nota de processo (não é parte do produto): como delegar tarefas de implementação entre modelos Claude (no Claude Code) e Google Antigravity, visando economia de token, velocidade e revisão cruzada. Levantado em conversa em 2026-11-15; pesquisar de novo antes de confiar nos preços/tiers, pois esse espaço muda rápido.

## Claude (Claude Code)

| Modelo | Preço (in/out por MTok) | Uso recomendado |
|---|---|---|
| Opus 5.5 | $4 / $20 | Decisões de arquitetura, julgamento em ambiguidade, revisão de correção/segurança. Baixo volume. |
| Sonnet 5.5 | $2 / $10 | Implementação do dia a dia (scraper, motor de transposição, gerador de EPUB, CLI). Cavalo de batalha. |
| Haiku 5.5 | $0.10 / $0.50 | Tarefas repetitivas em volume (testes em lote, limpeza de texto raspado, refactors mecânicos). Maior alavanca de economia. |

## Google Antigravity

Hierarquia de modelos (Gemini 4, confirmada em busca de 2026-11-15):

- **Hydrogen** — modelo padrão, rápido, selecionado por default. Equivalente ao papel do Sonnet no Claude.
- **Carbon** + `/swarm` — o mais capaz, multi-agente para tarefas de engenharia grandes. Só Google AI Ultra. Equivalente ao papel do Opus.
- **Argon** — frontier anterior ao Carbon, foco em engenharia complexa. Pro/Ultra.
- **Orchestrator** — roteia automaticamente entre Hydrogen/Carbon por trás de um prompt único. Ultra.

Ponto forte diferencial do Antigravity: controle de navegador nativo e orquestração assíncrona de múltiplos agentes (roda em paralelo enquanto você segue trabalhando em outro lugar).

## Matriz de delegação para o cifra-kindle

| Tarefa | Ferramenta/modelo | Por quê |
|---|---|---|
| Arquitetura (formato EPUB vs PDF, estrutura dos links internos, parsing de acordes) | Claude Opus 5.5 | Julgamento em ambiguidade, baixo volume. |
| Implementação (scraper, transposição, gerador EPUB, CLI) | Claude Sonnet 5.5 | Segue spec bem, custo moderado. |
| Tarefas repetitivas em volume (testes, limpeza de dados, refactors mecânicos) | Claude Haiku 5.5 | Maior economia de token. |
| Exploração/validação de scraping contra o DOM real do Cifra Club; verificação visual do EPUB renderizado | Antigravity — Gemini 4 Hydrogen | Controle de navegador nativo; tarefa de verificação, não decisão complexa. |
| Tarefa de engenharia grande/multi-módulo (ex: se a Fase 2 de coletâneas crescer bastante) | Antigravity — Gemini 4 Carbon + `/swarm` | Só vale o custo (Ultra) se a tarefa for grande de verdade. |
| Revisão de código — correção/segurança | Claude (`/code-review`) | Reputação mais forte hoje em revisão de código. |
| Revisão ponta a ponta (o fluxo funciona de verdade? o arquivo chega certo no Kindle?) | Antigravity | Fecha o loop com verificação visual/comportamental real. |

**Regra central:** quem implementa não deveria ser o único a revisar — Claude e Gemini têm pontos cegos diferentes. Padrão: Claude implementa e revisa código → Antigravity verifica comportamento real (browser/visual).

**Para o estágio atual do projeto (MVP, pessoal, sem prazo):** Hydrogen no Antigravity + Sonnet 5.5 no Claude Code cobre a maior parte do volume; Carbon/swarm e Opus 5.5 ficam reservados para decisões pontuais difíceis.
