export type FieldKind = "text" | "textarea" | "select" | "radio" | "checkbox" | "date" | "file";

export interface DetectedOption {
  value: string;
  label: string;
}

export interface DetectedField {
  /** Stable key for this run: index-based, since forms rarely have reliable ids. */
  id: string;
  kind: FieldKind;
  label: string;
  name: string;
  autocomplete: string;
  required: boolean;
  options: DetectedOption[];
  element: HTMLElement;
  /** Radios sharing one name are grouped into one DetectedField with several elements. */
  groupElements?: HTMLElement[];
}

export interface ProfileValueMap {
  [profileKey: string]: string;
}

export type MatchConfidence = "exact" | "alias" | "fuzzy" | "low";

export interface FieldMatch {
  fieldId: string;
  profileKey: string;
  confidence: MatchConfidence;
}
