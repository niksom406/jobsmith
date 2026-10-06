import { expect, test } from "vitest";
import { testConnectionRequestSchema } from "./types";

test("accepts a test-connection message and rejects anything else", () => {
  expect(
    testConnectionRequestSchema.safeParse({
      type: "test-connection",
      requestId: "abc",
      payload: { apiKey: "sk-test", model: "gpt-6-luna" },
    }).success,
  ).toBe(true);

  expect(
    testConnectionRequestSchema.safeParse({
      type: "fill-form",
      requestId: "abc",
      payload: {},
    }).success,
  ).toBe(false);
});
