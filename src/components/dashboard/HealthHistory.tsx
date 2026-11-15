import { useEffect, useState } from "react";
import type { ComponentType } from "react";
import { AlertTriangle, Check, CheckCircle2, Clock, Filter, Info, Search, Stethoscope, Brain, RotateCcw } from "lucide-react";
import { assessmentRepository } from "../../storage/assessmentRepository";
import { healthConsultationRepository } from "../../storage/healthConsultationRepository";
import type { AlertItem } from "../../types/health";
import type { AssessmentRecord, AssessmentType } from "../../types/assessment";
import type { HealthConsultationRecord } from "../../types/health";
import { ResultsDashboard } from "./ResultsDashboard";

type FilterType = AssessmentType | "all" | "consultation";
type SortOrder = "newest" | "oldest";

interface HealthHistoryProps {
  alerts: AlertItem[];
  onAcknowledgeAlert: (id: number) => void;
}

const HEALTH_SIGN_LABELS: Record<string, string> = {
  nausea: "Nausea",
  fatigue: "Fatigue",
  body_pains: "Body Pains",
  flu_symptoms: "Flu Symptoms",
  headache: "Headache",
  dizziness: "Dizziness",
  shortness_of_breath: "Shortness of Breath",
  chest_pain: "Chest Pain",
  fever: "Fever",
  other: "Other",
};

const SEVERITY_CONFIG: Record<string, { label: string; color: string; bg: string; border: string; Icon: ComponentType<{ size?: number; className?: string }> }> = {
  critical: {
    label: "Critical",
    color: "text-rose-300",
    bg: "bg-rose-500/10",
    border: "border-rose-500/20",
    Icon: AlertTriangle,
  },
  attention: {
    label: "Attention",
    color: "text-amber-300",
    bg: "bg-amber-500/10",
    border: "border-amber-500/20",
    Icon: AlertTriangle,
  },
  info: {
    label: "Information",
    color: "text-cyan-300",
    bg: "bg-cyan-500/10",
    border: "border-cyan-500/20",
    Icon: Info,
  },
};

const ASSESSMENT_TYPE_LABELS: Record<AssessmentType, string> = {
  full_body: "Full Body",
  squat: "Squat",
  shoulder_mobility: "Shoulder Mobility",
  balance: "Balance",
  posture: "Posture",
};

function scoreColor(score: number | null): string {
  if (score === null) return "text-slate-400";
  if (score >= 85) return "text-ARTEMIS-green";
  if (score >= 70) return "text-cyan-300";
  if (score >= 55) return "text-ARTEMIS-amber";
  return "text-ARTEMIS-red";
}

interface UnifiedRecord {
  id: string;
  type: "assessment" | "consultation";
  date: number;
  name: string;
  score?: number;
  assessmentType?: AssessmentType;
  detectedSigns?: string[];
  status?: string;
  transcript?: string;
}

