// @vitest-environment jsdom
import { expect, test } from "vitest";
import { setRadioGroup, setTextValue, wasSetByJobsmith } from "./setValue";

test("wasSetByJobsmith is true during the change/blur Jobsmith itself dispatches, then clears", async () => {
  document.body.innerHTML = `<textarea id="notes"></textarea>`;
  const element = document.getElementById("notes") as HTMLTextAreaElement;
  let seenDuringBlur = false;
  element.addEventListener("blur", () => {
    seenDuringBlur = wasSetByJobsmith(element);
  });
  setTextValue(element, "A drafted answer.");
  expect(seenDuringBlur).toBe(true);
  await Promise.resolve();
  expect(wasSetByJobsmith(element)).toBe(false);
});

test("a real user click on a radio is not marked as Jobsmith's fill", () => {
  document.body.innerHTML = `
    <label><input type="radio" name="fintech" value="yes">Yes</label>
    <label><input type="radio" name="fintech" value="no">No</label>
  `;
  const yes = document.querySelector('input[value="yes"]') as HTMLInputElement;
  let seenDuringChange = false;
  yes.addEventListener("change", () => {
    seenDuringChange = wasSetByJobsmith(yes);
  });
  yes.click();
  expect(seenDuringChange).toBe(false);
  expect(yes.checked).toBe(true);
});

test("setRadioGroup marks the clicked option so a save-prompt can ignore Jobsmith's own Yes", () => {
  document.body.innerHTML = `
    <label><input type="radio" name="fintech" value="yes">Yes</label>
    <label><input type="radio" name="fintech" value="no">No</label>
  `;
  const yes = document.querySelector('input[value="yes"]') as HTMLInputElement;
  const no = document.querySelector('input[value="no"]') as HTMLInputElement;
  let seenDuringChange = false;
  yes.addEventListener("change", () => {
    seenDuringChange = wasSetByJobsmith(yes);
  });
  setRadioGroup([yes, no], "yes");
  expect(seenDuringChange).toBe(true);
});
