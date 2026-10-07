# PPDC-001 Phase 3 — Research Enrichment

Status: **PARTIAL** while Parallel's current account balance and billing state await sign-in verification.

## What is implemented

- Public research is an explicit user action. Channel3 handles product-reference searches; Parallel handles broader public context. The UI never calls both automatically and offers offline replay controls.
- The query planner reads evidence-backed structured item/model, condition, and broad market facts only. It rejects contact details, addresses, seller/buyer references, private-message instructions, and arbitrary URLs. Raw deal text and private evidence are not sent to these providers.
- Provider results are normalized to titles, safe source URLs when available, merchant domains, price, currency, and known condition. Raw excerpts and request headers are not persisted. Channel3 `buy.trychannel3.com` redirect links are omitted to avoid recording referral redirects.
- Normalized results are cached in the existing ignored SQLite data file using a provider + normalized-query key. Failures remain visible and retryable. Replay uses local samples without provider requests.
- Price comparisons require at least three matching model references with the same known condition and currency. The median and range are shown; no currency conversion is guessed. A cheap price can only produce amber context, never a fraud verdict. Clear model-generation/variant conflicts remain unresolved.
- Research runs, safe query text, retrieval time, cache/live/replay mode, results, and source evidence stay with the Deal. The Protection Passport now snapshots that research provenance at verified payment time.
- The existing human Continue gate remains authoritative. Research cannot initiate checkout or capture payment.

## Wired benchmark subset

Automated offline coverage reads the PPDC-BENCH-001 case files for **CORE-05, CORE-10, CORE-12, ADV-03, ADV-06, and ADV-08**. These Phase 3 tests construct the research-stage Deal facts from the case expectations; they do **not** run the complete 32-case benchmark pack through the full extraction and assessment pipeline. Existing checkout-flow tests independently cover the human Continue boundary.

## Provider verification

### Channel3

The signed-in usage dashboard showed **995 of 1,000 monthly free searches remaining**, **21,000 bonus credits remaining**, and an **Add Payment Method** control (no payment method attached) after this smoke run. Three calls were made in this phase, all counted against the monthly free allowance: two returned HTTP 422 while the adapter sent unsupported locale fields in the JSON body; the request was narrowed to the documented query/limit body; the third succeeded and returned seven normalized results. No paid resource was created and no real payment method was used.

The successful search returned USD, new-condition Fender Player II references for a used GBP Fender Player deal. These are not comparable; the app correctly reports that the available public references cannot support a price comparison. Channel3's response price is normalized from `offers[].price.price`. The current app query includes “UK”, but this smoke did not establish localized GBP results. Treat Channel3 as product context until matching UK/used evidence is available.

Current provider docs: [search request and monthly allowance](https://docs.trychannel3.com/guides/make-a-search), [search response and offer schema](https://docs.trychannel3.com/guides/response-overview), and [locale options](https://docs.trychannel3.com/guides/locale).

### Parallel

No Phase 3 live request has been made. The account's setup record shows a $20 grant from October 6, 2026, with an approximate December 5 expiry and no card at setup, but the current balance and payment-method state have not been rechecked. The dashboard currently requires sign-in, so no live call will be made until the current credit and card status are visible. Parallel's current free-credit page says the $5 monthly allowance applies to organizations with a card and excess usage is billed; it is not treated as safe without current account verification ([Parallel free-credit terms](https://parallel.ai/blog/free-tier-parallel)).

## Offline verification scope

The GitHub Actions workflow runs tests, TypeScript, production build, low-severity npm audit, and schema/source-reference validation for all 32 machine-readable benchmark fixtures. It contains no credentials and does not run live provider tests.

Live smoke counts are bounded to three requests per provider for this phase. Channel3 used three; Parallel used zero pending account verification. Do not begin visual polish or Phase 4 before review.
