import "server-only";
import { createWorker } from "tesseract.js";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import type { Deal } from "../domain/deal";
import { extractionToDeal, extractWithModel, type DealModelAdapter } from "../domain/deal-extraction";
import { extractDealFromText } from "../domain/extract-text";
import { configuredDealModelAdapter } from "./gemini-deal-model";

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const ACCEPTED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

/** OCR runs on this server process. The user's image is not sent to an OCR API. */
export async function extractDealFromImage(input: { image: Uint8Array; mimeType: string; dealId?: string; evidenceId?: string; modelAdapter?: DealModelAdapter | null }): Promise<Deal> {
  if (!ACCEPTED_IMAGE_TYPES.has(input.mimeType)) throw new Error("Use a JPEG, PNG, or WebP image.");
  if (input.image.byteLength === 0 || input.image.byteLength > MAX_IMAGE_BYTES) throw new Error("Image must be between 1 byte and 8 MB.");

  const cachePath = resolve(process.cwd(), ".cache", "tesseract");
  await mkdir(cachePath, { recursive: true });
  const workerPath = resolve(process.cwd(), "node_modules", "tesseract.js", "src", "worker-script", "node", "index.js");
  const worker = await createWorker("eng", 1, { cachePath, workerPath });
  try {
    const { data } = await worker.recognize(Buffer.from(input.image));
    if (!data.text.trim()) throw new Error("No readable listing text was found in the image.");
    const dealId = input.dealId ?? "image-intake";
    const evidenceLabel = "OCR text extracted locally from user-supplied image";
    const evidenceId = input.evidenceId ?? "user-input";
    const adapter = input.modelAdapter === null
      ? null
      : input.modelAdapter ?? configuredDealModelAdapter();
    if (!adapter) return extractDealFromText(data.text, dealId, evidenceLabel, evidenceId, "ocr");
    const extraction = await extractWithModel(adapter, data.text);
    return extractionToDeal({
      extraction,
      dealId,
      evidence: { id: evidenceId, source: "user", label: evidenceLabel, capturedAt: new Date().toISOString(), private: true },
    });
  } finally {
    await worker.terminate();
  }
}
