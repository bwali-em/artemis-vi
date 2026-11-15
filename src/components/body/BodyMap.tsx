import { useMemo, useState } from "react";
import type { BodyMapAssessment, RegionAssessment } from "../../types/bodyMap";
import { ANATOMY_REGIONS, RATING_COLORS, RATING_LABELS } from "../../data/anatomyRegions";
import { RegionDetailPanel } from "./RegionDetailPanel";

interface BodyMapProps {
  assessment: BodyMapAssessment;
  selectedId?: string | null;
  onSelect?: (regionId: string | null) => void;
  /** Optional highlight filter, e.g. only show regions needing attention. */
  highlightAttentionOnly?: boolean;
  className?: string;
}

export function BodyMap({
  assessment,
  selectedId,
  onSelect,
  highlightAttentionOnly = false,
  className = "",
}: BodyMapProps) {
  const [internalSelected, setInternalSelected] = useState<string | null>(null);
  const activeId = selectedId !== undefined ? selectedId : internalSelected;

  const regionMap = useMemo(() => {
    const map: Record<string, RegionAssessment> = {};
    for (const r of assessment.regions) map[r.regionId] = r;
    return map;
  }, [assessment.regions]);

  const active = activeId ? regionMap[activeId] ?? null : null;

  const handleSelect = (regionId: string) => {
    const next = activeId === regionId ? null : regionId;
    if (selectedId !== undefined) {
      onSelect?.(next);
    } else {
      setInternalSelected(next);
    }
  };

  return (
    <div className={`flex flex-col lg:flex-row gap-5 ${className}`}>
      <div className="flex flex-col items-center">
        <svg
          viewBox="0 0 400 800"
          role="img"
          aria-label="Anatomical body map with assessment status for each region"
          className="w-full max-w-[280px] h-auto select-none"
        >
          {ANATOMY_REGIONS.map((region) => {
            const assessmentRegion = regionMap[region.id];
            const status = assessmentRegion?.status ?? "unassessed";
            const color = RATING_COLORS[assessmentRegion?.rating ?? "grey"];
            const isActive = activeId === region.id;
            const needsAttention =
              status === "attention" || status === "critical" || status === "monitor";
            const dimmed = highlightAttentionOnly && !needsAttention;

            return (
              <path
                key={region.id}
                id={region.id}
                d={region.path}
                fill={color}
                stroke={isActive ? "#ffffff" : "rgba(2,6,23,0.85)"}
                strokeWidth={isActive ? 2.5 : 1}
                strokeLinejoin="round"
                onClick={() => handleSelect(region.id)}
                style={{
                  cursor: "pointer",
                  opacity: dimmed ? 0.25 : 0.92,
                  transition: "opacity 0.15s ease, stroke 0.15s ease",
                }}
              >
                <title>{`${region.name} — ${RATING_LABELS[assessmentRegion?.rating ?? "grey"]}`}</title>
              </path>
            );
          })}
        </svg>

        <Legend />
      </div>

      <div className="flex-1 min-w-0">
        <RegionDetailPanel assessment={active} onClear={() => handleSelect(activeId ?? "")} />
      </div>
    </div>
  );
}

function Legend() {
  const items: Array<{ rating: keyof typeof RATING_COLORS; label: string }> = [
    { rating: "green", label: "Normal" },
    { rating: "yellow", label: "Monitoring" },
    { rating: "orange", label: "Needs attention" },
    { rating: "red", label: "Abnormal" },
    { rating: "grey", label: "Not assessed" },
  ];

  return (
    <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-[11px]">
      {items.map((item) => (
        <div key={item.rating} className="flex items-center gap-2">
          <span
            className="inline-block h-3 w-3 rounded-sm"
            style={{ backgroundColor: RATING_COLORS[item.rating] }}
          />
          <span className="text-ARTEMIS-slate">{item.label}</span>
        </div>
      ))}
    </div>
  );
}