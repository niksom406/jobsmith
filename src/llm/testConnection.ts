export type TestConnectionResult = { ok: true; model: string } | { ok: false; error: string };

const TIMEOUT_MS = 15_000;

export async function testOpenAiConnection(
  apiKey: string,
  model: string,
  fetchImpl: typeof fetch = fetch,
): Promise<TestConnectionResult> {
  const key = apiKey.trim();
  const modelId = model.trim();
  if (!key) return { ok: false, error: "Add an API key first." };
  if (!modelId) return { ok: false, error: "Choose a model first." };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetchImpl(`https://api.openai.com/v1/models/${encodeURIComponent(modelId)}`, {
      method: "GET",
      headers: { Authorization: `Bearer ${key}` },
      signal: controller.signal,
    });
    if (response.status === 401) return { ok: false, error: "That API key was rejected." };
    if (response.status === 404) return { ok: false, error: `OpenAI could not find the model “${modelId}”.` };
    if (!response.ok) return { ok: false, error: `OpenAI returned status ${response.status}.` };
    return { ok: true, model: modelId };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return { ok: false, error: "The request to OpenAI timed out." };
    }
    return { ok: false, error: "Could not reach OpenAI." };
  } finally {
    clearTimeout(timer);
  }
}
