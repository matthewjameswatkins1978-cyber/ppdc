# PPDC AI Experiment 001 — Results and review gate

**R1 state (9 October 2026): corrected runtime recovered; hosted inference blocked by access.** Astropods revision 3 on build `fb617573` reached ready with zero restarts, then the single deployment was paused after Edge blocked the authenticated chat route. The production image also passed a complete local agent-plus-messaging startup. No hosted model request was sent, so AI reasoning quality remains untested.

## Gate evidence (8 October 2026)
- Rodric Rabbah's Astropods Discord response confirms the first hosted agent's hosting costs are waived for the hackathon and a $10 promotional credit is available for AI Gateway token use. He recommends one agent with an internal dispatcher for the two roles.
- `ast billing get` immediately before deployment and inference showed $0.01 usage spend, $0 billed, $9.99 credit remaining, a $1 warning, and an enforced $2 spend limit. `ast billing status` showed active, no payment method, no credits spent, and enforcement active. The account billing UI confirms the cap pauses agents before the $10 credit is exhausted.
- The new blueprint `ppdc-ai-experiment-001` is **private**. The original `ppdc-ai-brain` remains unchanged and private with zero deployments.
- Docker Desktop 29.8.1 is running. The corrected local image build and pipeline import smoke pass; the Astropods Linux amd64 build and private registry push produced build `fb617573`. The deployment dry-run passed.
- Exactly one deployment exists: `ogc-v3g-r5y`, using authenticated `web` access granted only to the verified Astropods user ID. `ast agent get` reports build `fb617573` but deployment status **failed** because the agent container keeps crashing. Available logs still show the earlier `zod` resolution error from before the Dockerfile correction, so the corrected build's startup cause is not yet confirmed. A plain unauthenticated GET to the launch URL returned HTTP 302 to Astropods sign-in; it is not an open inference endpoint.
- **Hosted inference has not started.** `ast agent trace` reports 0 traces; `ast agent usage` reports 0 tokens and $0 model cost. No promotional credit was consumed by this experiment. The account remained at $0.01 usage spend, $0 billed, $9.99 credit remaining, and the enforced $2 cap.
- The chat route redirects to Astropods sign-in. After a normal sign-in attempt, Microsoft Edge blocked the returned `*.agents.astropods.ai` page (`ERR_BLOCKED_BY_CLIENT`); the in-app browser returned to the Astropods login page. No password was entered, no security block was bypassed, and no synthetic listing was sent to the model. Authentication must be completed by the user before hosted cases can run.
- The five mock tests pass. Typecheck, spec validation, local image build, Astropods blueprint build, and `git diff --check` pass. No PayPal transaction, Render action, benchmark case, or holdout case was run or loaded.
## R1 runtime recovery and first-trial gate (9 October 2026)

### Gate A — hosted runtime diagnosis
- Exact experiment PR #13 starting head: `63b7f29908770ee1889b2e4bd2cfa32a4f3a6ece`; base remains current PR #12 branch head `3c73720ef004c1ea1af8e2d93d5edc463ac6424c`. Lucy's review recommends keeping the PR draft and withholding any quality claim until corrected-build evidence exists.
- The original `d6a5c400` image failed with `Cannot find module 'zod'`, from `/app/src/domain/deal-extraction.ts` imported by `/app/src/domain/extract-text.ts`. The old TSX runtime lived in `/app/experiments/ai-experiment-001/agent/node_modules`; Node resolving imports from `/app/src/domain` does not search that sibling directory. The minimal Dockerfile correction puts dependencies in `/app/node_modules`, where both the agent and `/app/src/domain` imports resolve them.
- `fb617573` is the corrected build. Deployment history shows revision 2 on that build was undeployed and revision 3 became active. Before pausing, `ast agent get` showed active/ready, one replica, both workloads ready, and zero restarts. After the access gate failed, revision 3 was paused; the current deployment is inactive/paused with zero replicas. The CLI does not expose an image digest beyond build ID `fb617573`.
- `ast agent logs --workload agent/app` returned `No logs found` for the corrected build. The initial `zod` exception is directly evidenced for the earlier image; the intervening failed status for corrected-build revision 2 has no fresh diagnostic log, so that transient status's cause remains unknown.
- The spec selects Gateway model `gpt-5-6-luna`. Astropods' spec documentation says Gateway configuration injects its URL/key and selected model at deployment. The account vault and `main` environment list no user-provided secrets or variables. The hosted process's actual environment values were not read. During local container diagnostics, the ephemeral local-development `ASTRO_GATEWAY_API_KEY` appeared in a tool output. It was not committed or included in the PR; no model call occurred, the local services were stopped, and the key was short-lived (up to 24 hours). Treat it as exposed until expiry or revocation is confirmed. Model availability was not tested with an inference request.

