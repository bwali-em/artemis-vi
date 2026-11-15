interface DetectionStatusProps {
  status: {
    detected: boolean;
    confidence: number;
    visibility: number;
    missingLandmarks: string[];
  };
}

export function DetectionStatus({ status }: DetectionStatusProps) {
  const ok = status.detected && status.visibility >= 0.5;
  const color = ok ? "text-ARTEMIS-green" : status.detected ? "text-ARTEMIS-amber" : "text-ARTEMIS-red";
  const dotColor = ok ? "bg-ARTEMIS-green" : status.detected ? "bg-ARTEMIS-amber" : "bg-ARTEMIS-red";

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-ARTEMIS-border/50 bg-black/40 backdrop-blur text-xs font-mono">
      <span className={`w-2 h-2 rounded-full ${dotColor} animate-pulse`} aria-hidden="true" />
      <span className={color}>{status.detected ? "POSE DETECTED" : "NO POSE"}</span>
      <span className="text-ARTEMIS-slate">| {Math.round(status.visibility * 100)}% visibility</span>
      {status.missingLandmarks.length > 0 && (
        <span className="text-ARTEMIS-amber">Missing: {status.missingLandmarks.join(", ")}</span>
      )}
    </div>
  );
}
