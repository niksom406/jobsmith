import { expect, test } from "vitest";
import { findBestAnswerMatch, normalizeQuestion, similarity } from "./matching";

test("normalizes question text so near-identical phrasing matches", () => {
  expect(normalizeQuestion("What is your notice period?")).toBe(normalizeQuestion("What is your notice period"));
  expect(normalizeQuestion("What is your notice period?")).toBe(normalizeQuestion("Notice period?"));
});

test("similarity is high for a reworded question and low for an unrelated one", () => {
  const high = similarity("Why do you want to work here?", "What interests you about this company?");
  const low = similarity("Why do you want to work here?", "What is your notice period?");
  expect(high).toBeGreaterThan(low);
});

test("finds the best candidate above the threshold and nothing when there is none", () => {
  const candidates = [
    { id: "a", originalQuestion: "What is your notice period?", normalizedQuestion: normalizeQuestion("What is your notice period?") },
    { id: "b", originalQuestion: "Describe a time you managed a budget.", normalizedQuestion: normalizeQuestion("Describe a time you managed a budget.") },
  ];
  const match = findBestAnswerMatch("What's your notice period at the moment?", candidates);
  expect(match?.id).toBe("a");

  const noMatch = findBestAnswerMatch("What is your favourite colour?", candidates);
  expect(noMatch).toBeNull();
});
