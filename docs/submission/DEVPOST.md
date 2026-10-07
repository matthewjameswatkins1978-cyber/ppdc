# Devpost Submission Copy — Draft

**Status:** Draft only. The current authenticated submission form has not been inspected. Sign-in is required before exact field names and required values can be confirmed. Do not submit from this document.

## Project name

PayPal Deal Checker

## Tagline

Check the deal before you pay.

## One-line summary

A human-led purchase assistant that turns fragmented evidence into a clear deal assessment, useful questions and a payment-time record after PayPal Sandbox checkout.

## Problem

A purchase decision can be scattered across a listing, screenshots, messages, photos, price, delivery promises and payment requests. Buyers may have to decide before those details form one coherent picture.

## Solution

PayPal Deal Checker organises the evidence around a Deal and separates stated facts, supported findings, inferences and unknowns. Green, amber and red findings explain what appears coherent, what deserves clarification and what is a concrete concern. It can add bounded product context where available, and it abstains when comparisons do not support a useful price conclusion. New evidence updates the same Deal and makes the change visible.

The buyer remains in control. Only an explicit human Continue action enters PayPal Sandbox checkout. After PayPal confirms a completed Sandbox capture, PPDC creates a Protection Passport containing the payment-time understanding and its evidence.

## PayPal integration

The demo uses PayPal Sandbox Orders. The buyer approves the order; the server captures only after an APPROVED state, protects against duplicate capture, performs a fresh PayPal read, and creates the Passport only after authoritative COMPLETED confirmation. This demonstrates an integration flow and does not imply PayPal endorses PPDC or guarantee buyer-protection eligibility.

## AI and research

The public demo uses evidence-grounded assessment controls and may use bounded, sanitised Channel3 product research. External research is supporting evidence, not a verdict. Public Gemini is disabled. No model, provider, fixture or tool can authorise payment.

## What is new

PPDC focuses on evidence and the questions it supports rather than a seller verdict. It shows what changed when new evidence arrives, can abstain when price comparisons are inadequate, keeps payment authority with the buyer, and preserves the payment-time context in a Protection Passport after verified Sandbox completion.

## Intended impact

Buyers can see what is known and what still needs clarification. Legitimate sellers may benefit when a gap can be resolved with evidence rather than treated as automatic suspicion. No measured fraud reduction or other impact result is claimed.

## Technology

Next.js and TypeScript; PayPal Sandbox Orders API; bounded Channel3 product research; local OCR with Tesseract.js; Zod structured validation; deterministic assessment and payment safeguards; Render Free deployment. Include only technologies verified in the submitted revision.

## Challenges and learnings

The work required distinguishing evidence from inference, limiting private information in public research, keeping product-price context conservative, preventing AI or tool output from authorising payment, and preserving the deal evidence through a verified Sandbox checkout. Useful warnings must not become unsupported accusations about a seller.

## Open source

Source: https://github.com/matthewjameswatkins1978-cyber/ppdc

Licence: AGPL-3.0-only. Copyright © 2026 Matthew Watkins. Alternative commercial licensing may be available separately.

## Demo

https://paypal-deal-checker-demo.onrender.com

The public demo uses PayPal Sandbox only. Render Free may sleep after inactivity; allow time for the service to wake.

## Final claim audit

Before submission, compare every statement with the final public app and code/tests. Remove unsupported claims such as “fraud detector,” “detects scams,” “prevents fraud,” “guarantees protection,” “safe seller,” “trustworthy seller,” “fraudulent seller,” “guaranteed safe,” “accurate price,” “real-time market value,” or “production PayPal.”

## Pending form review

After Matthew signs in, inspect the actual Devpost fields and required team/entrant details. Map this draft to those fields, revise only as needed, then review the submission preview with Matthew. Do not publish or submit without his explicit approval.
