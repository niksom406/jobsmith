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
  if (element instanceof HTMLInputElement && element.type === "text") {
    const maxLength = element.maxLength;
    return maxLength === -1 || maxLength > 120;
  }
  return false;
}
