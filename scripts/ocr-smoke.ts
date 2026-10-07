import { extractDealFromImage } from "../src/server/extract-image";

const sampleUrl = "https://tesseract.projectnaptha.com/img/eng_bw.png";
const response = await fetch(sampleUrl);
if (!response.ok) throw new Error(`OCR sample image request failed (${response.status}).`);
const image = new Uint8Array(await response.arrayBuffer());
const deal = await extractDealFromImage({ image, mimeType: "image/png", dealId: "ocr-smoke" });
if (deal.id !== "ocr-smoke" || deal.evidence[0]?.private !== true || !Array.isArray(deal.unknowns)) throw new Error("Image intake did not produce a private, structured Deal record.");
console.log(`OCR smoke succeeded: structured Deal JSON; ${deal.evidence.length} private image-evidence record; ${deal.unknowns.length} unknown fields retained.`);
