import { useState, useEffect, useCallback } from "react";
import { UserRound, AlertTriangle, Check, Plus, Moon } from "lucide-react";

export type LoggedAssessment = {
  id: string;
  crewName: string;
  category: string;
  severity: "CRITICAL" | "CAUTION" | "ADVISORY";
  timestamp: string;
  summary: string;
  bedtime?: string;
  wakeTime?: string;
  sleepHours?: number;
  stress?: number;
  sleepQuality?: number;
  mood?: number;
  recommendations?: string[];
};

type Severity = "NOMINAL" | "CAUTION" | "CRITICAL";

type AiSymptomAssistantProps = {
  missionTriageLogs: LoggedAssessment[];
  onAddMissionLog: (log: LoggedAssessment) => void;
  onClearMissionLogs: () => void;
};

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

function computeWakeTime(bedtime: string, sleepHours: number): string {
  if (!bedtime) return "";
  const [h, m] = bedtime.split(":").map(Number);
  const date = new Date();
  date.setHours(h, m, 0, 0);
  date.setMinutes(date.getMinutes() + Math.round(sleepHours * 60));
  return date.toTimeString().slice(0, 5);
}

/**
 * Generates AI-driven sleep & stress recommendations grounded in the
 * NASA/CSA research data (docs/sleep_stress_wellbeing_research.md):
 * ARCHeR actigraphy/behavioral surveys, C-STARS mental well-being,
 * circadian alignment, SANS/fluid-shift risk, immune reactivation,
 * and menu fatigue/nutrition guidance.
 */
function generateRecommendations({
  sleepHours,
  stress,
  bedtime,
  sleepQuality,
  mood,
}: {
  sleepHours: number;
  stress: number;
  bedtime?: string;
  sleepQuality?: number | null;
  mood?: number | null;
}): string[] {
  const recs: string[] = [];

  // --- Sleep duration (sleep loss / circadian desynchrony, ARCHeR) ---
  if (sleepHours <= 4) {
    recs.push(
      "CRITICAL — Severe sleep debt. Prioritize consolidated sleep; request a sleep-wake schedule review with the Crew Medical Officer. Use timed light therapy to realign your circadian rhythm.",
    );
  } else if (sleepHours <= 6) {
    recs.push(
      "CAUTION — Sleep below the 7–9 hr operational baseline. Keep a consistent bedtime/wake time; start a 60-minute wind-down routine (dim lights, no screens) before sleep.",
    );
  } else {
    recs.push(
      "Sleep duration within the 7–9 hr operational baseline. Maintain your current schedule and light-exposure routine.",
    );
  }

  // --- Bedtime / circadian alignment ---
  if (bedtime) {
    const bedHour = parseInt(bedtime.split(":")[0], 10);
    if (bedHour >= 2 || bedHour === 0) {
      recs.push(
        "Late bedtime may disrupt circadian alignment. Aim to retire between 21:00–23:00 to preserve the light/dark cycle critical for Earth-independent operations.",
      );
    } else if (bedHour >= 21) {
      recs.push(
        "Bedtime falls within the recommended circadian window (21:00–23:00). Good for maintaining a stable sleep rhythm.",
      );
    }
  }

  // --- Stress (isolation, confinement, C-STARS, behavioral health) ---
  if (stress >= 8) {
    recs.push(
      "CRITICAL — Elevated stress. Contact the Crew Medical Officer immediately. Use paced breathing and reduce workload; isolation and confinement are the primary behavioral risks on long missions.",
    );
  } else if (stress >= 6) {
    recs.push(
      "CAUTION — Elevated stress. Schedule daily behavioral check-ins (C-STARS-style), prioritize crew communication, and pace your workload to prevent compounding strain.",
    );
  } else {
    recs.push(
      "Stress within baseline. Continue regular behavioral self-monitoring and crew check-ins.",
    );
  }

  // --- Post-sleep sleep quality (sleep environment, ARCHeR) ---
  if (sleepQuality != null) {
    if (sleepQuality <= 4) {
      recs.push(
        "Poor sleep quality reported. Optimize the sleep environment: reduce cabin noise/ventilation disturbance, control thermal comfort, and use eye masks/earplugs.",
      );
    } else if (sleepQuality <= 6) {
      recs.push(
        "Moderate sleep quality. Review sleep environment factors (thermal, humidity, noise) and consider a pre-sleep relaxation protocol.",
      );
    } else {
      recs.push(
        "Good sleep quality. Maintain your current sleep environment and pre-sleep routine.",
      );
    }
  }

  // --- Post-sleep mood (C-STARS mental well-being) ---
  if (mood != null) {
    if (mood <= 3) {
      recs.push(
        "Low mood flagged. Increase crew social interaction, schedule enjoyable activities, and monitor for behavioral health changes per C-STARS guidelines.",
      );
    } else if (mood <= 5) {
      recs.push(
        "Moderate mood. Engage in crew bonding activities and keep a structured daily schedule to support psychological well-being.",
      );
    } else {
      recs.push(
        "Positive mood reported. Continue crew engagement and structured activities.",
      );
    }
  }

  // --- SANS / fluid shift + immune reactivation cross-domain (NASA HRP) ---
  if (sleepHours <= 6 && stress >= 6) {
    recs.push(
      "Combined low sleep and high stress may amplify headward fluid shift and SANS risk. Monitor for headache or vision changes; review the thigh-cuff/fluid protocol.",
    );
  }

  return recs;
}

