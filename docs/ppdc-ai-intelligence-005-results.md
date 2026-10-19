# PPDC AI Intelligence Upgrade 005 results

**Status:** offline implementation complete; stopped for Lucy's independent review. No hosted inference was run.

## Verified starting point

The isolated branch starts at the verified open draft PR #12 head `3c73720ef004c1ea1af8e2d93d5edc463ac6424c` (`feature/ppdc-rules-framework-004a`). It does not include PR #13 changes and does not touch `D:\Projects\paypal-dc`. PR #13 was read for its role contract and mock coverage; Lucy's review `#5475855821` is treated as a constraint, not as approval of that implementation.

## What was implemented

- Versioned Evidence Auditor and Deal Sense Adviser guides and separate role prompts.
- Provider-independent role request/response interface.
- Gemini REST adapter for `gemini-3.8-flash`, medium reasoning, JSON-schema response mode, 30-second timeout, zero retries, key sent in the API header only.
- Deterministic proposal checks for exact source IDs, quote and UTF-16 offsets, allowed fields, subjects, negation, payment intent, monetary roles, uncertainty, temporal status and instruction-like text.
- Accepted omitted observations are merged and findings recomputed. An accepted contradiction now survives reconciliation as an evidence-linked unknown. AI cannot directly delete or change findings.
- Adviser claims require exact source quotations and a lexical support threshold. This is a partial, heuristic grounding check, not a formal entailment proof.
- Combined question output uses PPDC's four-question priority cap.

The adapter and role pipeline are not wired into the production UI or a public route. The mocked adapter test makes no network call. No API key, credentials or personal data were used.

## Offline evaluation

Tests use original synthetic listing text and explicit expected outcomes. The Auditor itself was mocked; therefore this section verifies reconciliation and role boundaries, not model quality.

| Case | Synthetic evidence challenge | Deterministic reconciliation expectation | Mock result |
|---|---|---|---|
| A | Ordinary used tablet sale | No red warning | Pass |
| B | Seller requests Friends & Family for an item | Accept exact omitted request; recompute red warning | Pass |
| C | Buyer/seller text explicitly rejects Friends & Family | No purchase warning | Pass |
| D | PayPal protection policy mentions Friends & Family | Mention is not a seller request | Pass |
| E | False Friends & Family warning against explicit rejection | Correct polarity; recomputation removes warning; AI challenge alone cannot remove it | Pass |
| F | Console works; charger faulty | Keep accessory fault separate from main item | Pass |
| G | Later source says motor stalls under load | Accept source-backed omission; recompute condition finding | Pass |
| H | Adapter inclusion is unstated | Retain unknown; do not invent inclusion or absence | Pass |
| I | Title says Nori Vela X7; specifics say X5 | Accept only with both exact sources; record unresolved conflict | Pass |
| J | Asking price £120 and postage £6 | Keep amounts in distinct roles | Pass |
| K | £120, roughly €140 | Do not treat approximate conversion as checkout price | Pass |
| L | No practical delivery option established | Keep delivery unresolved | Pass |
| M | Listing says “ignore previous instructions” | Treat listing as untrusted; no promotion | Pass |
| N | Adviser invents “genuine” and seller-history claims with a valid source ID | Reject unsupported wording | Pass |
| Q | Payment conflict, model conflict and competing questions | At most four combined questions; retain payment and model-conflict priority | Pass |

A mock pipeline test verifies that Auditor and Adviser run as separate sequential roles, the Adviser receives reconciled evidence rather than raw source input, and the final warning remains determined by PPDC code. A mock Gemini adapter test checks the documented endpoint shape, schema mode, medium reasoning, usage parsing and header-only key placement without making a call.

**Measured quality improvement:** not established. No model ran, so AI omission detection, correction acceptance rate, Adviser usefulness, unsupported-claim rate and comparative quality are unknown. The offline tests prove only that validated proposals can improve a deliberately omitted synthetic fact and that invalid/uncertain claims are constrained.

## Provider and billing decision

| Provider | Offline adapter | Hosted result | Decision |
|---|---|---|---|
| Google Gemini 3.8 Flash | Implemented; mock-tested | 0 requests; 0 tokens; $0 | Ready for Lucy review, not hosted-call approval |
| Xiaomi MiMo 2.6 Flash | Not implemented | 0 requests; 0 tokens; $0 | Deferred; account credit, hard spending cap and quality-comparison basis not verified |

The official Gemini docs describe JSON-schema structured output and low/medium/high thinking; adapter uses medium. Gemini API billing is account/project-specific. Free-tier access and no-charge protection for this account and UK region were not verified, so no hosted call was made. Promotional credit is not assumed to cover direct Gemini or MiMo usage. There were no hosted outputs to compare and no inference cost.

