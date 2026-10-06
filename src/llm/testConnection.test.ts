import { expect, test } from "vitest";
import { testOpenAiConnection } from "./testConnection";

test("reports a missing key without calling the network", async () => {
  let called = false;
  const fetchImpl: typeof fetch = async () => {
    called = true;
    return new Response(null, { status: 200 });
  };
  const result = await testOpenAiConnection("  ", "gpt-6-luna", fetchImpl);
  expect(result).toEqual({ ok: false, error: "Add an API key first." });
  expect(called).toBe(false);
});

test("maps auth and model errors without including the key", async () => {
  const seen: string[] = [];
  const fetchImpl: typeof fetch = async (input, init) => {
    seen.push(String(input));
    const header = new Headers(init?.headers).get("Authorization") ?? "";
    expect(header).toBe("Bearer sk-secret");
    const status = String(input).includes("missing-model") ? 404 : 401;
    return new Response("nope", { status });
  };

  const rejected = await testOpenAiConnection("sk-secret", "gpt-6-luna", fetchImpl);
  expect(rejected.ok).toBe(false);
  if (!rejected.ok) expect(rejected.error).not.toContain("sk-secret");

  const missing = await testOpenAiConnection("sk-secret", "missing-model", fetchImpl);
  expect(missing.ok).toBe(false);
  if (!missing.ok) expect(missing.error).toContain("missing-model");
  expect(seen[0]).toBe("https://api.openai.com/v1/models/gpt-6-luna");
});
