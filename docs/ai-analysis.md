# Optional Astropods evidence analysis

The bridge is a private, server-side, opt-in experiment. `PPDC_ASTROPODS_ENABLED` defaults to `false`; ordinary deal intake, assessment, fixtures, and checkout work without Astropods. This branch does not enable a public endpoint, deploy an agent, or change Render.

## Data flow and consent

The checkbox applies only to the current submission. The user can label the evidence speaker as seller, buyer, or unknown/mixed; this is user-provided attribution, not independently verified identity. When selected, the backend sends the submitted text and any text extracted from the image by local OCR. The image bytes are never sent to Astropods. Common email, phone, and payment-card number patterns are masked before sending; that pattern-based pass is incomplete. The UI tells users not to include addresses, credentials, or personal/payment details. Public use would need a reviewed consent and privacy flow before enablement.

The feature is disabled unless `PPDC_ASTROPODS_ENABLED=true`. The adapter implements only Astropods’ documented hosted messaging API at `https://astropods.com`; Astropods local development exposes its agent messaging SDK over gRPC, which this PPDC HTTP adapter does not call. Hosted mode requires a private deployment ID and a server-only bearer token. Never put that token in a client variable, browser bundle, fixture, or committed `.env` file. `.env.example` contains placeholders only; `.env` is ignored by Git.

## Trust boundary

Astropods returns one JSON case under the existing `cases` response shape. PPDC validates its strict schema and checks source IDs, exact quotes, attribution, field allowlists, price/currency coherence, and conservative semantic policies. Seller statements remain seller claims. Model analysis is attached as `status: proposed` and cannot set findings, green/amber/red severity, seller trust, fraud probability, PayPal protection, amount, payment authorization, capture, or Passport state. Deterministic assessment is unchanged.

Exact quote presence is necessary, not sufficient. PPDC rejects unsupported fields, claims, contradictions, and price verdicts. It also replaces model-written explanatory prose and unknown/abstention wording with server-built text based on admitted quotes and allowlisted fields; the model cannot smuggle an unsupported conclusion through those display fields. Unsupported suggestions such as “pay now” and seller-trust verdicts are filtered from buyer questions.

The backend treats input evidence as untrusted data, never instructions. It does not expose tools to the model. It uses the documented messaging flow (create conversation, post message, consume SSE through a terminal `finish` event) and returns no partial response. Failure, invalid configuration, timeout, authentication rejection, malformed JSON, or incomplete output leaves the deterministic assessment in place with a clear notice.

## Limits and current status

Offline tests inject fake fetch responses; CI never needs Astropods credentials or live inference. Request/response sizes and timeouts are bounded. The model, provider identity, request ID, start time, latency, token counts, cost, and validation status are not accepted from model JSON. Server code supplies available metadata; token usage and per-request cost remain unknown when the provider does not return them.

Hosted deployment behavior is not live-tested in this phase. Hosted mode is configuration scaffolding for a later controlled review, not approval to deploy. No private buyer evidence is used for the bounded synthetic test.