import { useState } from "react";
import { AssessmentSelector } from "../components/assessment/AssessmentSelector";
import { ConversationalAssessmentRunner } from "../components/assessment/ConversationalAssessmentRunner";
import { ResultsDashboard } from "../components/dashboard/ResultsDashboard";
import type { AssessmentRecord } from "../types/assessment";

export function AssessmentPage() {
  const [view, setView] = useState<"selector" | "assessment" | "results">("selector");
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [record, setRecord] = useState<AssessmentRecord | null>(null);

  if (view === "results" && record) {
    return <ResultsDashboard record={record} onBack={() => { setView("selector"); setRecord(null); }} />;
  }

  if (view === "assessment" && selectedType) {
    return (
      <ConversationalAssessmentRunner
        type={selectedType as any}
        onComplete={(rec) => { setRecord(rec); setView("results"); }}
        onExit={() => { setView("selector"); setSelectedType(null); }}
      />
    );
  }

  return (
    <div className="flex flex-col min-h-[100svh] bg-astra-navy text-white">
      <header className="border-b border-astra-border/60 bg-black/40 px-5 py-4 sm:px-8">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-300 text-astra-navy">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M9 11a3 3 0 1 1 6 0c0 2-3 2-3 4" />
                <line x1="12" y1="17" x2="12" y2="17" />
                <circle cx="12" cy="12" r="10" />
              </svg>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-[0.18em] text-slate-400">Movement assessment</p>
              <h1 className="text-sm font-bold text-white">Choose an assessment</h1>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-5 py-8 sm:px-8 sm:py-10 pb-[env(safe-area-inset-bottom)]">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-10">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.22em] text-astra-cyan">Medical operations / movement analysis</p>
            <h2 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">Start an assessment</h2>
          </div>
          <p className="max-w-sm text-sm leading-6 text-astra-slate">Choose a guided movement assessment. Results are pose-estimation estimates for this prototype, not clinical measurements.</p>
        </div>

        <AssessmentSelector onStart={(type) => { setSelectedType(type); setView("assessment"); }} />
      </main>
    </div>
  );
}
