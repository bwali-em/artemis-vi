import type { RegionAssessment } from "../../types/bodyMap";
import { RATING_COLORS, RATING_LABELS } from "../../data/anatomyRegions";

interface RegionDetailPanelProps {
  assessment: RegionAssessment | null;
  onClear?: () => void;
}

export function RegionDetailPanel({ assessment, onClear }: RegionDetailPanelProps) {
  if (!assessment) {
    return (
      <div className="flex h-full min-h-[260px] flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 bg-black/30 p-8 text-center">
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full border border-ARTEMIS-cyan/30 bg-ARTEMIS-cyan/10 text-ARTEMIS-cyan">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M9 11a3 3 0 1 1 6 0c0 2-3 2-3 4" />
            <line x1="12" y1="17" x2="12" y2="17" />
            <circle cx="12" cy="12" r="10" />
          </svg>
        </div>
        <p className="text-sm font-medium text-slate-200">Select a body region</p>
        <p className="mt-1 max-w-xs text-xs leading-5 text-slate-500">
          Tap any part of the figure to see its name, health status, rating and the underlying joint data.
        </p>
      </div>
    );
  }

  const color = RATING_COLORS[assessment.rating];
  const ratingLabel = RATING_LABELS[assessment.rating];

  return (
    <div className="flex h-full flex-col rounded-2xl border border-white/10 bg-[#0d1b2b]/80 p-5 backdrop-blur-sm">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-ARTEMIS-cyan">Region</p>
          <h3 className="mt-1 text-lg font-semibold text-white">{assessment.name}</h3>
        </div>
        <button
          onClick={onClear}
          className="min-h-[2.75rem] min-w-[2.75rem] rounded-lg border border-white/10 px-3 text-xs text-slate-300 active:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
          aria-label="Clear selection"
        >
          Close
        </button>
      </div>

      <div className="mb-5 flex items-center gap-3 rounded-xl border border-white/10 bg-black/30 p-4">
        <span className="inline-block h-8 w-8 shrink-0 rounded-full" style={{ backgroundColor: color }} />
        <div className="min-w-0 flex-1">
          <p className="text-xs text-slate-400">Health status</p>
          <p className="text-sm font-semibold text-white">{ratingLabel}</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-slate-400">Score</p>
          <p className="text-sm font-semibold text-white">
            {assessment.score != null ? `${Math.round(assessment.score)}/100` : "—"}
          </p>
        </div>
      </div>

      <div>
        <p className="mb-2 text-xs font-mono uppercase tracking-wider text-slate-500">Observation</p>
        <p className="text-sm leading-6 text-slate-200">{assessment.note}</p>
      </div>

      <div className="mt-auto pt-5">
        <div className="flex items-center gap-2 text-[11px] text-slate-500">
          <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
          <span>{statusDescription(assessment.status)}</span>
        </div>
      </div>
    </div>
  );
}

function statusDescription(status: RegionAssessment["status"]): string {
  switch (status) {
    case "normal":
      return "Assessed as within the expected range for this movement.";
    case "monitor":
      return "Slightly outside the expected range. Worth monitoring over repeat sessions.";
    case "attention":
      return "Outside the expected range. Consider discussing with the medical officer.";
    case "critical":
      return "Well outside the expected range. Flag for medical review.";
    default:
      return "No measurement captured for this region.";
  }
}