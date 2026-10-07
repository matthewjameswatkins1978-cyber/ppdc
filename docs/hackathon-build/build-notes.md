# Build Notes

## Decisions

- Product: PayPal Deal Checker, with a Deal Assessment as the primary result.
- Target: Broad consumer purchases. Use a UK used-guitar example for the MVP demo because it can expose price, condition, shipping, seller claims and payment-protection questions.
- Assessment: Green for confirmed/coherent deal elements; amber for items to clarify; red for concrete concerns, contradictions or protection problems. Never present a colour as a seller-trust or fraud verdict.
- Epistemic labels: Keep known facts, inferences and items that cannot be verified distinct. Price fairness and comparable listings are supporting evidence, not the main product.
- Main flow: Messy text or screenshot → structured Deal → evidence checks → Deal Assessment and plain-language conclusion → explicit human Continue decision → PayPal Sandbox checkout → Protection Passport after successful payment.
- Passport: Snapshot the agreed deal, payment result and evidence/assessment that existed at checkout time. It is a record, not a guarantee of buyer-protection eligibility.
- Build style: Conventional TypeScript/Next.js, small number of services, no sponsor infrastructure without a concrete benefit. Prefer a small vertical slice over breadth.
- Spending: Preserve the project’s £0 personal-spend constraint; use the already prepared sandbox and confirmed free allowances.
- Schedule: As of 2026-10-06, use the approximately five-week calendar runway to get the slice working early and reserve the final week for hardening and submission. No hours-per-week estimate requested.
- Onboarding: The participant supplied the core product direction in one detailed response. Optional visual-style round skipped; style remains open. No coding-language or prior-build claims inferred.
- Scope deepening rounds: 0; the detailed direction already resolved the central workflow and boundaries. Remaining implementation details are deferred to PRD/spec where evidence can guide them.

## Active Shaping

- Matthew clarified that the product is not limited to UK shoppers or used products; the guitar is only the demo scenario.
- Matthew replaced a “best pick”/simple fair-price result with a whole-deal assessment and plain-language conclusion.
- Matthew explicitly ruled out fraud percentages and seller trust/fraud declarations.
- Matthew confirmed PayPal Sandbox checkout after explicit Continue, followed by a Protection Passport.

## Open Questions for Later Design

- Which single image/text extraction and public-search providers best fit the already provisioned free access and can be verified before implementation.
- Exact Deal fields, assessment rules and evidence citation format.
- Passport persistence and retention for the prototype, with no unnecessary personal data.
- A precise illustrative listing and the public evidence available for it.

## Reconciliation with PPDC-001

`PPDC-001.md` is the current build contract. The product direction above remains compatible and is retained. This note records the decisions needed to reconcile the earlier shaping notes with that contract:

- Both provisioned search services are in scope behind one question-routed capability. Channel3 handles product identity/specification/reference-price questions; Parallel handles broader public-web and listing context. They are not both called by default.
- Public search accepts sanitized query data only. Names, contact details, private messages, screenshots, and other private deal evidence must not be forwarded to search providers.
- The phase sequence follows PPDC-001: Phase 0 proves the domain/payment spine, extraction, search provenance, and first five fixtures; product UI and expanded research are subsequent phases.
- The setup inventory is newer than PPDC-001's setup snapshot: Render's $50 credit is now applied. It remains an optional later hosting target; no service or billable resource has been created.
- Channel3, Parallel, and PayPal sandbox credentials are present only in ignored local `.env`; no credential values belong in these notes. Sandbox order `8D840960HM121793H` was approved using the Sandbox buyer balance, captured server-side, and verified `COMPLETED` by fresh API read; the browser return URL showed `ERR_CONNECTION_REFUSED` because localhost was not running.
- Gemini is verified for local structured-extraction testing only; the adapter remains optional and defaults to rules. The original key source is unknown, but GEMINI_API_KEY is stored in ignored local .env. Do not enable billing or make Gemini a production dependency. Keep the longer-term provider choice open.

## PPDC-001 Phase 1 checkpoint

Phase 1 is accepted and checkpointed locally. The application supports text and screenshot intake, local OCR, structured assessment, browser-local deal persistence, fixture replay, provenance, and adding evidence to the same deal. Disagreements are retained as amber unknowns with both evidence references instead of silently replacing earlier facts.

The assessment uses deterministic local rules: stated/coherent terms can be green, missing or unverified details are amber, and a sourced Friends & Family purchase request is red. Fixtures and ordinary UI use do not call Gemini, Channel3, Parallel, or PayPal. No checkout or Passport flow is wired into the application yet.

Browser testing found that Next.js bundling caused Tesseract's default worker path to resolve under a nonexistent D:/ROOT. The application now supplies the worker path from the local node_modules installation. The browser successfully completed screenshot upload and local OCR.

Verification: 24 automated tests passed; TypeScript, production build, OCR smoke, npm audit (zero vulnerabilities), diff check, and credential-pattern scan passed. Browser checks covered fixture replay, evidence updates, persistence after reload, and screenshot intake.