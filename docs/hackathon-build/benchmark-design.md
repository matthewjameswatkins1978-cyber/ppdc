# PPDC-BENCH-001 — benchmark design and handoff

## Mission and boundary

This pack evaluates the existing PayPal Deal Checker against synthetic, replayable deal inputs. It does not implement another checker or modify production assessment, UI, PayPal payment, search, model adapters, package metadata, persistence, or deployment. It uses the existing domain's `fact` / `paypal_rule` / `inference` / `unknown` assertion kinds, evidence references, and green/amber/red findings.

## Design decisions

The benchmark has three lanes: model testing, red teaming, and human comprehension. It rewards evidence-linked facts, faithful unknowns, bounded conclusions, and useful clarification. Exact generated prose is deliberately not a gold target. Semantic findings specify required category, severity and allowed range, policy reference, required/forbidden concepts, and action class. Public research cases specify a product-only query and forbidden private fields. Model and tool output are untrusted data, not instructions. Payment authority is tested as an application state boundary, not as model wording.

Fixtures are fictional and include both coherent and concerning deals. In particular: cheap does not mean scam; new seller does not mean scam; sparse public information does not mean scam; urgency alone does not mean scam; green is not a guarantee; red is not a personal accusation; unknown does not mean negative.

## Sources and limits

The source registry was checked on 2026-10-07. It prioritizes PayPal UK help/legal/security material for this en-GB suite, followed by FTC consumer advice and OWASP, NCSC, and NIST technical guidance. Registry entries paraphrase only the rule needed by listed cases. PayPal describes item-not-received, little/no-value, imposter, refund/overpayment, investment, invoice, urgency, postage-label and package-rerouting patterns. Shipping guidance primarily concerns seller protection, so the benchmark does not turn it into a buyer eligibility rule. PayPal protection is transaction- and category-specific; do not promise eligibility or an outcome based only on Goods and Services. The UK policy record specifically covers vehicle exclusions and distinguishes the claim windows for Item Not Received and Significantly Not as Described. FTC guidance is marked US jurisdiction and informs general marketplace-evidence checks, not UK legal claims.

The NIST AI RMF Generative AI Profile supports a complementary mix of expert, adversarial, and human feedback evaluation. The three benchmark lanes are a practical design choice, not a claim that NIST mandates this exact structure. OWASP and NCSC materials inform adversarial test categories and tool boundaries.

## Phase 1 handoff

Wire these ten cases first: `CORE-01`, `CORE-05`, `CORE-10`, `CORE-13`, `CORE-17`, `CORE-18`, `CORE-22`, `ADV-01`, `ADV-03`, and `ADV-08`. Together they cover a normal purchase, a coherent bargain, unknown pricing, Friends and Family, urgency without overreaction, compound concern, missing evidence, direct injection, privacy-safe research, and the explicit human payment gate. Keep model outputs and public results recorded; do not call live services to build the suite.

## Acceptance and status

All 24 core and 8 adversarial cases must validate against the schema. Four human scripts are material only; no participants have been recruited or tested. The scorecard defines hard failures and separate metrics. This pack establishes evaluation inputs and expectations; it does not establish a passing baseline for the current app.
