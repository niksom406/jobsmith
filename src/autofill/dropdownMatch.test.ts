import { expect, test } from "vitest";
import { matchDropdownOption } from "./dropdownMatch";

const noticeOptions = [
  { value: "0", label: "Immediate" },
  { value: "2w", label: "2 weeks" },
  { value: "1m", label: "1 month" },
];

test("matches an exact label", () => {
  const result = matchDropdownOption("1 month", noticeOptions);
  expect(result.confidence).toBe("exact");
  expect(result.option?.value).toBe("1m");
});

test("matches sponsorship yes/no via alias", () => {
  const options = [{ value: "y", label: "Yes - I require sponsorship" }, { value: "n", label: "No - I do not require sponsorship" }];
  const result = matchDropdownOption("No", options);
  expect(result.option?.value).toBe("n");
});

test("does not guess when nothing is close", () => {
  const result = matchDropdownOption("Antarctica", noticeOptions);
  expect(result.option).toBeNull();
  expect(result.confidence).toBe("low");
});
