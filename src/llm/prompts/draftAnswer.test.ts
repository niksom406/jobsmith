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

test("passes earlier drafts through for the model to avoid repeating, on a Replace", async () => {
  const captured: { body: unknown } = { body: null };
  const fetchImpl: typeof fetch = async (_input, init) => {
    captured.body = JSON.parse(String(init?.body));
    return responseWith({ variants: [{ angle: "skills_fit", text: "A different answer." }] });
  };
  await draftAnswerVariants({
    apiKey: "sk-test",
    model: "gpt-6-luna",
    question: "Why do you want this role?",
    cvSummary: "Engineer with 5 years experience.",
    userNotes: "",
    jobDescription: "Build the platform team.",
    companyBrief: "Acme makes developer tools.",
    avoidTexts: ["I want this role because..."],
    fetchImpl,
  });
  const sentInput = (captured.body as { input: { content: string }[] }).input;
  const userMessage = sentInput[1]?.content ?? "";
  expect(userMessage).toContain("I want this role because...");
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
