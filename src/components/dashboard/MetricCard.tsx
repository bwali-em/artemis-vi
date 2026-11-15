interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: "up" | "down" | "neutral";
}

export function MetricCard({ title, value, subtitle, trend }: MetricCardProps) {
  const trendIcon = trend === "up" ? "↑" : trend === "down" ? "↓" : "—";
  const trendClass =
    trend === "up" ? "text-ARTEMIS-green" : trend === "down" ? "text-ARTEMIS-amber" : "text-ARTEMIS-slate";

  return (
    <div className="rounded-xl border border-ARTEMIS-border/50 bg-black/40 p-5">
      <div className="text-xs font-mono text-ARTEMIS-slate uppercase tracking-wider mb-1">{title}</div>
      <div className="text-2xl font-bold text-white">{value}</div>
      {subtitle && <div className="text-xs text-ARTEMIS-slate mt-1">{subtitle}</div>}
      <div className={`mt-2 text-xs font-mono ${trendClass}`}>{trendIcon}</div>
    </div>
  );
}
