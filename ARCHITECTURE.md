# Equity Space Graph — evidence-led investigation architecture

## Objective

Turn any public or private company name into a queryable, multi-hop economic graph whose edges are attributable claims rather than visual associations. A graph edge is publishable only when its direction, relationship type, economic mechanism, time range, evidence source and confidence are stored independently.

## Current audit

- The existing static corpus contains 180 raw company records and 568 relationships.
- Fourteen duplicate ticker records were isolated in an `Unmapped` layer. Runtime canonicalization now collapses duplicate ticker identities before layout or analysis.
- Evidence depth is uneven. Construction, substrates, engineered materials, raw minerals and foundry require the largest primary-source research push.
- The existing edge schema stores one evidence label and one URL. This is insufficient for multiple filings, excerpts, contradictory disclosures, historical changes or analyst review.

## Production data model

1. `entities`: canonical organization, security, subsidiary, fund, product, material, facility and geography records.
2. `entity_aliases`: tickers, CIKs, LEIs, former names, brands and source-specific identifiers.
3. `documents`: filing or source metadata, URL, accession number, form, filing date, issuer, content hash and retrieval status.
4. `document_chunks`: normalized text, section, page or exhibit, byte offsets and embedding pointer.
5. `claims`: subject, predicate, object, qualifiers, amount, currency, percentage, start/end dates and extraction status.
6. `claim_evidence`: many-to-many links from claims to exact document excerpts with source rank.
7. `relationships`: materialized graph edges accepted from one or more claims.
8. `relationship_versions`: history of changed economics, counterparties, confidence and status.
9. `investigations`: seed entity, depth budget, source policy, status and coverage metrics.
10. `review_queue`: contradictions, ambiguous entities, low-confidence claims and material financial interpretations.

## Source hierarchy

1. Regulatory filings and contract exhibits: 10-K/20-F, 10-Q, 8-K/6-K, S-1/F-1, Form D, 13D/G, proxy statements and material exhibits.
2. Issuer and counterparty primary disclosures: investor relations releases, presentations, product documentation and official partnership announcements.
3. Government, utility and permitting records.
4. Reputable financial reporting and trade publications for discovery and corroboration.
5. Aggregators and social sources only as leads; never as sole support for a verified edge.

## Investigation workflow

1. Resolve the seed name to a canonical issuer/security and CIK.
2. Retrieve the filing index and prioritize annual filings, material-agreement exhibits, offering documents and recent current reports.
3. Extract claims with exact source spans. Groq is used for bounded text extraction and concise synthesis, never for source invention.
4. Resolve every named counterparty and product to canonical entities.
5. Ask JEV parallel typed questions for relationship class, direction, materiality, directness, evidence sufficiency, contradiction risk, next source and human-review requirement.
6. Accept only high-confidence, primary-source claims into the verified graph. Keep inferred, disputed and historical edges in separate states.
7. Expand each named counterparty until the requested depth, confidence floor, source budget or cycle limit is reached.
8. Recompute concentration, propagation and affected-market-cap metrics from accepted edges only; show inferred reach separately.

## JEV responsibilities

JEV is the fast decision layer, not the prose generator. It routes each document and claim, assigns typed probabilities, chooses the next research source, decides whether expansion should continue and gates automatic acceptance. Groq can extract and explain; deterministic code enforces schemas, thresholds, graph traversal and financial calculations.

## Query path

User question → entity and intent resolution → verified subgraph retrieval → JEV routing and sufficiency decision → optional current-news retrieval → Groq synthesis constrained to retrieved entities and citations → answer with named paths, evidence state and uncertainty.

## Quality gates

- No anonymous “many customers” node when the source names entities.
- No supplier/customer edge derived only from shared sector membership.
- No verified edge without an exact primary-source URL and attributable excerpt.
- Contradictory or stale claims remain visible and versioned.
- Revenue, ownership and commitment amounts retain period, units and disclosure date.
- Every investigation reports layer coverage, unresolved aliases, source failures and review backlog.
