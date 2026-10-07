# PPDC Release and Submission Checklist

## Phase 5A closure evidence

- [x] PR #6 squash-merged to `main`: `23cbe7e4957c720688d1a0d635ab9fabf2c67eb5`.
- [x] Render existing service remains Free, without a card, on deployment branch `main`; it deployed the merge commit.
- [x] Public app responded over HTTPS after wake-up at https://paypal-deal-checker-demo.onrender.com.
- [x] Phase 5A record confirms one intended £155 Sandbox capture, attempted only after APPROVED, followed by a fresh COMPLETED verification and Passport. Duplicate-capture protection passed. No live PayPal or real money was used.
- [x] PayPal Sandbox only; Channel3 configured for bounded research; public Gemini disabled.
- [x] README no longer claims public credentials are absent or Sandbox checkout is unavailable; it describes Render Free sleep and non-durable server state.

## Repository and release

- [x] Repository is public and source licence is AGPL-3.0-only.
- [x] Public demo URL is current.
- [x] Phase 5B work is on `feature/ppdc-phase-5b-submission`, based on merged `main`.
- [x] Final Phase 5B review: only the three intended submission docs are staged; no private screenshots; `.env` is ignored.
- [ ] Phase 5B CI green and PR reviewed.
- [ ] After approved merge: local `main` equals `origin/main`, worktree clean, Render still on `main`, public app healthy.

## Application and public smoke

- [x] App loads publicly after Render has awakened; PayPal Sandbox action appears at the human decision point.
- [x] Repaired-guitar text and seller repair follow-up were exercised; same Deal updated and “What changed?” showed the new unverified claim.
- [x] Conflicting-console text with separate `Model:` evidence was exercised; contradictions and Friends & Family concern appeared with evidence sources.
- [x] Ordinary console scenario was exercised; coherent stated details remained restrained, working-condition claim stayed unverified, and no price verdict was invented.
- [x] Source link was visible in the public app.
- [x] Fresh Chrome session loaded the landing page with no Deal or personal content; a local replay sample produced an assessment without external provider calls.
- [x] Fresh public demo had no browser console errors; at 390px viewport document width stayed within the viewport, and Tab moved from the Deal textbox through the screenshot input to replay controls.
- [ ] Exercise **Questions worth asking**, its Copy action, and **What I checked** in the public app. Avoid overwriting Matthew’s clipboard during verification.
- [ ] Verify cancel/return path as part of final demo readiness; do not create another Sandbox order solely for this checklist.

## PayPal

- [x] Sandbox only; explicit human Continue action required.
- [x] Server capture follows APPROVED state and has duplicate protection.
- [x] Fresh COMPLETED verification gates Passport creation.
- [x] Phase 5A rehearsal created one verified Passport after completion.
- [ ] Reconfirm current public return and cancel experience after service wake-up before recording. Render Free cold start can delay first return; treat a first-request timeout as inconclusive until the service is awake.

## Research and privacy

- [x] Public research path is bounded and sanitised; no Gemini is enabled publicly.
- [x] Current guitar comparison set was insufficient for a reliable price verdict; the demo story states this limitation.
- [x] Assessment does not infer seller intent or treat price alone as fraud evidence.
- [ ] Confirm provider failure and insufficient-comparison states during final recording rehearsal if used.

## Video

- [x] Demo story targets 2:35, with a 2:45 hard stop.
- [ ] Record under three minutes, synthetic data only, no secrets/password/autofill/real card; show Sandbox and Passport.
- [ ] Matthew reviews the final recording and approves any video destination/publication.
- [ ] Final title and description reviewed.

## Devpost

- [x] Draft project copy prepared in `DEVPOST.md`; repository, demo URL and AGPL-3.0-only are included.
- [ ] Inspect actual required fields and rules in the authenticated Devpost submission form; current browser session is signed out.
- [ ] Fill and review the final submission preview, including entrant/team details and technology fields.
- [ ] Matthew explicitly approves submission. Do not submit yet.

## Final checks before Phase 5B merge

- [x] `npm test` — 65 passed.
- [x] `npm run typecheck`.
- [x] `npm run build`.
- [x] `npm run ocr:smoke`.
- [x] `python scripts/validate-benchmarks.py` — 32 cases passed.
- [x] `npm audit --audit-level=low` — 0 vulnerabilities.
- [x] `git diff --check`.
- [x] Secret scan of tracked files and staged docs: no configured `.env` values or high-confidence credential tokens; `.env.example` contains placeholders only. Phase 5B history will be checked after commit.
- [ ] Review full PR diff and CI.

## Cost and scope

- [x] Render remains Free; no card attached and no paid compute.
- [x] No Gemini public key or paid model calls; no new live PayPal rehearsal was performed for documentation work.
- [x] No additional sponsor infrastructure, product features or databases added.
- [x] Real money spent: £0.

## Remaining human actions

- Sign in to Devpost so the actual submission form can be inspected.
- Review the demo script, record/approve the final video, and approve any video publication.
- Review the Devpost preview and explicitly approve final submission.
