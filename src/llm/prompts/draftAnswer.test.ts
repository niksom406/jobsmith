import { expect, test } from "vitest";
import { draftAnswerVariants, verifyAnswerClaims } from "./draftAnswer";

function responseWith(json: unknown): Response {
  return new Response(JSON.stringify({ output_text: JSON.stringify(json) }), { status: 200 });
}

test("returns variants with distinct angles", async () => {
  const fetchImpl: typeof fetch = async () =>
    responseWith({
      variants: [
        { angle: "motivation", text: "I want this role because..." },
        { angle: "skills_fit", text: "My background in..." },
      ],
    });
  const variants = await draftAnswerVariants({
    apiKey: "sk-test",
    model: "gpt-6-luna",
    question: "Why do you want this role?",
    cvSummary: "Engineer with 5 years experience.",
    userNotes: "",
    jobDescription: "Build the platform team.",
    companyBrief: "Acme makes developer tools.",
    fetchImpl,
  });
  expect(variants).toHaveLength(2);
  expect(variants[0]?.angle).toBe("motivation");
});

test("verification reports unsupported claims", async () => {
  const fetchImpl: typeof fetch = async () => responseWith({ unsupportedClaims: ["Claims to have led a team of 50, not in the CV."] });
  const claims = await verifyAnswerClaims({
    apiKey: "sk-test",
    model: "gpt-6-luna",
    draft: "I led a team of 50 engineers.",
    cvSummary: "Engineer with 5 years experience.",
    userNotes: "",
    fetchImpl,
  });
  expect(claims).toHaveLength(1);
});
