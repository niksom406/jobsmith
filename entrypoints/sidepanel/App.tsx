import { EnableSiteForm } from "../../src/ui/EnableSiteForm";

export default function App() {
  return (
    <main className="space-y-6 p-4">
      <header>
        <p className="text-xs tracking-wide text-muted uppercase">Jobsmith</p>
        <h1 className="font-serif text-2xl">This page</h1>
      </header>
      <p className="text-sm leading-6 text-muted">
        Form filling and answer drafts are not in this version yet. You can allow Jobsmith on the career site you have open.
        LinkedIn stays off.
      </p>
      <EnableSiteForm />
    </main>
  );
}
