# PPDC AI Experiment 001

Status: isolated synthetic-only quality experiment. This is not a production launch.

One private Astropods deployment runs two sequential roles through an internal dispatcher. PPDC first extracts and assesses the synthetic evidence. The Evidence Auditor receives original source segments plus that deterministic result and may propose only candidates already present in PPDC's source-aware candidate set. PPDC validates the source ID, exact quote, offsets, value, polarity, time and intent. Only accepted proposals and deterministic PPDC facts/findings go to the Deal Sense Adviser. PPDC validates the adviser's strict response shape, citation IDs, question limits and prohibited authority language before presentation. The AI cannot set findings or severity, change payment authority, or take a buyer action.

The dispatcher uses the Astropods messaging adapter core and OpenAI-compatible AI Gateway calls. It does not install a tracing or observability adapter, emit trace context, or persist conversational memory. The deployment uses the authenticated `web` adapter; never use `insecure-web` or grant web access to `anyone`. All inputs in this experiment are fictional.

## Cases

`synthetic-cases.json` contains five new fictional cases: coherent ordinary sale, Friends & Family request, explicit rejection of Friends & Family, conflicting item/condition evidence, and an ambiguous untested item. IDs are new and do not reuse the frozen 100-case or unseen holdout suites.

## Run mock tests

From the repository root:

```powershell
node --conditions=react-server --import tsx --test experiments/ai-experiment-001/agent/pipeline.test.ts
```

No API key or hosted call is needed for these tests.

## Hosted run controls

Before hosted inference, verify the account has the first-agent hosting waiver, promotional credit, no payment method, and an enforced spend cap below remaining credit. Recheck immediately before inference. Keep the adapter list to authenticated `web`; no public grant. Run mock tests first. Submit one case per chat turn and stop if usage approaches the hard cap. Record gateway token usage from each response and account spend/credit before and after. Do not inspect/run frozen benchmark or holdout inputs.

Run Astropods blueprint commands from `experiments/ai-experiment-001/agent`, where `astropods.yml` is the project root. The spec uses the repository root as its build context. Publish only as private with `ast blueprint push -V private`; never push the existing `ppdc-ai-brain` blueprint. Deploy only the authenticated `web` adapter with a single-user grant.

## Known limits

The deterministic validation gate prevents novel or altered facts, but it cannot prove that model prose accurately summarizes otherwise valid evidence. The Adviser is a quality experiment, not a policy oracle. Its prose is checked for shape, source IDs, questions, and prohibited authority claims; independent human review must still assess semantic accuracy. One account spend cap is shared across all agents and usage. Astropods' platform retention and operational logs are outside this code's control; therefore only the five fictional cases may be sent.

This experiment follows Issue #10's findings on negation, F&F, conflicts, and attribution, and Issue #11's source-bound candidate, deterministic validation, and no-authority boundaries. It does not claim to resolve broader item identity, mixed-field condition, or price-role issues.