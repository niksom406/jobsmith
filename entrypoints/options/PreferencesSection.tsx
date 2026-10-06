import { useEffect, useState } from "react";
import type { Preferences } from "../../src/schemas/preferences";
import { Button, Card, SaveRow, SelectField, TextField } from "./fields";

export function PreferencesSection({
  preferences,
  onSave,
}: {
  preferences: Preferences;
  onSave: (preferences: Preferences) => Promise<void>;
}) {
  const [draft, setDraft] = useState(preferences);
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    setDraft(preferences);
  }, [preferences]);

  function update(partial: Partial<Preferences>) {
    setDraft((current) => ({ ...current, ...partial }));
    setNotice(null);
  }

  const sponsorship = draft.sponsorshipNeeded === null ? "" : draft.sponsorshipNeeded ? "yes" : "no";

  return (
    <div className="space-y-6">
      <header>
        <h2 className="font-serif text-3xl">Preferences</h2>
        <p className="mt-1 text-sm text-muted">Things a CV usually does not say. The short wizard for these arrives with CV upload.</p>
      </header>
      <Card>
        <div className="flex items-center justify-between">
          <h3 className="font-serif text-xl">Right to work</h3>
          <Button
            tone="quiet"
            onClick={() => update({ rightToWork: [...draft.rightToWork, { country: "", status: "citizen" }] })}
          >
            Add country
          </Button>
        </div>
        {draft.rightToWork.length === 0 ? <p className="text-sm text-muted">No countries yet.</p> : null}
        {draft.rightToWork.map((item, index) => (
          <div key={index} className="grid gap-4 border-t border-line pt-4 sm:grid-cols-3">
            <TextField
              label="Country"
              value={item.country}
              onChange={(country) => {
                const rightToWork = draft.rightToWork.slice();
                rightToWork[index] = { ...item, country };
                update({ rightToWork });
              }}
            />
            <SelectField
              label="Status"
              value={item.status}
              onChange={(status) => {
                const rightToWork = draft.rightToWork.slice();
                rightToWork[index] = { ...item, status: status as Preferences["rightToWork"][number]["status"] };
                update({ rightToWork });
              }}
              options={[
                { value: "citizen", label: "Citizen" },
                { value: "settled", label: "Settled status" },
                { value: "visa", label: "Visa" },
                { value: "other", label: "Other" },
              ]}
            />
            <div className="flex items-end">
              <Button tone="quiet" onClick={() => update({ rightToWork: draft.rightToWork.filter((_, itemIndex) => itemIndex !== index) })}>
                Remove
              </Button>
            </div>
          </div>
        ))}
        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField
            label="Sponsorship needed"
            value={sponsorship}
            onChange={(value) => update({ sponsorshipNeeded: value === "" ? null : value === "yes" })}
            options={[
              { value: "", label: "Not set" },
              { value: "no", label: "No" },
              { value: "yes", label: "Yes" },
            ]}
          />
          <TextField label="Notice period" value={draft.noticePeriod} onChange={(noticePeriod) => update({ noticePeriod })} />
          <TextField label="Salary amount" value={draft.salaryExpectation.amount} onChange={(amount) => update({ salaryExpectation: { ...draft.salaryExpectation, amount } })} />
          <TextField label="Currency" value={draft.salaryExpectation.currency} onChange={(currency) => update({ salaryExpectation: { ...draft.salaryExpectation, currency } })} />
          <SelectField
            label="Salary period"
            value={draft.salaryExpectation.period}
            onChange={(period) => update({ salaryExpectation: { ...draft.salaryExpectation, period: period as Preferences["salaryExpectation"]["period"] } })}
            options={[
              { value: "year", label: "Per year" },
              { value: "month", label: "Per month" },
              { value: "day", label: "Per day" },
              { value: "hour", label: "Per hour" },
            ]}
          />
          <TextField label="Start date" value={draft.startDate} onChange={(startDate) => update({ startDate })} />
          <SelectField
            label="Relocation"
            value={draft.relocation}
            onChange={(relocation) => update({ relocation: relocation as Preferences["relocation"] })}
            options={[
              { value: "yes", label: "Yes" },
              { value: "no", label: "No" },
              { value: "discuss", label: "Discuss" },
            ]}
          />
          <SelectField
            label="Remote preference"
            value={draft.remotePreference}
            onChange={(remotePreference) => update({ remotePreference: remotePreference as Preferences["remotePreference"] })}
            options={[
              { value: "remote", label: "Remote" },
              { value: "hybrid", label: "Hybrid" },
              { value: "onsite", label: "On site" },
              { value: "flexible", label: "Flexible" },
            ]}
          />
          <SelectField
            label="Willingness to travel"
            value={draft.willingnessToTravel}
            onChange={(willingnessToTravel) => update({ willingnessToTravel: willingnessToTravel as Preferences["willingnessToTravel"] })}
            options={[
              { value: "none", label: "None" },
              { value: "occasional", label: "Occasional" },
              { value: "frequent", label: "Frequent" },
            ]}
          />
        </div>
      </Card>
      <SaveRow
        pending={pending}
        notice={notice}
        onSave={() => {
          setPending(true);
          void onSave(draft)
            .then(() => setNotice("Preferences saved in this browser."))
            .catch((error: unknown) => setNotice(error instanceof Error ? error.message : "Could not save preferences."))
            .finally(() => setPending(false));
        }}
      />
    </div>
  );
}
