import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Crosshair, ZoomIn, ZoomOut, Maximize2 } from "lucide-react";
import type { BodyMapAssessment, RegionAssessment } from "../../types/bodyMap";
import { ANATOMY_REGIONS, RATING_COLORS, RATING_LABELS } from "../../data/anatomyRegions";
import { applyBoxTransform, unionRect, type Rect } from "../../data/bodyImage";
import { useBodyOverlay, usePrefersReducedMotion } from "../../hooks/useBodyOverlay";
import { BodyImageOverlay } from "../bodymap/BodyImageOverlay";
import { OverlayControls } from "../bodymap/OverlayControls";
import { RegionDetailPanel } from "./RegionDetailPanel";

interface BodyMapProps {
  assessment: BodyMapAssessment;
  selectedId?: string | null;
  onSelect?: (regionId: string | null) => void;
  /** Optional highlight filter, e.g. only show regions needing attention. */
  highlightAttentionOnly?: boolean;
  className?: string;
  /** Show the human-image overlay initially. The live toggle lives in OverlayControls. */
  showBodyImage?: boolean;
  /** Initial overlay opacity (0-1) when showBodyImage is used. */
  bodyImageOpacity?: number;
}

type RatingKey = keyof typeof RATING_COLORS;

const MIN_ZOOM = 1;
const MAX_ZOOM = 2.5;
const FOCUS_ZOOM = 2;
const FALLBACK_REGION_BOX: Rect = { x: 80, y: 10, width: 240, height: 770 };