export function AiSymptomAssistant({
  missionTriageLogs,
  onAddMissionLog,
  onClearMissionLogs,
}: AiSymptomAssistantProps) {
  const [selectedCrew, setSelectedCrew] = useState(CREW_ROSTER[0]);
  const [bedtime, setBedtime] = useState("");
  const [sleepHours, setSleepHours] = useState(7);
  const [stress, setStress] = useState(3);
  const [sleepQuality, setSleepQuality] = useState<number | null>(null);
  const [mood, setMood] = useState<number | null>(null);
  const [category, setCategory] = useState("General wellness check-in");
  const [summary, setSummary] = useState("");
  const [liveSeverity, setLiveSeverity] = useState<Severity>("NOMINAL");

  const wakeTime = computeWakeTime(bedtime, sleepHours);

  useEffect(() => {
    setLiveSeverity(severityFromInputs(sleepHours, stress));
  }, [sleepHours, stress]);

  const recommendations = generateRecommendations({
    sleepHours,
    stress,
    bedtime,
    sleepQuality,
    mood,
  });

  const severityColor = (sev: Severity) => {
    switch (sev) {
      case "CRITICAL": return "text-rose-400 bg-rose-500/20 border border-rose-500/40";
      case "CAUTION": return "text-amber-400 bg-amber-500/20 border border-amber-500/40";
      default: return "text-emerald-400 bg-emerald-500/20 border border-emerald-500/40";
    }
  };

  const handleAddLog = useCallback(() => {
    const sev = severityFromInputs(sleepHours, stress);
    const recs = generateRecommendations({
      sleepHours,
      stress,
      bedtime,
      sleepQuality,
      mood,
    });
    const log: LoggedAssessment = {
      id: `triage-${Date.now()}`,
      crewName: selectedCrew.name,
      category,
      severity: (sev === "NOMINAL" ? "ADVISORY" : sev) as LoggedAssessment["severity"],
      timestamp: new Date().toLocaleString(),
      summary: summary ||
        `${selectedCrew.name} — bedtime ${bedtime || "—"}, sleep ${sleepHours}h, stress ${stress}/10` +
        (sleepQuality != null ? `, sleep quality ${sleepQuality}/10` : "") +
        (mood != null ? `, mood ${mood}/10` : ""),
      bedtime: bedtime || undefined,
      wakeTime: wakeTime || undefined,
      sleepHours,
      stress,
      sleepQuality: sleepQuality ?? undefined,
      mood: mood ?? undefined,
      recommendations: recs,
    };
    onAddMissionLog(log);
    setSummary("");
  }, [
    selectedCrew,
    bedtime,
    sleepHours,
    stress,
    sleepQuality,
    mood,
    category,
    summary,
    wakeTime,
    onAddMissionLog,
  ]);

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

        {/* Sleep & wellbeing inputs */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-slate-800/50 bg-white/[0.02] p-4 lg:col-span-2">
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
            <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-3">Bedtime</p>
            <input
              type="time"
              value={bedtime}
              onChange={(e) => setBedtime(e.target.value)}
              className="w-full rounded bg-white/5 border border-slate-700 px-3 py-2 text-sm text-white focus:border-cyan-400 focus-visible:outline-none"
            />
            {bedtime && (
              <p className="mt-1 text-[10px] text-slate-500">
                Implied wake time: <span className="text-cyan-400 font-mono">{wakeTime || "—"}</span>
              </p>
            )}
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
        </div>

        {/* Post-sleep wellbeing log */}
        <section className="rounded-xl border border-slate-800/50 bg-white/[0.02] p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[10px] uppercase tracking-wider text-slate-500">Post-Sleep Wellbeing Log</p>
            <span className={`text-[10px] font-semibold ${sleepQuality != null && mood != null ? "text-emerald-400" : "text-slate-500"}`}>
              {sleepQuality != null && mood != null ? "Logged" : "Optional — log after waking"}
            </span>
          </div>
          <div className="grid gap-4 sm:grid-cols-4">
            <div className="rounded-lg border border-slate-700/50 bg-white/[0.03] p-3">
              <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-2">Sleep Quality</p>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min="1"
                  max="10"
                  step="1"
                  value={sleepQuality ?? 5}
                  onChange={(e) => setSleepQuality(Number(e.target.value))}
                  className="w-full accent-emerald-400"
                />
                <span className="text-sm font-mono text-white">{sleepQuality ?? 5} /10</span>
              </div>
            </div>
            <div className="rounded-lg border border-slate-700/50 bg-white/[0.03] p-3">
              <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-2">Mood</p>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min="1"
                  max="10"
                  step="1"
                  value={mood ?? 5}
                  onChange={(e) => setMood(Number(e.target.value))}
                  className="w-full accent-purple-400"
                />
                <span className="text-sm font-mono text-white">{mood ?? 5} /10</span>
              </div>
            </div>
          </div>
        </section>

        {/* Assessment */}
        <div className="rounded-xl border border-slate-800/50 bg-white/[0.02] p-4">
          <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-3">Assessment</p>
          <div className="grid gap-3 sm:grid-cols-4">
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

        {/* AI Recommendations (dynamic, research-grounded) */}
        <section className="rounded-xl border border-slate-700/40 bg-emerald-500/[0.03] p-4">
          <div className="flex items-center gap-2 mb-3">
            <Moon size={14} className="text-emerald-400" />
            <h4 className="text-sm font-semibold text-white">AI Recommendations (sleep & stress)</h4>
          </div>
          <ul className="space-y-2 text-xs text-slate-300 leading-relaxed">
            {recommendations.map((r, i) => (
              <li key={i} className="flex gap-2">
                <span className="mt-0.5 w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                <p>{r}</p>
              </li>
            ))}
          </ul>
        </section>
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
                {log.recommendations && log.recommendations.length > 0 && (
                  <div className="mt-1.5 border-t border-slate-800 pt-1.5">
                    <p className="text-[9px] font-semibold uppercase tracking-wider text-slate-500 mb-1">AI guidance:</p>
                    <ul className="space-y-1 text-[9px] text-slate-300 leading-tight">
                      {log.recommendations.slice(0, 2).map((r, i) => (
                        <li key={i} className="flex gap-1">
                          <span className="mt-0.5 w-1 h-1 rounded-full bg-cyan-500/60 shrink-0" />
                          <span className="leading-none">{r}</span>
                        </li>
                      ))}
                      {log.recommendations.length > 2 && (
                        <li className="text-[9px] text-slate-500 italic">
                          +{log.recommendations.length - 2} more…
                        </li>
                      )}
                    </ul>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

export default AiSymptomAssistant;
