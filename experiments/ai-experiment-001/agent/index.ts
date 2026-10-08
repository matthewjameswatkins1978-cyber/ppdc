import { serve, type AgentAdapter } from "@astropods/adapter-core";
import { runExperiment, type ModelRole } from "./pipeline.js";


const model = process.env.MODEL_DEFAULT ?? "gpt-5-6-luna";

const token = process.env.ASTRO_GATEWAY_API_KEY;
const baseUrl = process.env.ASTRO_GATEWAY_URL;
async function callModel(role: ModelRole, system: string, input: unknown) {
  if (!token || !baseUrl) throw new Error("Astropods AI Gateway is not configured.");
  const response = await fetch(`${baseUrl.replace(/\/+$/, "")}/chat/completions`, {
    method: "POST", headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    signal: AbortSignal.timeout(45_000),
    body: JSON.stringify({ model, temperature: 0, max_tokens: 850, response_format: { type: "json_object" }, messages: [{ role: "system", content: system }, { role: "user", content: JSON.stringify(input) }] }),
  });
  if (!response.ok) throw new Error(`Gateway returned HTTP ${response.status}.`);
  const result = await response.json() as { choices?: { message?: { content?: string | null } }[]; usage?: { prompt_tokens?: number; completion_tokens?: number } };
  const content = result.choices?.[0]?.message?.content;
  if (!content) throw new Error(`${role} returned no content.`);
  return { content, usage: { inputTokens: result.usage?.prompt_tokens, outputTokens: result.usage?.completion_tokens } };
}

const adapter: AgentAdapter = {
  name: "PPDC AI Experiment 001",
  async stream(prompt, hooks) {
    try {
      hooks.onStatusUpdate({ status: "ANALYZING" });
      const result = await runExperiment(prompt, callModel);
      hooks.onChunk(JSON.stringify(result, null, 2));
      hooks.onFinish();
    } catch {
      hooks.onError(new Error("Experiment request failed validation or generation; no result was accepted."));
    }
  },
  getConfig() { return { systemPrompt: "Internal PPDC experiment dispatcher. It runs two separate reasoning roles and validates both outputs before presentation.", tools: [] }; },
};
serve(adapter);