export function HealthHistory({ alerts, onAcknowledgeAlert }: HealthHistoryProps) {
  const [records, setRecords] = useState<AssessmentRecord[]>([]);
  const [consultations, setConsultations] = useState<HealthConsultationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<FilterType>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortOrder, setSortOrder] = useState<SortOrder>("newest");
  const [selectedRecord, setSelectedRecord] = useState<UnifiedRecord | null>(null);

  useEffect(() => {
    let mounted = true;
    Promise.all([
      assessmentRepository.getAll(),
      healthConsultationRepository.getAll()
    ]).then(([assessments, consultationData]) => {
      if (mounted) {
        setRecords(assessments);
        setConsultations(consultationData);
        setLoading(false);
      }
    }).catch((err) => {
      if (mounted) {
        setError(err instanceof Error ? err.message : "Failed to load history.");
        setLoading(false);
      }
    });
    return () => { mounted = false; };
  }, []);

  const unifiedRecords: UnifiedRecord[] = [
    ...records.map(r => ({
      id: r.id,
      type: "assessment" as const,
      date: r.date,
      name: r.name,
      score: r.score,
      assessmentType: r.type,
    })),
    ...consultations.map(c => ({
      id: c.id,
      type: "consultation" as const,
      date: c.date,
      name: "AI Health Consultation",
      detectedSigns: c.detectedSigns,
      status: c.status,
      transcript: c.transcript,
    }))
  ].sort((a, b) => sortOrder === "newest" ? b.date - a.date : a.date - b.date);

  const filteredRecords = unifiedRecords
    .filter((r) => filterType === "all" || (filterType === "consultation" ? r.type === "consultation" : r.assessmentType === filterType))
    .filter((r) => r.name.toLowerCase().includes(searchQuery.toLowerCase()) || r.detectedSigns?.some(s => s.toLowerCase().includes(searchQuery.toLowerCase())));

  if (selectedRecord) {
    return (
      <div className="min-h-[600px] flex flex-col">
        {selectedRecord.type === "assessment" ? (
          <ResultsDashboard record={selectedRecord as any} onBack={() => setSelectedRecord(null)} />
        ) : (
          <div className="flex-1 overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-6">
              <button
                onClick={() => setSelectedRecord(null)}
                className="min-h-[2.75rem] min-w-[2.75rem] text-slate-400 hover:text-white active:text-cyan-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 transition"
              >
                <RotateCcw size={20} />
              </button>
              <h2 className="text-lg font-semibold">AI Health Consultation</h2>
              <div className="w-[2.75rem]" />
            </div>
            <div className="max-w-3xl mx-auto space-y-6">
              <div className="rounded-2xl border border-white/10 bg-[#0d1b2b] p-6">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-12 h-12 rounded-xl bg-purple-500/20 flex items-center justify-center text-purple-400">
                    <Brain size={24} />
                  </div>
                  <div>
                    <p className="text-sm text-slate-400">Consultation Date</p>
                    <p className="text-lg font-semibold">{new Date(selectedRecord.date).toLocaleString()}</p>
                  </div>
                  <div className="ml-auto">
                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${
                      selectedRecord.status === "completed" ? "bg-emerald-500/20 text-emerald-300" :
                      selectedRecord.status === "in_progress" ? "bg-amber-500/20 text-amber-300" :
                      "bg-slate-500/20 text-slate-300"
                    }`}>
                      {selectedRecord.status}
                    </span>
                  </div>
                </div>
                {selectedRecord.detectedSigns && selectedRecord.detectedSigns.length > 0 && (
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.2em] text-cyan-300 mb-3">Detected Health Signs</p>
                    <div className="flex flex-wrap gap-2">
                      {selectedRecord.detectedSigns.map((sign: string) => (
                        <span key={sign} className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-sm text-slate-300">
                          {HEALTH_SIGN_LABELS[sign as keyof typeof HEALTH_SIGN_LABELS] || sign}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {selectedRecord.transcript && (
                  <div className="mt-6">
                    <p className="text-[10px] uppercase tracking-[0.2em] text-cyan-300 mb-3">Consultation Transcript</p>
                    <div className="rounded-lg bg-black/30 p-4 text-sm text-slate-300 whitespace-pre-wrap max-h-96 overflow-y-auto">
                      {selectedRecord.transcript}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-slate-500">
        <div className="animate-spin w-6 h-6 border-2 border-ARTEMIS-cyan border-t-transparent rounded-full mb-2" />
        <span>Loading health history...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center px-6">
        <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4 text-slate-500">
          <Clock size={24} />
        </div>
        <h3 className="text-white font-semibold mb-2">Failed to load history</h3>
        <p className="text-slate-500 text-sm mb-4">{error}</p>
          <button
            onClick={() => {
              setLoading(true);
              setError(null);
              Promise.all([
                assessmentRepository.getAll(),
                healthConsultationRepository.getAll()
              ]).then(([assessments, consultationData]) => {
                setRecords(assessments);
                setConsultations(consultationData);
                setLoading(false);
              }).catch((err) => {
                setError(err instanceof Error ? err.message : "Failed to load history.");
                setLoading(false);
              });
            }}
            className="min-h-[2.75rem] min-w-[2.75rem] text-cyan-300 underline text-base active:text-cyan-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
          >
            Retry
          </button>
      </div>
    );
  }

  if (filteredRecords.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center px-6">
        <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4 text-slate-500">
          <Filter size={24} />
        </div>
        <h3 className="text-white font-semibold mb-2">No matching records</h3>
        <p className="text-slate-500 text-sm mb-4">
          Try adjusting the filter, search, or sort options.
        </p>
          <button
            onClick={() => {
              setFilterType("all");
              setSearchQuery("");
              setSortOrder("newest");
            }}
            className="min-h-[2.75rem] min-w-[2.75rem] text-cyan-300 underline text-base active:text-cyan-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
          >
            Clear all filters
          </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-white/10 bg-[#0d1b2b] p-5 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-4">
          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] text-cyan-300">Health history</p>
            <h2 className="mt-1 text-lg font-semibold">Health records</h2>
          </div>
          <div className="flex flex-wrap gap-3 w-full sm:w-auto">
            <div className="relative w-full sm:w-64">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search by name"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full min-h-[2.75rem] bg-white/5 border border-white/10 rounded-lg px-4 py-2 pl-10 text-base text-white focus:border-cyan-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 transition"
              />
            </div>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value as FilterType)}
              className="w-full min-h-[2.75rem] sm:w-64 bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-base text-white focus:border-cyan-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 transition"
            >
              <option value="all">All records</option>
              <option value="consultation">AI Consultations</option>
              {Object.entries(ASSESSMENT_TYPE_LABELS).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
            <select
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value as SortOrder)}
              className="w-full min-h-[2.75rem] sm:w-64 bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-base text-white focus:border-cyan-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 transition"
            >
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
            </select>
          </div>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-400">{filteredRecords.length} matching record(s)</span>
        </div>
      </section>

      <section className="rounded-2xl border border-white/10 bg-[#0d1b2b] p-5 sm:p-6">
        <div className="space-y-3">
          {filteredRecords.map((r) => (
            <div
              key={r.id}
              role="button"
              onClick={() => setSelectedRecord(r)}
              className="cursor-pointer rounded-lg border border-white/10 bg-white/[0.02] p-4 min-h-[2.75rem] active:border-cyan-300/50 active:bg-white/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 transition"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded flex items-center justify-center text-xs font-bold"
                    style={{
                      background: r.type === "consultation" ? "rgba(139, 92, 246, 0.2)" : "rgba(0, 224, 214, 0.2)",
                      color: r.type === "consultation" ? "#8b5cf6" : "#00e0d6"
                    }}>
                    {r.type === "consultation" ? <Brain size={14} /> : <Stethoscope size={14} />}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-200">{r.name}</p>
                    <p className="text-[10px] text-slate-500">
                      {new Date(r.date).toLocaleDateString()} · {r.type === "consultation" ? "AI Consultation" : ASSESSMENT_TYPE_LABELS[r.assessmentType!]}
                    </p>
                    {r.type === "consultation" && r.detectedSigns && r.detectedSigns.length > 0 && (
                      <p className="text-[10px] text-cyan-300 mt-1">Signs: {r.detectedSigns.join(", ")}</p>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  {r.type === "assessment" && r.score !== undefined ? (
                    <p className={`text-sm font-semibold ${scoreColor(r.score)}`}>{r.score}</p>
                  ) : (
                    <span className="text-sm font-semibold text-cyan-300">{r.status || "Completed"}</span>
                  )}
                  <p className="text-[10px] text-slate-500">{r.type === "consultation" ? "AI Consultation" : "Completed"}</p>
                </div>
              </div>
              {r.type === "assessment" && (
                <p className="mt-2 text-[10px] text-slate-500">Movement performance estimate, not a clinical result</p>
              )}
              {r.type === "consultation" && (
                <p className="mt-2 text-[10px] text-slate-500">Health consultation summary</p>
              )}
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-white/10 bg-[#0d1b2b] p-5 sm:p-6">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] text-amber-200">Alert review</p>
            <h2 className="mt-1 text-lg font-semibold">Alerts & notifications</h2>
          </div>
          <span className="rounded-full bg-amber-300/10 px-2.5 py-1 text-[10px] font-semibold text-amber-200">
            {alerts.length} open
          </span>
        </div>
        <p className="text-[10px] text-slate-500 mb-4">The alerts below are listed for interface review. They are not clinical alerts.</p>
        {alerts.length === 0 ? (
          <div className="py-8 text-center">
            <CheckCircle2 className="mx-auto mb-2 text-emerald-300" size={24} />
            <p className="text-sm font-medium text-slate-200">All alerts reviewed</p>
            <p className="mt-1 text-xs text-slate-500">There are no alerts awaiting review.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {alerts.map((alert) => {
              const config = severity(alert.severity);
              const Icon = config.Icon;
              return (
                <div key={alert.id} className="rounded-xl border border-white/[0.08] bg-white/[0.025] p-4">
                  <div className="flex items-start gap-3">
                    <span className={`mt-0.5 rounded-lg p-2 ${config.bg} ${config.color}`}>
                      <Icon size={15} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-xs font-semibold text-slate-200">{alert.title}</p>
                        <span className={`rounded px-1.5 py-0.5 text-[9px] uppercase tracking-wider ${config.bg} ${config.color}`}>
                          {config.label}
                        </span>
                        
                      </div>
                      <p className="mt-1.5 text-[11px] leading-5 text-slate-400">{alert.detail}</p>
                      <div className="mt-3 flex items-center justify-between gap-3">
                        <span className="text-[10px] text-slate-500">{alert.time}</span>
                        <button
                          onClick={() => onAcknowledgeAlert(alert.id)}
                          className="inline-flex items-center gap-1 min-h-[2.75rem] min-w-[2.75rem] text-[10px] font-semibold text-cyan-300 active:text-cyan-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
                        >
                          <Check size={12} /> Acknowledge
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );

  function severity(s: string) {
    return SEVERITY_CONFIG[s] ?? SEVERITY_CONFIG.info;
  }
}