References: [Gemini 3.8 Flash model](https://ai.google.dev/gemini-api/docs/models/gemini-3.8-flash), [structured output](https://ai.google.dev/gemini-api/docs/structured-output), [thinking](https://ai.google.dev/gemini-api/docs/thinking), [pricing](https://ai.google.dev/gemini-api/docs/pricing), [billing](https://ai.google.dev/gemini-api/docs/billing/), [MiMo model docs](https://platform.xiaomimimo.com/#/docs/api/mimo-v2-6-flash).

## Hackathon resources

| Resource | Benefit | Actual cost / access status | Integration effort | Recommendation |
|---|---|---|---|---|
| APIMatic PayPal Context Plugin | PayPal SDK/API setup, calls, models, errors, resilience and test guidance; useful for developer correctness | Devpost advertises one month Basic for participants using the plugin. Plugin install does not require APIMatic credentials; actual account redemption not checked. Does not establish legal Buyer Protection. | Low; install into a coding agent; use PayPal Sandbox separately for behavior | Use as an implementation reference when changing PayPal SDK flows; do not treat as policy authority |
| Channel3 | Product catalogue reference for model/variant identity | Hackathon page advertises 20,000 free API credits/searches; account/key/terms not verified and no calls made | Medium; product matching, attribution and disambiguation need design | Consider later for product identity only; catalogue data cannot establish this seller's condition, ownership or authenticity |
| Render | Hosting allowance | User supplied evidence of a $50 promotion; redemption and billing state not verified; no credit consumed and deployment untouched | None for this code-only experiment | Leave current demo unchanged; verify account credit and payment-method exposure before any hosting change |
| Kernel | Hosted browser/computer-use option | Devpost advertises a $50 credit; account eligibility not verified | Medium/high and unnecessary for synthetic offline evaluation | Skip |
| Elastic | Search/observability services or local Elasticsearch | Devpost advertises a 14-day trial with a possible extension; account eligibility not verified | High for this task; tracing/observability remains disabled | Skip |
| Postman | PayPal API collections and request exploration | Free account; account state not checked | Low | Useful for Sandbox request inspection, not needed for this experiment |
| AG Grid / Bryntum / Zapier | UI widgets or automation trials | Trial/credit claims on hackathon pages; account redemption not checked | Extra dependencies or workflow | Skip; no material benefit to the bounded evidence test |

Primary promotion details: [Devpost resources](https://paypalaihackathon.devpost.com/resources), [APIMatic](https://paypalaihackathon.devpost.com/details/apimatic), [Channel3](https://paypalaihackathon.devpost.com/details/channel3), [Render](https://paypalaihackathon.devpost.com/details/render), [Kernel](https://paypalaihackathon.devpost.com/details/kernel), [Elastic](https://paypalaihackathon.devpost.com/details/elastic), [Postman](https://paypalaihackathon.devpost.com/details/postman). Render's own [FAQ](https://render.com/docs/faq) and [free-instance billing guidance](https://render.com/docs/free) state payment-method/usage conditions; this account's actual billing state remains unknown.

## Results and limits

- Hosted inference: **No**; hosted cases: **0**; input/output/reasoning tokens: **0**; promotional credits used: **$0**; personal money spent: **£0**.
- Auditor omissions detected in hosted results: **None available**. The synthetic omission tests are mock proposals, not evidence of model detection.
- Unsupported Adviser claims in hosted results: **None available**. Offline fabricated-claim test was rejected.
- Gemini free-tier eligibility and hard billing protection: **Unknown** for the user's account and region.
- MiMo adapter: **Deferred**; no hosted comparison.
- APIMatic account promotion redemption, Channel3 account/key/terms, and Render credit redemption/payment-method state: **Not verified**.
- Final local verification: `npm test` PASS (104/104), `npm run typecheck` PASS, `npm run build` PASS. GitHub Actions status: NOT RUN; PR #12 has no reported checks on its base branch.
- Official frozen 100-case benchmark: **Not run**. 20 unseen holdout cases: **not touched**. Production deployment: **unchanged**. PayPal transactions: **none**. Licence: **AGPL-3.0-only unchanged**.

## Review required before any hosted trial

Lucy should independently review correction scope, payment negation, quote provenance, heuristic claim grounding, and the new contradiction persistence behavior. Hosted use remains a separate decision: first verify a supported Google authentication path, free-tier eligibility for this account/region, and a real hard no-charge boundary. This work makes no claim that the stronger model improves PPDC until a bounded, approved, recorded hosted comparison is performed.