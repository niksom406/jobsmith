const PAYMENT_HINTS = /card|cvv|cvc|iban|account.?number|sort.?code|routing/i;

/** True if this element is inside a detected application form and is not a password or payment field. */
export function isCapturable(element: HTMLElement): boolean {
  if (element instanceof HTMLInputElement && (element.type === "password" || element.type === "hidden")) return false;
  const name = (element.getAttribute("name") ?? "") + (element.getAttribute("id") ?? "") + (element.getAttribute("autocomplete") ?? "");
  if (PAYMENT_HINTS.test(name)) return false;
  return Boolean(element.closest("form")) || Boolean(element.closest("[class*='application']"));
}

export function isLongTextField(element: HTMLElement): boolean {
  if (element instanceof HTMLTextAreaElement) return true;
  // A single-line text input with no maxlength (the HTML default, reported as -1) is a short
  // structured field — city, name, title — not an essay. Treating -1 as "long" disabled alias
  // matching on almost every text input, so "Where are you currently based?" never mapped to city.
  if (element instanceof HTMLInputElement && (element.type === "text" || element.type === "")) {
    return element.maxLength > 120;
  }
  return false;
}
