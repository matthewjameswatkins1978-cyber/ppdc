# Setup verification

Updated 2026-10-06. PayPal and Channel3 account smoke checks have been run.

- [x] PayPal sandbox OAuth
- [x] PayPal sandbox order create and lookup; GBP 1.00 order remains `CREATED` and uncaptured
- [x] Channel3 promo code redeemed; one search succeeded and returned 4 Fender Telecaster products; dashboard shows 21,000 bonus credits and 999 monthly credits remain
- [x] Parallel account granted $20 credit for 60 days, no card added; one Turbo Search and one Extract succeeded. Billing UI rounds balance to $20.00 and Usage showed no usage yet.
- [x] Astropods account signed in; $10 one-time signup credit applied; usage $0.00; no card; $5 alert and $20 hard spend limit. Exact gateway model catalog not visible until agent deployment; no test agent created. Not planned for MVP absent a concrete hosting need.
- [ ] Render account signed in (Hobby), no card or services; billing shows $0.00 credit; claim portal requires organizer claim link
- [x] APIMatic PayPal Context Plugin installed for Codex, Cursor, and VS Code; reload/start a new Codex session to load
- [x] Local Postman collection prepared for OAuth, Orders create/capture/lookup; no secrets included. Import to a signed-in Postman workspace pending.
- [x] KERNEL $50 hackathon credit activation success toast; billing shows no card, no usage, and trial end 2026-11-15; exact credit balance not exposed; available, not yet required
- [ ] APIMatic subscription claim deferred until PPDC uses the Context Plugin and can provide the required project/GitHub evidence

The local repo safety check passed: `.env` is ignored. `.env.example` contains placeholder values only. PayPal, Channel3, and Parallel credentials are stored only in the ignored local `.env`; Secret Hatch currently has no registered capabilities and the CLI is unavailable in this shell. APIMatic's official setup instructions state that the Context Plugin repo is experimental for the hackathon and is not a long-term supported PayPal product.
