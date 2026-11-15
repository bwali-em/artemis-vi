import { useEffect, useState } from "react";
import { Save, UserCog } from "lucide-react";
import { userRepository } from "../storage/userRepository";
import type { UserDetails } from "../types/user";

type Form = Omit<UserDetails, "id" | "updatedAt">;

const empty: Form = {
  username: "",
  userRole: "",
  position: "",
  healthStatus: "",
  medicalHistory: "",
  currentIssues: "",
};

export function UserDetailsPage() {
  const [form, setForm] = useState<Form>(empty);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  useEffect(() => {
    const u = userRepository.get();
    setForm({
      username: u.username,
      userRole: u.userRole,
      position: u.position,
      healthStatus: u.healthStatus,
      medicalHistory: u.medicalHistory,
      currentIssues: u.currentIssues,
    });
  }, []);

  const update = (key: keyof Form, value: string) => setForm((p) => ({ ...p, [key]: value }));

  const save = () => {
    const rec = userRepository.save(form);
    setSavedAt(rec.updatedAt);
  };

  return (
    <div className="min-h-[100svh] bg-[#07111f]/60 backdrop-blur-md text-white p-5 sm:p-8 pb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto max-w-3xl space-y-6">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-cyan-300">Crew profile</p>
          <h1 className="mt-1 text-2xl font-semibold flex items-center gap-2"><UserCog size={22} className="text-cyan-300" /> User details</h1>
          <p className="mt-2 text-sm text-slate-400">Update your profile, role, and health information. Details are saved on this device.</p>
        </div>

        <section className="rounded-2xl border border-white/10 bg-[#0d1b2b]/80 p-5 sm:p-6 space-y-4">
          <h2 className="text-sm font-semibold text-white">Profile</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Username" value={form.username} onChange={(v) => update("username", v)} />
            <Field label="User role" value={form.userRole} onChange={(v) => update("userRole", v)} placeholder="e.g. Crew member, Medical officer" />
            <Field label="Position" value={form.position} onChange={(v) => update("position", v)} placeholder="e.g. Mission specialist" />
            <Field label="Health status" value={form.healthStatus} onChange={(v) => update("healthStatus", v)} placeholder="e.g. Fit for duty, Under observation" />
          </div>
        </section>

        <section className="rounded-2xl border border-white/10 bg-[#0d1b2b]/80 p-5 sm:p-6 space-y-4">
          <h2 className="text-sm font-semibold text-white">Medical information</h2>
          <TextArea label="Medical history" value={form.medicalHistory} onChange={(v) => update("medicalHistory", v)} placeholder="Prior conditions, surgeries, allergies, medications..." />
          <TextArea label="Current issues" value={form.currentIssues} onChange={(v) => update("currentIssues", v)} placeholder="Any current symptoms, concerns, or limitations..." />
        </section>

        <div className="flex flex-wrap items-center gap-3">
          <button onClick={save} className="inline-flex items-center justify-center gap-2 min-h-[2.75rem] rounded-lg bg-cyan-400 px-5 py-2.5 text-sm font-bold text-slate-950 active:bg-cyan-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 transition">
            <Save size={16} /> Save details
          </button>
          {savedAt && <span className="text-xs text-emerald-300">Saved {new Date(savedAt).toLocaleTimeString()}</span>}
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">{label}</span>
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400/50" />
    </label>
  );
}

function TextArea({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">{label}</span>
      <textarea value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} rows={4} className="bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400/50 resize-y" />
    </label>
  );
}
