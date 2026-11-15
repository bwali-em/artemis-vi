import { useState, useEffect, useCallback } from "react";
import { UserRound, AlertTriangle, Check, Plus } from "lucide-react";

export type LoggedAssessment = {
  id: string;
  crewName: string;
  category: string;
  severity: "CRITICAL" | "CAUTION" | "ADVISORY";
  timestamp: string;
  summary: string;
};

type Severity = "NOMINAL" | "CAUTION" | "CRITICAL";

type AiSymptomAssistantProps = {
  missionTriageLogs: LoggedAssessment[];
  onAddMissionLog: (log: LoggedAssessment) => void;
  onClearMissionLogs: () => void;
};

const STORAGE_KEY = "astra_mission_triage_logs";

const CREW_ROSTER = [
  { id: "ast-001", name: "Commander Maya Chen", role: "Expedition Specialist" },
  { id: "ast-002", name: "Dr. Liam Vance", role: "Medical Officer" },
  { id: "ast-003", name: "Eng. Tariq Al-Mansoor", role: "Systems Engineer" },
];

function severityFromInputs(sleepHours: number, stress: number): Severity {
  if (stress >= 8 || sleepHours <= 4) return "CRITICAL";
  if (stress >= 6 || sleepHours <= 6) return "CAUTION";
  return "NOMINAL";
}

function severityLabel(severity: LoggedAssessment["severity"] | Severity) {
  switch (severity) {
    case "CRITICAL": return "CRITICAL";
    case "CAUTION": return "CAUTION";
    default: return "NOMINAL";
  }
}

