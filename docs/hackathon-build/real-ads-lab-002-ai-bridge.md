# Real Ads Lab 002: AI bridge follow-up

Status: guidance for a later private AI bridge review. This change does not enable inference, publish the agent, or send listing evidence to a provider.

## Authority boundary

- PPDC's deterministic validator and assessment rules remain authoritative for accepted Deal state and green, amber, or red severity.
- An AI bridge may propose candidate facts, exact supporting quotes, seller-attributed statements, unresolved details, conflicts, and at most four buyer questions.
- PPDC must verify every source ID and exact quote against the supplied evidence before accepting any proposal. The server owns provenance; the model cannot provide trusted metadata.
- Conflicts remain unresolved until the buyer or stronger evidence resolves them. The model must not select a winning value by guesswork.
- The model cannot decide whether to buy, set severity, access PayPal, or trigger a payment action.

## Evidence envelope

When privacy and retention approval permits a model call, send a compact, synthetic-first evidence envelope with separate source records for listing title, item specifics, seller notes, and buyer-provided notes. Each record needs a stable source ID and a source label. Preserve the original excerpt as the quote-validation source; do not combine independent records into one unlabeled paragraph.

Ask for a versioned proposed-analysis object only. Keep source attribution and trusted provenance on the PPDC server. Reject quotes that are not exact substrings of their referenced source, source IDs that were not supplied, unsupported material assertions, excess questions, or additional output fields that could imply authority.

## Synthetic bridge regressions

Use local fixtures only for:

- differing RAM values in a title and item specifics, preserving both quotes as one unresolved RAM conflict;
- seller-reported repairs, damage, missing parts, and untested functions, without presenting claims as independently verified;
- a model year or accessory that is absent, producing a focused question and retaining the unknown;
- original asking currency alongside a separately quoted approximate conversion;
- variable delivery cost versus return-postage terms, which must not be conflated;
- prompt-injection instructions embedded in seller text, treated only as untrusted evidence;
- ordinary coherent listings, ensuring the bridge does not manufacture concerns.

Replay recorded synthetic results for routine development. Do not use private or real buyer evidence until provider authentication, retention, trace controls, deletion, and cost limits have been approved. No hosted Astropods deployment or Render integration is implied by this note.

## Safe integration with draft PR #8

PR #8 and this branch touch the same domain seams. Keep both sets of responsibilities when they are combined:

1. In `assessment.ts`, retain deterministic finding generation and current-pass unknown suppression from this branch. Also retain PR #8's evidence-reference merge behavior so each quote stays attached to its own source. Do not use model output to generate severity or payment findings.
2. In `deal.ts`, retain Lab 002's `priceDisplays` alongside PR #8's optional proposed-analysis metadata and speaker attribution. Approximate conversions remain display-only and never replace `price` or `currency` used by checkout.
3. In `presentation.ts`, PR #8 currently prioritizes deterministic questions, then appends separately prioritized model questions. This branch generates a broader deterministic candidate set and ranks payment protection, conflicts, faults, and other concerns before the four-question cap. During integration, pass only validated AI questions into the domain question flow and apply one shared priority-aware cap to the combined candidates; do not let model questions displace Friends & Family or other higher-priority deterministic concerns.
4. When combining branches, start from the latest reviewed PR #8 head, resolve these three files explicitly, and inspect the merged diff. Run cross-project contract tests, all PPDC tests, typecheck, production build, benchmark validation, audit, and secret scan. Keep both PRs draft and unmerged until Matthew reviews the combined result.

## Source-aware deterministic contract (004A)

`extractDealFromIntake` retains each original field and ordered follow-up as a separate source segment. Candidate quotes and offsets point into that segment; reconciliation keeps historical and corrected candidates available. The legacy `extractDealFromText` signature remains supported for plain text and OCR; the local OCR-only fallback tags its source as OCR.

When integrating PR #8, validate proposed AI facts against the same source IDs and exact excerpts. The server continues to own trusted provenance and deterministic assessment remains authoritative. Preserve `sourceSegments` and candidates when adding evidence, then rerun deterministic reconciliation. Do not let AI candidates alter payment authority, severity, or the buyer's decision.

The AI proposal remains optional and subordinate: it cannot change severity, accepted deal facts, currency/payment amount, or PayPal authority. An unresolved conflict remains unresolved until buyer-provided evidence or a stronger source supports a value.