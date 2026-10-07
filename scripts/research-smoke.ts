import "dotenv/config";
import { productReferenceQuery, publicContextQuery } from "../src/domain/research-query";
import { searchChannel3, searchParallel } from "../src/server/research";

const channel3 = await searchChannel3(productReferenceQuery({ product: "Fender Player Telecaster", condition: "used", locale: "UK" }));
const parallel = await searchParallel(publicContextQuery({ publicUrl: "https://www.gov.uk/consumer-protection-rights", question: "official UK consumer online purchase rights" }));
console.log(JSON.stringify({
  channel3: { resultCount: channel3.results.length, evidence: channel3.evidence.map(({ label, sourceRef, capturedAt }) => ({ label, sourceRef, capturedAt })) },
  parallel: { resultCount: parallel.results.length, evidence: parallel.evidence.map(({ label, sourceRef, capturedAt }) => ({ label, sourceRef, capturedAt })) },
}, null, 2));
