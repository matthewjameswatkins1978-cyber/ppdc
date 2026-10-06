# Infrastructure notes

- **PayPal:** Use the free sandbox. Keep the REST app client ID and secret in Secret Hatch (aliases `paypal.client_id` and `paypal.client_secret`). The intended flow is sandbox OAuth, create order, buyer approval in sandbox, capture, and order lookup. Never use live credentials or real money for setup.
- **Hosting:** Render is an optional later deployment target. The hackathon page advertises $50 in credits. Verify the account balance before creating a service; credit depletion is billable. The project can remain local while the MVP is built.
- **AI endpoint:** Astropods is advertised as a free account, but the hackathon page does not state an inference credit amount. Inspect actual model availability, per-model pricing, and spend controls before use. Any AI provider is acceptable under the hackathon rules.
- **Product search:** Channel3 is the strongest fit for retail product search and advertises 20,000 hackathon searches. Parallel Search + Extract is a separate candidate, not a listed hackathon sponsor; confirm the exact vendor and current free plan before relying on it. Avoid scraping retailer pages as a substitute unless allowed by their terms.
- **APIMatic:** The PayPal Context Plugin gives coding agents API context and needs no APIMatic credentials according to the Devpost page. It is developer tooling, not a PPDC runtime dependency.
- **Postman:** Use a local workspace/collection for OAuth, Orders, Capture, and Order lookup. Keep secrets in local environment variables and never sync or export them.
- **KERNEL:** Devpost offers $50 in credits, but internet-capable browser automation is not a PPDC requirement. Do not configure it unless a genuine use appears.
