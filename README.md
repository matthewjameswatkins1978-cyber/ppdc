# PayPal Deal Checker

**Check the deal before you pay.** Deal Checker helps a buyer see what is clear, what needs attention, and what remains unknown. The person decides whether to continue; PayPal handles checkout.

This is a PayPal AI Hackathon prototype. It is not a fraud detector, seller-trust score, legal opinion, or guarantee of buyer protection. The current prototype uses PayPal Sandbox only.

## Current build contract

Read [PPDC-001](docs/hackathon-build/PPDC-001.md) and [Luna execution instructions](docs/hackathon-build/LUNA-INSTRUCTIONS.md). Local setup/account truth is in [the access inventory](docs/access-inventory.md), [hackathon resources](docs/hackathon-resources.md), [infrastructure notes](docs/infrastructure-notes.md), and [setup verification](docs/setup-verification.md).

## Local development

Requirements: Node.js 20.9+ and npm.

1. Copy `.env.example` to `.env` and fill in sandbox credentials locally. Never share `.env` or commit it.
2. Install dependencies with `npm install`.
3. Start the local app with `npm run dev`.

Available checks: `npm test`, `npm run typecheck`, and `npm run build`. `npm run ocr:smoke` checks the image-to-Deal path against a public OCR sample; it downloads the sample and first-use OCR assets.

Deal extraction defaults to the local rules-based parser. To evaluate structured Gemini extraction locally, accept the AI Studio terms, create a no-billing API key, set `PPDC_DEAL_MODEL_PROVIDER=gemini`, and put the key in ignored `.env` as `GEMINI_API_KEY`. The API response is validated locally against the Deal schema and source evidence. Gemini free-tier use is for local development/testing only; current Google terms require Paid Services for an API client made available to UK users. Do not enable billing or deploy this provider publicly without explicit spend approval.

## PayPal Sandbox smoke check

The only payment integration configured here is the PayPal Sandbox Orders API. `npm run paypal:smoke -- create` creates a GBP 1.00 sandbox order and prints its approval link. The human must approve it with a sandbox buyer account. Then `npm run paypal:smoke -- capture <order-id>` checks that PayPal reports `APPROVED`, captures once with a unique idempotency key, and requires PayPal to report `COMPLETED`.

The sandbox buyer's approval is a human decision. Do not substitute live credentials or real-money checkout. The smoke command is a developer verification tool, not a production checkout flow.

## Product scope
The first demo uses a UK used-guitar deal, while the product is intended for consumer purchases broadly. Assessments use green, amber, and red findings with evidence and distinguish facts, PayPal rules, inferences, and unknowns. Price context is supporting evidence. Public search must receive sanitized queries, never private conversations or identifying details.

## Public demo

[Open the public demo](https://paypal-deal-checker-demo.onrender.com). It runs as a single Next.js Node web service on Render's Free plan. Free instances sleep after inactivity, and their local filesystem is temporary. Deal assessment state is stored in the browser; server-side checkout records are not promised to survive restarts or redeploys.

The public instance has no provider credentials. Local replay works without external calls, while live public search is unavailable. PayPal checkout is Sandbox-only in code, but this instance cannot complete checkout until the owner explicitly approves transferring the existing Sandbox credentials. No live PayPal credentials or Gemini key are configured.

## Assessment and payment flow

Evidence is structured into a Deal, then evidence-backed rules produce the assessment, questions, and plain-language conclusion. Optional public research uses sanitized product details only. The default extractor is local and rules-based; Gemini is optional for local development/testing and is not enabled publicly. Deterministic application rules validate evidence, enforce the explicit human Continue decision, require authoritative PayPal Sandbox states before capture, and allow a Protection Passport only after fresh confirmation of a completed capture.

Evidence → structured Deal → assessment → optional sanitized public research → guidance → human Continue → PayPal Sandbox → fresh server verification → Protection Passport.
## License

PayPal Deal Checker is licensed under the **GNU Affero General Public License v3.0 only (AGPL-3.0-only)**.

Copyright © 2026 Matthew Watkins.

The public AGPL licence allows anyone to use, study, modify, and redistribute the covered code under its terms. Modified versions offered to users over a network are subject to the AGPL's corresponding-source requirements.

Alternative commercial licensing may be available by separate agreement with the copyright holder.

