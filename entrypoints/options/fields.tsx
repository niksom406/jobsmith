import { useId, type ReactNode } from "react";

export { ThemeToggle } from "../../src/ui/ThemeToggle";

const controlClass = "w-full rounded-md border border-line bg-card px-3 py-2 text-ink outline-none ring-moss focus:ring-2";

export function TextField({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: "text" | "email" | "password" | "url";
}) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm text-muted">
        {label}
      </label>
      <input id={id} type={type} value={value} onChange={(event) => onChange(event.target.value)} className={controlClass} />
    </div>
  );
}

export function AreaField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm text-muted">
        {label}
      </label>
      <textarea id={id} value={value} rows={4} onChange={(event) => onChange(event.target.value)} className={controlClass} />
    </div>
  );
}

export function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm text-muted">
        {label}
      </label>
      <select id={id} value={value} onChange={(event) => onChange(event.target.value)} className={controlClass}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export function Button({
  children,
  onClick,
  tone = "primary",
  disabled = false,
}: {
  children: ReactNode;
  onClick?: () => void;
  tone?: "primary" | "quiet" | "danger";
  disabled?: boolean;
}) {
  const tones = {
    primary: "bg-moss text-white hover:bg-moss-dark",
    quiet: "border border-line bg-card text-ink hover:border-moss",
    danger: "bg-clay text-white",
  };
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`rounded-md px-3 py-2 text-sm disabled:opacity-50 ${tones[tone]}`}
    >
      {children}
    </button>
  );
}

export function Card({ children }: { children: ReactNode }) {
  return <section className="space-y-4 rounded-lg border border-line bg-card p-4">{children}</section>;
}

export function SaveRow({
  onSave,
  pending,
  notice,
}: {
  onSave: () => void;
  pending: boolean;
  notice: string | null;
}) {
  return (
    <div className="flex items-center gap-3">
      <Button onClick={onSave} disabled={pending}>
        {pending ? "Saving…" : "Save"}
      </Button>
      {notice ? <p className="text-sm text-moss-dark">{notice}</p> : null}
    </div>
  );
}
