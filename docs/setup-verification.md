# Setup verification

Updated 2026-10-06. No account-dependent smoke tests have been run yet.

- [ ] PayPal sandbox OAuth
- [ ] PayPal sandbox create/order/capture/lookup
- [x] Channel3 promo code redeemed; one search succeeded and returned 4 Fender Telecaster products; dashboard shows 21,000 bonus credits and 999 monthly credits remain
- [ ] Parallel public search and extraction (vendor and free terms still to verify)
- [ ] Astropods free balance/pricing reviewed; tiny call only if free credit is confirmed
- [ ] Render account signed in (Hobby), no card or services; billing shows $0.00 credit; claim portal requires organizer claim link
- [x] APIMatic PayPal Context Plugin installed for Codex, Cursor, and VS Code; reload/start a new Codex session to load
- [ ] Postman PayPal collection imported; no secrets in exports
- [ ] KERNEL $50 credit visible; available, not yet required

The local repo safety check passed: `.env` is ignored. `.env.example` contains placeholder values only. Secret Hatch currently has no registered capabilities and the CLI is unavailable in this shell, so Channel3's key is stored only in the ignored local `.env`. APIMatic's official setup instructions state that the Context Plugin repo is experimental for the hackathon and is not a long-term supported PayPal product.
