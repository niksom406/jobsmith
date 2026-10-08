import type { DetectedField, DetectedOption, FieldKind } from "./types";

function labelFor(element: HTMLElement, root: ParentNode): string {
  const aria = element.getAttribute("aria-label");
  if (aria) return aria;

  const describedBy = element.getAttribute("aria-describedby");
  if (describedBy) {
    const described = root.querySelector(`#${CSS.escape(describedBy)}`);
    if (described?.textContent) return described.textContent.trim();
  }

  const id = element.getAttribute("id");
  if (id) {
    const byFor = root.querySelector(`label[for="${CSS.escape(id)}"]`);
    if (byFor?.textContent) return byFor.textContent.trim();
  }

  const wrappingLabel = element.closest("label");
  if (wrappingLabel?.textContent) return wrappingLabel.textContent.trim();

  // Greenhouse/Lever often put the label in a preceding sibling or parent block, not a <label>.
  let node: Element | null = element.parentElement;
  for (let depth = 0; depth < 3 && node; depth += 1) {
    const text = node.querySelector(".label, legend, [class*='label']")?.textContent;
    if (text?.trim()) return text.trim();
    node = node.parentElement;
  }

  return element.getAttribute("placeholder") ?? element.getAttribute("name") ?? "";
}

/**
 * A radio group's real "question" is almost never the first radio's own wrapping label -- a very
 * common pattern wraps each option individually (`<label><input type="radio">Yes</label>`), so
 * `labelFor()` on just the first radio would return "Yes", not the actual question. Prefer the
 * enclosing `<fieldset>`'s `<legend>` (the semantically-correct question text) when there is one.
 */
function radioGroupLabel(elements: HTMLInputElement[], root: ParentNode): string {
  const first = elements[0];
  if (!first) return "";
  const legend = first.closest("fieldset")?.querySelector("legend")?.textContent?.trim();
  if (legend) return legend;
  return labelFor(first, root);
}

function kindForInput(element: HTMLInputElement): FieldKind {
  if (element.type === "radio") return "radio";
  if (element.type === "checkbox") return "checkbox";
  if (element.type === "date") return "date";
  if (element.type === "file") return "file";
  return "text";
}

function optionsFor(element: HTMLSelectElement): DetectedOption[] {
  return Array.from(element.options).map((option) => ({ value: option.value, label: option.textContent?.trim() ?? option.value }));
}

/** Reads every fillable field inside `root`, grouping radios that share a name. */
export function detectFields(root: ParentNode = document): DetectedField[] {
  const fields: DetectedField[] = [];
  const radioGroups = new Map<string, { elements: HTMLInputElement[]; options: DetectedOption[] }>();
  let autoId = 0;

  const nodes = root.querySelectorAll<HTMLElement>("input, select, textarea");
  for (const element of Array.from(nodes)) {
    if (element instanceof HTMLInputElement) {
      if (element.type === "hidden" || element.type === "submit" || element.type === "button" || element.type === "password") continue;
      if (element.type === "radio") {
        const name = element.name || `radio-${autoId}`;
        const group = radioGroups.get(name) ?? { elements: [], options: [] };
        group.elements.push(element);
        group.options.push({ value: element.value, label: labelFor(element, root) });
        radioGroups.set(name, group);
        continue;
      }
      autoId += 1;
      fields.push({
        id: `field-${autoId}`,
        kind: kindForInput(element),
        label: labelFor(element, root),
        name: element.name,
        autocomplete: element.autocomplete || element.getAttribute("autocomplete") || "",
        required: element.required,
        options: [],
        element,
      });
      continue;
    }
    if (element instanceof HTMLSelectElement) {
      autoId += 1;
      fields.push({
        id: `field-${autoId}`,
        kind: "select",
        label: labelFor(element, root),
        name: element.name,
        autocomplete: element.autocomplete || element.getAttribute("autocomplete") || "",
        required: element.required,
        options: optionsFor(element),
        element,
      });
      continue;
    }
    if (element instanceof HTMLTextAreaElement) {
      autoId += 1;
      fields.push({
        id: `field-${autoId}`,
        kind: "textarea",
        label: labelFor(element, root),
        name: element.name,
        autocomplete: element.getAttribute("autocomplete") || "",
        required: element.required,
        options: [],
        element,
      });
    }
  }

  for (const [name, group] of radioGroups) {
    const first = group.elements[0];
    if (!first) continue;
    autoId += 1;
    fields.push({
      id: `field-${autoId}`,
      kind: "radio",
      label: radioGroupLabel(group.elements, root),
      name,
      autocomplete: "",
      required: group.elements.some((element) => element.required),
      options: group.options,
      element: first,
      groupElements: group.elements,
    });
  }

  return fields;
}