export function BodyMap({
  assessment,
  selectedId,
  onSelect,
  highlightAttentionOnly = false,
  className = "",
  showBodyImage = false,
  bodyImageOpacity,
}: BodyMapProps) {
  const [internalSelected, setInternalSelected] = useState<string | null>(null);
  const activeId = selectedId !== undefined ? selectedId : internalSelected;

  // --- interactive view state (additive) ---
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [ratingFilter, setRatingFilter] = useState<RatingKey | null>(null);
  const [zoom, setZoom] = useState(1);
  const [focusMode, setFocusMode] = useState(false);
  const [bbox, setBbox] = useState<{ cx: number; cy: number } | null>(null);
  const pathRefs = useRef<Record<string, SVGPathElement | null>>({});

  // --- optional human-image overlay (additive) ---
  const [regionBox, setRegionBox] = useState<Rect>(FALLBACK_REGION_BOX);
  const overlay = useBodyOverlay({
    initialEnabled: showBodyImage,
    initialOpacity: bodyImageOpacity,
    initialMode: "above-regions",
  });
  const prefersReducedMotion = usePrefersReducedMotion();

  // Union of every region path, measured after mount. getBBox is local to the
  // path so the parent pan/zoom transform does not affect the result.
  useLayoutEffect(() => {
    let measured: Rect | null = null;
    for (const region of ANATOMY_REGIONS) {
      const el = pathRefs.current[region.id];
      if (!el) continue;
      try {
        const b = el.getBBox();
        if (!b || b.width <= 0 || b.height <= 0) continue;
        const next = { x: b.x, y: b.y, width: b.width, height: b.height };
        measured = measured ? unionRect(measured, next) : next;
      } catch {
        // getBBox is unsupported in some test/SSR environments.
      }
    }
    setRegionBox(measured ?? FALLBACK_REGION_BOX);
    // ANATOMY_REGIONS is a static module constant; refs exist after the first paint.
  }, []);

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

  // Counts per rating for the interactive legend + summary.
  const counts = useMemo(() => {
    const c: Record<string, number> = { green: 0, yellow: 0, orange: 0, red: 0, grey: 0 };
    for (const region of ANATOMY_REGIONS) {
      const rating = (regionMap[region.id]?.rating ?? "grey") as string;
      c[rating] = (c[rating] ?? 0) + 1;
    }
    return c;
  }, [regionMap]);

  const attentionCount = useMemo(
    () =>
      ANATOMY_REGIONS.filter((r) => {
        const s = regionMap[r.id]?.status;
        return s === "attention" || s === "critical" || s === "monitor";
      }).length,
    [regionMap],
  );

  // Measure the active region so focus mode can zoom onto it.
  useEffect(() => {
    if (!activeId) { setBbox(null); return; }
    const el = pathRefs.current[activeId];
    if (!el) { setBbox(null); return; }
    try {
      const b = el.getBBox();
      setBbox({ cx: b.x + b.width / 2, cy: b.y + b.height / 2 });
    } catch {
      setBbox(null);
    }
  }, [activeId]);

  // Esc clears the selection.
  const handleContainerKey = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape" && activeId) { e.preventDefault(); handleSelect(activeId); }
    if (e.key === "+" || e.key === "=") setZoom((z) => Math.min(MAX_ZOOM, +(z + 0.25).toFixed(2)));
    if (e.key === "-") setZoom((z) => Math.max(MIN_ZOOM, +(z - 0.25).toFixed(2)));
    if (e.key === "0") { setZoom(1); setFocusMode(false); }
  };

  const focusing = focusMode && !!bbox;
  const scale = focusing ? Math.max(zoom, FOCUS_ZOOM) : zoom;
  const centerX = focusing ? bbox!.cx : 200;
  const centerY = focusing ? bbox!.cy : 400;
  const tx = Math.max(400 - 400 * scale, Math.min(0, 200 - centerX * scale));
  const ty = Math.max(800 - 800 * scale, Math.min(0, 400 - centerY * scale));

  const overlayEnabled = overlay.enabled;
  const overlayBehind = overlay.mode === "behind-regions";
  const overlayPlacement = useMemo(
    () =>
      applyBoxTransform(
        regionBox,
        overlay.stretchX,
        overlay.stretchY,
        overlay.offsetX,
        overlay.offsetY,
      ),
    [regionBox, overlay.stretchX, overlay.stretchY, overlay.offsetX, overlay.offsetY],
  );
  const showRegionOutline = overlayEnabled && overlay.outline && overlay.panelOpen;
  const regionOpacityFactor = overlayEnabled && overlay.regionsFaded ? 0.35 : 1;

  const hovered = hoveredId ? ANATOMY_REGIONS.find((r) => r.id === hoveredId) : null;
  const hoveredAssess = hoveredId ? regionMap[hoveredId] : undefined;
  const hoveredRating = (hoveredAssess?.rating ?? "grey") as RatingKey;

  return (
    <div className={`flex flex-col lg:flex-row gap-5 ${className}`} onKeyDown={handleContainerKey}>
      <div className="flex flex-col items-center">
        {/* toolbar */}
        <div className="mb-2 flex w-full max-w-[280px] items-center justify-between">
          <span className="text-[11px] text-slate-400">
            {attentionCount > 0 ? `${attentionCount} region${attentionCount === 1 ? "" : "s"} need review` : "No regions flagged"}
          </span>
          <div className="flex items-center gap-1">
            <ToolBtn label="Zoom out (-)" onClick={() => setZoom((z) => Math.max(MIN_ZOOM, +(z - 0.25).toFixed(2)))}><ZoomOut size={14} /></ToolBtn>
            <ToolBtn label="Zoom in (+)" onClick={() => setZoom((z) => Math.min(MAX_ZOOM, +(z + 0.25).toFixed(2)))}><ZoomIn size={14} /></ToolBtn>
            <ToolBtn label="Auto-focus selected region" active={focusMode} onClick={() => setFocusMode((v) => !v)}><Crosshair size={14} /></ToolBtn>
            <ToolBtn label="Reset view (0)" onClick={() => { setZoom(1); setFocusMode(false); }}><Maximize2 size={14} /></ToolBtn>
          </div>
        </div>

        <OverlayControls overlay={overlay} className="mb-2 w-full max-w-[280px]" />

        <div className="relative w-full max-w-[280px] overflow-hidden rounded-xl border border-white/10 bg-gradient-to-b from-slate-900/70 to-black/50">
          <svg
            viewBox="0 0 400 800"
            role="img"
            aria-label="Anatomical body map with assessment status for each region"
            className="h-auto w-full select-none rounded-xl"
            onClick={() => { if (activeId) handleSelect(activeId); }}
          >
            <defs>
              <filter id="bm-glow" x="-30%" y="-30%" width="160%" height="160%">
                <feGaussianBlur stdDeviation="3" result="b" />
                <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
              </filter>
              <pattern id="bm-grid" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(148,163,184,0.07)" strokeWidth="1" />
              </pattern>
              <radialGradient id="bm-shadow" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="rgba(0,0,0,0.55)" />
                <stop offset="100%" stopColor="rgba(0,0,0,0)" />
              </radialGradient>
            </defs>

            <rect x={0} y={0} width={400} height={800} fill="url(#bm-grid)" />

            <g style={{ transform: `translate(${tx}px, ${ty}px) scale(${scale})`, transformOrigin: "0 0", transition: overlayEnabled && prefersReducedMotion ? "none" : "transform 400ms cubic-bezier(0.22, 1, 0.36, 1)" }}>
              <ellipse cx={200} cy={782} rx={90} ry={9} fill="url(#bm-shadow)" />

              {overlayEnabled && overlayBehind && (
                <BodyImageOverlay
                  placement={overlayPlacement}
                  opacity={overlay.opacity}
                  flipX={overlay.flip}
                  blend={overlay.blend}
                />
              )}

              {ANATOMY_REGIONS.map((region) => {
                const assessmentRegion = regionMap[region.id];
                const status = assessmentRegion?.status ?? "unassessed";
                const rating = (assessmentRegion?.rating ?? "grey") as RatingKey;
                const color = RATING_COLORS[rating];
                const isActive = activeId === region.id;
                const isHovered = hoveredId === region.id;
                const needsAttention =
                  status === "attention" || status === "critical" || status === "monitor";
                const dimmed = highlightAttentionOnly && !needsAttention;
                const filteredOut = ratingFilter !== null && rating !== ratingFilter;
                const othersDimmed = (activeId !== null && !isActive) || (hoveredId !== null && !isHovered && activeId === null);

                let opacity = 0.92;
                if (dimmed) opacity = 0.25;
                if (filteredOut) opacity = 0.12;
                else if (othersDimmed && !dimmed) opacity = 0.6;
                opacity *= regionOpacityFactor;

                return (
                  <path
                    key={region.id}
                    ref={(el) => { pathRefs.current[region.id] = el; }}
                    id={region.id}
                    d={region.path}
                    fill={color}
                    stroke={isActive ? "#ffffff" : isHovered ? "rgba(255,255,255,0.8)" : "rgba(2,6,23,0.85)"}
                    strokeWidth={isActive ? 2.5 : isHovered ? 2 : 1}
                    strokeLinejoin="round"
                    filter={isActive || isHovered ? "url(#bm-glow)" : undefined}
                    className={status === "critical" && !filteredOut ? "animate-pulse" : undefined}
                    role="button"
                    tabIndex={0}
                    aria-pressed={isActive}
                    aria-label={`${region.name}, ${RATING_LABELS[rating]}`}
                    onClick={(e) => { e.stopPropagation(); handleSelect(region.id); }}
                    onPointerEnter={() => setHoveredId(region.id)}
                    onPointerLeave={() => setHoveredId((h) => (h === region.id ? null : h))}
                    onFocus={() => setHoveredId(region.id)}
                    onBlur={() => setHoveredId((h) => (h === region.id ? null : h))}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); handleSelect(region.id); }
                    }}
                    style={{
                      cursor: "pointer",
                      opacity,
                      outline: "none",
                      transition: "opacity 0.15s ease, stroke 0.15s ease, stroke-width 0.15s ease",
                    }}
                  >
                    <title>{`${region.name} — ${RATING_LABELS[rating]}`}</title>
                  </path>
                );
              })}

              {overlayEnabled && !overlayBehind && (
                <BodyImageOverlay
                  placement={overlayPlacement}
                  opacity={overlay.opacity}
                  flipX={overlay.flip}
                  blend={overlay.blend}
                />
              )}

              {showRegionOutline &&
                ANATOMY_REGIONS.map((region) => (
                  <path
                    key={`outline-${region.id}`}
                    d={region.path}
                    fill="none"
                    stroke="rgba(34,211,238,0.55)"
                    strokeWidth={0.75}
                    strokeLinejoin="round"
                    pointerEvents="none"
                  />
                ))}
            </g>
          </svg>

          {/* hover card */}
          <div className="pointer-events-none absolute inset-x-2 bottom-2 flex justify-center">
            {hovered && (
              <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-black/70 px-2.5 py-1.5 text-xs backdrop-blur">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: RATING_COLORS[hoveredRating] }} />
                <span className="font-medium text-slate-100">{hovered.name}</span>
                <span className="text-slate-400">{RATING_LABELS[hoveredRating]}</span>
              </div>
            )}
          </div>
        </div>

        <Legend counts={counts} filter={ratingFilter} onFilter={setRatingFilter} />
      </div>

      <div className="flex-1 min-w-0">
        <RegionDetailPanel assessment={active} onClear={() => handleSelect(activeId ?? "")} />
      </div>
    </div>
  );
}

