import { useEffect, useState } from "react";
import type { CertificationItem, EducationItem, LanguageItem, Profile, WorkHistoryItem } from "../../src/schemas/profile";
import { AreaField, Button, Card, SaveRow, TextField } from "./fields";

function tidyLines(value: string[]): string[] {
  return value.map((line) => line.trim()).filter(Boolean);
}

function blankRole(): WorkHistoryItem {
  return { title: "", company: "", location: "", startDate: "", endDate: "", current: false, highlights: [] };
}

function blankEducation(): EducationItem {
  return { school: "", degree: "", field: "", startDate: "", endDate: "" };
}

function blankCertification(): CertificationItem {
  return { name: "", issuer: "", date: "" };
}

function blankLanguage(): LanguageItem {
  return { name: "", proficiency: "" };
}

export function ProfileSection({ profile, onSave }: { profile: Profile; onSave: (profile: Profile) => Promise<void> }) {
  const [draft, setDraft] = useState(profile);
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    setDraft(profile);
  }, [profile]);

  function update(partial: Partial<Profile>) {
    setDraft((current) => ({ ...current, ...partial }));
    setNotice(null);
  }

  return (
    <div className="space-y-6">
      <header>
        <h2 className="font-serif text-3xl">Profile</h2>
        <p className="mt-1 text-sm text-muted">Correct anything here. CV upload will fill this in the next phase.</p>
      </header>
      <Card>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label="Name" value={draft.name} onChange={(name) => update({ name })} />
          <TextField label="Email" type="email" value={draft.email} onChange={(email) => update({ email })} />
          <TextField label="Phone" value={draft.phone} onChange={(phone) => update({ phone })} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label="Address line 1" value={draft.address.line1} onChange={(line1) => update({ address: { ...draft.address, line1 } })} />
          <TextField label="Address line 2" value={draft.address.line2} onChange={(line2) => update({ address: { ...draft.address, line2 } })} />
          <TextField label="City" value={draft.address.city} onChange={(city) => update({ address: { ...draft.address, city } })} />
          <TextField label="Region" value={draft.address.region} onChange={(region) => update({ address: { ...draft.address, region } })} />
          <TextField label="Postal code" value={draft.address.postalCode} onChange={(postalCode) => update({ address: { ...draft.address, postalCode } })} />
          <TextField label="Country" value={draft.address.country} onChange={(country) => update({ address: { ...draft.address, country } })} />
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <TextField label="LinkedIn" type="url" value={draft.links.linkedin} onChange={(linkedin) => update({ links: { ...draft.links, linkedin } })} />
          <TextField label="GitHub" type="url" value={draft.links.github} onChange={(github) => update({ links: { ...draft.links, github } })} />
          <TextField label="Portfolio" type="url" value={draft.links.portfolio} onChange={(portfolio) => update({ links: { ...draft.links, portfolio } })} />
        </div>
        <AreaField label="Summary" value={draft.summary} onChange={(summary) => update({ summary })} />
        <AreaField label="Skills, one per line" value={draft.skills.join("\n")} onChange={(value) => update({ skills: value.split("\n") })} />
      </Card>

      <Card>
        <div className="flex items-center justify-between">
          <h3 className="font-serif text-xl">Work history</h3>
          <Button tone="quiet" onClick={() => update({ workHistory: [...draft.workHistory, blankRole()] })}>
            Add role
          </Button>
        </div>
        {draft.workHistory.length === 0 ? <p className="text-sm text-muted">No roles yet.</p> : null}
        {draft.workHistory.map((role, index) => (
          <div key={index} className="space-y-3 border-t border-line pt-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                label="Title"
                value={role.title}
                onChange={(title) => {
                  const workHistory = draft.workHistory.slice();
                  workHistory[index] = { ...role, title };
                  update({ workHistory });
                }}
              />
              <TextField
                label="Company"
                value={role.company}
                onChange={(company) => {
                  const workHistory = draft.workHistory.slice();
                  workHistory[index] = { ...role, company };
                  update({ workHistory });
                }}
              />
              <TextField
                label="Location"
                value={role.location}
                onChange={(location) => {
                  const workHistory = draft.workHistory.slice();
                  workHistory[index] = { ...role, location };
                  update({ workHistory });
                }}
              />
              <TextField
                label="Start"
                value={role.startDate}
                onChange={(startDate) => {
                  const workHistory = draft.workHistory.slice();
                  workHistory[index] = { ...role, startDate };
                  update({ workHistory });
                }}
              />
              <TextField
                label="End"
                value={role.endDate}
                onChange={(endDate) => {
                  const workHistory = draft.workHistory.slice();
                  workHistory[index] = { ...role, endDate };
                  update({ workHistory });
                }}
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={role.current}
                onChange={(event) => {
                  const workHistory = draft.workHistory.slice();
                  workHistory[index] = { ...role, current: event.target.checked };
                  update({ workHistory });
                }}
              />
              Current role
            </label>
            <AreaField
              label="Highlights, one per line"
              value={role.highlights.join("\n")}
              onChange={(value) => {
                const workHistory = draft.workHistory.slice();
                workHistory[index] = { ...role, highlights: value.split("\n") };
                update({ workHistory });
              }}
            />
            <Button
              tone="quiet"
              onClick={() => update({ workHistory: draft.workHistory.filter((_, item) => item !== index) })}
            >
              Remove role
            </Button>
          </div>
        ))}
      </Card>

      <Card>
        <div className="flex items-center justify-between">
          <h3 className="font-serif text-xl">Education</h3>
          <Button tone="quiet" onClick={() => update({ education: [...draft.education, blankEducation()] })}>
            Add education
          </Button>
        </div>
        {draft.education.map((item, index) => (
          <div key={index} className="grid gap-4 border-t border-line pt-4 sm:grid-cols-2">
            <TextField label="School" value={item.school} onChange={(school) => {
              const education = draft.education.slice();
              education[index] = { ...item, school };
              update({ education });
            }} />
            <TextField label="Degree" value={item.degree} onChange={(degree) => {
              const education = draft.education.slice();
              education[index] = { ...item, degree };
              update({ education });
            }} />
            <TextField label="Field" value={item.field} onChange={(field) => {
              const education = draft.education.slice();
              education[index] = { ...item, field };
              update({ education });
            }} />
            <TextField label="Start" value={item.startDate} onChange={(startDate) => {
              const education = draft.education.slice();
              education[index] = { ...item, startDate };
              update({ education });
            }} />
            <TextField label="End" value={item.endDate} onChange={(endDate) => {
              const education = draft.education.slice();
              education[index] = { ...item, endDate };
              update({ education });
            }} />
            <div className="flex items-end">
              <Button tone="quiet" onClick={() => update({ education: draft.education.filter((_, itemIndex) => itemIndex !== index) })}>
                Remove
              </Button>
            </div>
          </div>
        ))}
      </Card>

      <Card>
        <div className="flex items-center justify-between">
          <h3 className="font-serif text-xl">Certifications and languages</h3>
        </div>
        <div className="flex gap-2">
          <Button tone="quiet" onClick={() => update({ certifications: [...draft.certifications, blankCertification()] })}>
            Add certification
          </Button>
          <Button tone="quiet" onClick={() => update({ languages: [...draft.languages, blankLanguage()] })}>
            Add language
          </Button>
        </div>
        {draft.certifications.map((item, index) => (
          <div key={`cert-${index}`} className="grid gap-4 border-t border-line pt-4 sm:grid-cols-3">
            <TextField label="Certification" value={item.name} onChange={(name) => {
              const certifications = draft.certifications.slice();
              certifications[index] = { ...item, name };
              update({ certifications });
            }} />
            <TextField label="Issuer" value={item.issuer} onChange={(issuer) => {
              const certifications = draft.certifications.slice();
              certifications[index] = { ...item, issuer };
              update({ certifications });
            }} />
            <TextField label="Date" value={item.date} onChange={(date) => {
              const certifications = draft.certifications.slice();
              certifications[index] = { ...item, date };
              update({ certifications });
            }} />
          </div>
        ))}
        {draft.languages.map((item, index) => (
          <div key={`lang-${index}`} className="grid gap-4 border-t border-line pt-4 sm:grid-cols-2">
            <TextField label="Language" value={item.name} onChange={(name) => {
              const languages = draft.languages.slice();
              languages[index] = { ...item, name };
              update({ languages });
            }} />
            <TextField label="Proficiency" value={item.proficiency} onChange={(proficiency) => {
              const languages = draft.languages.slice();
              languages[index] = { ...item, proficiency };
              update({ languages });
            }} />
          </div>
        ))}
      </Card>

      <SaveRow
        pending={pending}
        notice={notice}
        onSave={() => {
          setPending(true);
          void onSave({
            ...draft,
            skills: tidyLines(draft.skills),
            workHistory: draft.workHistory.map((role) => ({ ...role, highlights: tidyLines(role.highlights) })),
          })
            .then(() => setNotice("Profile saved in this browser."))
            .catch((error: unknown) => setNotice(error instanceof Error ? error.message : "Could not save the profile."))
            .finally(() => setPending(false));
        }}
      />
    </div>
  );
}
