# PPDC evaluation benchmark

PPDC-BENCH-001 is a small, offline, replayable evaluation pack for the existing PayPal Deal Checker. It tests whether extraction and assessment explain the evidence a buyer has, preserve what remains unknown, and keep payment authority with the human. It is not an assessment engine, policy registry, fraud classifier, or live-search tool.

The three lanes are **model testing** (24 canonical deals), **red teaming** (8 adversarial cases), and **human comprehension** (4 moderator scripts). All deal examples and people are synthetic. Research records are snapshots of public, authoritative guidance; cases use no live APIs or model calls.

## Structure

- `source-registry.json`: source IDs, canonical URLs, jurisdiction, verification date, paraphrased rule, and case coverage.
- `schemas/deal-benchmark-case.schema.json`: JSON Schema for machine-readable cases.
- `cases/core/` and `cases/adversarial/`: replay inputs and semantic expectations.
- `human/`: short scripts for later formative comprehension checks; no study has been run.
- `scorecard.md`: metrics, hard failures, and interpretation.
- `../docs/hackathon-build/benchmark-design.md`: design decisions and handoff order.

## Case shape

Each JSON case contains a synthetic deal input, evidence items with IDs and privacy labels, expected facts with assertion kind and evidence pointer, unknowns, semantic finding expectations, follow-up questions, sanitized research expectations, conclusion concepts, hard-failure conditions, and source IDs. Findings allow only explicit severity ranges. Do not compare generated prose verbatim; compare meaning, evidence linkage, policy rule references, and action boundaries. The current app's vocabulary is `fact`, `paypal_rule`, `inference`, `unknown`, plus `green`, `amber`, and `red` findings. These fixtures test that vocabulary without changing app types.

## Running and interpreting

The pack is data, not a runner. Validate every JSON file against the schema, then adapt the selected cases to the current app's test harness or replay captured outputs offline. Record the app revision, model/provider and adapter version, fixture revision, and any skipped capability for each run. Never silently count provider errors as successful research. Keep extracted facts, grounding, findings, policy correctness, safety, privacy, injection resistance, and payment authority as separate results.

Any hard failure in `scorecard.md` fails that case/run regardless of average score. For subjective severity, use the allowed range and report agreement; do not soften an expectation without a documented design reason. Uncertainty is a valid result and should score better than unsupported certainty.

## Adding a case

1. Give it the next stable ID and a synthetic scenario that tests a distinct behavior.
2. Include only evidence available to the simulated app; cite exact evidence IDs for expected facts.
3. Record missing evidence as unknown, not as a negative fact.
4. Add semantic findings with narrow allowed severities and relevant source IDs.
5. State privacy-safe query concepts and forbidden private fields where research is needed.
6. Run schema validation and review the fixture for real-person details, unsupported policy claims, and unintended ambiguity.
7. Update the suite counts and report the benchmark revision used.

Do not add cases merely to inflate suite size. Keep tests offline and synthetic. Re-check policy sources before changing policy expectations. This first pack is a benchmark design baseline, not proof that the application passes it.

## First ten for automated integration

`CORE-01`, `CORE-05`, `CORE-10`, `CORE-13`, `CORE-17`, `CORE-18`, `CORE-22`, `ADV-01`, `ADV-03`, `ADV-08` cover ordinary coherence, explained bargains, price uncertainty, payment protection, non-overreaction, compound concerns, incomplete evidence, prompt injection, search privacy, and explicit human payment authority.
