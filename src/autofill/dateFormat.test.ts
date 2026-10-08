// @vitest-environment jsdom
import { expect, test } from "vitest";
import { setDateInputValue, toIsoDateString } from "./dateFormat";

test("passes an already-ISO date through unchanged", () => {
  expect(toIsoDateString("1990-03-15")).toBe("1990-03-15");
});

test("converts a UK-style D/M/Y date", () => {
  expect(toIsoDateString("15/03/1990")).toBe("1990-03-15");
});

test("swaps when the first number can only be a day", () => {
  expect(toIsoDateString("31/01/1990")).toBe("1990-01-31");
});

test("converts a textual month-name date unambiguously", () => {
  expect(toIsoDateString("15 March 1990")).toBe("1990-03-15");
  expect(toIsoDateString("March 15, 1990")).toBe("1990-03-15");
});

test("returns null for text with no recognisable date", () => {
  expect(toIsoDateString("whenever works")).toBeNull();
  expect(toIsoDateString("")).toBeNull();
});

test("setDateInputValue reports false when the browser rejects the value", () => {
  const input = document.createElement("input");
  input.type = "date";
  expect(setDateInputValue(input, "1990-03-15")).toBe(true);
  expect(input.value).toBe("1990-03-15");
});
