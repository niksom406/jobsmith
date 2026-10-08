import type { ZodType } from "zod";

export class LlmError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LlmError";
  }
}

export interface LlmCallOptions<T> {
  apiKey: string;
  model: string;
  system: string;
  user: string;
  schema: ZodType<T>;
  schemaName: string;
  maxOutputTokens?: number;
  timeoutMs?: number;
  retries?: number;
  fetchImpl?: typeof fetch;
  /**
   * OpenAI's hosted Responses API tools (e.g. `[{ type: "web_search" }]`) run server-side on
   * OpenAI's own infrastructure — Jobsmith never fetches arbitrary sites itself, so this needs no
   * extra host permission beyond https://api.openai.com. Not every model supports every tool; a
   * request with an unsupported tool fails like any other OpenAI error and the caller decides
   * whether to retry without it.
   */
  tools?: Record<string, unknown>[];
}

export interface LlmCallResult<T> {
  data: T;
  usage: { inputTokens: number; outputTokens: number };
}

function zodToJsonSchema(schema: ZodType<unknown>): Record<string, unknown> {
  const toJson = (schema as unknown as { toJSONSchema?: () => Record<string, unknown> }).toJSONSchema;
  if (typeof toJson === "function") return toJson();
  // Fallback: accept anything. Zod still validates the parsed response below.
  return { type: "object" };
}

/**
 * Calls the OpenAI Responses API with a strict JSON schema, validates the result with Zod,
 * retries once on a schema mismatch or transient failure, and never logs prompt or answer text.
 */
export async function callLlmJson<T>(options: LlmCallOptions<T>): Promise<LlmCallResult<T>> {
  const { apiKey, model, system, user, schema, schemaName, maxOutputTokens = 2000, timeoutMs = 30_000, tools } = options;
  const retries = options.retries ?? 1;
  const fetchImpl = options.fetchImpl ?? fetch;

  if (!apiKey.trim()) throw new LlmError("No OpenAI API key is set. Add one in Settings → AI.");
  if (!model.trim()) throw new LlmError("No model is set for this task. Choose one in Settings → AI.");

  let lastError: string | null = null;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const correction: string =
        attempt > 0 && lastError
          ? `\n\nYour previous answer did not match the required schema (${lastError}). Return JSON that matches the schema exactly.`
          : "";

      const response: Response = await fetchImpl("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        signal: controller.signal,
        body: JSON.stringify({
          model,
          max_output_tokens: maxOutputTokens,
          input: [
            { role: "system", content: system },
            { role: "user", content: user + correction },
          ],
          ...(tools && tools.length > 0 ? { tools } : {}),
          text: {
            format: {
              type: "json_schema",
              name: schemaName,
              strict: true,
              schema: zodToJsonSchema(schema),
            },
          },
        }),
      });

      if (response.status === 401) throw new LlmError("OpenAI rejected the API key.");
      if (!response.ok) {
        lastError = `OpenAI returned status ${response.status}`;
        continue;
      }

      const body = (await response.json()) as {
        output_text?: string;
        output?: { content?: { text?: string }[] }[];
        usage?: { input_tokens?: number; output_tokens?: number };
      };

      const text =
        body.output_text ??
        body.output?.flatMap((item) => item.content ?? []).find((part) => part.text)?.text ??
        "";

      let json: unknown;
      try {
        json = JSON.parse(text);
      } catch {
        lastError = "the response was not valid JSON";
        continue;
      }

      const parsed = schema.safeParse(json);
      if (!parsed.success) {
        lastError = parsed.error.issues.map((issue) => issue.message).join("; ");
        continue;
      }

      return {
        data: parsed.data,
        usage: {
          inputTokens: body.usage?.input_tokens ?? 0,
          outputTokens: body.usage?.output_tokens ?? 0,
        },
      };
    } catch (error) {
      if (error instanceof LlmError) throw error;
      lastError = error instanceof Error && error.name === "AbortError" ? "the request timed out" : "could not reach OpenAI";
    } finally {
      clearTimeout(timer);
    }
  }

  throw new LlmError(`The model did not return a usable answer (${lastError ?? "unknown error"}).`);
}
