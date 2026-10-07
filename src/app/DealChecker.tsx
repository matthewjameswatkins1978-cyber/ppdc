"use client";

import { useEffect, useMemo, useState } from "react";
import type { Deal, Finding } from "@/domain/deal";
import { assessDeal } from "@/domain/assessment";
import { dealFixtures } from "@/domain/fixtures";
import { beforePayFor, changedFacts, evidenceToKeep, formatQuestions, questionsFor } from "@/domain/presentation";

const STORAGE_KEY = "ppdc.phase1.deals";
export default function DealChecker() {
  const [deal, setDeal] = useState<Deal | null>(null);
  const [text, setText] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkoutError, setCheckoutError] = useState("");
  const [researchLoading, setResearchLoading] = useState(false);
  const [researchError, setResearchError] = useState("");
  const [error, setError] = useState("");
  const [copyStatus, setCopyStatus] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    try {
      const savedDeals = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]") as Deal[];
      const last = savedDeals.at(-1);
      if (last && Array.isArray(last.evidence) && Array.isArray(last.findings)) setDeal(assessDeal(last));
    } catch { localStorage.removeItem(STORAGE_KEY); }
    setSaved(true);
  }, []);
  useEffect(() => {
    if (!saved || !deal) return;
    try {
      const previous = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]") as Deal[];
      const others = previous.filter((item) => item.id !== deal.id).slice(-9);
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...others, deal]));
    } catch { setError("This deal could not be saved in this browser."); }
  }, [deal, saved]);

  const counts = useMemo(() => ({
    green: deal?.findings.filter((item) => item.severity === "green").length ?? 0,
    amber: deal?.findings.filter((item) => item.severity === "amber").length ?? 0,
    red: deal?.findings.filter((item) => item.severity === "red").length ?? 0,
  }), [deal]);
  const questions = deal ? questionsFor(deal) : [];
  const changes = deal ? changedFacts(deal) : [];
  const addedEvidence = deal?.evidence.slice(1).filter((evidence) => evidence.source === "user") ?? [];
  const addedEvidenceIds = new Set(addedEvidence.map(({ id }) => id));
  const addedClaims = deal?.materialPromises.filter((claim) => claim.evidenceIds.some((id) => addedEvidenceIds.has(id))) ?? [];

  const conclusion = deal?.conclusion && deal.researchResults?.length
    ? deal.conclusion.replace("No public price or seller checks have been run.", `Public context recorded ${deal.researchResults.length} reference(s); compare variants and condition before drawing a price conclusion.`)
    : deal?.conclusion;

  async function submitEvidence(event: React.FormEvent) {
    event.preventDefault(); setLoading(true); setError("");
    try {
      const form = new FormData(); if (text.trim()) form.set("text", text); if (image) form.set("image", image);
      if (deal) form.set("existingDeal", JSON.stringify(deal));
      const response = await fetch("/api/deals", { method: "POST", body: form }); const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Unable to assess this evidence.");
      setDeal(result.deal); setText(""); setImage(null);
      const input = document.querySelector<HTMLInputElement>("#deal-image"); if (input) input.value = "";
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to assess this evidence."); }
    finally { setLoading(false); }
  }
  function loadFixture(fixture: Deal) { setError(""); setDeal(assessDeal(structuredClone(fixture))); }
  async function copyQuestions() {
    try { await navigator.clipboard.writeText(formatQuestions(questions)); setCopyStatus("Questions copied. Paste them wherever you choose."); }
    catch { setCopyStatus("Copy was unavailable. Select and copy the questions above."); }
  }
  async function continueToSandboxPayment() {
    if (!deal) return; setCheckoutLoading(true); setCheckoutError("");
    try {
      const response = await fetch("/api/checkout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ deal, actionId: crypto.randomUUID() }) });
      const result = await response.json() as { approvalUrl?: string; error?: string };
      if (!response.ok || !result.approvalUrl) throw new Error(result.error ?? "PayPal Sandbox did not return an approval link.");
      window.location.assign(result.approvalUrl);
    } catch (cause) { setCheckoutError(cause instanceof Error ? cause.message : "PayPal Sandbox checkout could not be started."); setCheckoutLoading(false); }
  }
  async function checkPublicContext(provider: "channel3" | "parallel", mode: "live" | "replay" = "live") {
    if (!deal) return; setResearchLoading(true); setResearchError("");
    try {
      const response = await fetch("/api/research", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ deal, provider, mode }) });
      const result = await response.json(); if (!response.ok) throw new Error(result.error ?? "Public research could not be started."); setDeal(result.deal as Deal);
    } catch (cause) { setResearchError(cause instanceof Error ? cause.message : "Public research could not be completed."); }
    finally { setResearchLoading(false); }
  }
  const fixtureName = (id: string) => ({ "friends-family-request": "Friends & Family request", "unexplained-low-price": "Unclear bargain", "coherent-used-guitar": "Clear used guitar", "recipient-changed": "Recipient changed" }[id] ?? "Damaged guitar");
  const severityText = (severity: Finding["severity"]) => ({ green: "✓ CLEAR", amber: "! TO CLARIFY", red: "● CONCRETE CONCERN" }[severity]);

  return <main className="shell">
    <div className="masthead"><div className="brand">PAYPAL DEAL CHECKER</div><span className="local-tag">Sandbox demo · local assessment</span></div>
    <header className="intro"><h1>Understand the deal before you pay.</h1><p>See what the evidence supports, what needs a question and what deserves attention. You decide what to do next.</p></header>
    <div className="workspace">
      <div className="stack">
        {deal && <section className="panel" aria-labelledby="deal-summary"><h2 id="deal-summary">Deal at a glance</h2><div className="deal-summary"><div className="deal-name">{deal.item?.value ?? deal.model?.value ?? "Item not identified yet"}</div>{deal.price && deal.currency && <div className="price">{new Intl.NumberFormat("en-GB", { style: "currency", currency: deal.currency.value }).format(deal.price.value)}</div>}</div><div className="facts">{deal.model && <span className="fact-chip">Model: {deal.model.value}</span>}{deal.condition && <span className="fact-chip">{deal.condition.value}</span>}{deal.deliveryTerms && <span className="fact-chip">{deal.deliveryTerms.value}</span>}</div><p className="subtle">Summary from the evidence provided; seller statements have not been independently verified.</p></section>}
        <section className="panel"><h2>{deal ? "Add information to this deal" : "Start with a listing or message"}</h2>{deal && <button className="secondary" type="button" onClick={() => { setDeal(null); setText(""); setImage(null); setError(""); }}>Start a new deal</button>}<form onSubmit={submitEvidence}><label htmlFor="deal-text">Listing text, seller messages or agreed terms</label><textarea id="deal-text" value={text} onChange={(event) => setText(event.target.value)} rows={5} placeholder="For sale: Fender Player Telecaster. Used, good condition. £450. Tracked postage…"/><label htmlFor="deal-image">Add a screenshot or photo (JPEG, PNG or WebP; up to 8 MB)</label><input id="deal-image" type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => setImage(event.target.files?.[0] ?? null)}/><button className="primary" disabled={loading || (!text.trim() && !image)}>{loading ? "Checking evidence…" : deal ? "Update this deal" : "Assess this deal"}</button></form>{error && <p role="alert" className="error">{error}</p>}</section>
        <section className="panel" aria-labelledby="fixtures-title"><h2 id="fixtures-title">Replay a sample · no external calls</h2><div className="fixtures">{dealFixtures.map((fixture) => <button className="fixture" type="button" key={fixture.id} onClick={() => loadFixture(fixture)}>{fixtureName(fixture.id)}</button>)}</div></section>
        {deal && <section className="panel"><h2>Evidence worth keeping</h2><p className="subtle">A practical record helps you remember what was agreed; it does not guarantee any outcome.</p><ul className="compact-list">{evidenceToKeep(deal).map((item) => <li key={item}>{item}</li>)}</ul></section>}
      </div>
      {deal ? <div className="stack">
        <section className="panel conclusion"><h2>Whole-deal view</h2><p>{conclusion ?? "The available evidence is not enough to form a useful summary yet."}</p></section>
        <section className="panel" aria-labelledby="assessment-title"><h2 id="assessment-title">Deal Assessment</h2><div className="count-row" aria-label="Finding summary"><span className="count green">✓ {counts.green} clear</span><span className="count amber">! {counts.amber} to clarify</span><span className="count red">● {counts.red} concern</span></div><div className="findings">{deal.findings.map((finding) => <article className={`finding ${finding.severity}`} key={finding.id}><p className="finding-label">{severityText(finding.severity)} · {finding.category}</p><h3>{finding.title}</h3><p>{finding.explanation}</p>{finding.whyItMatters && <p><strong>Why it matters:</strong> {finding.whyItMatters}</p>}{finding.recommendedAction && <p><strong>Consider:</strong> {finding.recommendedAction}</p>}{finding.evidenceIds.length > 0 && <p className="subtle">Evidence: {finding.evidenceIds.map((id) => deal.evidence.find((item) => item.id === id)?.label ?? id).join(", ")}</p>}</article>)}</div></section>
        {(changes.length > 0 || addedEvidence.length > 0) && <section className="panel"><h2>What changed?</h2>{changes.length > 0 && <><p className="subtle">The evidence records different details. Compare the original sources; no reason is inferred.</p>{changes.map((change, index) => <div className="changed" key={`${change.field}-${index}`}><strong>{change.field}</strong><br/>{change.text}{change.sources.length > 0 && <div className="subtle">Sources: {change.sources.join(" · ")}</div>}</div>)}</>}{addedEvidence.length > 0 && <><p className="subtle">Additional evidence was added to this Deal. Seller statements remain claims unless independently verified.</p>{addedEvidence.map((item) => <div className="changed" key={`added-${item.id}`}><strong>{item.label}</strong> added to this Deal.</div>)}{addedClaims.map((claim, index) => <div className="changed" key={`${claim.key}-${index}`}><strong>Seller-reported claim:</strong> {claim.value}<div className="subtle">Not independently verified. Sources: {claim.evidenceIds.map((id) => deal.evidence.find((item) => item.id === id)?.label ?? id).join(" · ")}</div></div>)}{addedClaims.some(({ value }) => /professionally repaired|headstock.{0,40}repaired|repaired after/i.test(value)) && <p className="subtle">The disclosed repair could help explain the asking price, but repair quality, current stability, and value remain unverified.</p>}</>}</section>}
        <section className="panel"><h2>Questions worth asking</h2>{questions.length ? <><ul className="question-list">{questions.map((question) => <li key={question}>{question}</li>)}</ul><button type="button" className="secondary" onClick={copyQuestions}>Copy questions</button><span className="subtle" role="status" aria-live="polite"> {copyStatus}</span></> : <p className="subtle">No follow-up questions are currently recorded.</p>}</section>
        <section className="panel"><h2>Check public context</h2><p className="subtle">Optional checks use provider credits and may incur charges if your account is not covered. Replay uses local sample results and makes no external call. Only product details are shared.</p><div className="button-row"><button className="secondary" type="button" disabled={researchLoading} onClick={() => checkPublicContext("channel3")}>Search product references</button><button className="secondary" type="button" disabled={researchLoading} onClick={() => checkPublicContext("parallel")}>Search public context</button><button className="secondary" type="button" disabled={researchLoading} onClick={() => checkPublicContext("channel3", "replay")}>Replay sample</button></div>{researchLoading && <p role="status">Checking public context…</p>}{researchError && <p role="alert" className="error">{researchError}</p>}{deal.researchResults?.length ? <p className="subtle">{deal.researchResults.length} public reference(s) recorded. They may describe different variants or conditions; compare the source details.</p> : null}</section>
        <section className="panel"><h2>What I checked</h2><p className="subtle">Local rules reviewed the evidence you supplied. Public context runs only when requested. Seller identity and payment eligibility have not been verified.</p><details className="provenance"><summary>Show evidence and source details</summary><h3>Evidence you provided</h3><ul className="compact-list">{deal.evidence.map((item) => <li key={item.id}><strong>{item.label}</strong> · {new Date(item.capturedAt).toLocaleString("en-GB")} · {item.source === "user" ? "provided by you" : item.source}</li>)}</ul>{deal.evidenceRefs?.length ? <><h3>Evidence references</h3><ul className="compact-list">{deal.evidenceRefs.map((ref, index) => <li key={`${ref.evidenceId}-${index}`}><strong>{ref.field}:</strong> “{ref.quote}” — {deal.evidence.find((item) => item.id === ref.evidenceId)?.label ?? "evidence"}</li>)}</ul></> : null}{deal.researchRuns?.length ? <><h3>Public checks</h3><ul className="compact-list">{deal.researchRuns.map((run) => <li key={run.id}><strong>{run.provider}</strong> · {run.delivery} · {run.outcome} · “{run.safeQuery}” · checked {new Date(run.checkedAt).toLocaleString("en-GB")}</li>)}</ul></> : <p className="subtle">No public checks have been run.</p>}{deal.researchResults?.length ? <ul className="compact-list">{deal.researchResults.map((result) => <li key={result.id}>{result.url ? <a href={result.url} target="_blank" rel="noreferrer">{result.title}</a> : result.title}{result.merchant ? ` — ${result.merchant}` : ""}{result.price ? ` — ${result.price.currency} ${result.price.amount}${result.price.condition ? ` (${result.price.condition})` : ""}` : ""}</li>)}</ul> : null}<p className="subtle">Unknown or unverified: seller identity, independent item condition and payment eligibility. Deal ID: <code>{deal.id}</code>. Saved in this browser only.</p></details></section>
        <section className="panel"><h2>Before you pay</h2><p className="subtle">Current assessment points to review before you decide.</p><ul className="compact-list">{beforePayFor(deal).map((finding) => <li key={finding.id}><strong>{severityText(finding.severity)}:</strong> {finding.title}</li>)}</ul>{!deal.findings.length && <p>No assessment findings are available yet.</p>}<div className="subsection"><h3>Your decision · PayPal Sandbox</h3><p className="subtle">This prototype opens Sandbox only. It does not charge a real PayPal account or card. Continuing is your explicit choice.</p>{deal.price && deal.currency?.value === "GBP" ? <><p><strong>Sandbox amount: {new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(deal.price.value)}</strong></p><button className="primary" type="button" onClick={continueToSandboxPayment} disabled={checkoutLoading}>{checkoutLoading ? "Opening PayPal Sandbox…" : "Continue with PayPal Sandbox"}</button></> : <p>Sandbox checkout needs a clear GBP price first.</p>}{checkoutError && <p role="alert" className="error">{checkoutError}</p>}<p className="subtle">A Protection Passport is created only after PayPal’s server API confirms a completed capture.</p></div></section>
      </div> : <div className="stack"><section className="panel"><h2>Your assessment will appear here</h2><p className="subtle">Start with a listing, message or screenshot. You can replay samples without contacting a provider.</p></section></div>}
    </div>
    <footer>Green, amber and red describe the evidence found, not whether a seller is trustworthy or fraudulent. “Before you pay” is a review aid, not a decision. <a href="https://github.com/matthewjameswatkins1978-cyber/ppdc" target="_blank" rel="noreferrer">Source code</a></footer>
  </main>;
}
