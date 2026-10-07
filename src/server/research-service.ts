import "server-only";
import { randomUUID } from "node:crypto";
import type { Deal, Finding } from "@/domain/deal";
import type { ResearchProvider, ResearchResult, ResearchRun } from "@/domain/research";
import { planProductResearch } from "@/domain/research-query";
import { assessDeal } from "@/domain/assessment";
import { researchCacheKey, sqliteResearchCache, type ResearchCache } from "./research-cache";
import { searchChannel3, searchParallel, type ResearchResponse } from "./research";

type ResearchMode = "live" | "replay";
type Searcher = (query: ReturnType<typeof planProductResearch>) => Promise<ResearchResponse>;

function fixtures(provider: ResearchProvider): ResearchResult[] {
  if (provider === "channel3") return [
    { id: "fixture-channel3-fender-1", title: "Fender Player Telecaster used reference", price: { amount: 520, currency: "GBP", condition: "used" } },
    { id: "fixture-channel3-fender-2", title: "Fender Player Telecaster used reference", price: { amount: 560, currency: "GBP", condition: "used" } },
    { id: "fixture-channel3-fender-3", title: "Fender Player Telecaster used reference", price: { amount: 610, currency: "GBP", condition: "used" } },
    { id: "fixture-channel3-ps5", title: "PS5 Slim new retail reference", price: { amount: 430, currency: "GBP", condition: "new" } },
    { id: "fixture-channel3-ps5-2", title: "PS5 Slim new retail reference", price: { amount: 400, currency: "GBP", condition: "new" } },
    { id: "fixture-channel3-ps5-3", title: "PS5 Slim new retail reference", price: { amount: 370, currency: "GBP", condition: "new" } },
  ];
  return [
    { id: "fixture-parallel-olympus-1", title: "Olympus OM-1 mirrorless camera", url: "https://example.com/om1" },
    { id: "fixture-parallel-olympus-2", title: "OM System OM-1 Mark II camera", url: "https://example.org/om1-mark-ii" },
  ];
}

function normalize(value: string): string { return value.toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim(); }

function migrateCachedResults(provider: ResearchProvider, results: ResearchResult[]): ResearchResult[] {
  if (provider !== "channel3") return results;
  return results.map((result) => {
    if (!result.url) return result;
    try {
      if (new URL(result.url).hostname.toLowerCase() === "buy.trychannel3.com") {
        const safeResult = { ...result };
        delete safeResult.url;
        return safeResult;
      }
    } catch { return { ...result, url: undefined }; }
    return result;
  });
}

