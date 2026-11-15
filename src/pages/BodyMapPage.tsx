import { useState } from "react";
import { ChevronLeft, Activity } from "lucide-react";
import type { BodyMapAssessment } from "../types/bodyMap";
import { BodyMap } from "../components/body/BodyMap";
import { AnimatedBodyMap } from "../components/body/AnimatedBodyMap";

interface BodyMapPageProps {
  assessment: BodyMapAssessment;
  title?: string;
  onBack: () => void;
}

export function BodyMapPage({ assessment, title, onBack }: BodyMapPageProps) {
  const [highlightAttentionOnly, setHighlightAttentionOnly] = useState(false);
  const { summary } = assessment;

  return (
    <div className="flex min-h-[100svh] flex-col bg-ARTEMIS-navy text-white">
      <header className="border-b border-ARTEMIS-border/60 bg-black/40 px-5 py-4 sm:px-8">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-300 text-slate-950">
              <Activity size={20} strokeWidth={2.5} />
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Body map</p>
              <h1 className="text-sm font-bold text-white">{title ?? "Movement assessment"}</h1>
            </div>
          </div>
          <button
            onClick={onBack}
            className="inline-flex min-h-[2.75rem] items-center gap-1 rounded-lg border border-ARTEMIS-border px-4 py-2 text-sm text-ARTEMIS-cyan active:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
          >
            <ChevronLeft size={18} /> Back
          </button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl flex-1 px-5 py-6 sm:px-8 sm:py-8">
        <div className="mb-6">
          <h2 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
            Regions requiring attention
          </h2>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-400">
            This map is derived from MediaPipe joint coordinates captured during the movement. Colours
            indicate the assessed status of each region. Pose-estimation output is a monitoring aid, not a
            clinical diagnosis.
          </p>
        </div>

        <SummaryStrip summary={summary} />

        {assessment.motion && assessment.motion.frames.length > 1 && (
          <div className="mt-6 rounded-2xl border border-ARTEMIS-cyan/25 bg-[#07111f]/70 p-5 sm:p-6">
            <div className="mb-4">
              <div className="flex items-center gap-2">
                <Activity size={16} className="text-ARTEMIS-cyan" />
                <h3 className="text-xs font-mono uppercase tracking-wider text-ARTEMIS-cyan">
                  Movement simulation
                </h3>
              </div>
              <p className="mt-1 text-sm text-slate-300">
                Playback of the body movement recorded by MediaPipe. Regions that moved slowly are
                highlighted as areas that needed attention.
              </p>
            </div>
            <AnimatedBodyMap assessment={assessment} colorByMotion />
          </div>
        )}

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <label className="inline-flex cursor-pointer items-center gap-2 text-xs text-slate-300">
            <input
              type="checkbox"
              checked={highlightAttentionOnly}
              onChange={(e) => setHighlightAttentionOnly(e.target.checked)}
              className="h-4 w-4 rounded border-white/20 bg-transparent accent-cyan-400"
            />
            Highlight only regions needing attention
          </label>
          <span className="text-[11px] text-slate-500">
            {summary.totalAssessed} of 30 regions assessed
          </span>
        </div>

        <div className="mt-4 rounded-2xl border border-white/10 bg-[#07111f]/60 p-5 sm:p-6">
          <BodyMap assessment={assessment} highlightAttentionOnly={highlightAttentionOnly} />
        </div>

        <p className="mt-6 text-center text-[11px] leading-5 text-slate-600">
          ARTEMIS HEALTH prototype · Regional status is a movement-performance estimate, not a medical
          diagnosis.
        </p>
      </main>
    </div>
  );
}

function SummaryStrip({
  summary,
}: {
  summary: BodyMapAssessment["summary"];
}) {
  const cards: Array<{ label: string; value: number; color: string }> = [
    { label: "Normal", value: summary.normal, color: "text-[#95C11E]" },
    { label: "Monitoring", value: summary.monitoring, color: "text-[#F2C811]" },
    { label: "Attention", value: summary.attention, color: "text-[#F08A1E]" },
    { label: "Abnormal", value: summary.critical, color: "text-[#E03131]" },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {cards.map((c) => (
        <div key={c.label} className="rounded-xl border border-white/10 bg-[#0d1b2b]/80 p-4">
          <p className={`text-2xl font-semibold ${c.color}`}>{c.value}</p>
          <p className="mt-1 text-[11px] uppercase tracking-wider text-slate-500">{c.label}</p>
        </div>
      ))}
    </div>
  );
}