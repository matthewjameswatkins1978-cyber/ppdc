# PayPal Deal Checker
**Check the deal before you pay.**

PayPal Deal Checker (PPDC) helps a buyer bring listing text, screenshots, seller statements, delivery terms, payment requests and optional public product context into one evidence-backed view before they decide what to do.

PPDC is a hackathon prototype, not a fraud detector, seller-trust score, legal opinion, price guarantee or promise of PayPal buyer-protection eligibility.

## Why this exists

A purchase decision is often scattered across a listing, messages, photos, a price, delivery promises and a requested payment method. PPDC brings those pieces together so a buyer can see what the evidence supports, what needs a question and what remains unknown.

## What it does

1. Add listing or message text, or a screenshot for local OCR.
2. Turn the supplied evidence into a structured Deal.
3. Review green, amber and red findings with their evidence references and a plain-language conclusion.
4. Ask useful follow-up questions and add new evidence to the same Deal.
5. Optionally check sanitized product details against public context.
6. Make an explicit human decision to continue to PayPal Sandbox.
7. After a verified completed Sandbox capture, show a payment-time Protection Passport.

**Evidence → structured Deal → assessment → optional public research → questions → updated evidence → human Continue → PayPal Sandbox → verified capture → Protection Passport.**

## Design principles

- **Evidence, not verdict.** PPDC separates supplied facts, seller claims, inference and unknowns. It does not assign a fraud percentage or decide whether a seller is trustworthy.
- **A bargain should survive explanation.** Price context can help explain a deal, but price alone is not evidence of fraud. When comparisons are weak or not comparable, PPDC should abstain from a price verdict.
- **The buyer decides. PayPal moves the money.** Findings and research cannot authorize payment.
- Green, amber and red describe the evidence found: coherent or stated details, details to clarify, and concrete concerns or contradictions. They are not seller ratings.

## Human authority and PayPal Sandbox

Only the buyer's explicit **Continue with PayPal Sandbox** action starts checkout. The server creates a Sandbox order, reads it again, captures only when PayPal reports `APPROVED`, then requires a fresh PayPal response with a completed order and completed capture before it creates a Protection Passport. Stable request IDs and payment-state checks protect capture against duplicate returns.

The integration uses PayPal Sandbox Orders API only. It does not use live PayPal credentials, charge a real card, or imply that PayPal endorses PPDC.

## AI and public research

The public demo currently uses deterministic, evidence-linked rules for its Deal assessment. It can use Channel3 for bounded product context. Queries are sanitized to product details; private chat, seller identity and contact details are not sent to public search. Research results are untrusted supporting evidence and may be incomplete, mismatched or unavailable.

The optional Gemini structured-extraction adapter was tested locally. Gemini is **not enabled in the public demo** and is not a production dependency. Do not describe the public demo as using live Gemini inference.

## Protection Passport

After PayPal confirms a completed Sandbox capture, the Passport records the payment-time Deal snapshot alongside the verified Sandbox transaction: stated terms, material promises, findings, unresolved details, evidence references and research provenance. It is a record of what was available at that time, not a guarantee of protection or reimbursement.

## Public demo

[Open PayPal Deal Checker](https://paypal-deal-checker-demo.onrender.com).

The demo runs on Render Free at no monthly compute cost. Free instances can sleep after inactivity; allow the first request time to wake the service before a rehearsal. No paid tier, card or autoscaling is configured.

The demo has no persistent disk. Deal assessments are saved in the current browser, and server-side checkout records use the instance's temporary filesystem. They are not guaranteed to survive a sleep, restart or redeploy. After a Free-tier wake, an earlier return may be unable to restore its server-side checkout record or Passport. PayPal's Sandbox order state remains authoritative. Wake the demo before a public rehearsal and do not treat a Passport as durable storage.

## Demo scenarios

The primary story is a synthetic used-guitar listing with a seller-reported headstock repair: new evidence makes the price easier to understand while repair quality, stability and value remain unverified. The secondary story uses conflicting console descriptions and a Friends & Family purchase request. An ordinary used-console scenario demonstrates restraint when no concrete concern is supported.

Walkthrough notes live in [`demo/scripts/`](demo/scripts/), with synthetic scenario data in [`demo/scenarios/`](demo/scenarios/). They are illustrative and are not connected to a real seller or marketplace listing.

## Safety and privacy

- Public research receives sanitized product details only; do not paste private chat or identifying information into a research request.
- External text and research are treated as untrusted evidence.
- PPDC does not infer seller intent, label a seller fraudulent, or treat a low price alone as proof of fraud.
- A stated payment method is not proof of transaction eligibility or buyer-protection eligibility.
- PayPal credentials are server-side. The public integration uses the Sandbox endpoint only.
- The demo should use synthetic data. Never enter a real card during a Sandbox rehearsal.

## Local development

Requirements: Node.js 20.9+ and npm.

1. Copy `.env.example` to `.env` and fill in only the local values you need. Keep `.env` out of Git and never share it.
2. Install dependencies with `npm install`.
3. Start the app with `npm run dev`.

Useful checks:

- `npm test` — automated tests.
- `npm run typecheck` — TypeScript check.
- `npm run build` — production build.
- `npm run ocr:smoke` — image-to-Deal OCR smoke check; downloads the sample and OCR assets on first use.
- `python scripts/validate-benchmarks.py` — validates offline assessment cases.

The default extractor uses local rules. Gemini is optional for local structured-extraction experiments and must not be enabled publicly or given billing without a separate approval.

## License

PayPal Deal Checker is licensed under the **GNU Affero General Public License v3.0 only (AGPL-3.0-only)**. See [`LICENSE`](LICENSE).

Copyright © 2026 Matthew Watkins.

Alternative commercial licensing may be available by separate agreement with the copyright holder.
