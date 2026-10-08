import { expect, test } from "vitest";
import { draftCoverLetter } from "./draftCoverLetter";

function responseWith(json: unknown): Response {
  return new Response(JSON.stringify({ output_text: JSON.stringify(json) }), { status: 200 });
}

test("returns the drafted cover letter text", async () => {
  const fetchImpl: typeof fetch = async () => responseWith({ text: "Acme's platform team is exactly where I want to build next." });
  const text = await draftCoverLetter({
    apiKey: "sk-test",
    model: "gpt-6-luna",
    jobTitle: "Senior Software Engineer",
    companyName: "Acme Robotics",
    cvSummary: "Engineer with 5 years experience.",
    userNotes: "",
    jobDescription: "Build the platform team.",
    companyBrief: "Acme makes developer tools.",
    fetchImpl,
  });
  expect(text).toContain("platform team");
});

test("passes the word limit through to the model", async () => {
  const captured: { body: unknown } = { body: null };
  const fetchImpl: typeof fetch = async (_input, init) => {
    captured.body = JSON.parse(String(init?.body));
    return responseWith({ text: "A short letter." });
  };
  await draftCoverLetter({
    apiKey: "sk-test",
    model: "gpt-6-luna",
    jobTitle: "Senior Software Engineer",
    companyName: "Acme Robotics",
    cvSummary: "Engineer with 5 years experience.",
    userNotes: "",
    jobDescription: "Build the platform team.",
    companyBrief: "Acme makes developer tools.",
    wordLimit: 200,
    fetchImpl,
  });
  const sentInput = (captured.body as { input: { content: string }[] }).input;
  const userMessage = sentInput[1]?.content ?? "";
  expect(userMessage).toContain("\"wordLimit\":200");
});
