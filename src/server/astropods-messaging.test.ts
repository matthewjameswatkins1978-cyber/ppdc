import assert from "node:assert/strict";
import test from "node:test";
import { AstropodsTransportError, createAstropodsMessagingClient } from "./astropods-messaging";

function sseResponse(text: string, options: { splitUtf8?: boolean; contentType?: string } = {}): Response {
  const bytes = new TextEncoder().encode(text);
  let chunks: Uint8Array[];
  if (options.splitUtf8) {
    const pound = bytes.indexOf(0xc2);
    assert.ok(pound >= 0 && bytes[pound + 1] === 0xa3);
    chunks = [bytes.slice(0, pound + 1), bytes.slice(pound + 1)];
  } else chunks = [bytes];
  const body = new ReadableStream<Uint8Array>({
    start(controller) { for (const chunk of chunks) controller.enqueue(chunk); controller.close(); },
  });
  return new Response(body, { headers: { "content-type": options.contentType ?? "text/event-stream; charset=utf-8" } });
}

const normalStream = (payload = "£275 — Squier Telecaster") =>
  `event: chunk\ndata: {"content":${JSON.stringify(payload)}}\n\nevent: finish\ndata: {}\n\n`;

test("documented hosted messaging creates a conversation, sends one prompt, and assembles UTF-8 SSE output", async () => {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const fetcher: typeof fetch = async (input, init) => {
    const url = String(input);
    calls.push({ url, init });
    if (url.endsWith("/api/v1/deployments/synthetic-agent/messaging/conversations")) return Response.json({ conversation_id: "local-conversation" });
    if (url.endsWith("/messages")) return Response.json({ accepted: true }, { status: 202 });
    if (url.endsWith("/stream")) return sseResponse(normalStream(), { splitUtf8: true });
    throw new Error(`Unexpected URL ${url}`);
  };
  const result = await createAstropodsMessagingClient({ mode: "hosted", baseUrl: "https://astropods.com", deploymentId: "synthetic-agent", bearerToken: "test-only" }, fetcher)
    .complete("synthetic guitar evidence");
  assert.equal(result.text, "£275 — Squier Telecaster");
  assert.equal(result.conversationId, "local-conversation");
  assert.deepEqual(calls.map((call) => new URL(call.url).pathname), [
    "/api/v1/deployments/synthetic-agent/messaging/conversations", "/api/v1/deployments/synthetic-agent/messaging/conversations/local-conversation/messages", "/api/v1/deployments/synthetic-agent/messaging/conversations/local-conversation/stream",
  ]);
  assert.equal(JSON.parse(String(calls[1]?.init?.body)).content, "synthetic guitar evidence");
  assert.equal(calls[2]?.init?.headers && new Headers(calls[2].init?.headers).get("accept"), "text/event-stream");
  assert.ok(calls.every((call) => new Headers(call.init?.headers).get("authorization") === "Bearer test-only"));
});

test("SSE joins multiline event data before parsing a chunk", async () => {
  const fetcher: typeof fetch = async (input) => {
    const url = String(input);
    if (url.endsWith("/api/v1/deployments/synthetic-agent/messaging/conversations")) return Response.json({ conversation_id: "multi" });
    if (url.endsWith("/messages")) return Response.json({ accepted: true });
    return sseResponse('event: chunk\ndata: {"content":\ndata: "done"}\n\nevent: finish\ndata: {}\n\n');
  };
  const result = await createAstropodsMessagingClient({ mode: "hosted", baseUrl: "https://astropods.com", deploymentId: "synthetic-agent", bearerToken: "test-only" }, fetcher).complete("synthetic");
  assert.equal(result.text, "done");
});

test("rejects authentication failures without exposing response bodies", async () => {
  const client = createAstropodsMessagingClient({ mode: "hosted", baseUrl: "https://astropods.com", deploymentId: "demo", bearerToken: "test-only" },
    async () => new Response("credential detail", { status: 403 }));
  await assert.rejects(client.complete("synthetic"), (error: unknown) => {
    assert.ok(error instanceof AstropodsTransportError);
    assert.equal(error.code, "authentication");
    assert.ok(!error.message.includes("credential detail"));
    return true;
  });
});

