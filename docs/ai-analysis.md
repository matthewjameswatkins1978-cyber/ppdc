# Optional Astropods evidence analysis

The bridge is a private, server-side, opt-in experiment. `PPDC_ASTROPODS_ENABLED` defaults to `false`; ordinary deal intake, assessment, fixtures, and checkout work without Astropods. This branch does not enable a public endpoint, deploy an agent, or change Render.

## Data flow and consent

Consent is required again for every submission. When selected, the backend sends current submitted text and any text extracted from an image by local OCR, plus bounded exact quote excerpts from earlier user-provided evidence. Earlier excerpts retain distinct source IDs, array order, client-reported capture timestamps, and user-selected speaker labels. Those labels and timestamps are unverified browser data. Full earlier submissions are not sent. If browser history is malformed or cannot fit the limits, AI review is skipped and local assessment continues. Image bytes are never sent to Astropods. Common email, phone, and payment-card number patterns are masked before sending; this pattern-based pass is incomplete and is not anonymisation. The UI says what is sent and that local checking remains available.

Astropods messaging persists conversation history, and its observability trace API exposes run input/output. This agent also configures Mastra observability. The current evidence therefore may be retained in chat history and traces; deletion of a conversation is not evidence that telemetry is erased. Use synthetic data for deployment checks until retention, deletion, and trace controls have been confirmed. Do not claim private evidence is not logged.

The feature is disabled unless `PPDC_ASTROPODS_ENABLED=true`. The adapter implements only Astropods’ documented hosted messaging API at `https://astropods.com`; Astropods local development exposes its agent messaging SDK over gRPC, which this PPDC HTTP adapter does not call. Hosted mode requires a private deployment ID and a server-only bearer token. Never put that token in a client variable, browser bundle, fixture, or committed `.env` file. `.env.example` contains placeholders only; `.env` is ignored by Git.

## Trust boundary

Astropods returns one versioned model-only object (contract_version: ppdc-ai-analysis/1) containing cases. It does not return trusted provenance or top-level source attribution; PPDC attaches both after validating the proposal. The JSON Schema in src/domain/analysis-contract-v1.schema.json is generated from the runtime Zod validator and copied to the Astropods agent. Before using that agent, run bun run contract:check in D:\Projects\ppdc-ai-brain to detect copy drift.

Exact quote presence is necessary, not sufficient. PPDC rejects unsupported fields, claims, contradictions, and price verdicts. It also replaces model-written explanatory prose and unknown/abstention wording with server-built text based on admitted quotes and allowlisted fields; the model cannot smuggle an unsupported conclusion through those display fields. Unsupported suggestions such as “pay now” and seller-trust verdicts are filtered from buyer questions.

The backend treats input evidence as untrusted data, never instructions. It does not expose tools to the model. It uses the documented messaging flow (create conversation, post message, consume SSE through a terminal `finish` event) and returns no partial response. Failure, invalid configuration, timeout, authentication rejection, malformed JSON, or incomplete output leaves the deterministic assessment in place with a clear notice.

## Deal admission

Only server-validated, evidence-backed fields may be projected into the Deal: item/model, condition, payment method and delivery terms. Existing values are never overwritten. Matching values merge source IDs; differing values create unresolved conflicts. Seller repair disclosures are retained as seller statements with their source IDs and remain unverified. Model contradictions remain unresolved. Price, market comparisons, severity, trust, protection eligibility, payment authority, and checkout state are never promoted from AI. The existing deterministic assessor alone sets findings and severity. The model's validated questions are included in the normal “Questions worth asking” list, de-duplicated and capped at four; deterministic payment questions retain priority.

## Public request and cost controls

AI remains opt-in and the route is disabled in production, even if an environment flag is set. The local route caps submitted text at 32 KB, evidence at 12 distinct sources, each source at 32 KB, combined serialized sources at 64 KB, and model output at 64 KB, with a 60-second timeout. No source or model output is logged by PPDC, and API errors are returned without upstream error details. Local checking does not depend on AI.

Before public AI is enabled, require authenticated user/session identity and an atomic trusted edge/KV limiter. Proposed defaults: one upstream call per explicit user action, a small per-user daily quota, a per-session short-window burst cap, a 64 KB request cap, and a daily service budget reserved before the upstream call. Fail closed on limiter/auth/budget errors; do not retry automatically; retain aggregate counts and outcome codes only, not source text. This requires an implementation review and must not be treated as already active. A supported non-human, deployment-scoped Astropods service credential is also unverified; do not place an interactive user session token in a server secret.

## Limits and current status

Offline tests inject fake fetch responses; CI never needs Astropods credentials or live inference. Request/response sizes and timeouts are bounded. The model, provider identity, request ID, start time, latency, token counts, cost, and validation status are not accepted from model JSON. Server code supplies available metadata; token usage and per-request cost remain unknown when the provider does not return them.

Hosted deployment behavior is not live-tested in this phase. Hosted mode is configuration scaffolding for a later controlled review, not approval to deploy. No private buyer evidence is used. No Astropods call, blueprint publish, agent deployment, or Render change is authorized by this work.
