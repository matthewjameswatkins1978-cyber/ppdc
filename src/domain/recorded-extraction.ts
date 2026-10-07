import type { DealExtraction } from "./deal-extraction";

/** One-time Codex CLI evaluation on fictional listing OCR; routine tests never call a live model. */
export const recordedModelExtraction: DealExtraction = {
  item: "Telecaster electric guitar",
  model: "Fender Player Telecaster",
  price: 450,
  currency: "GBP",
  condition: "Used, good condition",
  paymentMethod: "Bank transfer only",
  deliveryTerms: "Tracked postage included; dispatches in 2 days",
  materialPromises: ["Includes original hard case"],
  unknowns: ["Serial number not shown"],
  evidenceRefs: [
    { field: "item", quote: "Fender Player Telecaster" },
    { field: "model", quote: "Fender Player Telecaster" },
    { field: "price", quote: "Price GBP 450" },
    { field: "currency", quote: "Price GBP 450" },
    { field: "condition", quote: "Used, good condition" },
    { field: "paymentMethod", quote: "Bank transfer only" },
    { field: "deliveryTerms", quote: "Tracked postage included, dispatches in 2 days" },
    { field: "materialPromises", quote: "Seller says includes original hard case" },
    { field: "unknowns", quote: "Serial number not shown" },
  ],
};

/** Captured Codex CLI result on actual Tesseract OCR output; intentionally fails field-evidence validation. */
export const recordedCodexOcrResponse: unknown = {
  item: "guitar",
  model: "Fender Player Telecaster",
  price: 450,
  currency: "GBP",
  condition: "Used, good condition",
  paymentMethod: "Bank transfer only",
  deliveryTerms: "Tracked postage included. Dispatches in 2 days.",
  materialPromises: ["Includes original hard case"],
  unknowns: ["Serial number not shown"],
  evidenceRefs: [
    { field: "model", quote: "Fender Player Telecaster" },
    { field: "condition", quote: "Used, good condition." },
    { field: "price", quote: "Price GBP 450." },
    { field: "currency", quote: "GBP" },
    { field: "paymentMethod", quote: "Bank transfer only." },
    { field: "deliveryTerms", quote: "Tracked postage included. Dispatches in 2 days." },
    { field: "materialPromises", quote: "Seller says includes original hard case." },
    { field: "unknowns", quote: "Serial number not shown." },
  ],
};

/** Sanitized local-development result from one Gemini Interactions smoke request on the OCR text below. */
export const recordedGeminiOcrSource = "For sale: Fender Player Telecaster. Used, good condition. Price GBP 450. Bank transfer only. Tracked postage included, dispatches in 2 days. Seller says includes original hard case. Serial number not shown.";

export const recordedGeminiOcrExtraction: DealExtraction = {
  item: "Fender Player Telecaster",
  model: "Player Telecaster",
  price: 450,
  currency: "GBP",
  condition: "Used, good condition",
  paymentMethod: "Bank transfer",
  deliveryTerms: "Tracked postage included, dispatches in 2 days",
  materialPromises: ["includes original hard case"],
  unknowns: ["Serial number not shown"],
  evidenceRefs: [
    { field: "item", quote: "Fender Player Telecaster" },
    { field: "model", quote: "Player Telecaster" },
    { field: "price", quote: "450" },
    { field: "currency", quote: "GBP" },
    { field: "condition", quote: "Used, good condition" },
    { field: "paymentMethod", quote: "Bank transfer only" },
    { field: "deliveryTerms", quote: "Tracked postage included, dispatches in 2 days" },
    { field: "materialPromises", quote: "includes original hard case" },
    { field: "unknowns", quote: "Serial number not shown" },
  ],
};
