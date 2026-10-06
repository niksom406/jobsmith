export class ExtractionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ExtractionError";
  }
}

async function extractPdfText(buffer: ArrayBuffer): Promise<string> {
  const pdfjs = await import("pdfjs-dist");
  // Modern pdf.js has no "run on main thread" fallback for an empty workerSrc — it throws
  // "No GlobalWorkerOptions.workerSrc specified." instead. The worker script is copied into
  // public/pdf.worker.min.mjs (see package.json's postinstall) and shipped as a plain static
  // asset, so it needs a real extension URL, not a CDN (CSP wouldn't allow a remote script
  // anyway, and this all needs to work fully offline).
  pdfjs.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL("pdf.worker.min.mjs");
  const doc = await pdfjs.getDocument({ data: buffer }).promise;
  const pages: string[] = [];
  for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber += 1) {
    const page = await doc.getPage(pageNumber);
    const content = await page.getTextContent();
    const line = content.items
      .map((item) => ("str" in item ? item.str : ""))
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
    if (line) pages.push(line);
  }
  return pages.join("\n");
}

async function extractDocxText(buffer: ArrayBuffer): Promise<string> {
  const mammoth = await import("mammoth");
  const result = await mammoth.extractRawText({ arrayBuffer: buffer });
  return result.value.trim();
}

export async function extractText(file: Blob, mimeType: string): Promise<string> {
  const buffer = await file.arrayBuffer();
  if (mimeType === "application/pdf") return extractPdfText(buffer);
  if (
    mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    mimeType === "application/msword"
  ) {
    return extractDocxText(buffer);
  }
  throw new ExtractionError("Upload a PDF or a Word (.docx) file.");
}
