// @vitest-environment jsdom
import { expect, test } from "vitest";
import { fillAriaComboboxes, fillWorkdayDateGroups } from "./workdayWidgets";

function values(overrides: Record<string, string> = {}) {
  return { "address.country": "", "preferences.startDate": "", ...overrides };
}

test("fills an ARIA combobox when the label matches a profile value with a confident option", async () => {
  document.body.innerHTML = `
    <label id="country-label">Country</label>
    <button role="combobox" aria-labelledby="country-label" aria-haspopup="listbox" aria-controls="country-listbox">Select One</button>
    <ul role="listbox" id="country-listbox">
      <li role="option">United Kingdom</li>
      <li role="option">United States</li>
    </ul>
  `;
  const outcomes = await fillAriaComboboxes(document, values({ "address.country": "United Kingdom" }));
  // The widget's own script (not Jobsmith) usually redraws the trigger's text after the click; this only
  // asserts Jobsmith opened the popup, found the right option, and clicked it rather than guessing.
  expect(outcomes).toEqual([{ label: "Country", status: "filled" }]);
});

test("never opens or inspects options for a sensitive-looking combobox label", async () => {
  document.body.innerHTML = `
    <label id="gender-label">Gender</label>
    <button role="combobox" aria-labelledby="gender-label" aria-haspopup="listbox" aria-controls="gender-listbox">Select One</button>
    <ul role="listbox" id="gender-listbox"><li role="option">Female</li></ul>
  `;
  const outcomes = await fillAriaComboboxes(document, values());
  expect(outcomes).toEqual([{ label: "Gender", status: "skipped_sensitive" }]);
});

test("does not overwrite a combobox that already has a value", async () => {
  document.body.innerHTML = `
    <label id="country-label">Country</label>
    <button role="combobox" aria-labelledby="country-label" aria-haspopup="listbox">France</button>
  `;
  const outcomes = await fillAriaComboboxes(document, values({ "address.country": "United Kingdom" }));
  expect(outcomes).toEqual([{ label: "Country", status: "skipped_not_empty" }]);
});

test("fills a start-date three-input group from an ISO value", () => {
  document.body.innerHTML = `
    <fieldset>
      <legend>Earliest start date</legend>
      <input aria-label="Month" />
      <input aria-label="Day" />
      <input aria-label="Year" />
    </fieldset>
  `;
  const outcomes = fillWorkdayDateGroups(document, values({ "preferences.startDate": "2026-03-15" }));
  expect(outcomes).toEqual([{ label: "Earliest start date", status: "filled" }]);
  expect((document.querySelector("input[aria-label='Month']") as HTMLInputElement).value).toBe("03");
  expect((document.querySelector("input[aria-label='Day']") as HTMLInputElement).value).toBe("15");
  expect((document.querySelector("input[aria-label='Year']") as HTMLInputElement).value).toBe("2026");
});

test("never fills a date-of-birth group even if it matches the three-input shape", () => {
  document.body.innerHTML = `
    <fieldset>
      <legend>Date of birth</legend>
      <input aria-label="Month" />
      <input aria-label="Day" />
      <input aria-label="Year" />
    </fieldset>
  `;
  const outcomes = fillWorkdayDateGroups(document, values({ "preferences.startDate": "2026-03-15" }));
  expect(outcomes).toEqual([{ label: "Date of birth", status: "skipped_sensitive" }]);
  expect((document.querySelector("input[aria-label='Month']") as HTMLInputElement).value).toBe("");
});
