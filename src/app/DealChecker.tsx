"use client";

import { useEffect, useMemo, useState } from "react";
import type { Deal } from "@/domain/deal";
import { assessDeal } from "@/domain/assessment";
import { dealFixtures } from "@/domain/fixtures";

const STORAGE_KEY = "ppdc.phase1.deals";
const colors = { green: "#18794e", amber: "#946200", red: "#b42318" } as const;

export default function DealChecker() {
  const [deal, setDeal] = useState<Deal | null>(null);
  const [text, setText] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
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

  async function submitEvidence(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true); setError("");
    try {
      const form = new FormData();
      if (text.trim()) form.set("text", text);
      if (image) form.set("image", image);
      if (deal) form.set("existingDeal", JSON.stringify(deal));
      const response = await fetch("/api/deals", { method: "POST", body: form });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Unable to assess this evidence.");
      setDeal(result.deal); setText(""); setImage(null);
      const input = document.querySelector<HTMLInputElement>("#deal-image");
      if (input) input.value = "";
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to assess this evidence."); }
    finally { setLoading(false); }
  }

  function loadFixture(fixture: Deal) {
    setError("");
    setDeal(assessDeal(structuredClone(fixture)));
  }

  return (
    <main style={{ maxWidth: 980, margin: "0 auto", padding: "32px 20px 64px", color: "#172b4d", fontFamily: "system-ui, sans-serif" }}>
      <header style={{ marginBottom: 28 }}>
        <p style={{ color: "#176b87", fontWeight: 700, letterSpacing: 1 }}>PAYPAL DEAL CHECKER · PHASE 1</p>
        <h1 style={{ fontSize: "clamp(2rem, 5vw, 3.5rem)", margin: "8px 0" }}>Understand the deal before you pay.</h1>
        <p style={{ fontSize: 18, maxWidth: 700 }}>See what is clear, what needs a question, and what raises a concrete concern. You decide what to do next.</p>
        <p role="status" style={{ display: "inline-block", background: "#e8f4f7", padding: "8px 12px", borderRadius: 8 }}>Local assessment · no live AI or search calls</p>
      </header>

      <section style={{ border: "1px solid #d8dee8", borderRadius: 14, padding: 20, marginBottom: 20 }}>
        <h2>{deal ? "Add evidence to this deal" : "Start with the listing or message"}</h2>
        {deal && <button type="button" onClick={() => { setDeal(null); setText(""); setImage(null); setError(""); }}>Start a new deal</button>}
        <form onSubmit={submitEvidence}>
          <label htmlFor="deal-text">Paste listing text, seller messages, or agreed terms</label>
          <textarea id="deal-text" value={text} onChange={(event) => setText(event.target.value)} rows={6} style={{ display: "block", width: "100%", boxSizing: "border-box", margin: "8px 0 16px", padding: 12, border: "1px solid #8993a4", borderRadius: 8, font: "inherit" }} placeholder="For sale: Fender Player Telecaster. Used, good condition. £450. PayPal Goods & Services. Tracked postage..." />
          <label htmlFor="deal-image">Or add a screenshot/photo (JPEG, PNG or WebP; up to 8 MB)</label>
          <input id="deal-image" type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => setImage(event.target.files?.[0] ?? null)} style={{ display: "block", margin: "8px 0 16px" }} />
          <button disabled={loading || (!text.trim() && !image)} style={{ background: "#075985", color: "white", padding: "11px 18px", border: 0, borderRadius: 8, font: "inherit", fontWeight: 700, cursor: "pointer" }}>{loading ? "Checking evidence…" : deal ? "Update this deal" : "Assess this deal"}</button>
        </form>
        {error && <p role="alert" style={{ color: colors.red }}>{error}</p>}
      </section>

      <section aria-labelledby="fixtures-title" style={{ marginBottom: 28 }}>
        <h2 id="fixtures-title">Replay a sample · no external calls</h2>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {dealFixtures.map((fixture) => <button key={fixture.id} onClick={() => loadFixture(fixture)} style={{ padding: "9px 12px", border: "1px solid #8993a4", borderRadius: 8, background: "white", cursor: "pointer" }}>{fixture.id === "friends-family-request" ? "Friends & Family request" : fixture.id === "unexplained-low-price" ? "Unclear bargain" : fixture.id === "coherent-used-guitar" ? "Clear used guitar" : fixture.id === "recipient-changed" ? "Recipient changed" : "Damaged guitar"}</button>)}
        </div>
      </section>

      {deal && <>
        <section aria-labelledby="assessment-title">
          <h2 id="assessment-title">Deal Assessment</h2>
          <p aria-label="Finding summary"><strong style={{ color: colors.green }}>● {counts.green} clear</strong>　<strong style={{ color: colors.amber }}>● {counts.amber} to clarify</strong>　<strong style={{ color: colors.red }}>● {counts.red} concrete concern</strong></p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 12 }}>
            {deal.findings.map((finding) => <article key={finding.id} style={{ border: `1px solid ${colors[finding.severity]}`, borderLeftWidth: 6, borderRadius: 10, padding: 14, background: "white" }}>
              <p style={{ margin: "0 0 6px", color: colors[finding.severity], fontWeight: 700 }}>{finding.severity.toUpperCase()} · {finding.category}</p>
              <h3 style={{ margin: "0 0 8px" }}>{finding.title}</h3>
              <p>{finding.explanation}</p>
              {finding.whyItMatters && <p><strong>Why it matters:</strong> {finding.whyItMatters}</p>}
              {finding.recommendedAction && <p><strong>Consider:</strong> {finding.recommendedAction}</p>}
              {finding.evidenceIds.length > 0 && <p><strong>Evidence:</strong> {finding.evidenceIds.map((id) => deal.evidence.find((item) => item.id === id)?.label ?? id).join(", ")}</p>}
            </article>)}
          </div>
        </section>
        <section style={{ background: "#f2f6fa", borderRadius: 12, padding: 18, margin: "20px 0" }}>
          <h2>Whole-deal view</h2><p>{deal.conclusion}</p>
        </section>
        <details style={{ border: "1px solid #d8dee8", borderRadius: 12, padding: 16 }}>
          <summary style={{ cursor: "pointer", fontWeight: 700 }}>What I checked · evidence and provenance</summary>
          <p>This assessment uses local text rules and local OCR only. No public listings, price references, seller identity, or payment eligibility were checked.</p>
          <ol>{deal.evidence.map((item) => <li key={item.id}><strong>{item.label}</strong> — {new Date(item.capturedAt).toLocaleString()} · {item.source === "user" ? "provided by you" : item.source}</li>)}</ol>
          {deal.evidenceRefs?.length ? <ul>{deal.evidenceRefs.map((ref, index) => <li key={`${ref.evidenceId}-${ref.field}-${index}`}><strong>{ref.field}:</strong> “{ref.quote}” — {deal.evidence.find((item) => item.id === ref.evidenceId)?.label ?? "evidence"}</li>)}</ul> : <p>Fixture details are illustrative and do not represent a real listing.</p>}
          <p>Deal ID: <code>{deal.id}</code> · Saved in this browser only.</p>
        </details>
      </>}
      <footer style={{ marginTop: 28, color: "#526174" }}>Green, amber and red describe the evidence found, not whether a seller is trustworthy or fraudulent.</footer>
    </main>
  );
}