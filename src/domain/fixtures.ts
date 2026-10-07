import type { Deal } from "./deal";

const evidence = (id: string, label: string) => ({ id, source: "user" as const, label, capturedAt: "2026-10-06T00:00:00.000Z", private: false });
const fact = <T,>(key: string, value: T) => ({ key, value, kind: "fact" as const, evidenceIds: ["listing"] });

export const dealFixtures: Deal[] = [
  {
    id: "coherent-used-guitar", status: "ready_for_decision", item: fact("item", "Fender Player Telecaster"), model: fact("model", "Player Telecaster"),
    price: fact("price", 450), currency: fact("currency", "GBP"), condition: fact("condition", "Used, good condition"), deliveryTerms: fact("delivery", "Tracked postage agreed"),
    materialPromises: [], unknowns: [], evidence: [evidence("listing", "Illustrative listing text")], findings: [], conclusion: "The stated terms are clear. Check the instrument condition against the photos before deciding.",
  },
  {
    id: "cheap-damaged-guitar", status: "assessing", item: fact("item", "Electric guitar"), price: fact("price", 180), currency: fact("currency", "GBP"), condition: fact("condition", "Damaged; repair needed"),
    materialPromises: [fact("promise", "Seller says the input jack needs repair")], unknowns: [], evidence: [evidence("listing", "Illustrative damaged-item listing")], findings: [],
  },
  {
    id: "unexplained-low-price", status: "assessing", item: fact("item", "Fender Player Telecaster"), price: fact("price", 150), currency: fact("currency", "GBP"), condition: { key: "condition", value: "Not stated", kind: "unknown", evidenceIds: [] },
    materialPromises: [], unknowns: [{ key: "reason_for_price", value: "Why the price is unusually low", kind: "unknown", evidenceIds: [] }], evidence: [evidence("listing", "Illustrative listing with incomplete terms")], findings: [],
  },
  {
    id: "friends-family-request", status: "assessing", item: fact("item", "Used guitar"), price: fact("price", 300), currency: fact("currency", "GBP"), paymentMethod: fact("payment", "Friends & Family requested"),
    materialPromises: [], unknowns: [], evidence: [evidence("message", "Illustrative seller payment request")], findings: [],
  },
  {
    id: "recipient-changed", status: "assessing", item: fact("item", "Used guitar"), price: fact("price", 300), currency: fact("currency", "GBP"),
    materialPromises: [], unknowns: [{ key: "recipient", value: "Payee changed after agreement", kind: "unknown", evidenceIds: ["message"] }], evidence: [evidence("message", "Illustrative payment instruction")], findings: [],
  },
];
