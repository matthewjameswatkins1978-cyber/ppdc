# PPDC AI Experiment 001 — Results and review gate

**State: HOSTED RUNTIME BLOCKED; no inference performed.** This is not evidence that AI improves PPDC explanations. The private blueprint and one authenticated single-user deployment exist, but Astropods marks the deployment failed after selecting corrected build `fb617573`. Local Docker import smoke and all five mock tests pass. Hosted model inference, PayPal transactions, Render actions, and transmission of fictional listings to a model have not occurred.

## Gate evidence (8 October 2026)
- Rodric Rabbah's Astropods Discord response confirms the first hosted agent's hosting costs are waived for the hackathon and a $10 promotional credit is available for AI Gateway token use. He recommends one agent with an internal dispatcher for the two roles.
- `ast billing get` immediately before deployment and inference showed $0.01 usage spend, $0 billed, $9.99 credit remaining, a $1 warning, and an enforced $2 spend limit. `ast billing status` showed active, no payment method, no credits spent, and enforcement active. The account billing UI confirms the cap pauses agents before the $10 credit is exhausted.
- The new blueprint `ppdc-ai-experiment-001` is **private**. The original `ppdc-ai-brain` remains unchanged and private with zero deployments.
- Docker Desktop 29.8.1 is running. The corrected local image build and pipeline import smoke pass; the Astropods Linux amd64 build and private registry push produced build `fb617573`. The deployment dry-run passed.
- Exactly one deployment exists: `ogc-v3g-r5y`, using authenticated `web` access granted only to the verified Astropods user ID. `ast agent get` reports build `fb617573` but deployment status **failed** because the agent container keeps crashing. Available logs still show the earlier `zod` resolution error from before the Dockerfile correction, so the corrected build's startup cause is not yet confirmed. A plain unauthenticated GET to the launch URL returned HTTP 302 to Astropods sign-in; it is not an open inference endpoint.
- **Hosted inference has not started.** `ast agent trace` reports 0 traces; `ast agent usage` reports 0 tokens and $0 model cost. No promotional credit was consumed by this experiment. The account remained at $0.01 usage spend, $0 billed, $9.99 credit remaining, and the enforced $2 cap.
- The chat route redirects to Astropods sign-in. After a normal sign-in attempt, Microsoft Edge blocked the returned `*.agents.astropods.ai` page (`ERR_BLOCKED_BY_CLIENT`); the in-app browser returned to the Astropods login page. No password was entered, no security block was bypassed, and no synthetic listing was sent to the model. Authentication must be completed by the user before hosted cases can run.
- The five mock tests pass. Typecheck, spec validation, local image build, Astropods blueprint build, and `git diff --check` pass. No PayPal transaction, Render action, benchmark case, or holdout case was run or loaded.
## Offline synthetic baseline

All five inputs are new fictional listings with synthetic source IDs. The local deterministic results below come from the PR #12 branch's `extractDealFromIntake` and `assessDeal`; no benchmark or holdout data was loaded. “Auditor”, “Adviser”, unsupported AI claims, and AI usefulness are **not run**, because there were no model outputs.

### AI001-A — ordinary coherent sale

- Deterministic interpretation: Nintendo Switch OLED; asking price £160 GBP; lightly used and described as working; PayPal Goods & Services; tracked postage £4.
- Deterministic findings: all green (`item-identified`, `price-stated`, `condition-stated`, `delivery-stated`, `payment-stated`); no unknowns and no F&F warning.
- Auditor proposals / accepted / rejected: not run.
- Adviser response / buyer-facing usefulness: not run.
- AI unsupported claims, AI missed facts, and AI false alerts: not assessable.
- Usage: 0 input tokens / 0 output tokens / $0.00 credit.

### AI001-B — Friends & Family requested

- Deterministic interpretation: camera item, seller-requested PayPal Friends & Family, used condition, tracked postage; model and price are unstated.
- Deterministic findings: red `friends-family-purchase`; price is amber `price-missing`; item, condition, delivery, and payment fields are otherwise identified.
- Auditor proposals / accepted / rejected: not run.
- Adviser response / buyer-facing usefulness: not run.
- AI unsupported claims, AI missed facts, and AI false alerts: not assessable.
- Usage: 0 input tokens / 0 output tokens / $0.00 credit.

### AI001-C — Friends & Family explicitly rejected

- Deterministic interpretation: “I do not accept Friends & Family”; PayPal Goods & Services accepted; collection or tracked postage by agreement. No item, price, or condition was established.
- Deterministic findings: no F&F warning; G&S payment stated; condition and price need clarification.
- Auditor proposals / accepted / rejected: not run.
- Adviser response / buyer-facing usefulness: not run.
- AI unsupported claims, AI missed facts, and AI false alerts: not assessable.
- Usage: 0 input tokens / 0 output tokens / $0.00 credit.

### AI001-D — conflicting item and condition evidence