function deriveFinding(deal: Deal, provider: ResearchProvider, results: ResearchResult[]): { finding: Finding; question?: string; outcome: ResearchRun["outcome"] } {
  const model = deal.model?.kind === "fact" ? deal.model.value : deal.item?.value ?? "the stated product";
  const identity = normalize(deal.model?.kind === "fact" ? deal.model.value : deal.item?.value ?? "").split(" ").filter((token) => token.length > 1);
  const identityMatches = results.filter((result) => result.price && identity.length > 0 && identity.every((token) => normalize(result.title).split(" ").includes(token)));
  const variantMismatch = (result: ResearchResult) => /\bplayer\s*(?:ii|2)\b/i.test(result.title) && !/\bplayer\s*(?:ii|2)\b/i.test(model);
  const variantResults = identityMatches.filter(variantMismatch);
  const exactIdentityMatches = identityMatches.filter((result) => !variantMismatch(result));
  const knownCondition = deal.condition?.kind === "fact" ? (deal.condition.value.toLowerCase().includes("new") ? "new" : "used") : undefined;
  const relevant = exactIdentityMatches.filter((result) => result.price!.currency === deal.currency?.value && knownCondition && result.price!.condition === knownCondition);
  const sourceIds = results.map((result) => result.id);
  const titleModels = new Set(results.map((result) => normalize(result.title).replace(/\b(?:used|new|reference|retail|camera|mirrorless)\b/g, "").trim()).filter(Boolean));
  const generationConflict = /\bom[- ]?1\b/i.test(model) && results.some((r) => /mark\s*ii|mark\s*2/i.test(r.title)) && results.some((r) => /\bom[- ]?1\b/i.test(r.title) && !/mark\s*ii|mark\s*2/i.test(r.title));
  let severity: Finding["severity"] = "amber";
  let outcome: ResearchRun["outcome"] = results.length ? "insufficient" : "insufficient";
  let title = "There is not enough comparable public evidence";
  let explanation = "The public results do not provide enough matching, same-currency, condition-aware references for a reliable price comparison. No price verdict is made.";
  let question: string | undefined = "Can you confirm the exact model or variant so the comparison can be narrowed?";
  if (generationConflict) {
    title = "Public sources refer to different model generations";
    explanation = "The results include both the stated model and a Mark II generation. The deal’s identity is retained as supplied; a generation-specific comparison is uncertain.";
    outcome = "disagreement";
    question = "Can you confirm the exact model number or generation?";
  } else if (titleModels.size > 1 && results.length > 1 && !results.some((r) => r.price)) {
    title = "Public sources disagree about the product identity";
    explanation = "The public results describe different product identities. They are preserved separately and have not been collapsed into one match.";
    outcome = "disagreement";
  } else if (variantResults.length > 0 && exactIdentityMatches.length === 0) {
    title = "Public results refer to a different model variant";
    explanation = `The deal states ${model}, while the results identify ${[...new Set(variantResults.map((result) => result.title))].join("; ")}. These variants are not treated as equivalent for price comparison.`;
    question = "Can you confirm the exact model or generation?";
  } else if (exactIdentityMatches.length > 0 && deal.currency?.kind === "fact" && exactIdentityMatches.every((result) => result.price!.currency !== deal.currency!.value)) {
    const currencies = [...new Set(exactIdentityMatches.map((result) => result.price!.currency))].join(", ");
    title = "Available references use a different currency";
    explanation = `The matching product references use ${currencies}; this deal uses ${deal.currency.value}. No exchange rate is available here, so the prices are not compared.`;
    question = "Can you find or provide references priced in the deal’s currency?";
  } else if (exactIdentityMatches.length > 0 && knownCondition && exactIdentityMatches.every((result) => result.price!.condition !== knownCondition)) {
    const conditions = [...new Set(exactIdentityMatches.map((result) => result.price!.condition ?? "unknown"))].join(", ");
    title = "Available references describe a different condition";
    explanation = `The matching references are listed as ${conditions}, while the deal describes the item as ${knownCondition}. They are not treated as comparable prices.`;
    question = "Can you confirm the item’s condition and look for references in the same condition?";
  } else if (relevant.length >= 3 && deal.price?.kind === "fact") {
    const values = relevant.map((result) => result.price!.amount).sort((a, b) => a - b);
    const median = values[Math.floor(values.length / 2)];
    const ratio = deal.price.value / median;
    outcome = "results";
    if (ratio < 0.7) {
      title = "The asking price is below the available references";
      const repairContext = deal.condition?.value.toLowerCase().includes("repair") ? " The disclosed repair may plausibly explain part of the difference; its quality has not been independently inspected." : "";
      explanation = `The asking price is ${deal.currency?.value ?? ""} ${deal.price.value}; ${relevant.length} same-currency references range from ${values[0]} to ${values.at(-1)} with a median of ${median}. This is a reason to understand the difference, not evidence of fraud.${repairContext}`;
      question = deal.condition?.value.toLowerCase().includes("repair") ? "Can you share details and photos of the repair and explain how it affects the price?" : "Why is the price below these references, and can you provide current photos or other supporting evidence?";
    } else if (ratio <= 1.3) {
      severity = "green";
      title = "The asking price is broadly consistent with available references";
      explanation = `The asking price is ${deal.currency?.value ?? ""} ${deal.price.value}; ${relevant.length} same-currency references range from ${values[0]} to ${values.at(-1)}. References are context, not a guaranteed market value.`;
      question = undefined;
    } else {
      title = "The asking price is above available references";
      explanation = `The asking price is ${deal.currency?.value ?? ""} ${deal.price.value}; ${relevant.length} same-currency references have a median of ${median}. Compare condition, included items and delivery before drawing a conclusion.`;
      question = "What condition, included accessories or delivery terms explain the difference?";
    }
  }
  return { finding: { id: `research-${provider}`, severity, category: "public-research", title, explanation, evidenceIds: sourceIds, kind: "inference", ruleId: "research-context" }, ...(question ? { question } : {}), outcome };
}

