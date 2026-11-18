---
name: 'Review: Incompatibility / Interface-Gap Attack'
type: review
target: architecture-cifra-kindle-2026-11-17/ARCHITECTURE-SPINE.md
lens: adversarial — can independently-built units diverge while each obeys every written AD to the letter
created: '2026-11-17'
---

# Review: Incompatibility Attack on ARCHITECTURE-SPINE.md (cifra-kindle)

## Verdict

The spine correctly pins *who talks to whom* (process boundaries, layering, HTTP-only
cross-language calls, one EPUB per song) but it does **not** pin the actual *payload
contracts* that cross those boundaries. Every interface where two independently-built
units must agree on a wire format, a vocabulary, or a labeling rule is left to each
builder's private judgment: the FastAPI↔Node contract (shape, keying, ordering, the
12 toms), the "original key" decision, the `envios.status` vocabulary, the EPUB
anchor/key-naming scheme, and the FastAPI error contract on scrape failure. These are
not nitpicks — several of them map directly onto the PRD's own testable consequences
(FR-1's "distinct error message," FR-3's "opens on the original key"), so a spine that
leaves them unpinned creates a real, demonstrable risk that two compliant builders ship
components that cannot talk to each other, or that silently violate the PRD while each
AD is satisfied to the letter.

Below are 8 concrete incompatible-pair scenarios, roughly in order of how directly they
threaten FR-1/2/3/4's testable consequences.

---

## Finding 1 — No response schema for the 12 transposed versions (biggest hole)

**Where:** AD-2 ("cada uma das 12 versoes de tom e obtida requisitando a URL do Cifra
Club com o parametro de tom correspondente") and AD-1 ("integrations/ no Node consome
exclusivamente via HTTP"). Capability Map ties FR-2 entirely to `scraper/`.

**What's missing:** No endpoint path, no JSON field names, no example payload, no
`interfaces/` type definition is given anywhere in the spine for what FastAPI hands
back to Node for a scrape. Every one of these is left open:
- Is it one HTTP call that returns all 12 versions bundled, or 12 separate calls (Node
  looping, passing a `tom`/`nota` param each time) against a single-tom scrape
  endpoint?
- If bundled: is it an array (`versions: [...]`) or a map keyed by key name
  (`{"C": {...}, "C#": {...}}`)?
- Field names: `tom` vs `key` vs `nota`; `linhas`/`conteudo` vs `content`/`body`.

**Concrete incompatible pair:** Builder A (FastAPI) implements a single
`POST /scrape {url}` endpoint that internally loops all 12 Cifra Club URL variants and
returns `{"tom_original": "C", "versoes": {"C": "...", "C#": "...", ...}}`. Builder B
(Node `integrations/cifraClub`) — reading only AD-2's "cada uma das 12 versoes e obtida
requisitando a URL... com o parametro de tom correspondente" — reasonably concludes
*Node* is the one that must drive the 12-request loop, and builds a client that calls
`GET /scrape?url=...&tom=C`, `...&tom=C#`, etc., 12 times. Neither violates AD-1 or
AD-2's text. The result: Builder B's client sends a `tom` query param FastAPI's
single-shot endpoint ignores (or 404s on, since no such route exists), and the two
services cannot complete a single request between them — discovered only at
integration time, not from the spine.

---

## Finding 2 — Who decides and labels "the original key" is never pinned

**Where:** FR-2's testable consequence: "O Tom original da Cifra (como publicado no
Cifra Club) e identificavel como a versao de abertura." AD-7's `musicas.tom_original`
column. FR-3: "Ao abrir o Arquivo pronto, a versao exibida e a do Tom original."

**What's missing:** Nothing says *how* the original key is determined or communicated.
Is it: (a) an explicit field FastAPI returns (e.g. `tom_original: "G"`, detected from
the untransposed/default Cifra Club page before any `tom=` param is applied), or (b) an
implicit convention — "whichever version comes first in the returned list/array is the
original"?

