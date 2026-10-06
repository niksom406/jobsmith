import { expect, test } from "vitest";
import { parseProfileFromCv } from "./parseProfile";

function responseWith(json: unknown): Response {
  return new Response(JSON.stringify({ output_text: JSON.stringify(json), usage: {} }), { status: 200 });
}

test("builds a profile with the current schema version from the model's answer", async () => {
  const fetchImpl: typeof fetch = async () =>
    responseWith({
      name: "Ada Lovelace",
      email: "",
      phone: "",
      address: { line1: "", line2: "", city: "", region: "", postalCode: "", country: "" },
      links: { linkedin: "", github: "", portfolio: "" },
      summary: "",
      skills: ["Mathematics"],
      workHistory: [],
      education: [],
      certifications: [],
      languages: [],
    });

  const profile = await parseProfileFromCv({ apiKey: "sk-test", model: "gpt-6-luna", cvText: "Ada Lovelace, mathematician.", fetchImpl });
  expect(profile.schemaVersion).toBe(1);
  expect(profile.name).toBe("Ada Lovelace");
  expect(profile.skills).toEqual(["Mathematics"]);
});
