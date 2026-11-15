import { useEffect, useMemo, useRef, useState } from "react";
import { Pause, Play, RotateCcw } from "lucide-react";
import type { BodyMapAssessment } from "../../types/bodyMap";
import { ANATOMY_REGIONS, RATING_COLORS } from "../../data/anatomyRegions";

const CONNECTIONS: Array<[number, number]> = [
  [11, 13],
  [13, 15],
  [12, 14],
  [14, 16],
  [11, 12],
  [11, 23],
  [12, 24],
  [23, 24],
  [23, 25],
  [25, 27],
  [24, 26],
  [26, 28],
  [11, 7],
  [12, 8],
  [7, 9],
  [8, 10],
  [0, 7],
  [0, 8],
];

interface AnimatedBodyMapProps {
  assessment: BodyMapAssessment;
  /** When true, region fill is driven by movement slowness instead of status. */
  colorByMotion?: boolean;
  className?: string;
}

/**
 * Simulated movement of the recorded MediaPipe body, played back over the
 * anatomical body map. Regions that moved slowly are highlighted so you can
 * see where the body needed attention during the movement.
 */
export function AnimatedBodyMap({ assessment, colorByMotion = true, className = "" }: AnimatedBodyMapProps) {
  const motion = assessment.motion;
  const frames = motion?.frames ?? [];
  const regionMotion = motion?.regionMotion ?? {};
  const duration = motion?.durationMs ?? 0;

  const [playing, setPlaying] = useState(true);
  const [elapsed, setElapsed] = useState(0);
  const rafRef = useRef<number | null>(null);
  const startRef = useRef<number>(0);
  const elapsedRef = useRef(0);
  elapsedRef.current = elapsed;

  useEffect(() => {
    if (!playing || frames.length < 2 || duration <= 0) return;

    // Resume from wherever the playhead currently is.
    startRef.current = performance.now() - elapsedRef.current;

    const tick = () => {
      const now = performance.now();
      const t = now - startRef.current;
      if (t >= duration) {
        setElapsed(duration);
        setPlaying(false);
        return;
      }
      setElapsed(t);
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [playing, frames.length, duration]);

  const currentPoints = useMemo(() => {
    if (frames.length === 0) return [];
    if (frames.length === 1) return frames[0].points;
    // Find surrounding frames and interpolate.
    let lo = 0;
    let hi = frames.length - 1;
    while (lo < hi - 1) {
      const mid = (lo + hi) >> 1;
      if (frames[mid].t <= elapsed) lo = mid;
      else hi = mid;
    }
    const a = frames[lo];
    const b = frames[hi];
    const span = b.t - a.t || 1;
    const f = Math.max(0, Math.min(1, (elapsed - a.t) / span));
    return a.points.map((p, i) => {
      const q = b.points[i] ?? p;
      return {
        x: p.x + (q.x - p.x) * f,
        y: p.y + (q.y - p.y) * f,
        visible: p.visible || q.visible,
      };
    });
  }, [frames, elapsed]);

  const handleRestart = () => {
    setElapsed(0);
    setPlaying(true);
  };

  const handleScrub = (value: number) => {
    setElapsed(value);
    setPlaying(false);
  };

  if (!motion || frames.length < 2) {
    return (
      <div className={`flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 bg-black/30 p-8 text-center ${className}`}>
        <p className="text-sm font-medium text-slate-200">No motion data captured</p>
        <p className="mt-1 max-w-xs text-xs leading-5 text-slate-500">
          A movement simulation will appear here once joint movement is recorded during an assessment.
        </p>
      </div>
    );
  }

  const regionFill = (regionId: string): string => {
    if (colorByMotion) {
      const slowness = regionMotion[regionId]?.slowness ?? 0;
      if (slowness >= 60) return RATING_COLORS.orange;
      if (slowness >= 30) return RATING_COLORS.yellow;
      return RATING_COLORS.green;
    }
    const r = assessment.regions.find((x) => x.regionId === regionId);
    return RATING_COLORS[r?.rating ?? "grey"];
  };

  return (
    <div className={`flex flex-col gap-4 ${className}`}>
      <div className="flex items-center justify-center">
        <svg
          viewBox="0 0 400 800"
          role="img"
          aria-label="Simulated body movement with slow regions highlighted"
          className="w-full max-w-[260px] h-auto select-none"
        >
          {ANATOMY_REGIONS.map((region) => (
            <path
              key={region.id}
              d={region.path}
              fill={regionFill(region.id)}
              opacity={0.35}
              stroke="rgba(2,6,23,0.5)"
              strokeWidth={0.75}
              strokeLinejoin="round"
            />
          ))}

          {/* Animated skeleton overlay */}
          {currentPoints.length > 0 && (
            <g>
              {CONNECTIONS.map(([a, b]) => {
                const pa = currentPoints[a];
                const pb = currentPoints[b];
                if (!pa || !pb || !pa.visible || !pb.visible) return null;
                return (
                  <line
                    key={`${a}-${b}`}
                    x1={pa.x}
                    y1={pa.y}
                    x2={pb.x}
                    y2={pb.y}
                    stroke="#22d3ee"
                    strokeWidth={4}
                    strokeLinecap="round"
                  />
                );
              })}
              {currentPoints.map((p, i) => {
                if (!p.visible) return null;
                if (![0, 7, 8, 11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28].includes(i)) return null;
                return <circle key={i} cx={p.x} cy={p.y} r={5} fill="#e2f8ff" stroke="#22d3ee" strokeWidth={1.5} />;
              })}
            </g>
          )}
        </svg>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={() => (elapsed >= duration ? handleRestart() : setPlaying((p) => !p))}
          className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-cyan-400 text-slate-950 active:bg-cyan-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
          aria-label={playing ? "Pause simulation" : "Play simulation"}
        >
          {playing ? <Pause size={18} /> : <Play size={18} />}
        </button>
        <button
          onClick={handleRestart}
          className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/15 text-slate-200 active:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
          aria-label="Restart simulation"
        >
          <RotateCcw size={16} />
        </button>
        <input
          type="range"
          min={0}
          max={Math.round(duration)}
          value={Math.round(elapsed)}
          onChange={(e) => handleScrub(Number(e.target.value))}
          className="h-2 flex-1 cursor-pointer accent-cyan-400"
          aria-label="Scrub through the movement"
        />
        <span className="w-20 text-right font-mono text-xs tabular-nums text-slate-400">
          {(elapsed / 1000).toFixed(1)}s / {(duration / 1000).toFixed(1)}s
        </span>
      </div>

      <p className="text-center text-[11px] text-slate-500">
        {colorByMotion
          ? "Colour shows how slowly each region moved. Orange = slow / needs attention, yellow = slightly slow, green = normal pace."
          : "Colour shows the assessed health status of each region."}
      </p>
    </div>
  );
}