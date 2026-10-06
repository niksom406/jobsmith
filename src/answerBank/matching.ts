const STOP_WORDS = new Set([
  "a",
  "an",
  "the",
  "is",
  "are",
  "do",
  "did",
  "you",
  "your",
  "what",
  "why",
  "how",
  "to",
  "of",
  "for",
  "in",
  "on",
  "and",
  "or",
  "please",
  "describe",
]);

/** A stable key for exact repeats: lowercase, punctuation stripped, stop words removed, words sorted. */
export function normalizeQuestion(question: string): string {
  const words = question
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((word) => word && !STOP_WORDS.has(word));
  return [...new Set(words)].sort().join(" ");
}

function bigrams(value: string): Set<string> {
  const letters = value.replace(/\s+/g, "");
  const grams = new Set<string>();
  for (let index = 0; index < letters.length - 1; index += 1) grams.add(letters.slice(index, index + 2));
  return grams;
}

/** Dice coefficient over character bigrams: cheap, local, no network call. 1 = identical, 0 = unrelated. */
export function similarity(a: string, b: string): number {
  const left = bigrams(normalizeQuestion(a));
  const right = bigrams(normalizeQuestion(b));
  if (left.size === 0 || right.size === 0) return a.trim() === b.trim() ? 1 : 0;
  let shared = 0;
  for (const gram of left) if (right.has(gram)) shared += 1;
  return (2 * shared) / (left.size + right.size);
}

export interface AnswerBankCandidate {
  id: string;
  originalQuestion: string;
  normalizedQuestion: string;
}

export interface MatchResult {
  id: string;
  score: number;
}

/** Best match above the threshold, or null. Exact normalized matches always win first. */
export function findBestAnswerMatch(
  question: string,
  candidates: AnswerBankCandidate[],
  threshold = 0.6,
): MatchResult | null {
  const normalized = normalizeQuestion(question);
  const exact = candidates.find((candidate) => candidate.normalizedQuestion === normalized && normalized.length > 0);
  if (exact) return { id: exact.id, score: 1 };

  let best: MatchResult | null = null;
  for (const candidate of candidates) {
    const score = similarity(question, candidate.originalQuestion);
    if (score >= threshold && (!best || score > best.score)) best = { id: candidate.id, score };
  }
  return best;
}
