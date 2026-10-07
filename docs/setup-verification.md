# Setup verification

Updated 2026-10-06. PayPal and Channel3 account smoke checks have been run.

- [x] PayPal sandbox OAuth
- [x] PayPal Sandbox order `8D840960HM121793H` approved with the Sandbox Personal buyer's PayPal balance and captured server-side; a fresh server API read confirmed `COMPLETED` for GBP 1.00 (capture `2VY61454Y4822283G`)
- [x] Channel3 promo code redeemed; initial search returned 4 Fender Telecaster products. Last exact dashboard balance before the additional Phase 0 search was 21,000 bonus credits and 999 monthly credits; current balance not rechecked.
- [x] Parallel account granted $20 credit for 60 days, no card added; setup Turbo Search + Extract and one Phase 0 Search succeeded. Exact current balance not rechecked.
- [x] Astropods account signed in; $10 one-time signup credit applied; usage $0.00; no card; $5 alert and $20 hard spend limit. Exact gateway model catalog not visible until agent deployment; no test agent created. Not planned for MVP absent a concrete hosting need.
- [x] Render $50 Hackathon Participant credit visible in Billing; full balance remains and is valid until 2027-10-01. No card, services, or pending charges; no deployment created.
- [x] APIMatic PayPal Context Plugin installed for Codex, Cursor, and VS Code; reload/start a new Codex session to load
- [x] Local Postman collection prepared for OAuth, Orders create/capture/lookup; no secrets included. Import to a signed-in Postman workspace pending.
- [x] KERNEL $50 hackathon credit activation success toast; billing shows no card, no usage, and trial end 2026-11-15; exact credit balance not exposed; available, not yet required
- [ ] APIMatic subscription claim deferred until PPDC uses the Context Plugin and can provide the required project/GitHub evidence

The local repo safety check passed: `.env` is ignored. `.env.example` contains placeholder values only. PayPal, Channel3, and Parallel credentials are stored only in the ignored local `.env`; Secret Hatch CLI and connector are available locally; the connector reports zero active capabilities. APIMatic's official setup instructions state that the Context Plugin repo is experimental for the hackathon and is not a long-term supported PayPal product.

## PPDC-001 Phase 0 engineering checks

Updated 2026-10-07. The local Next.js/TypeScript foundation and schema-validated Deal extraction are in place.

- [x] Automated tests cover explicit human payment authorization, duplicate-action idempotency, ordered payment states, schema-validated extraction with evidence quotes, mock Gemini REST Interaction output, rejection of unsupported inferences, PayPal approval/capture/fresh-completion transition, privacy-safe query construction, and five reusable illustrative deal fixtures
- [x] TypeScript typecheck passes
- [x] Next.js production build passes
- [x] Channel3 adapter smoke lookup succeeded once; five product results were returned with Channel3 provenance and capture time
- [x] Parallel adapter smoke lookup succeeded once; ten public results were returned with source URLs and capture time
- [x] PayPal Sandbox approval → server-side capture → fresh server-side `COMPLETED` read verified for order `8D840960HM121793H`; automated coverage checks the ordered GET → capture → GET transition and refuses capture before `APPROVED`.
- Known issue: after the Sandbox buyer approved with PayPal balance, PayPal redirected to the configured localhost return URL and the browser showed `ERR_CONNECTION_REFUSED` because no local app server was listening. The server-side order was nevertheless `APPROVED` and capture completed. The smoke flow currently relies on a running app at `http://localhost:3000` for that return page.
- [x] Local Tesseract OCR and deterministic intake produce all required Deal fields (item, model, price, currency, condition, payment method, delivery terms, material promises, unknowns) and preserve evidence references.
- [x] Strict Zod schema and source-quote validation reject malformed or unsupported extraction output. Codex CLI was evaluated on a synthetic listing screenshot after Tesseract OCR; its item inference lacked a source quote and was rejected. Routine tests use recorded responses and do not call a live model.
- [x] One live Gemini structured extraction from the existing OCR listing text passed the existing Zod schema and all 9 evidence-quote checks. Evidence-backed fields survived; a test confirms unsupported item guesses without a source reference are rejected. The REST adapter now reads `steps[].content[]` (the API response shape); one initial live request exposed that mismatch, followed by one successful request after the fix. The key was available in the local process and is now stored in ignored project `.env`; its original source is unverified. No card or billing account was added. Free-tier use is for local development/testing only; Google's current terms require Paid Services for API clients made available to UK users.
- Protection Passport creation is a Phase 2 item in PPDC-001 and is not a Phase 0 exit criterion.

No production PayPal payment was made and no service was deployed. The single Sandbox order was captured as recorded above.
