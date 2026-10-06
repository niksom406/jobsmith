// @vitest-environment jsdom
import { expect, test } from "vitest";
import { isCapturable } from "./formBounds";

test("ignores password fields and fields outside a form", () => {
  document.body.innerHTML = `
    <form>
      <input id="q" name="why_role" />
      <input id="p" type="password" name="password" />
      <input id="card" name="card_number" />
    </form>
    <input id="outside" name="newsletter" />
  `;
  expect(isCapturable(document.getElementById("q")!)).toBe(true);
  expect(isCapturable(document.getElementById("p")!)).toBe(false);
  expect(isCapturable(document.getElementById("card")!)).toBe(false);
  expect(isCapturable(document.getElementById("outside")!)).toBe(false);
});
