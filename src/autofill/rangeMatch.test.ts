import { expect, test } from "vitest";
import { matchNumericRangeOption } from "./rangeMatch";

test("matches an age into the correct age-group bucket", () => {
  const options = [
    { value: "18-24", label: "18-24" },
    { value: "25-34", label: "25-34" },
    { value: "35-44", label: "35-44" },
  ];
  expect(matchNumericRangeOption("29", options).option?.value).toBe("25-34");
});

test("matches a salary amount into a currency-formatted range", () => {
  const options = [
    { value: "a", label: "£20,000 - £30,000" },
    { value: "b", label: "£40,000 - £50,000" },
    { value: "c", label: "£60,000 - £70,000" },
  ];
  expect(matchNumericRangeOption("50000", options).option?.value).toBe("b");
});

test("matches an open-ended '+' bucket", () => {
  const options = [
    { value: "a", label: "Under 18" },
    { value: "b", label: "18-64" },
    { value: "c", label: "65+" },
  ];
  expect(matchNumericRangeOption("70", options).option?.value).toBe("c");
});

test("does not guess when the value falls outside every range", () => {
  const options = [
    { value: "a", label: "18-24" },
    { value: "b", label: "25-34" },
  ];
  expect(matchNumericRangeOption("90", options).option).toBeNull();
});

test("does not guess on a non-numeric saved value", () => {
  const options = [{ value: "a", label: "18-24" }];
  expect(matchNumericRangeOption("not a number", options).option).toBeNull();
});
