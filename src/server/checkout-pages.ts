import type { ProtectionPassport } from "@/domain/protection-passport";

function escapeHtml(value: unknown): string {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;",
  })[character]!);
}

function page(title: string, body: string): string {
  return `<!doctype html><html lang="en-GB"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)} · PayPal Deal Checker</title><style>*{box-sizing:border-box}body{font:15px/1.55 system-ui,sans-serif;color:#172b4d;max-width:1000px;margin:24px auto;padding:0 16px;background:#fbfcfe}main{border:1px solid #d8dee8;border-radius:16px;padding:clamp(16px,3vw,28px);background:white}h1{font-size:1.7rem;line-height:1.2;margin:.3em 0}h2{font-size:1.1rem;margin:0 0 9px}h3{font-size:.95rem;margin:12px 0 5px}.passport-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.card{border:1px solid #d8dee8;border-radius:12px;padding:15px;min-width:0}.card ul{padding-left:20px;margin:6px 0}.card li{margin:5px 0;overflow-wrap:anywhere}.ok{color:#18794e}.wait{color:#946200}.eyebrow{font-size:.72rem;font-weight:750;letter-spacing:.08em;color:#526174}.verified{background:#f2faf5;border-color:#c9e6d3}.deal-evidence{background:#f5f8fb}.amount{font-size:1.2rem;font-weight:700}a{color:#075985}@media(max-width:600px){.passport-grid{grid-template-columns:1fr}}</style><main><p><strong>PAYPAL DEAL CHECKER</strong></p>${body}<p><a href="/">Return to Deal Checker</a></p></main></html>`;
}

export function renderPendingCheckout(status: string, retryUrl: string): string {
  return page("Payment not complete", `<h1 class="wait">Payment is not confirmed</h1><p>PayPal currently reports <strong>${escapeHtml(status)}</strong>. No completed payment or Protection Passport has been recorded.</p><p>If you have just approved in Sandbox, refresh the status:</p><p><a href="${escapeHtml(retryUrl)}">Check PayPal status again</a></p>`);
}

export function renderCheckoutFailure(retryUrl?: string): string {
  const retry = retryUrl ? `<p><a href="${escapeHtml(retryUrl)}">Retry the server-side PayPal check</a></p>` : "";
  return page("Payment not confirmed", `<h1>Payment could not be verified</h1><p>The server could not confirm a completed PayPal Sandbox capture. This request did not mark the payment complete or create a new Protection Passport.</p>${retry}`);
}

export function renderCancelledCheckout(): string {
  return page("Checkout cancelled", `<h1>Checkout cancelled</h1><p>This return did not capture a payment or create a Protection Passport. If you approved the order before returning here, use the PayPal return link again so the server can verify its current state.</p>`);
}

export function renderProtectionPassport(passport: ProtectionPassport): string {
  const amount = new Intl.NumberFormat("en-GB", { style: "currency", currency: passport.currency }).format(passport.price);
  const details = [
    ["Item", passport.item], ["Model", passport.model],
    ["Condition stated in deal", passport.statedCondition], ["Delivery terms", passport.deliveryTerms],
  ].filter((entry) => entry[1]);
  const detailRows = details.map(([label, value]) => `<li><strong>${escapeHtml(label)}:</strong> ${escapeHtml(value)}</li>`).join("");
  const promises = passport.materialPromises.map((value) => `<li>${escapeHtml(value)}</li>`).join("");
  const references = passport.evidenceReferences.map((reference) => `<li><strong>${escapeHtml(reference.field)}:</strong> “${escapeHtml(reference.quote)}” (evidence ${escapeHtml(reference.evidenceId)})</li>`).join("");
  const findings = passport.findings.map((finding) => `<li><strong>${escapeHtml(finding.severity.toUpperCase())} · ${escapeHtml(finding.title)}:</strong> ${escapeHtml(finding.explanation)}</li>`).join("");
  const unknowns = passport.unresolvedUnknowns.map((value) => `<li>${escapeHtml(value)}</li>`).join("");
  const researchRuns = (passport.researchRuns ?? []).map((run) => `<li><strong>${escapeHtml(run.provider)} · ${escapeHtml(run.delivery)} · ${escapeHtml(run.outcome)}</strong>: ${escapeHtml(run.safeQuery)} (checked ${escapeHtml(new Date(run.checkedAt).toLocaleString("en-GB"))}${run.retrievedAt ? `; retrieved ${escapeHtml(new Date(run.retrievedAt).toLocaleString("en-GB"))}` : ""})</li>`).join("");
  const researchResults = (passport.researchResults ?? []).map((result) => `<li>${result.url ? `<a href="${escapeHtml(result.url)}" rel="noreferrer">${escapeHtml(result.title)}</a>` : escapeHtml(result.title)}${result.price ? ` — ${escapeHtml(result.price.currency)} ${escapeHtml(result.price.amount)}${result.price.condition ? ` (${escapeHtml(result.price.condition)})` : ""}` : ""}</li>`).join("");
  const research = researchRuns || researchResults ? `<section class="card"><h2>What was checked</h2>${researchRuns ? `<ul>${researchRuns}</ul>` : ""}${researchResults ? `<ul>${researchResults}</ul>` : ""}</section>` : `<section class="card"><h2>What was checked</h2><p>No public research is recorded for this payment.</p></section>`;
  return page("Protection Passport", `<h1 class="ok">Protection Passport</h1><p>This snapshot records the completed Sandbox transaction and the deal information available at payment time. It does not guarantee buyer-protection eligibility.</p><div class="passport-grid"><section class="card verified"><p class="eyebrow">TRANSACTION FACT</p><h2 class="ok">Payment completed through PayPal Sandbox</h2><p>Verified server-side capture state: <strong>COMPLETED</strong></p><ul><li><strong>Amount:</strong> ${escapeHtml(amount)}</li><li><strong>PayPal order:</strong> ${escapeHtml(passport.paypalOrderId)}</li><li><strong>Recorded:</strong> ${escapeHtml(new Date(passport.createdAt).toLocaleString("en-GB"))}</li></ul></section><section class="card deal-evidence"><p class="eyebrow">DEAL EVIDENCE AT PAYMENT</p><h2>What the deal information said</h2><ul><li><strong>Deal ID:</strong> ${escapeHtml(passport.dealId)}</li>${detailRows}<li><strong>Payment method in deal evidence:</strong> ${escapeHtml(passport.statedPaymentMethod ?? "Not stated")}</li></ul></section>${passport.conclusion ? `<section class="card"><h2>Whole-deal view</h2><p>${escapeHtml(passport.conclusion)}</p></section>` : ""}${promises ? `<section class="card"><h2>Material promises</h2><ul>${promises}</ul></section>` : ""}${findings ? `<section class="card"><h2>Important findings</h2><ul>${findings}</ul></section>` : ""}${references || unknowns ? `<section class="card"><h2>Evidence retained</h2>${references ? `<ul>${references}</ul>` : ""}${unknowns ? `<h3>Unresolved details</h3><ul>${unknowns}</ul>` : ""}</section>` : ""}${research}</div>`);
}

export const checkoutPageHeaders = {
  "Content-Type": "text/html; charset=utf-8",
  "Cache-Control": "no-store, max-age=0",
  "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
};
