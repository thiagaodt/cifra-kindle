# Diagramas de Arquitetura — Adaptador de Cifras para Kindle

## Pipeline em camadas

```mermaid
graph LR
  Web["apps/web (Next.js)"] --> Routes["routes/"]
  Routes --> Controllers["controllers/"]
  Controllers --> Services["services/"]
  Services --> Repositories["repositories/"]
  Services --> Integrations["integrations/"]
  Repositories --> DB[("Postgres")]
  Integrations --> FastAPI["FastAPI (scraper/)"]
  Integrations --> SMTP["SMTP (Send-to-Kindle)"]
  FastAPI --> CifraClub["Cifra Club (externo)"]
```

## Topologia de ambiente (dev local)

```mermaid
graph TB
  subgraph Notebook["Notebook do Thiago (localhost)"]
    Next["Next.js :3010"]
    Express["Express API :3333"]
    FastAPI["FastAPI scraper :8000"]
    PG[("Postgres :5433 - Docker")]
  end
  Kindle["Kindle"]
  CifraClubSite["cifraclub.com.br"]
  Next --> Express
  Express --> PG
  Express --> FastAPI
  FastAPI --> CifraClubSite
  Express -. SMTP .-> Kindle
```

## Modelo de dados

```mermaid
erDiagram
  musicas {
    uuid id PK
    text nome
    text cifra_club_url
    varchar tom_original
    timestamp criado_em
  }
  envios {
    uuid id PK
    uuid musica_id FK
    varchar status
    text erro_mensagem
    timestamp enviado_em
    timestamp criado_em
    timestamp atualizado_em
  }
  musicas ||--o{ envios : gera
```

`musicas` guarda o que foi buscado (deduplicado pela URL do Cifra Club); `envios` guarda cada execução do pipeline — alimenta o histórico e o progresso na UI (ver Constraints C-9/C-10 e `api-contracts.md`).