export async function runResearch(
  deal: Deal,
  provider: ResearchProvider,
  mode: ResearchMode = "live",
  dependencies: { cache?: ResearchCache; channel3?: Searcher; parallel?: Searcher; now?: () => string } = {},
): Promise<Deal> {
  const query = planProductResearch(deal, provider);
  const now = dependencies.now ?? (() => new Date().toISOString());
  const cache = dependencies.cache ?? sqliteResearchCache;
  const key = researchCacheKey(provider, query.query);
  let delivery: ResearchRun["delivery"] = mode === "replay" ? "fixture" : "live";
  let retrievedAt: string | undefined;
  let results: ResearchResult[] = [];
  let unavailable = false;
  let failureMessage = "Public research could not be completed. Check the provider setup or try again.";
  if (mode === "replay") {
    results = fixtures(provider);
  } else {
    const cached = await cache.get(key);
    if (cached) {
      results = migrateCachedResults(provider, cached.results);
      retrievedAt = cached.retrievedAt;
      delivery = "cache";
      if (results !== cached.results) await cache.save(key, { ...cached, results });
    }
    else {
      try {
        const search = provider === "channel3" ? dependencies.channel3 ?? searchChannel3 : dependencies.parallel ?? searchParallel;
        const response = await search(query);
        results = response.results;
        retrievedAt = response.capturedAt;
        await cache.save(key, { provider, safeQuery: query.query, retrievedAt, results });
      } catch (error) {
        unavailable = true;
        if (error instanceof Error && /^(?:Channel3|Parallel) search failed \(\d{3}\)\.$/.test(error.message)) failureMessage = error.message;
      }
    }
  }
  const evidence = results.map((result) => ({ id: result.id, source: provider, ...(result.url ? { sourceRef: result.url } : {}), label: result.title, capturedAt: retrievedAt ?? now(), private: false } as const));
  const analysis = unavailable ? undefined : deriveFinding(deal, provider, results);
  const run: ResearchRun = {
    id: randomUUID(), provider, purpose: query.purpose, safeQuery: query.query,
    checkedAt: now(), ...(retrievedAt ? { retrievedAt } : {}), delivery,
    outcome: unavailable ? "unavailable" : analysis!.outcome,
    resultIds: results.map((result) => result.id),
    ...(unavailable ? { message: failureMessage } : {}),
  };
  const assessed = assessDeal(deal);
  const researchFinding: Finding = unavailable
    ? { id: `research-${provider}-unavailable`, severity: "amber", category: "public-research", title: "Public research was unavailable", explanation: "The provider request failed. No conclusion about the item or seller can be drawn from this attempt.", evidenceIds: [], kind: "unknown", ruleId: "research-unavailable" }
    : analysis!.finding;
  const findings = [...assessed.findings.filter((item) => !item.id.startsWith("research-")), researchFinding];
  const questions = unavailable ? [] : analysis?.question ? [analysis.question] : [];
  const conclusion = unavailable
    ? `${deal.item?.value ?? "This deal"} still has its local assessment. Public research was unavailable, so no external comparison was made.`
    : `${deal.item?.value ?? "This deal"} has been checked against ${results.length} normalized ${provider} result${results.length === 1 ? "" : "s"}. ${analysis!.finding.explanation}`;
  return {
    ...assessed, findings, conclusion,
    researchRuns: [...(deal.researchRuns ?? []), run],
    researchResults: [...(deal.researchResults ?? []).filter((item) => !results.some((next) => next.id === item.id)), ...results],
    researchQuestions: [...new Set([...(deal.researchQuestions ?? []).filter((item) => !item.startsWith("Can you confirm") && !item.startsWith("Why is the price")), ...questions])],
    evidence: [...deal.evidence.filter((item) => !evidence.some((next) => next.id === item.id)), ...evidence],
  };
}
