import { z } from "zod";
import { expect, test } from "vitest";
import { callLlmJson, LlmError } from "./client";

const schema = z.strictObject({ greeting: z.string() });

function responseWith(text: string, status = 200): Response {
  return new Response(JSON.stringify({ output_text: text, usage: { input_tokens: 10, output_tokens: 5 } }), {
    status,
  });
}

test("rejects when no API key is configured, without a network call", async () => {
  let called = false;
  const fetchImpl: typeof fetch = async () => {
    called = true;
    return responseWith("{}");
  };
  await expect(
    callLlmJson({ apiKey: "", model: "gpt-6-luna", system: "s", user: "u", schema, schemaName: "greeting", fetchImpl }),
  ).rejects.toThrow(LlmError);
  expect(called).toBe(false);
});

test("parses a valid structured response", async () => {
  const fetchImpl: typeof fetch = async () => responseWith(JSON.stringify({ greeting: "hello" }));
  const result = await callLlmJson({
    apiKey: "sk-test",
    model: "gpt-6-luna",
    system: "s",
    user: "u",
    schema,
    schemaName: "greeting",
    fetchImpl,
  });
  expect(result.data.greeting).toBe("hello");
  expect(result.usage.inputTokens).toBe(10);
});

test("retries once on a schema mismatch, then succeeds", async () => {
  let call = 0;
  const fetchImpl: typeof fetch = async () => {
    call += 1;
    return call === 1 ? responseWith(JSON.stringify({ greeting: 5 })) : responseWith(JSON.stringify({ greeting: "hi" }));
  };
  const result = await callLlmJson({
    apiKey: "sk-test",
    model: "gpt-6-luna",
    system: "s",
    user: "u",
    schema,
    schemaName: "greeting",
    fetchImpl,
    retries: 1,
  });
  expect(call).toBe(2);
  expect(result.data.greeting).toBe("hi");
});

test("includes tools in the request body when provided, and omits them otherwise", async () => {
  const captured: { body: unknown } = { body: null };
  const fetchImpl: typeof fetch = async (_input, init) => {
    captured.body = JSON.parse(String(init?.body));
    return responseWith(JSON.stringify({ greeting: "hi" }));
  };
  await callLlmJson({
    apiKey: "sk-test",
    model: "gpt-6-luna",
    system: "s",
    user: "u",
    schema,
    schemaName: "greeting",
    fetchImpl,
    tools: [{ type: "web_search" }],
  });
  expect((captured.body as { tools?: unknown[] })?.tools).toEqual([{ type: "web_search" }]);

  captured.body = null;
  await callLlmJson({ apiKey: "sk-test", model: "gpt-6-luna", system: "s", user: "u", schema, schemaName: "greeting", fetchImpl });
  expect(captured.body && "tools" in (captured.body as object)).toBe(false);
});

test("surfaces a rejected key without retrying", async () => {
  let call = 0;
  const fetchImpl: typeof fetch = async () => {
    call += 1;
    return responseWith("{}", 401);
  };
  await expect(
    callLlmJson({ apiKey: "sk-bad", model: "gpt-6-luna", system: "s", user: "u", schema, schemaName: "greeting", fetchImpl }),
  ).rejects.toThrow("rejected the API key");
  expect(call).toBe(1);
});
