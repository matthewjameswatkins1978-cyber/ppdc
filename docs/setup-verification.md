# Setup verification

Updated 2026-10-06. PayPal and Channel3 account smoke checks have been run.

- [x] PayPal sandbox OAuth
- [x] PayPal sandbox order create and lookup; GBP 1.00 order remains `CREATED` and uncaptured
- [x] Channel3 promo code redeemed; one search succeeded and returned 4 Fender Telecaster products; dashboard shows 21,000 bonus credits and 999 monthly credits remain
- [ ] Parallel public search and extraction (vendor and free terms still to verify)
- [ ] Astropods free balance/pricing reviewed; tiny call only if free credit is confirmed
- [ ] Render account signed in (Hobby), no card or services; billing shows $0.00 credit; claim portal requires organizer claim link
- [x] APIMatic PayPal Context Plugin installed for Codex, Cursor, and VS Code; reload/start a new Codex session to load
- [ ] Postman PayPal collection imported; no secrets in exports
- [ ] KERNEL $50 credit visible; available, not yet required

The local repo safety check passed: `.env` is ignored. `.env.example` contains placeholder values only. PayPal sandbox credentials and Channel3's key are stored only in the ignored local `.env`; Secret Hatch currently has no registered capabilities and the CLI is unavailable in this shell. APIMatic's official setup instructions state that the Context Plugin repo is experimental for the hackathon and is not a long-term supported PayPal product.
