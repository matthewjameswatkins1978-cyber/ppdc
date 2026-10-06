# Access inventory

This file records access state and credential aliases only. Never put secret values here.

| Service | Account / access status | Secret Hatch alias | Offer | Expiry | Verification |
|---|---|---|---|---|---|
| PayPal Developer | Not set up in this run; account and sandbox app need owner sign-in | `paypal.client_id`, `paypal.client_secret` | Sandbox is free | Not stated | OAuth and Orders smoke test pending |
| Channel3 | Not claimed; hackathon signup/key issuance pending | `channel3.api_key` | 20,000 searches with `PAYPAL-HACKATHON-2026` | Not stated | One product search pending |
| Render | Not claimed | None for initial account setup | $50 hackathon credits | Not stated | Credit application pending |
| Astropods | Not claimed | Not yet known | Free account advertised; credits not stated | Not stated | Free balance/pricing check pending |
| Parallel | Not claimed; not listed as a Devpost sponsor | `parallel.api_key` | Ordinary plan advertises up to 5,000 free requests/month, up to $80 signup credit + $5 monthly credit | Check actual account eligibility and expiry | One public search pending |
| APIMatic | PayPal plugin installed for Codex, Cursor, and VS Code | None | Basic free for 1 month only for participants who used plugin | Terms/form not inspected | Installed; requires a new Codex session to load |
| Postman | Public PayPal API workspace located; no signed-in Postman account | None | Free plan; no extra hackathon quota stated | Plan terms apply | Public workspace link ready; local collection not imported |
| KERNEL | Not claimed | Not required yet | $50 hackathon credits | Not stated | Available only after claim |
| AG Grid | Not configured | None | Free 45-day AG Studio trial | 45 days from claim | Not needed for PPDC currently |
| Bryntum | Not configured | None | 45-day trial | 45 days from claim | Not needed for PPDC currently |
| Elastic | Not configured | None | 14-day trial + possible 30-day extension; local edition free | Trial period | Not needed for PPDC currently |
| Zapier | Not configured | None | 14-day Professional trial, then Free | 14 days | Not needed for PPDC currently |

Secret Hatch was checked locally and currently reports no registered capabilities. When a credential is issued, add it locally using `secret-hatch add --service <service>`; do not paste it into chat. If Secret Hatch is unavailable, use an ignored `.env` file and keep `.env.example` placeholders only.
