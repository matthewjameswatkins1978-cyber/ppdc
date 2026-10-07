import type { ProtectionPassport } from "@/domain/protection-passport";

function escapeHtml(value: unknown): string {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;",
  })[character]!);
}

function page(title: string, body: string): string {
  return `<!doctype html><html lang="en-GB"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)} · PayPal Deal Checker</title><style>body{font:16px system-ui,sans-serif;color:#172b4d;max-width:850px;margin:32px auto;padding:0 18px;line-height:1.55}main{border:1px solid #d8dee8;border-radius:14px;padding:24px}h1{font-size:2rem}h2{margin-top:28px}li{margin:8px 0}.ok{color:#18794e}.wait{color:#946200}a{color:#075985}</style><main><p><strong>PAYPAL DEAL CHECKER</strong></p>${body}<p><a href="/">Return to Deal Checker</a></p></main></html>`;
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
    ["Item", passport.item], ["Model", passport.model], ["Stated condition", passport.statedCondition],
    ["Delivery terms", passport.deliveryTerms], ["Payment route", passport.paymentRoute],
    ["PayPal order", passport.paypalOrderId], ["Created", new Date(passport.createdAt).toLocaleString("en-GB")],
  ].filter((entry) => entry[1]);
  const detailRows = details.map(([label, value]) => `<li><strong>${escapeHtml(label)}:</strong> ${escapeHtml(value)}</li>`).join("");
  const promises = passport.materialPromises.map((value) => `<li>${escapeHtml(value)}</li>`).join("");
  const references = passport.evidenceReferences.map((reference) => `<li><strong>${escapeHtml(reference.field)}:</strong> “${escapeHtml(reference.quote)}” (evidence ${escapeHtml(reference.evidenceId)})</li>`).join("");
  const findings = passport.findings.map((finding) => `<li><strong>${escapeHtml(finding.severity.toUpperCase())} · ${escapeHtml(finding.title)}:</strong> ${escapeHtml(finding.explanation)}</li>`).join("");
  const unknowns = passport.unresolvedUnknowns.map((value) => `<li>${escapeHtml(value)}</li>`).join("");
  const researchRuns = (passport.researchRuns ?? []).map((run) => `<li><strong>${escapeHtml(run.provider)} · ${escapeHtml(run.delivery)} · ${escapeHtml(run.outcome)}</strong>: ${escapeHtml(run.safeQuery)} (checked ${escapeHtml(new Date(run.checkedAt).toLocaleString("en-GB"))}${run.retrievedAt ? `; retrieved ${escapeHtml(new Date(run.retrievedAt).toLocaleString("en-GB"))}` : ""})</li>`).join("");
  const researchResults = (passport.researchResults ?? []).map((result) => `<li>${result.url ? `<a href="${escapeHtml(result.url)}" rel="noreferrer">${escapeHtml(result.title)}</a>` : escapeHtml(result.title)}${result.price ? ` — ${escapeHtml(result.price.currency)} ${escapeHtml(result.price.amount)}${result.price.condition ? ` (${escapeHtml(result.price.condition)})` : ""}` : ""}</li>`).join("");
  const research = researchRuns || researchResults ? `<h2>Public research at payment</h2>${researchRuns ? `<ul>${researchRuns}</ul>` : ""}${researchResults ? `<ul>${researchResults}</ul>` : ""}` : "";
  return page("Protection Passport", `<h1 class="ok">Sandbox payment completed</h1><p>PayPal's server API confirmed the order and capture as COMPLETED. This Passport records the Deal Checker information available at payment time; it is not a guarantee of buyer-protection eligibility.</p><h2>Protection Passport</h2><ul><li><strong>Deal ID:</strong> ${escapeHtml(passport.dealId)}</li><li><strong>Agreed price:</strong> ${escapeHtml(amount)}</li>${detailRows}</ul>${passport.conclusion ? `<h2>Whole-deal view</h2><p>${escapeHtml(passport.conclusion)}</p>` : ""}${promises ? `<h2>Material promises</h2><ul>${promises}</ul>` : ""}${research}${references ? `<h2>Evidence references</h2><ul>${references}</ul>` : ""}${findings ? `<h2>Assessment findings at payment</h2><ul>${findings}</ul>` : ""}${unknowns ? `<h2>Unresolved unknowns</h2><ul>${unknowns}</ul>` : ""}`);
}

export const checkoutPageHeaders = {
  "Content-Type": "text/html; charset=utf-8",
  "Cache-Control": "no-store, max-age=0",
  "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
};
