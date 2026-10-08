import { afterEach, expect, test } from "vitest";
import { db } from "../storage/db";
import { getCompanyBrief, saveUserProvidedBrief } from "./companyBrief";

afterEach(async () => {
  await db.companyCache.clear();
});

test("returns a cached brief without any network call", async () => {
  await saveUserProvidedBrief("acme.example", "Acme makes gadgets.");
  let called = false;
  const fetchImpl: typeof fetch = async () => {
    called = true;
    return new Response("", { status: 200 });
  };
  const result = await getCompanyBrief({ domain: "acme.example", apiKey: "sk-test", model: "gpt-6-luna", fetchImpl });
  expect(result).toEqual({ brief: "Acme makes gadgets.", source: "cache" });
  expect(called).toBe(false);
});

test("falls back to the About page when the model has no answer, and caches it", async () => {
  const fetchImpl: typeof fetch = async (input) => {
    const url = String(input);
    if (url.includes("api.openai.com")) {
      return new Response(JSON.stringify({ output_text: JSON.stringify({ brief: "I cannot find reliable information." }) }), { status: 200 });
    }
    if (url.endsWith("/about")) {
      return new Response(`<html><body><main>${"Acme builds tools for careers teams. ".repeat(10)}</main></body></html>`, { status: 200 });
    }
    return new Response("", { status: 404 });
  };
  const result = await getCompanyBrief({ domain: "acme.example", apiKey: "sk-test", model: "gpt-6-luna", fetchImpl });
  expect(result.source).toBe("about_page");
  expect(result.brief).toContain("Acme builds tools");

  const cached = await db.companyCache.get("acme.example");
  expect(cached?.source).toBe("about_page");
});

test("asks OpenAI to actually search the web, not just recall from memory", async () => {
  const captured: { body: unknown } = { body: null };
  const fetchImpl: typeof fetch = async (_input, init) => {
    captured.body = JSON.parse(String(init?.body));
    return new Response(JSON.stringify({ output_text: JSON.stringify({ brief: "Acme is a logistics company serving small retailers. Found via web_search." }) }), {
      status: 200,
    });
  };
  const result = await getCompanyBrief({ domain: "acme.example", apiKey: "sk-test", model: "gpt-6-luna", fetchImpl });
  expect(result.source).toBe("web_search");
  expect((captured.body as { tools?: unknown[] })?.tools).toEqual([{ type: "web_search" }]);
});

test("reports none when every source fails, instead of guessing", async () => {
  const fetchImpl: typeof fetch = async () => new Response("", { status: 500 });
  const result = await getCompanyBrief({ domain: "unknown.example", apiKey: "sk-test", model: "gpt-6-luna", fetchImpl });
  expect(result).toEqual({ brief: "", source: "none" });
});

test("ignores an ATS vendor's own hosting domain and searches by company name instead", async () => {
  const captured: { body: unknown } = { body: null };
  const fetchImpl: typeof fetch = async (_input, init) => {
    captured.body = JSON.parse(String(init?.body));
    return new Response(JSON.stringify({ output_text: JSON.stringify({ brief: "Acme Robotics builds warehouse automation." }) }), { status: 200 });
  };
  const result = await getCompanyBrief({
    domain: "jobs.ashbyhq.com",
    companyName: "Acme Robotics",
    apiKey: "sk-test",
    model: "gpt-6-luna",
    fetchImpl,
  });
  expect(result.source).toBe("web_search");
  expect(result.brief).toContain("Acme Robotics");
  const sentInput = (captured.body as { input: { content: string }[] }).input;
  expect(sentInput[1]?.content).toContain("Company name: Acme Robotics");
  expect(sentInput[1]?.content).not.toContain("ashbyhq.com");
});

test("without a company name, an ATS vendor domain alone reports none rather than describing the ATS platform", async () => {
  let called = false;
  const fetchImpl: typeof fetch = async () => {
    called = true;
    return new Response("", { status: 404 });
  };
  const result = await getCompanyBrief({ domain: "boards.greenhouse.io", apiKey: "sk-test", model: "gpt-6-luna", fetchImpl });
  expect(result).toEqual({ brief: "", source: "none" });
  expect(called).toBe(false);
});