function ToolBtn({
  label, onClick, active, children,
}: { label: string; onClick: () => void; active?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      aria-pressed={active}
      className={`inline-flex h-7 w-7 items-center justify-center rounded-md border text-slate-200 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 ${
        active ? "border-cyan-400/60 bg-cyan-400/15 text-cyan-200" : "border-white/10 bg-white/[0.03] active:bg-white/10"
      }`}
    >
      {children}
    </button>
  );
}

function Legend({
  counts,
  filter,
  onFilter,
}: {
  counts: Record<string, number>;
  filter: RatingKey | null;
  onFilter: (r: RatingKey | null) => void;
}) {
  const items: Array<{ rating: RatingKey; label: string }> = [
    { rating: "green", label: "Normal" },
    { rating: "yellow", label: "Monitoring" },
    { rating: "orange", label: "Needs attention" },
    { rating: "red", label: "Abnormal" },
    { rating: "grey", label: "Not assessed" },
  ];

  return (
    <div className="mt-4 w-full max-w-[280px]">
      <div className="grid grid-cols-2 gap-x-2 gap-y-1.5 text-[11px]">
        {items.map((item) => {
          const selected = filter === item.rating;
          const count = counts[item.rating] ?? 0;
          return (
            <button
              key={item.rating}
              type="button"
              disabled={count === 0}
              aria-pressed={selected}
              onClick={() => onFilter(selected ? null : item.rating)}
              className={`flex items-center gap-2 rounded-md border px-2 py-1 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 disabled:opacity-40 ${
                selected ? "border-cyan-400/60 bg-cyan-400/10" : "border-transparent active:bg-white/5"
              }`}
            >
              <span
                className="inline-block h-3 w-3 shrink-0 rounded-sm"
                style={{ backgroundColor: RATING_COLORS[item.rating] }}
              />
              <span className="flex-1 text-ARTEMIS-slate">{item.label}</span>
              <span className="font-mono tabular-nums text-slate-500">{count}</span>
            </button>
          );
        })}
      </div>
      <p className="mt-2 text-center text-[10px] text-slate-500">
        Tap a legend item to isolate it. Tab to move between regions, Enter to select, Esc to clear.
      </p>
    </div>
  );
}