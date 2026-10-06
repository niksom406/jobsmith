/** Finds the browser's own value setter so React/Angular/Vue see the change, not just the DOM attribute. */
function nativeSetter(element: HTMLElement): ((value: string) => void) | null {
  if (element instanceof HTMLInputElement) {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
    return setter ? (value: string) => setter.call(element, value) : null;
  }
  if (element instanceof HTMLTextAreaElement) {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value")?.set;
    return setter ? (value: string) => setter.call(element, value) : null;
  }
  if (element instanceof HTMLSelectElement) {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, "value")?.set;
    return setter ? (value: string) => setter.call(element, value) : null;
  }
  return null;
}

function dispatchChangeEvents(element: HTMLElement): void {
  element.dispatchEvent(new Event("input", { bubbles: true }));
  element.dispatchEvent(new Event("change", { bubbles: true }));
  element.dispatchEvent(new FocusEvent("blur", { bubbles: true }));
}

/** True if the field already has a value — Jobsmith only fills empty fields. */
export function isEmpty(element: HTMLElement): boolean {
  if (element instanceof HTMLInputElement) {
    if (element.type === "checkbox" || element.type === "radio") return !element.checked;
    return element.value.trim() === "";
  }
  if (element instanceof HTMLTextAreaElement) return element.value.trim() === "";
  if (element instanceof HTMLSelectElement) return element.value.trim() === "";
  return true;
}

export function setTextValue(element: HTMLInputElement | HTMLTextAreaElement, value: string): void {
  const setter = nativeSetter(element);
  if (setter) setter(value);
  else element.value = value;
  dispatchChangeEvents(element);
}

export function setSelectValue(element: HTMLSelectElement, optionValue: string): boolean {
  const option = Array.from(element.options).find((candidate) => candidate.value === optionValue);
  if (!option) return false;
  const setter = nativeSetter(element);
  if (setter) setter(optionValue);
  else element.value = optionValue;
  dispatchChangeEvents(element);
  return true;
}

export function setCheckbox(element: HTMLInputElement, checked: boolean): void {
  if (element.checked === checked) return;
  element.click();
}

export function setRadioGroup(elements: HTMLInputElement[], value: string): boolean {
  const target = elements.find((element) => element.value === value);
  if (!target) return false;
  if (!target.checked) target.click();
  return true;
}

export async function attachFileToInput(element: HTMLInputElement, file: File): Promise<void> {
  const transfer = new DataTransfer();
  transfer.items.add(file);
  element.files = transfer.files;
  dispatchChangeEvents(element);
}
