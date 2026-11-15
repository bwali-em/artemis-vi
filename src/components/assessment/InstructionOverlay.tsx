interface InstructionOverlayProps {
  assessmentName: string;
  instruction: string;
  step: number;
  totalSteps: number;
  status: string;
  progress: number;
  countdown?: number;
  repCount?: number;
  feedback?: string;
}

export function InstructionOverlay({
  assessmentName,
  instruction,
  step,
  totalSteps,
  status,
  progress,
  countdown,
  repCount,
  feedback,
}: InstructionOverlayProps) {
  return (
    <div className="absolute left-6 top-6 w-80 z-40">
      <div className="bg-black/70 backdrop-blur-md border border-ARTEMIS-border/60 rounded-xl p-5 shadow-2xl">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-mono text-ARTEMIS-cyan tracking-wider uppercase">CURRENT INSTRUCTION</span>
          {countdown !== undefined && countdown > 0 && (
            <span className="text-xs font-mono text-ARTEMIS-amber">00:{String(countdown).padStart(2, "0")}</span>
          )}
        </div>
        <div className="text-lg font-semibold text-white leading-tight mb-2">{instruction}</div>
        <div className="flex items-center justify-between text-xs text-ARTEMIS-slate mb-3">
          <span>STEP {step} OF {totalSteps}</span>
          <span className="font-mono">{assessmentName}</span>
        </div>
        <div className="w-full bg-white/10 rounded-full h-1.5 mb-3 overflow-hidden">
          <div
            className="bg-ARTEMIS-cyan h-full transition-all duration-500"
            style={{ width: `${Math.max(0, Math.min(100, progress))}%` }}
          />
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className={`font-mono ${
            status.includes("Detecting") || status.includes("Ready")
              ? "text-ARTEMIS-green"
              : status.includes("Error") || status.includes("Failed")
                ? "text-ARTEMIS-red"
                : "text-ARTEMIS-amber"
          }`}>
            ● {status}
          </span>
        </div>
        {repCount !== undefined && (
          <div className="mt-3 pt-3 border-t border-white/10 flex justify-between items-center">
            <span className="text-xs text-ARTEMIS-slate">REPETITIONS</span>
            <span className="text-ARTEMIS-cyan font-mono font-bold text-lg">{repCount}</span>
          </div>
        )}
        {feedback && (
          <div className={`mt-3 pt-2 text-xs rounded bg-white/5 p-2 ${
            feedback.toLowerCase().includes("excellent") || feedback.toLowerCase().includes("good")
              ? "text-ARTEMIS-green border border-green/20"
              : feedback.toLowerCase().includes("try") || feedback.toLowerCase().includes("move")
                ? "text-ARTEMIS-amber border border-amber/20"
                : "text-ARTEMIS-slate border border-white/10"
          }`}>{feedback}</div>
        )}
      </div>
    </div>
  );
}
