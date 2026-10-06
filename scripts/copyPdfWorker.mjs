// Copies pdf.js's worker script into public/ so WXT ships it as a plain static asset at a
// stable extension URL. The worker can't be loaded from a CDN (no network dependency allowed,
// and MV3's CSP wouldn't permit a remote script anyway), and modern pdf.js has no "run without a
// worker" fallback — src/documents/extractText.ts points GlobalWorkerOptions.workerSrc at
// chrome.runtime.getURL("pdf.worker.min.mjs"), which only resolves if this file is present.
import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = join(projectRoot, "node_modules/pdfjs-dist/build/pdf.worker.min.mjs");
const destDir = join(projectRoot, "public");
const dest = join(destDir, "pdf.worker.min.mjs");

mkdirSync(destDir, { recursive: true });
copyFileSync(source, dest);
console.log(`Copied pdf.js worker: ${source} -> ${dest}`);