### Gate B — full local startup
- The final production-stage Docker image uses Node `v24.21.0`, `NODE_ENV=production`, `USER node` (UID 1000), working directory `/app/experiments/ai-experiment-001/agent`, and command `npm start`. The image resolves `zod` from `/app/node_modules/zod/index.cjs` and loads the Astropods messaging package.
- `ast project start --background --no-pull` built and started the agent with the Astropods messaging sidecar. Fresh local logs show the agent connected to `astro-messaging:9090` with health `HEALTHY`, sent its config, and reported it ready and listening. This verifies the `serve(adapter)` startup path, not a model call or authenticated hosted chat. The local development sidecar logged that authorization is disabled in dev mode; this was a localhost-only test, not the hosted deployment. `ast project stop` stopped the local services.

### Gates C–D — checks, dependencies, billing and access
- The startup correction was already present in the reviewed PR head; no application-code change was needed in R1. Experiment mocks: 5 passed. PPDC TypeScript check: passed. Astropods spec validation: passed. Local Docker build and full service startup: passed. Secret-pattern scan found no credentials in the PR files. No official benchmark or holdout was read or run.
- `npm audit` reports 9 moderate transitive OpenTelemetry advisories, with no high or critical findings. The suggested `@astropods/adapter-core` fix is a major downgrade to `0.4.1`; it was not applied without compatibility evidence. `npm ci` uses lock-resolved package versions (`adapter-core 0.13.1`, `messaging 0.2.0`, `tsx 4.23.15`, `zod 4.6.5`). Broader deployment remains gated on triage.
- Astropods support confirmed the first-agent hosting waiver and $10 Gateway credit on 8 October. Current `ast billing agents` attributes 4.0227 compute CU-hours to this deployment at `$0.00`, consistent with the waiver. `ast billing get/status`: `$9.98909108` credit remains, `$0` current spend, no payment method, `$1` warning, and enforced `$2` cap. The `$0.01090892` account usage is attributed to the `Local dev` feature and matches the earlier pretrial snapshot; no increase attributable to this R1 run was observed. Hosted agent traces, tokens, and model cost remain zero. Personal money billed: £0.
- `ast whoami` matches the intended single-user identity previously granted to the authenticated `web` adapter. An unauthenticated HTTP request redirects to Astropods sign-in. The authenticated launch route in Edge returned `ERR_BLOCKED_BY_CLIENT`; no password was entered, no browser control was bypassed, and the authenticated chat page was not reached. GitHub reports no PR-head CI checks, so CI is **NOT RUN**.

### Gate E — hosted trial and quality result
- **Hosted cases completed: 0/5.** The five local deterministic baselines remain documented below; neither hosted role ran. No role output exists to assess accepted Auditor corrections, unsupported Adviser claims, missed facts, false payment warnings, usefulness, per-role tokens, or credit delta. These are **NOT RUN / NOT ASSESSABLE**, not zero-error results.
- The isolated Adviser output path caps its own questions at four and passes them through PPDC's deterministic prioritizer/deduplicator. A combined PPDC-plus-Adviser/UI question list is not produced or tested; final question cap is **PARTIAL**, and UI integration readiness is not claimed.
- Keep the Auditor limitation explicit: its validator accepts only candidates PPDC already extracted, so it cannot recover omitted facts or repair an incorrect deterministic interpretation. Adviser citation-ID checks do not semantically prove the associated prose. The AI001-D condition contradiction and AI001-E adapter unknown remain uncorrected baselines, not hosted AI outcomes.
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
## Current stop and handoff
1. The original `zod` startup error was corrected in build `fb617573`; revision 3 ran ready with zero restarts. Corrected-build logs are unavailable, and the earlier transient failed status on revision 2 remains unexplained.
2. Hosted trial access is blocked: Edge returned `ERR_BLOCKED_BY_CLIENT` for the authenticated route. No browser control was bypassed and no password was entered. The deployment is paused and has zero replicas to suspend metering.
3. PR #13 remains draft and unmerged. Stop here for Lucy's independent review of this R1 recovery evidence. If the authenticated route later becomes available through supported browser access, resume the same deployment only after rechecking billing and the single-user grant, then run the five fictional cases one at a time under the existing cap.

No hosted inference, PayPal transaction, Render action, official benchmark, or holdout run occurred. Do not send real buyer/seller data.
