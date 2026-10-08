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