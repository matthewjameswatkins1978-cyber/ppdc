# Project Scope

## Project Name Candidates

- PayPal Deal Checker (current name)

## One-Line Summary

Help a buyer understand the evidence, uncertainties and concrete concerns in a consumer deal before they choose whether to pay, then record the agreed deal and checkout-time evidence in a Protection Passport.

## Target User

Anyone considering a consumer purchase from a listing or offer and wanting to understand the whole deal before paying. The MVP demonstrates the workflow with a UK used-guitar listing; it must not encode UK or second-hand goods as the product’s only audience.

## Problem

Deal information is scattered across listing text, product details, price comparisons, delivery terms, seller claims and payment-protection conditions. A single “good price” label misses important uncertainty and contradictions. Buyers need a clear, evidence-linked account of what is known, what is inferred and what remains unverified before they decide.

## Core Workflow

1. The user pastes messy listing text or supplies a screenshot.
2. The app extracts a structured Deal: product/variant, condition, item price, shipping and other stated costs, seller claims, listing/source details, and stated return or protection terms. It preserves source text and marks missing fields unknown.
3. The app checks public product/price information where useful and gathers supporting evidence about the listing’s claims and terms. Every result is attributed to a source and time. Public-search results are supporting evidence, not a seller-reputation score.
4. The app presents a Deal Assessment. Green means confirmed or coherent elements; amber means something needs understanding or clarification; red means a concrete concern, contradiction or protection problem. Each finding says whether it is known, inferred or unverified, and shows its evidence or limitation.
5. A plain-language conclusion explains what the whole deal adds up to and what the buyer could consider doing next. It does not say that a seller is trustworthy or fraudulent, calculate a “scam percentage,” or imply that green means risk-free.
6. The user chooses whether to continue. Only an explicit Continue action starts PayPal Sandbox checkout. The prototype does not process real money.
7. After a successful sandbox payment, the app creates a Protection Passport recording the agreed deal, payment reference/status, time, assessment and evidence available at checkout. It describes the record accurately and does not promise a protection outcome.

## What We Are Building

- One approachable TypeScript/Next.js web application with one end-to-end purchase scenario.
- Text and screenshot intake that produces a reviewable structured Deal.
- A small, transparent assessment model using green/amber/red findings and the labels known, inferred and unverified.
- Routed public research adapters: Channel3 for product identity/specifications/reference pricing and Parallel for broader public-web context. Select the provider from the question; call both only when the question needs both. Search results support the assessment and never replace deal evidence.
- A concise whole-deal conclusion and a human-controlled Continue step.
- A working PayPal Sandbox checkout, followed by a checkout-time Protection Passport on successful payment.
- Clear source attribution, timestamps, missing-data handling and honest limitations throughout the demo.

## What We Are Not Building

- A fraud detector, scam-probability score, seller-trust verdict or guarantee that a transaction is safe.
- An automatic purchase flow, real-money payment, production payment system or real buyer-protection determination.
- A general marketplace, price tracker, exhaustive product catalogue or best-pick recommender.
- Seller background checks or broad claims based on a seller’s identity.
- Sponsor infrastructure without a specific, demonstrated need.
- A polished multi-feature product before the single end-to-end flow works.

## Inspiration And References

- Visual product identification: turn a screenshot/photo into candidate structured product details, while showing what was and was not recognized.
- Price-comparison tools: use comparable offers as context, with source and condition differences visible instead of reducing the answer to one “fair price.”
- Digital receipts: preserve a compact, time-stamped record of the terms and evidence present when the buyer proceeded.

These are interaction patterns, not commitments to copy a particular service or its design.

## Demo Path

Use one clearly identified UK used-guitar scenario. The participant pastes listing text or supplies a screenshot; the app extracts the guitar, condition, price, shipping, seller claims and stated payment/return terms; then it displays sourced public price context plus the green/amber/red Deal Assessment. The conclusion distinguishes evidence from inference and unknowns. The buyer explicitly selects Continue, completes the PayPal Sandbox flow, and sees a Protection Passport tied to that successful sandbox payment and the evidence snapshot. Label any synthetic demo listing content as illustrative; do not present it as a real seller or live listing.

## Submission Story

Show the complete decision path in a short working demo: messy listing input becomes an evidence-linked assessment; the human decides; PayPal Sandbox executes; the Passport records what existed at payment time. The story is about helping people make a better-informed purchase decision, not detecting or guaranteeing fraud. Keep the public repository and reproducible demo instructions aligned with what actually works.