**Concrete incompatible pair:** Builder A (FastAPI) always returns the 12 versions
sorted chromatically starting at C (C, C#, D, ... B) for cache-friendliness/determinism,
and separately includes a `tom_original` field. Builder B (Node/EPUB `services/`)
never reads that field and instead assumes — because nothing in the spine says
otherwise and "abre no Tom original" reads naturally as "the first one you get" —
that array index 0 is the original key, and uses it both to set `musicas.tom_original`
and to pick the EPUB's opening section. Every song whose original key isn't C now
silently opens on the wrong key and gets the wrong value persisted in the database —
a direct, silent violation of FR-2/FR-3's testable consequences, with both builders
having followed AD-2/AD-7 as literally written.

---

## Finding 3 — `envios.status`: AD-7 names the mechanism, never the vocabulary

**Where:** AD-7: "Status de envio e varchar validado por enum Zod na camada de
aplicacao, nao enum nativo do Postgres." Consistency Conventions table repeats "status
de envio como string validada." The memlog mentions "progresso do envio em andamento
(busca->transpoe->gera->envia)" and a polling `GET /envios/:id`.

**What's missing:** The actual enum values. Not one status string appears anywhere in
the spine, PRD, or memlog.

**Concrete incompatible pair:** Builder A (Node backend, owns the Zod schema) implements
a coarse terminal vocabulary: `{"pendente", "concluido", "falhou"}` — one row update at
the end of the pipeline. Builder B (Next.js frontend), building the "progresso" screen
the memlog explicitly promises (polling through busca→transpõe→gera→envia stages),
reasonably assumes a *granular*, stage-level vocabulary exists — e.g. it hardcodes a
switch statement expecting `"buscando" | "transpondo" | "gerando" | "enviando" |
"enviado" | "erro"` to render a progress bar. Both builders can point to AD-7 and claim
compliance ("it's a varchar validated by a Zod enum"), yet the frontend's progress UI
either throws on an unrecognized status or permanently shows a default/unknown state,
because the backend never emits the intermediate values the frontend was built to
expect — and there is no authoritative list either one could have checked against.
This is a direct threat to the "progresso de envio" capability the Capability Map
promises under AD-7.

---

## Finding 4 — EPUB internal anchor/key-naming scheme is asserted, not specified

**Where:** AD-3: "as 12 versoes de tom como secoes ligadas por links internos
(TOC/ancoras)." FR-3: "A partir de qualquer versao de Tom, um link interno permite
navegar para qualquer uma das outras 11 versoes."

**What's missing:** No anchor-ID convention (`#tom-C` vs `#key-1` vs a slug of a
Portuguese label), and — more importantly — no canonical spelling for the 12 chromatic
keys themselves (sharps-only `C, C#, D, D#, E, F, F#, G, G#, A, A#, B` vs the
mixed sharp/flat spelling Cifra Club's own UI commonly displays, e.g. `C, C#, D, Eb, E,
F, F#, G, G#, A, Bb, B`). Although FR-3/EPUB generation nominally lives entirely inside
Node `services/` (per the Capability Map), the *key labels themselves* originate from
FastAPI's scrape (Finding 1) and get threaded straight through into anchor IDs and
section headings.

**Concrete incompatible pair:** Builder A (FastAPI) returns Cifra Club's native,
enharmonic-mixed key spelling verbatim (because AD-2 says "nenhuma logica de
transposicao... e implementada localmente," which a literal reading extends to "don't
even normalize the label — just mirror whatever Cifra Club's `tom` selector returns").
Builder B (Node EPUB generator) independently decided its anchor scheme would be
`#tom-{sharp-letter}` built from a hardcoded sharps-only array of 12 keys, used both to
generate anchors and to validate "did we get exactly 12 distinct keys back." When
FastAPI's labels include `Bb`/`Eb`, Builder B's generator either fails its own
12-key completeness check (treats `Bb` as a 13th/unexpected key, or fails to match it
against the sharps array it expected) or silently produces a mismatched anchor (`#tom-
Bb` is never linked to by any TOC entry built from the sharps array) — breaking "navegar
para qualquer uma das outras 11 versoes" for at least one key, for a reason invisible to
either builder individually.

---

## Finding 5 — FastAPI error contract on scrape failure / song-not-found is unspecified

**Where:** FR-1's testable consequence: "Se a musica nao for encontrada, o sistema
retorna uma mensagem de erro distinta indicando que a busca falhou." Consistency
Conventions table pins Node's *own* HTTP error shape (`{ error: string }`) but that
convention is stated for Express endpoints, not for what FastAPI sends Node.

**What's missing:** HTTP status code (404? 422? 200 with an error body?) and body shape
FastAPI uses for (a) song not found vs (b) scrape/parse failure (site structure changed,
Cifra Club blocked the request, one of the 12 per-key fetches failed mid-batch). AD-1
only says the boundary is HTTP; it says nothing about the error vocabulary crossing it.

**Concrete incompatible pair:** Builder A (FastAPI), using default FastAPI exception
handling, returns `404 {"detail": "Música não encontrada"}` (FastAPI's default error
key is `detail`, not `error`). Builder B (Node `integrations/cifraClub`), having just
built every *Express* error response as `{ error: string }` per the spine's own
Consistency Conventions, writes the FastAPI client to read `response.data.error` and
treats a missing field as a generic failure, surfacing a generic 500 "erro interno" to
the frontend instead of the FR-1-mandated distinct "song not found" message. FR-1's
explicit testable consequence ("nunca... silencio sem explicacao") is violated even
though Builder A's FastAPI code and Builder B's Node code each independently satisfy
every literal rule stated for their own layer.

A second, unaddressed sub-case: **partial failure**. AD-2 implies 12 independent
per-key fetches happen somewhere. Nothing says whether FastAPI (or Node, depending on
Finding 1's resolution) must treat "10 of 12 keys scraped, 2 timed out" as a total
failure or a partial success to report. A builder could return a short list silently;
a consumer expecting exactly-12 could `undefined`-crash or silently ship an 11-key,
unnavigable-on-one-link EPUB — again contradicting FR-3's "todas as 12 versoes."

---

## Finding 6 — Name-search flow (FR-1's "ou colar o link") has no owner

**Where:** FR-1: "Thiago pode informar o nome de uma musica (ou colar o link da musica
no Cifra Club)." Structural Seed's `scraper/` and `integrations/cifraClub/` are the only
candidates; neither is described as exposing a name→URL search capability.

**What's missing:** Resolving a free-text song name to a canonical Cifra Club URL
(presumably via Cifra Club's own search) is a distinct capability from scraping a known
URL, and nothing in the spine assigns it to either side of the Python/Node boundary.

**Concrete incompatible pair:** Builder A (FastAPI) builds only a
`scrape(url) -> versions` endpoint, assuming Node already resolved any song name to a
URL before calling it (since `integrations/cifraClub/` is described as "cliente HTTP
for the scraping FastAPI," implying Node drives it with a ready URL). Builder B (Node),
reading the same text, assumes the opposite — that passing a bare song name through to
FastAPI is fine because FastAPI "owns scraping of Cifra Club" broadly per AD-1's intent.
Neither builder implements search-by-name at all, or both do (duplicated, possibly
divergent search logic, one hitting Cifra Club's search page from Python, one from
Node), and FR-1's name-search path is either missing or implemented twice with
different matching/ranking behavior — undetectable from the spine alone.

---

## Finding 7 — `musicas.tom_original` storage format vs. display format

**Where:** AD-7's ER diagram: `musicas.tom_original varchar`. Consistency Conventions:
no format rule given beyond "ids uuid; timestamps timestamptz."

**What's missing:** Whether the stored/transmitted key label is letter-name
(`"C"`/`"C#"`) or the Portuguese solfège Cifra Club sometimes surfaces in its UI
(`"Dó"`, `"Ré"`, `"Mi"`), and whether sharps or flats are canonical. This compounds
Finding 4 (anchor naming) but is a separate risk: it affects what the **frontend**
displays in history (`apps/web` lists past `musicas`/`envios`) versus what scraper and
EPUB generator produce internally.

**Concrete incompatible pair:** Builder A (FastAPI/Node pipeline) stores `"C#"` (letter
name) in `musicas.tom_original`. Builder C (Next.js frontend), built from the PRD's
Portuguese-language glossary (§3 defines "Tom" and uses Portuguese throughout) without
ever seeing a worked example, renders a key-selector UI using Portuguese solfège labels
("Dó#") that it generates by its own guessed mapping table — now any key comparison the
frontend does against the raw `tom_original` string from the API (e.g., highlighting
"you're viewing the original key") fails string equality, because the two sides never
agreed on a canonical label vocabulary and the spine never wrote one down.

---

## Finding 8 — "12 chromatic keys" has two unaddressed enharmonic conventions, and no one owns the canonical list

**Where:** AD-2 and FR-2 both assert "12 tons cromaticos" without ever writing out
what those 12 strings are.

**What's missing:** A literal, ordered list of the 12 key-parameter values to request
from Cifra Club (this is also entangled with Finding 1 — who drives the loop — and
Finding 4 — how labels are spelled). Cifra Club's actual URL parameter format for key
selection is never pinned in the spine (nor resolved in the addendum, which flags this
exact scraping surface as researched only at the "projects exist" level, not at the
parameter-format level).

**Concrete incompatible pair:** Builder A assumes the 12-key loop parameter is a
simple semitone offset (`?semitom=0..11` relative to the detected original), computed
and applied by FastAPI itself. Builder B assumes (per AD-2's literal text, "requisitando
a URL... com o parametro de tom correspondente") that the caller must supply Cifra
Club's actual key-letter param (e.g. `?tom=F#`) directly, twelve times, one per
absolute key. If FastAPI implements the first interpretation and Node's client is
built for the second (or vice versa), every scrape either 404s, silently resolves to
the wrong key, or (worst case) "succeeds" by returning 12 versions that are actually
12 copies of the same key reached via a no-op/misunderstood parameter — a failure mode
that could pass a shallow smoke test ("we got 12 responses back") while completely
failing FR-2's actual requirement.

---

## Minor / honorable mentions (not written up as full scenarios)

- AD-5's "so services/ chama integrations/" is clean and leaves little room for
  divergence — no finding here.
- AD-4 (no network trigger on live key-change) is unambiguous and enforceable from the
  text alone — no finding here.
- The Consistency Conventions table's `{ error: string }` rule is fine for Express's
  *own* API surface; the gap is only that it's never extended to (or explicitly
  excluded from) the FastAPI boundary, which is what Finding 5 exploits.

## Overall assessment

For a solo-hobby MVP spine this short, the structural/process-boundary decisions (AD-1,
AD-3 through AD-6) are genuinely tight. But every finding above sits at exactly the
seam the task asked about: a *cross-component wire contract* that the spine gestures at
("via HTTP," "varchar validated by Zod enum," "ancoras," "mensagem de erro distinta")
without ever writing down the actual values, field names, or ownership that would make
two independent implementations interoperate by construction rather than by luck. Of
the eight, Findings 1, 2, 3, and 5 are the most load-bearing because they each map onto
an explicit FR testable consequence (FR-1's distinct error, FR-2/FR-3's original-key
labeling, the progress/history capability under AD-7) — meaning the spine as written
permits a fully-compliant build that still fails its own PRD's acceptance criteria.