- Deterministic interpretation: title says “Model: Nori Vela X7 manual coffee grinder”; item specifics say “Model: Nori Vela X5”. Seller first describes it as working/in good condition, then says its motor stalls under load and the exact condition is unclear.
- Deterministic findings: unresolved `conflict_item` and `conflict_model` amber findings, plus an unknown seller note. **Observed gap:** the current condition finding is green from the earlier description even though the later source reports a material fault. The facts are retained separately, but the finding is not reconciled to the later condition evidence.
- Auditor proposals / accepted / rejected: not run.
- Adviser response / buyer-facing usefulness: not run.
- AI unsupported claims, AI missed facts, and AI false alerts: not assessable.
- Usage: 0 input tokens / 0 output tokens / $0.00 credit.

### AI001-E — ambiguous item details

- Deterministic interpretation: Pipestone pocket radio; £35 GBP; untested; G&S accepted; postage varies by destination. The description explicitly says the listing does not state whether a power adapter is included.
- Deterministic findings: amber `condition-disclosed-faults` and `delivery-variable`; price/payment stated. **Observed gap:** the adapter inclusion unknown is not retained in `deal.unknowns` for this input.
- Auditor proposals / accepted / rejected: not run.
- Adviser response / buyer-facing usefulness: not run.
- AI unsupported claims, AI missed facts, and AI false alerts: not assessable.
- Usage: 0 input tokens / 0 output tokens / $0.00 credit.

## Mock contract evidence

Five offline tests pass:

1. An Auditor proposal passes only when it exactly matches a PPDC candidate and source quote/offsets; an altered value is rejected.
2. The dispatcher invokes Evidence Auditor then Deal Sense Adviser, and the Adviser sees only deterministic PPDC data plus accepted proposals, not the raw listing.
3. Malformed Auditor output fails closed; no proposed fact is forwarded.
4. PPDC rejects adviser authority language and citations outside the allowed evidence/guidance IDs.
5. All five new synthetic cases traverse the two separate mocked roles and cover the requested boundaries.

These tests establish schema/flow separation, not semantic accuracy of model prose. The deterministic validator currently permits an Auditor proposal only when an equivalent source-bound PPDC candidate already exists; it cannot recover a fact omitted by deterministic candidate extraction. That is a deliberate authority limit for this experiment and a material measurement limitation.

## Security, privacy, and build limitations
- The experiment code configures no `astroTelemetry`, Mastra observability, trace exporter, trace context, or conversational memory. Astropods created a platform-managed collector workload alongside the agent; the trace API currently reports 0 traces. Platform-side retention and operational logs remain outside this code's control.
- `npm audit` reported 9 moderate advisories in `@astropods/adapter-core`'s transitive OpenTelemetry dependency chain. Review/update this dependency before merge or wider use.
- The Docker build context uses an allowlist and excludes `.env*`, `node_modules`, Git metadata, and all benchmarks. Only `src/domain` and the experiment agent source are copied into the image. Both the local Docker image build and Astropods Linux amd64 build passed.
- Blueprint `ppdc-ai-experiment-001` is private. Its only deployment enables authenticated `web` access with a single-user grant. An unauthenticated request redirects to Astropods sign-in. The Edge browser then blocked the app route, so chat authentication and hosted inference remain unverified.
- Only fictional case inputs are intended for model transmission. The Astropods account email was used for the normal sign-in flow; no listing data was sent. Do not send real buyer/seller data.
- Existing PPDC limitations from Issues #10 and #11 remain relevant. This experiment does not resolve general item/model identity, condition reconciliation, or accessory inclusion extraction. The two deterministic misses above are direct examples.
- The existing PR #8 and PR #12 remain open and draft. The AGPL-3.0-only licence is unchanged. The official 100-case assessment and unseen 20-case holdout were not read or run.
## Required next step
1. Resolve the hosted runtime first. Astropods identifies build `fb617573` but marks the only deployment failed, while the available logs still end at the earlier build's `zod` error. Confirm the corrected image is actually running and inspect fresh startup logs before attempting chat access.
2. If Astropods reports the corrected deployment ready, finish sign-in through a browser that can load the authenticated chat route. The automated Edge session hit `ERR_BLOCKED_BY_CLIENT`; the in-app browser stopped at the login page. No password was entered or browser block bypassed.
3. Before any hosted call, recheck the enforced $2 account cap, credit and payment status, and the authenticated user grant. Then run the five fictional cases one turn at a time, recording Auditor proposals and validation decisions, Adviser responses, unsupported claims, missed facts, false alerts, usefulness, per-role token usage, and credit delta. Stop if controls change or the grant is ineffective.
4. Publish this explicitly blocked prototype as a draft PR for Lucy's independent review of the architecture, mocks, and deployment failure. State that hosted role behavior and AI usefulness remain untested. Keep the PR in draft and do not merge; a later revision can add hosted results after the deployment is ready and authenticated.

No hosted inference has occurred. Do not send real buyer/seller data or use the public Render demo.
