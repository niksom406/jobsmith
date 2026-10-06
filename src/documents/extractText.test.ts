import { expect, test } from "vitest";
import { ExtractionError, extractText } from "./extractText";

test("rejects a file type that is not a PDF or Word document", async () => {
  const file = new Blob(["hello"], { type: "text/plain" });
  await expect(extractText(file, "text/plain")).rejects.toThrow(ExtractionError);
});
