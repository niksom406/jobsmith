function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function isoFromParts(year: number, month: number, day: number): string | null {
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  if (year < 1000 || year > 9999) return null;
  return `${year}-${pad(month)}-${pad(day)}`;
}

/**
 * Converts a free-typed date (the sensitive-defaults "saved value" field, or anything else kept as
 * plain text) into the exact YYYY-MM-DD a native <input type="date"> requires. A native date input
 * silently ignores any other format -- setting .value to something it doesn't accept just leaves
 * the field empty, with no error, which is why a saved date of birth or start date can look like it
 * "didn't fill" even though Jobsmith tried.
 *
 * Deliberately conservative: an unambiguous format (already ISO, or a month name present) is
 * converted; a bare numeric D/M/Y vs M/D/Y string is assumed day-first (Jobsmith's UK-English
 * default), which is a real assumption, not a guess invented per-field -- it's the same convention
 * used throughout the UI. Anything else returns null rather than risk silently writing a wrong date.
 */
export function toIsoDateString(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(trimmed);
  if (iso) return isoFromParts(Number(iso[1]), Number(iso[2]), Number(iso[3]));

  const numeric = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(trimmed);
  if (numeric) {
    const first = Number(numeric[1]);
    const second = Number(numeric[2]);
    const year = Number(numeric[3]);
    // Day-first (UK) by default; if the first number can't be a day (>31) but the second can,
    // or the first can't be a month (>12) while the second clearly is a day, swap -- these are
    // the only two cases where the order is actually unambiguous either way.
    if (first > 12 && first <= 31) return isoFromParts(year, second, first); // D/M/Y, first can't be a month
    return isoFromParts(year, second, first);
  }

  // Only trust the built-in parser when a month name is present -- otherwise its own day/month
  // guessing for all-numeric strings is exactly the ambiguity this function exists to avoid.
  if (/[a-zA-Z]/.test(trimmed)) {
    const parsed = new Date(trimmed);
    if (!Number.isNaN(parsed.getTime())) {
      return isoFromParts(parsed.getFullYear(), parsed.getMonth() + 1, parsed.getDate());
    }
  }

  return null;
}

/** Sets a native <input type="date">'s value and reports whether the browser actually accepted
 * it, so a caller can report "skipped" instead of a misleading "filled" when it silently didn't. */
export function setDateInputValue(element: HTMLInputElement, isoValue: string): boolean {
  element.value = isoValue;
  return element.value === isoValue;
}