test("rejects incomplete streams, malformed chunks, and oversized assembled output", async (t) => {
  for (const scenario of [
    { name: "missing finish", stream: 'event: chunk\ndata: {"content":"partial"}\n\n' },
    { name: "malformed chunk", stream: "event: chunk\ndata: nope\n\nevent: finish\ndata: {}\n\n" },
  ]) {
    await t.test(scenario.name, async () => {
      const fetcher: typeof fetch = async (input) => String(input).endsWith("/api/v1/deployments/synthetic-agent/messaging/conversations")
        ? Response.json({ conversation_id: "failure" })
        : String(input).endsWith("/messages") ? Response.json({ accepted: true }) : sseResponse(scenario.stream);
      await assert.rejects(createAstropodsMessagingClient({ mode: "hosted", baseUrl: "https://astropods.com", deploymentId: "synthetic-agent", bearerToken: "test-only" }, fetcher).complete("synthetic"));
    });
  }
  const fetcher: typeof fetch = async (input) => String(input).endsWith("/api/v1/deployments/synthetic-agent/messaging/conversations")
    ? Response.json({ conversation_id: "large" })
    : String(input).endsWith("/messages") ? Response.json({ accepted: true }) : sseResponse(normalStream("£".repeat(12)));
  await assert.rejects(
    createAstropodsMessagingClient({ mode: "hosted", baseUrl: "https://astropods.com", deploymentId: "synthetic-agent", bearerToken: "test-only" }, fetcher).complete("synthetic", { maxResponseBytes: 8 }),
    (error: unknown) => error instanceof AstropodsTransportError && error.code === "oversized",
  );
});

test("rejects oversized metadata, invalid limits, and untrusted hosted endpoints", async () => {
  const metadataFetcher: typeof fetch = async () => new Response(JSON.stringify({ conversation_id: "x" }), { headers: { "content-length": "9000" } });
  const client = createAstropodsMessagingClient({ mode: "hosted", baseUrl: "https://astropods.com", deploymentId: "synthetic-agent", bearerToken: "test-only" }, metadataFetcher);
  await assert.rejects(client.complete("synthetic"), (error: unknown) => error instanceof AstropodsTransportError && error.code === "oversized");
  await assert.rejects(client.complete("synthetic", { timeoutMs: 0 }), (error: unknown) => error instanceof AstropodsTransportError && error.code === "configuration");
  assert.throws(() => createAstropodsMessagingClient({ mode: "hosted", baseUrl: "https://example.com", deploymentId: "demo", bearerToken: "test-only" }, metadataFetcher), /Astropods.com/i);
});

test("hosted messaging uses the documented deployment path and bearer authorization", async () => {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const fetcher: typeof fetch = async (input, init) => {
    const url = String(input);
    calls.push({ url, init });
    if (url.endsWith("/conversations")) return Response.json({ conversation_id: "hosted-1" });
    if (url.endsWith("/messages")) return Response.json({ accepted: true });
    return sseResponse(normalStream("synthetic result"));
  };
  const client = createAstropodsMessagingClient({
    mode: "hosted", baseUrl: "https://astropods.com", deploymentId: "registered-agent", bearerToken: "server-only-test-token",
  }, fetcher);
  const result = await client.complete("synthetic only");
  assert.equal(result.text, "synthetic result");
  assert.ok(calls.every(({ url }) => url.startsWith("https://astropods.com/api/v1/deployments/registered-agent/messaging/")));
  assert.ok(calls.every(({ init }) => new Headers(init?.headers).get("authorization") === "Bearer server-only-test-token"));
  assert.ok(calls.every(({ init }) => init?.redirect === "error" && init?.cache === "no-store"));
});