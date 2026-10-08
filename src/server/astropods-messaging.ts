import "server-only";

export type AstropodsConnection = { mode: "hosted"; baseUrl: string; deploymentId: string; bearerToken: string };
export interface AstropodsReply {
  conversationId: string;
  text: string;
  latencyMs: number;
}
export interface AstropodsMessagingClient {
  complete(content: string, options?: { signal?: AbortSignal; timeoutMs?: number; maxResponseBytes?: number }): Promise<AstropodsReply>;
}
export class AstropodsTransportError extends Error {
  constructor(message: string, readonly code: "configuration" | "authentication" | "http" | "stream" | "incomplete" | "oversized" | "timeout" | "cancelled") {
    super(message);
    this.name = "AstropodsTransportError";
  }
}

type Fetcher = typeof fetch;
const MAX_REQUEST_BYTES = 64 * 1024;
const DEFAULT_MAX_RESPONSE_BYTES = 64 * 1024;
const DEFAULT_TIMEOUT_MS = 60_000;

/** Uses documented Astropods messaging endpoints; tests inject fetch and replay SSE without credentials. */
export function createAstropodsMessagingClient(connection: AstropodsConnection, fetcher: Fetcher = fetch): AstropodsMessagingClient {
  const base = validateBaseUrl(connection);
  const authHeaders: Record<string, string> = { Authorization: `Bearer ${connection.bearerToken}` };
  const root = `${base}/api/v1/deployments/${encodeURIComponent(connection.deploymentId)}/messaging`;

  return {
    async complete(content, options = {}) {
      const requestBytes = new TextEncoder().encode(content).byteLength;
      if (!content.trim() || requestBytes > MAX_REQUEST_BYTES) {
        throw new AstropodsTransportError("Astropods request is empty or exceeds 64 KiB.", "oversized");
      }
      const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
      const maxResponseBytes = options.maxResponseBytes ?? DEFAULT_MAX_RESPONSE_BYTES;
      if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 120_000) {
        throw new AstropodsTransportError("Astropods timeout must be between 1 ms and 120 seconds.", "configuration");
      }
      if (!Number.isSafeInteger(maxResponseBytes) || maxResponseBytes < 1 || maxResponseBytes > 256 * 1024) {
        throw new AstropodsTransportError("Astropods response limit must be between 1 byte and 256 KiB.", "configuration");
      }
      const timeout = AbortSignal.timeout(timeoutMs);
      const signal = options.signal ? AbortSignal.any([options.signal, timeout]) : timeout;
      const startedAt = performance.now();
      let conversationId: string | undefined;
      const request = async (url: string, init: RequestInit) => {
        let response: Response;
        try {
          response = await fetcher(url, { ...init, signal, redirect: "error", cache: "no-store" });
        } catch (error) {
          if (options.signal?.aborted) throw new AstropodsTransportError("Astropods request was cancelled.", "cancelled");
          if (timeout.aborted) throw new AstropodsTransportError("Astropods request timed out.", "timeout");
          throw new AstropodsTransportError("Astropods could not be reached.", "http");
        }
        if (response.status === 401 || response.status === 403) throw new AstropodsTransportError("Astropods rejected the configured credentials or access.", "authentication");
        if (response.status === 413) throw new AstropodsTransportError("Astropods rejected an oversized request.", "oversized");
        if (!response.ok) throw new AstropodsTransportError(`Astropods request failed with HTTP ${response.status}.`, "http");
        return response;
      };

      try {
        const createUrl = `${root}/conversations`;
        const createResponse = await request(createUrl, {
          method: "POST", headers: { ...authHeaders, "Content-Type": "application/json" }, body: "{}",
        });
        const created = await readJson<{ conversation_id?: unknown }>(createResponse);
        if (typeof created.conversation_id !== "string" || !created.conversation_id) {
          throw new AstropodsTransportError("Astropods did not return a conversation identifier.", "stream");
        }
        conversationId = created.conversation_id;
        const messageUrl = `${root}/conversations/${encodeURIComponent(conversationId)}/messages`;
        await request(messageUrl, {
          method: "POST", headers: { ...authHeaders, "Content-Type": "application/json" }, body: JSON.stringify({ content }),
        });
        const streamUrl = `${root}/conversations/${encodeURIComponent(conversationId)}/stream`;
        const streamResponse = await request(streamUrl, {
          method: "GET", headers: { ...authHeaders, Accept: "text/event-stream" },
        });
        const text = await readAssistantStream(streamResponse, { signal, maxResponseBytes });
        if (!text.trim()) throw new AstropodsTransportError("Astropods finished without an assistant response.", "incomplete");
        return { conversationId, text, latencyMs: Math.round(performance.now() - startedAt) };
      } catch (error) {
        if (conversationId && (options.signal?.aborted || timeout.aborted)) {
          void cancelHostedGeneration(fetcher, root, conversationId, authHeaders);
        }
        if (error instanceof AstropodsTransportError) throw error;
        if (options.signal?.aborted) throw new AstropodsTransportError("Astropods request was cancelled.", "cancelled");
        if (timeout.aborted) throw new AstropodsTransportError("Astropods request timed out.", "timeout");
        throw new AstropodsTransportError("Astropods returned an invalid or incomplete response.", "stream");
      }
    },
  };
}

export function parseSseFrame(frame: string): { event: string; data: string } | null {
  const data: string[] = [];
  let event = "message";
  for (const line of frame.split(/\r?\n/)) {
    if (!line || line.startsWith(":")) continue;
    const separator = line.indexOf(":");
    const field = separator < 0 ? line : line.slice(0, separator);
    const raw = separator < 0 ? "" : line.slice(separator + 1).replace(/^ /, "");
    if (field === "event") event = raw;
    else if (field === "data") data.push(raw);
  }
  return data.length ? { event, data: data.join("\n") } : null;
}

