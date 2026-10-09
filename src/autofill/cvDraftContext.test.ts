import { expect, test } from "vitest";
import { createEmptyProfile } from "../schemas/profile";
import { buildCvDraftContext } from "./cvDraftContext";

test("includes work highlights and languages, not only the summary paragraph", () => {
  const profile = createEmptyProfile();
  profile.summary = "Analyst with three years of reporting experience.";
  profile.skills = ["SQL", "Python"];
  profile.workHistory = [
    {
      title: "Analyst",
      company: "Acme",
      location: "London",
      startDate: "",
      endDate: "",
      current: true,
      highlights: ["Built a weekend hiking club at work"],
    },
  ];
  profile.languages = [{ name: "Hindi", proficiency: "Native" }];
  const context = buildCvDraftContext(profile);
  expect(context).toContain("Analyst with three years");
  expect(context).toContain("SQL");
  expect(context).toContain("Built a weekend hiking club at work");
  expect(context).toContain("Hindi");
});

test("returns an empty string when the profile has nothing useful yet", () => {
  expect(buildCvDraftContext(createEmptyProfile())).toBe("");
});
