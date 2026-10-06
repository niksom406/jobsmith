import { useCallback, useEffect, useState } from "react";
import { preferencesSchema, type Preferences } from "../../src/schemas/preferences";
import { profileSchema, type Profile } from "../../src/schemas/profile";
import { sensitiveDefaultsSchema, type SensitiveDefaults } from "../../src/schemas/sensitiveDefaults";
import { settingsSchema, type Settings } from "../../src/schemas/settings";
import { LOCAL_KEYS, activeArea, extensionStorageAvailable, saveStored } from "../../src/storage/localStore";
import { loadLocalBundle, type LocalBundle } from "../../src/storage/transfer";
import { PreferencesSection } from "./PreferencesSection";
import { ProfileSection } from "./ProfileSection";
import {
  AboutSection,
  AiSection,
  AnswerBankSection,
  DataSection,
  DocumentsSection,
  InvalidRecord,
  SensitiveSection,
  SitesSection,
} from "./OtherSections";

const NAV = [
  ["profile", "Profile"],
  ["preferences", "Preferences"],
  ["documents", "Documents"],
  ["answers", "Answer bank"],
  ["sensitive", "Sensitive fields"],
  ["sites", "Sites"],
  ["ai", "AI"],
  ["data", "Data"],
  ["about", "About"],
] as const;

type SectionId = (typeof NAV)[number][0];

export default function App() {
  const [section, setSection] = useState<SectionId>("profile");
  const [bundle, setBundle] = useState<LocalBundle | null>(null);
  const [persisted, setPersisted] = useState(true);

  const reload = useCallback(async () => {
    setPersisted(extensionStorageAvailable());
    setBundle(await loadLocalBundle(activeArea()));
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function saveProfile(profile: Profile) {
    await saveStored(activeArea(), LOCAL_KEYS.profile, profileSchema, profile);
    await reload();
  }

  async function savePreferences(preferences: Preferences) {
    await saveStored(activeArea(), LOCAL_KEYS.preferences, preferencesSchema, preferences);
    await reload();
  }

  async function saveSensitive(defaults: SensitiveDefaults) {
    await saveStored(activeArea(), LOCAL_KEYS.sensitiveDefaults, sensitiveDefaultsSchema, defaults);
    await reload();
  }

  async function saveSettings(settings: Settings) {
    await saveStored(activeArea(), LOCAL_KEYS.settings, settingsSchema, settings);
    await reload();
  }

  return (
    <div className="mx-auto grid min-h-screen max-w-6xl gap-8 px-6 py-8 md:grid-cols-[220px_1fr]">
      <aside>
        <p className="font-serif text-2xl">Jobsmith</p>
        <p className="mt-1 text-sm text-muted">Settings stay in this browser.</p>
        <nav className="mt-6 flex flex-col gap-1" aria-label="Settings sections">
          {NAV.map(([id, label]) => (
            <button
              key={id}
              type="button"
              aria-current={section === id ? "page" : undefined}
              onClick={() => setSection(id)}
              className={`rounded-md px-3 py-2 text-left text-sm ${section === id ? "bg-ink text-paper" : "hover:bg-card"}`}
            >
              {label}
            </button>
          ))}
        </nav>
      </aside>
      <main>
        {persisted ? null : (
          <p className="mb-4 rounded-md border border-line bg-card px-3 py-2 text-sm text-muted">
            This page is not inside the extension, so changes last only until you reload it.
          </p>
        )}
        {bundle === null ? <p className="text-sm text-muted">Loading…</p> : null}
        {bundle && section === "profile" ? (
          bundle.profile.ok ? (
            <ProfileSection profile={bundle.profile.value} onSave={saveProfile} />
          ) : (
            <InvalidRecord title="Profile" error={bundle.profile.error} />
          )
        ) : null}
        {bundle && section === "preferences" ? (
          bundle.preferences.ok ? (
            <PreferencesSection preferences={bundle.preferences.value} onSave={savePreferences} />
          ) : (
            <InvalidRecord title="Preferences" error={bundle.preferences.error} />
          )
        ) : null}
        {section === "documents" ? <DocumentsSection /> : null}
        {section === "answers" ? <AnswerBankSection /> : null}
        {bundle && section === "sensitive" ? (
          bundle.sensitiveDefaults.ok ? (
            <SensitiveSection defaults={bundle.sensitiveDefaults.value} onSave={saveSensitive} />
          ) : (
            <InvalidRecord title="Sensitive fields" error={bundle.sensitiveDefaults.error} />
          )
        ) : null}
        {section === "sites" ? <SitesSection /> : null}
        {bundle && section === "ai" ? (
          bundle.settings.ok ? (
            <AiSection settings={bundle.settings.value} onSave={saveSettings} />
          ) : (
            <InvalidRecord title="AI" error={bundle.settings.error} />
          )
        ) : null}
        {section === "data" ? <DataSection onChanged={reload} /> : null}
        {section === "about" ? <AboutSection /> : null}
      </main>
    </div>
  );
}