export function AiSymptomAssistant({
  missionTriageLogs,
  onAddMissionLog,
  onClearMissionLogs,
}: AiSymptomAssistantProps) {
  const [selectedCrew, setSelectedCrew] = useState(CREW_ROSTER[0]);
  const [sleepHours, setSleepHours] = useState(7);
  const [stress, setStress] = useState(3);
  const [category, setCategory] = useState("General wellness check-in");
  const [summary, setSummary] = useState("");
  const [liveSeverity, setLiveSeverity] = useState<Severity>("NOMINAL");

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          // Intentionally read-only here; App.tsx owns the source of truth.
        }
      }
    } catch {
      // Ignore malformed storage
    }
  }, []);

  useEffect(() => {
    setLiveSeverity(severityFromInputs(sleepHours, stress));
  }, [sleepHours, stress]);

  const severityColor = (sev: Severity) => {
    switch (sev) {
      case "CRITICAL": return "text-rose-400 bg-rose-500/20 border border-rose-500/40";
      case "CAUTION": return "text-amber-400 bg-amber-500/20 border border-amber-500/40";
      default: return "text-emerald-400 bg-emerald-500/20 border border-emerald-500/40";
    }
  };

  const handleAddLog = useCallback(() => {
    const sev = severityFromInputs(sleepHours, stress);
    const log: LoggedAssessment = {
      id: `triage-${Date.now()}`,
      crewName: selectedCrew.name,
      category,
      severity: (sev === "NOMINAL" ? "ADVISORY" : sev) as LoggedAssessment["severity"],
      timestamp: new Date().toLocaleString(),
      summary: summary || `${selectedCrew.name} — sleep ${sleepHours}h, stress ${stress}/10`,
    };
    onAddMissionLog(log);
    setSummary("");
  }, [selectedCrew, sleepHours, stress, category, summary, onAddMissionLog]);

  return (
    <div className="mt-6 max-w-7xl mx-auto px-4 pb-12 space-y-6">
      {/* Autonomous AI Symptom Assistant */}
      <section className="rounded-2xl border border-slate-800 bg-slate-900/95 p-6 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-bold text-white">Autonomous AI Symptom Assistant</h3>
            <p className="text-xs text-slate-400">Earth-independent decision support · logs queued for ground downlink</p>
          </div>
          <div className={`flex items-center gap-2 px-3 py-1 rounded-md ${severityColor(liveSeverity)}`}>
            <AlertTriangle size={14} />
            <span className="text-xs font-bold tracking-wider uppercase">Live Severity: {severityLabel(liveSeverity)}</span>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-xl border border-slate-800/50 bg-white/[0.02] p-4">
            <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-3">Crew Member</p>
            <div className="space-y-2">
              {CREW_ROSTER.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setSelectedCrew(c)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition ${
                    selectedCrew.id === c.id
                      ? "bg-cyan-500/10 border-cyan-500/50 text-cyan-300"
                      : "border-transparent text-slate-400 hover:text-slate-300"
                  }`}
                >
                  <UserRound size={16} className="shrink-0" />
                  <span>{c.name}</span>
                  <span className="ml-auto text-[10px] text-slate-600">{c.role}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-slate-800/50 bg-white/[0.02] p-4">
            <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-3">Sleep (hours)</p>
            <div className="flex items-center gap-2">
              <input
                type="range"
                min="0"
                max="12"
                step="0.5"
                value={sleepHours}
                onChange={(e) => setSleepHours(Number(e.target.value))}
                className="w-full accent-cyan-400"
              />
              <span className="text-sm font-mono text-white">{sleepHours} h</span>
            </div>
          </div>

          <div className="rounded-xl border border-slate-800/50 bg-white/[0.02] p-4">
            <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-3">Stress (1-10)</p>
            <div className="flex items-center gap-2">
              <input
                type="range"
                min="1"
                max="10"
                step="1"
                value={stress}
                onChange={(e) => setStress(Number(e.target.value))}
                className="w-full accent-rose-400"
              />
              <span className="text-sm font-mono text-white">{stress} /10</span>
            </div>
          </div>

          <div className="rounded-xl border border-slate-800/50 bg-white/[0.02] p-4 sm:col-span-2 lg:col-span-3">
            <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-3">Assessment</p>
            <div className="grid gap-3 sm:grid-cols-3">
              <input
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="Category (e.g. General wellness)"
                className="rounded bg-white/5 border border-slate-700 px-3 py-2 text-sm text-white focus:border-cyan-400 focus-visible:outline-none"
              />
              <input
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                placeholder="Summary / notes"
                className="rounded bg-white/5 border border-slate-700 px-3 py-2 text-sm text-white focus:border-cyan-400 focus-visible:outline-none sm:col-span-2"
              />
              <button
                onClick={handleAddLog}
                disabled={!category.trim()}
                className="rounded-lg bg-cyan-500 text-slate-950 px-4 py-2 text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed active:bg-cyan-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 transition"
              >
                <Plus size={16} /> Log Assessment
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Central Mission Triage Ledger (Persisted across sessions) */}
      {missionTriageLogs.length > 0 && (
        <section className="bg-slate-900/95 border border-slate-800 rounded-xl p-5 text-slate-100 shadow-xl max-w-4xl mx-auto">
          <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-800">
            <div>
              <h4 className="text-sm font-bold text-white uppercase tracking-wider">
                Central Mission Triage Ledger ({missionTriageLogs.length})
              </h4>
              <p className="text-xs text-slate-400">
                Synced autonomous decision-support logs queued for ground telemetry downlink
              </p>
            </div>
            <button
              onClick={onClearMissionLogs}
              className="text-xs text-rose-400 hover:text-rose-300 cursor-pointer"
            >
              <Check size={14} className="mr-1" /> Purge Ledger
            </button>
          </div>

          <div className="space-y-2.5 max-h-60 overflow-y-auto">
            {missionTriageLogs.map((log) => (
              <div
                key={log.id}
                className="bg-slate-950/80 border border-slate-800 rounded-lg p-3 text-xs flex flex-col gap-1"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                        log.severity === "CRITICAL"
                          ? "bg-rose-500/20 text-rose-300 border border-rose-500/40"
                          : log.severity === "CAUTION"
                          ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                          : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                      }`}
                    >
                      {log.severity}
                    </span>
                    <span className="font-semibold text-slate-200">{log.crewName}</span>
                    <span className="text-indigo-400">• {log.category}</span>
                  </div>
                  <span className="text-slate-500">{log.timestamp}</span>
                </div>
                <p className="text-slate-400 leading-relaxed">{log.summary}</p>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

export default AiSymptomAssistant;