async function readAssistantStream(response: Response, options: { signal: AbortSignal; maxResponseBytes: number }): Promise<string> {
  if (!response.body) throw new AstropodsTransportError("Astropods response did not include an SSE stream.", "incomplete");
  const contentType = response.headers.get("content-type");
  if (contentType && !contentType.toLocaleLowerCase().startsWith("text/event-stream")) {
    throw new AstropodsTransportError("Astropods response was not an SSE stream.", "stream");
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  const output: string[] = [];
  let lineBuffer = "";
  let frameLines: string[] = [];
  let receivedBytes = 0;
  let finished = false;

  const consumeFrame = () => {
    const frame = parseSseFrame(frameLines.join("\n"));
    frameLines = [];
    if (!frame) return;
    if (frame.event === "error") throw new AstropodsTransportError("Astropods reported an error while generating the response.", "stream");
    if (frame.event === "finish") { finished = true; return; }
    if (frame.event !== "chunk") return;
    let payload: unknown;
    try { payload = JSON.parse(frame.data); }
    catch { throw new AstropodsTransportError("Astropods sent a malformed SSE chunk.", "stream"); }
    if (!payload || typeof payload !== "object" || !("content" in payload) || typeof payload.content !== "string") {
      throw new AstropodsTransportError("Astropods sent an unsupported SSE chunk.", "stream");
    }
    output.push(payload.content);
    if (new TextEncoder().encode(output.join("")).byteLength > options.maxResponseBytes) {
      throw new AstropodsTransportError("Astropods response exceeded the configured size limit.", "oversized");
    }
  };
  const consumeLine = (line: string) => {
    const clean = line.replace(/\r$/, "");
    if (clean === "") consumeFrame();
    else frameLines.push(clean);
  };

  try {
    while (!finished) {
      if (options.signal.aborted) throw new AstropodsTransportError("Astropods request was cancelled.", "cancelled");
      const { done, value } = await reader.read();
      if (done) {
        lineBuffer += decoder.decode();
        if (lineBuffer.endsWith("\n")) {
          lineBuffer = lineBuffer.slice(0, -1);
          consumeLine(lineBuffer);
        }
        break;
      }
      receivedBytes += value.byteLength;
      if (receivedBytes > options.maxResponseBytes * 2) throw new AstropodsTransportError("Astropods SSE stream exceeded the configured size limit.", "oversized");
      lineBuffer += decoder.decode(value, { stream: true });
      let newline: number;
      while ((newline = lineBuffer.indexOf("\n")) >= 0) {
        const line = lineBuffer.slice(0, newline);
        lineBuffer = lineBuffer.slice(newline + 1);
        consumeLine(line);
        if (finished) break;
      }
    }
  } catch (error) {
    await reader.cancel().catch(() => undefined);
    if (error instanceof AstropodsTransportError) throw error;
    throw new AstropodsTransportError("Astropods SSE stream was invalid or interrupted.", "stream");
  } finally {
    reader.releaseLock();
  }
  if (!finished) throw new AstropodsTransportError("Astropods SSE stream ended before its finish event.", "incomplete");
  return output.join("");
}

function validateBaseUrl(connection: AstropodsConnection): string {
  let url: URL;
  try { url = new URL(connection.baseUrl); }
  catch { throw new AstropodsTransportError("Astropods base URL is invalid.", "configuration"); }
  if (url.username || url.password || url.search || url.hash) throw new AstropodsTransportError("Astropods base URL must not contain credentials, query, or fragment data.", "configuration");

  if (connection.mode === "hosted" && (url.protocol !== "https:" || url.hostname !== "astropods.com" || !connection.deploymentId || !connection.bearerToken)) {
    throw new AstropodsTransportError("Hosted Astropods mode requires https://astropods.com, a deployment ID, and a server-side bearer token.", "configuration");
  }
  return url.toString().replace(/\/$/, "");
}

async function readJson<T>(response: Response): Promise<T> {
  const declaredLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > 8 * 1024) {
    throw new AstropodsTransportError("Astropods metadata response exceeded 8 KiB.", "oversized");
  }
  if (!response.body) throw new AstropodsTransportError("Astropods metadata response had no body.", "stream");
  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let text = "";
  let bytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) { text += decoder.decode(); break; }
      bytes += value.byteLength;
      if (bytes > 8 * 1024) throw new AstropodsTransportError("Astropods metadata response exceeded 8 KiB.", "oversized");
      text += decoder.decode(value, { stream: true });
    }
  } catch (error) {
    await reader.cancel().catch(() => undefined);
    if (error instanceof AstropodsTransportError) throw error;
    throw new AstropodsTransportError("Astropods returned malformed JSON metadata.", "stream");
  } finally {
    reader.releaseLock();
  }
  try { return JSON.parse(text) as T; }
  catch { throw new AstropodsTransportError("Astropods returned malformed JSON metadata.", "stream"); }
}

async function cancelHostedGeneration(fetcher: Fetcher, root: string, conversationId: string, headers: Record<string, string>): Promise<void> {
  try {
    await fetcher(`${root}/conversations/${encodeURIComponent(conversationId)}/cancel`, {
      method: "POST", headers, signal: AbortSignal.timeout(2_000), redirect: "error", cache: "no-store",
    });
  } catch { /* Cancellation is best effort; partial output is never returned. */ }
}
