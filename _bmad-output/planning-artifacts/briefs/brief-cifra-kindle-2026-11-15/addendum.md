# Addendum — Adaptador de Cifras para Kindle

Detalhe técnico e alternativas descartadas que não entraram no corpo do brief, mas são úteis para a próxima fase (PRD / arquitetura).

## Pesquisa: envio automatizado para Kindle

- Não existe API pública da Amazon para Send-to-Kindle. O mecanismo oficial é e-mail (`@kindle.com`) ou upload manual.
- Automação via script é viável simulando o envio por e-mail (SMTP). Bibliotecas de referência: `send2kindle` (PyPI), `KindlePy` (GitHub: cbdavide/KindlePy). Também existem MCP servers equivalentes ("send-to-kindle-mcp").
- Pré-requisito: o e-mail remetente da automação precisa estar na lista de "approved senders" da conta Amazon (até 15 endereços).
- Formatos aceitos por e-mail: PDF, EPUB, HTML, RTF, TXT, DOC/DOCX, imagens (MOBI/AZW em dispositivos mais antigos). Limite: até 25 anexos por e-mail, mensagem ≤ 50MB (upload direto pelo site permite até 200MB).
- PDF não reflui (bom para preservar alinhamento acorde/letra, ruim para zoom em tela pequena). EPUB reflui (bom para texto corrido e para links internos, mas quebra alinhamento de colunas a menos que se force o uso de fonte monoespaçada via CSS `white-space: pre`).

Fontes: send2kindle (PyPI), KindlePy (GitHub), Send to Kindle MCP Server (glama.ai), páginas de ajuda da Amazon sobre Send to Kindle, GSMArena (upload de EPUB por e-mail), Kindlepreneur (comparação EPUB vs MOBI vs PDF).

## Pesquisa: navegação/gestos no Kindle

- **Rejeitado**: gestos customizados (diferenciar swipe lateral de swipe para baixo) não existem no firmware oficial da Amazon — nenhuma API ou configuração exposta para isso em conteúdo de terceiros.
- **Rejeitado**: jailbreak + KUAL + KOReader permite um "Gesture Manager" rico (200+ ações mapeáveis), mas foi descartado por depender de brechas de firmware específicas por modelo/versão que a Amazon costuma corrigir — não é uma base estável para manter o projeto funcionando ao longo do tempo. Há também relatos de limitações mesmo dentro do KOReader (ex: swipe horizontal no centro da tela nem sempre remapeável).
- **Adotado**: links internos de hipertexto (TOC/âncoras) dentro de um EPUB reflowable. É um recurso padrão suportado nativamente pela Amazon (inclusive citado nas diretrizes do KDP). Ressalva importante: a documentação da Amazon indica que livros EPUB **fixed-layout** não suportam links internos no dispositivo — por isso o EPUB usado neste projeto precisa ser reflowable, não fixed-layout.

Fontes: Amazon KDP Guidelines (links internos), BookFusion Docs (KOReader Gestures), MobileRead Forums (limitações de gesture manager; links quebrando entre Kindle Previewer e Calibre), AndroidAuthority (razões para jailbreak).

## Pesquisa: Cifra Club — scraping/automação

- `cifraclub.com.br/robots.txt` retornou 403 na tentativa de acesso automatizado — indício de postura restritiva a bots. Isso não confirma os termos de uso exatos, que não foram encontrados nas buscas feitas; recomenda-se checar manualmente antes de travar a arquitetura.
- Projetos open-source conhecidos fazendo scraping do Cifra Club, sem registro de ação legal encontrado:
  - `code4music/cifraclub-api` (GitHub, ~96 estrelas) — API REST para cifras do Cifra Club. Última atualização fev/2023 (parado, mas referência útil).
  - `r-music/chorrrds` (pacote R no CRAN) — `get_chords()` faz scraping do Cifra Club via `xml2`.
  - `otacilion/arduino-tablature` (Node.js) e `TabBrasil` (PyPI) — exemplos adicionais de scraping do mesmo site.
- Avaliação de risco: conteúdo (letra/cifra) é protegido por direito autoral da composição musical; uso pessoal/privado tende a ser de baixo risco prático. Redistribuir ou publicizar o conteúdo coletado seria mais sensível — por isso ficou fora de escopo (ver seção "Explicitamente fora de escopo" no brief).

Fontes: code4music/cifraclub-api (GitHub), r-music/chorrrds (GitHub + r-music.rbind.io), otacilion/arduino-tablature (GitHub), TabBrasil (PyPI), iubenda (legalidade de web scraping).

## Alternativas descartadas (resumo de decisão)

| Alternativa | Por que foi descartada |
|---|---|
| Gestos customizados via jailbreak + KOReader | Instável a longo prazo (depende de brechas que a Amazon corrige); maior complexidade de manutenção do que o valor ganho frente à alternativa de links internos. |
| Múltiplas versões de tom bundladas no mesmo arquivo | Multiplica o tamanho do arquivo por N tons e a complexidade de geração; o benefício (trocar tom sem reenviar) é parcialmente coberto pelo fato de o reenvio já ser automatizado e rápido. Pode ser revisitado como incremento futuro para músicas específicas. |
| Coletâneas e navegação no MVP inicial | Não foi descartada, e sim adiada: o usuário priorizou o envio automatizado de uma única cifra como o recorte mínimo que já traz valor real, e coletâneas ficaram para a Fase 2. |
