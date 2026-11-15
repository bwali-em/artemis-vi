import { useState } from "react";
import { ChevronLeft, Clock, ArrowRight, Activity } from "lucide-react";
import type { AssessmentRecord } from "../../types/assessment";
import { BodyMapPage } from "../../pages/BodyMapPage";

interface ResultsDashboardProps {
  record: AssessmentRecord;
  onBack: () => void;
}

export function ResultsDashboard({ record, onBack }: ResultsDashboardProps) {
  const metrics = record.metrics;
  const score = record.score ?? 0;
  const [showBodyMap, setShowBodyMap] = useState(false);

  if (showBodyMap && record.bodyMap) {
    return <BodyMapPage assessment={record.bodyMap} title={`${record.name} — body map`} onBack={() => setShowBodyMap(false)} />;
  }

  const getScoreColor = (s: number) => {
    if (s >= 85) return "text-ARTEMIS-green";
    if (s >= 70) return "text-ARTEMIS-cyan";
    if (s >= 55) return "text-ARTEMIS-amber";
    return "text-ARTEMIS-red";
  };

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 py-6 border-b border-ARTEMIS-border/50">
          <div className="flex items-center gap-2">
            <button
              onClick={onBack}
              className="flex items-center gap-1 min-h-[2.75rem] min-w-[2.75rem] text-ARTEMIS-cyan active:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 transition"
              aria-label="Back to history"
            >
              <ChevronLeft size={18} /> Back to History
            </button>
          </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-8 pb-[env(safe-area-inset-bottom)]">
        <div className="max-w-4xl mx-auto">
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 rounded bg-ARTEMIS-cyan/20 flex items-center justify-center text-ARTEMIS-cyan text-xs font-bold">
                {record.type.charAt(0).toUpperCase()}
              </div>
              <h1 className="text-2xl font-bold text-white">{record.name}</h1>
            </div>
            <div className="flex items-center gap-4 text-xs text-ARTEMIS-slate mb-1">
              <span className="flex items-center gap-1">
                <Clock size={14} />
                {((record.duration || 0) / 1000).toFixed(0)}s
              </span>
              <span className="w-px h-3 bg-white/20" />
              <span>{new Date(record.date).toLocaleString()}</span>
            </div>
          </div>

          {/* Overall Score */}
          <div className="rounded-2xl border border-ARTEMIS-border/50 bg-black/40 p-8 mb-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-6">
              <div>
                <p className="text-xs font-mono text-ARTEMIS-slate uppercase tracking-wider">Movement Performance Score</p>
                <p className="text-4xl font-bold text-white mb-1">{score}</p>
                <p className={`text-xs font-mono ${getScoreColor(score)}`}>
                  {scoreLabel(score)} — Movement performance estimate, not a medical score
                </p>
              </div>
              <div className="relative w-32 h-32">
                <svg className="w-full h-full transform -rotate-90">
                  <circle
                    cx="80"
                    cy="80"
                    r="64"
                    stroke="white/10"
                    strokeWidth="12"
                    fill="none"
                  />
                  <circle
                    cx="80"
                    cy="80"
                    r="64"
                    stroke={getScoreColor(score)}
                    strokeWidth="12"
                    fill="none"
                    strokeDasharray={`402 ${Math.max(0, 402 - (score / 100) * 402)}`}
                    strokeLinecap="round"
                    className="transition-all duration-1000"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-2xl font-bold text-white">{score}</span>
                  <span className="text-xs text-ARTEMIS-slate">/ 100</span>
                </div>
              </div>
            </div>
          </div>

          {/* Key Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <MetricCard title="Valid Repetitions" value={metrics.repetitionCount ?? "—"} />
            <MetricCard title="Movement Consistency" value={metrics.repetitionConsistency ?? "—"} subtitle="%" />
            <MetricCard title="Left-Right Symmetry" value={metrics.leftRightSymmetry != null ? Math.round(metrics.leftRightSymmetry) : "—"} subtitle="%" />
            <MetricCard title="Detection Quality" value={metrics.detectionQuality != null ? Math.round(metrics.detectionQuality) : "—"} subtitle="%" />
          </div>

          {/* Body Map */}
          {record.bodyMap && (
            <div className="rounded-2xl border border-ARTEMIS-border/50 bg-black/40 p-6 mb-8">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <div className="flex items-center gap-2">
                  <Activity size={16} className="text-ARTEMIS-cyan" />
                  <h3 className="text-xs font-mono text-ARTEMIS-slate uppercase">Anatomical body map</h3>
                </div>
                <button
                  onClick={() => setShowBodyMap(true)}
                  className="inline-flex min-h-[2.75rem] items-center gap-2 rounded-lg bg-cyan-400 px-4 py-2 text-xs font-bold text-slate-950 active:bg-cyan-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
                >
                  <Activity size={14} /> Open body map
                </button>
              </div>
              <p className="text-xs leading-5 text-slate-400">
                Joint coordinates captured during this assessment have been mapped to{" "}
                {record.bodyMap.summary.totalAssessed} anatomical regions. Open the body map to see which
                regions are normal, need monitoring, or need attention.
              </p>
              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <BodyCount label="Normal" value={record.bodyMap.summary.normal} color="text-[#95C11E]" />
                <BodyCount label="Monitoring" value={record.bodyMap.summary.monitoring} color="text-[#F2C811]" />
                <BodyCount label="Attention" value={record.bodyMap.summary.attention} color="text-[#F08A1E]" />
                <BodyCount label="Abnormal" value={record.bodyMap.summary.critical} color="text-[#E03131]" />
              </div>
            </div>
          )}

          {/* Findings */}
          <div className="rounded-xl border border-ARTEMIS-border/50 bg-black/40 p-6 mb-8">
            <h3 className="text-xs font-mono text-ARTEMIS-slate uppercase mb-4">Assessment Findings</h3>
            <ul className="space-y-3">
              {record.findings.map((f, i) => (
                <li key={i} className="flex items-start gap-3 text-sm text-white">
                  <span className="flex shrink-0 mt-1 w-1.5 h-1.5 rounded-full bg-ARTEMIS-cyan" />
                  <p>{f}</p>
                </li>
              ))}
            </ul>
          </div>

          {/* Recommendations */}
          <div className="rounded-xl border border-ARTEMIS-amber/30 bg-amber/5 p-6 mb-8">
            <h3 className="text-xs font-mono text-ARTEMIS-amber uppercase mb-4 flex items-center gap-2">
              <ArrowRight size={14} /> Recommendations
            </h3>
            <ul className="space-y-3 text-sm text-white">
              {record.recommendations.map((r, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span className="flex shrink-0 mt-1 w-1.5 h-1.5 rounded-full bg-ARTEMIS-amber" />
                  <p>{r}</p>
                </li>
              ))}
            </ul>
          </div>

          <div className="text-xs text-ARTEMIS-slate/60 text-center mt-8">
            This score is a movement performance estimate based on pose estimation. It is not a clinical or medical diagnosis.
          </div>
        </div>
      </div>
    </div>
  );
}

function scoreLabel(score: number): string {
  if (score >= 85) return "Excellent";
  if (score >= 70) return "Good";
  if (score >= 55) return "Fair";
  if (score >= 40) return "Needs Improvement";
  return "Poor";
}

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
}

function MetricCard({ title, value, subtitle }: MetricCardProps) {
  return (
    <div className="rounded-xl border border-ARTEMIS-border/50 bg-black/40 p-4">
      <div className="text-xs font-mono text-ARTEMIS-slate uppercase tracking-wider mb-1">{title}</div>
      <div className="text-xl font-bold text-white">{value}</div>
      {subtitle && <div className="text-xs text-ARTEMIS-slate mt-1">{subtitle}</div>}
    </div>
  );
}

function BodyCount({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-[#0d1b2b]/60 px-3 py-2">
      <p className={`text-lg font-semibold ${color}`}>{value}</p>
      <p className="text-[10px] uppercase tracking-wider text-slate-500">{label}</p>
    </div>
  );
}
