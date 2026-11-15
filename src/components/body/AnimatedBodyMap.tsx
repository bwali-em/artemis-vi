import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactElement,
  type ReactNode,
} from "react";
import {
  Activity,
  Eye,
  EyeOff,
  FlipHorizontal,
  Maximize2,
  Pause,
  Play,
  Repeat,
  RotateCcw,
  SkipBack,
  SkipForward,
  Sun,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import type { BodyMapAssessment } from "../../types/bodyMap";
import { RATING_COLORS } from "../../data/anatomyRegions";

type Pt = { x: number; y: number; visible: boolean };

const CONNECTIONS: Array<[number, number]> = [
  [11, 13], [13, 15], [12, 14], [14, 16], [11, 12],
  [11, 23], [12, 24], [23, 24], [23, 25], [25, 27],
  [24, 26], [26, 28], [0, 7], [0, 8], [7, 11], [8, 12],
];

/** Optional MediaPipe hand/foot landmarks, drawn thin when present. */
const EXTRA_CONNECTIONS: Array<[number, number]> = [
  [15, 17], [15, 19], [15, 21], [16, 18], [16, 20], [16, 22],
  [27, 29], [29, 31], [27, 31], [28, 30], [30, 32], [28, 32],
];

const JOINT_INDEXES = [0, 7, 8, 11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28];

const JOINT_NAMES: Record<number, string> = {
  0: "Nose", 7: "Left ear", 8: "Right ear",
  11: "Left shoulder", 12: "Right shoulder",
  13: "Left elbow", 14: "Right elbow",
  15: "Left wrist", 16: "Right wrist",
  23: "Left hip", 24: "Right hip",
  25: "Left knee", 26: "Right knee",
  27: "Left ankle", 28: "Right ankle",
};

const TRAIL_JOINTS = [15, 16, 27, 28];
const TRAIL_MS = 900;
const SPEEDS = [0.25, 0.5, 1, 1.5, 2];
const MIN_ZOOM = 1;
const MAX_ZOOM = 3;

interface AnimatedBodyMapProps {
  assessment: BodyMapAssessment;
  /** When true, region fill is driven by movement slowness instead of status. */
  colorByMotion?: boolean;
  className?: string;
}

function isVis(p?: Pt) { return !!p && p.visible; }
function mid(a: Pt, b: Pt): Pt { return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, visible: a.visible && b.visible }; }
function dist(a: Pt, b: Pt) { return Math.hypot(b.x - a.x, b.y - a.y); }
function lerp(a: Pt, b: Pt, t: number): Pt { return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, visible: a.visible || b.visible }; }
const r2 = (n: number) => Math.round(n * 100) / 100;
const pstr = (p: { x: number; y: number }) => `${r2(p.x)} ${r2(p.y)}`;

function limbPoly(a: Pt, b: Pt, w1: number, w2: number): string | null {
  if (!isVis(a) || !isVis(b)) return null;
  const dx = b.x - a.x, dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len, ny = dx / len;
  const p = (p0: Pt, w: number, s: number) => `${p0.x + nx * w * s},${p0.y + ny * w * s}`;
  return [p(a, w1, 1), p(b, w2, 1), p(b, w2, -1), p(a, w1, -1)].join(" ");
}

/**
 * Tapered capsule: rounded ends (like a joint) and an optional muscle bulge in the middle.
 * Replaces the flat quad so limbs read as soft organic volumes.
 */
function limbPath(a: Pt, b: Pt, w1: number, w2: number, bulge = 0): string | null {
  if (!isVis(a) || !isVis(b)) return null;
  const dx = b.x - a.x, dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len, ny = dx / len;
  const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
  const wm = (w1 + w2) / 2 + bulge * 2;
  const P = (x: number, y: number, w: number, s: number) => `${r2(x + nx * w * s)} ${r2(y + ny * w * s)}`;
  return (
    `M ${P(a.x, a.y, w1, 1)} Q ${P(mx, my, wm, 1)} ${P(b.x, b.y, w2, 1)} ` +
    `A ${r2(w2)} ${r2(w2)} 0 0 0 ${P(b.x, b.y, w2, -1)} ` +
    `Q ${P(mx, my, wm, -1)} ${P(a.x, a.y, w1, -1)} ` +
    `A ${r2(w1)} ${r2(w1)} 0 0 0 ${P(a.x, a.y, w1, 1)} Z`
  );
}

/** Egg-shaped head with a defined jaw instead of a plain ellipse. */
function headPath(cx: number, cy: number, rx: number, ry: number): string {
  return (
    `M ${r2(cx)} ${r2(cy - ry)} ` +
    `C ${r2(cx + rx * 1.05)} ${r2(cy - ry)} ${r2(cx + rx * 1.02)} ${r2(cy + ry * 0.3)} ${r2(cx + rx * 0.58)} ${r2(cy + ry * 0.78)} ` +
    `Q ${r2(cx)} ${r2(cy + ry * 1.18)} ${r2(cx - rx * 0.58)} ${r2(cy + ry * 0.78)} ` +
    `C ${r2(cx - rx * 1.02)} ${r2(cy + ry * 0.3)} ${r2(cx - rx * 1.05)} ${r2(cy - ry)} ${r2(cx)} ${r2(cy - ry)} Z`
  );
}

function rot(d: { x: number; y: number }, ang: number) {
  const c = Math.cos(ang), s = Math.sin(ang);
  return { x: d.x * c - d.y * s, y: d.x * s + d.y * c };
}

/** Palm + four fanned fingers + thumb. Uses MediaPipe hand landmarks when available. */
function handPath(
  wrist: Pt, elbow: Pt, sc: number, centerX: number,
  pinky?: Pt, index?: Pt, thumb?: Pt,
): string | null {
  if (!isVis(wrist)) return null;
  const tips = [pinky, index].filter((p): p is Pt => isVis(p));
  let d: { x: number; y: number };
  let reach = 24 * sc;
  if (tips.length) {
    const tx = tips.reduce((s, p) => s + p.x, 0) / tips.length;
    const ty = tips.reduce((s, p) => s + p.y, 0) / tips.length;
    const l = Math.hypot(tx - wrist.x, ty - wrist.y) || 1;
    d = { x: (tx - wrist.x) / l, y: (ty - wrist.y) / l };
    reach = Math.max(14 * sc, Math.min(34 * sc, l * 1.1));
  } else if (isVis(elbow)) {
    const l = Math.hypot(wrist.x - elbow.x, wrist.y - elbow.y) || 1;
    d = { x: (wrist.x - elbow.x) / l, y: (wrist.y - elbow.y) / l };
  } else {
    d = { x: 0, y: 1 };
  }
  const n = { x: -d.y, y: d.x };
  const nSign = Math.sign(centerX - wrist.x) * Math.sign(n.x) || 1;

  const palmEnd: Pt = { x: wrist.x + d.x * reach * 0.52, y: wrist.y + d.y * reach * 0.52, visible: true };
  const parts: Array<string | null> = [limbPath(wrist, palmEnd, 7.5 * sc, 9 * sc)];

  const offs = [-6.2, -2.1, 2.1, 6.2];
  const angs = [-0.26, -0.09, 0.08, 0.24];
  const lens = [0.5, 0.58, 0.54, 0.4];
  offs.forEach((o, i) => {
    const s: Pt = { x: palmEnd.x + n.x * o * sc, y: palmEnd.y + n.y * o * sc, visible: true };
    const dir = rot(d, angs[i]);
    const L = reach * lens[i];
    const e: Pt = { x: s.x + dir.x * L, y: s.y + dir.y * L, visible: true };
    parts.push(limbPath(s, e, 2.5 * sc, 1.8 * sc));
  });

  const tb: Pt = { x: wrist.x + d.x * 5 * sc + n.x * nSign * 6 * sc, y: wrist.y + d.y * 5 * sc + n.y * nSign * 6 * sc, visible: true };
  let te: Pt;
  if (isVis(thumb)) {
    te = thumb as Pt;
  } else {
    const td = { x: d.x * 0.65 + n.x * nSign * 0.75, y: d.y * 0.65 + n.y * nSign * 0.75 };
    const tl = Math.hypot(td.x, td.y) || 1;
    te = { x: tb.x + (td.x / tl) * reach * 0.42, y: tb.y + (td.y / tl) * reach * 0.42, visible: true };
  }
  parts.push(limbPath(tb, te, 3.4 * sc, 2.4 * sc));
  return parts.filter(Boolean).join(" ");
}

/** Foot from ankle, heel and toe (MediaPipe 29-32 when present). */
function footPath(ankle: Pt, heel: Pt, toe: Pt, sc: number): string | null {
  if (!isVis(ankle)) return null;
  const parts: Array<string | null> = [
    limbPath(ankle, lerp(heel, toe, 0.4), 8.5 * sc, 8 * sc),
    limbPath(heel, toe, 7 * sc, 8.5 * sc, 1 * sc),
  ];
  return parts.filter(Boolean).join(" ");
}

function prettyRegion(id: string) {
  const s = id.replace(/-/g, " ");
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function slownessLabel(slowness: number) {
  if (slowness >= 60) return { text: "Slow \u2013 needs attention", tone: "text-orange-300" };
  if (slowness >= 30) return { text: "Slightly slow", tone: "text-yellow-300" };
  return { text: "Normal pace", tone: "text-emerald-300" };
}

function ToolButton({
  active, onClick, label, children,
}: { active?: boolean; onClick: () => void; label: string; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
      title={label}
      className={`inline-flex h-8 w-8 items-center justify-center rounded-lg border text-slate-200 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 ${
        active ? "border-cyan-400/60 bg-cyan-400/15 text-cyan-200" : "border-white/10 bg-white/[0.03] active:bg-white/10"
      }`}
    >
      {children}
    </button>
  );
}

/**
 * Pose-driven movement simulation: body regions are drawn from current
 * MediaPipe joint positions so the SVG moves coherently with recorded motion.
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

  // --- interactive view state (additive) ---
  const [rate, setRate] = useState(1);
  const [loop, setLoop] = useState(false);
  const [runId, setRunId] = useState(0);
  const [showSkeleton, setShowSkeleton] = useState(true);
  const [showTrails, setShowTrails] = useState(true);
  const [shading, setShading] = useState(true);
  const [mirror, setMirror] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [hoveredRegion, setHoveredRegion] = useState<string | null>(null);
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null);
  const [hoveredJoint, setHoveredJoint] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const dragRef = useRef<{ px: number; py: number; ox: number; oy: number; moved: boolean } | null>(null);

  useEffect(() => {
    if (!playing || frames.length < 2 || duration <= 0) return;
    startRef.current = performance.now() - elapsedRef.current / rate;
    const tick = () => {
      const now = performance.now();
      const t = (now - startRef.current) * rate;
      if (t >= duration) {
        if (loop) {
          startRef.current = now;
          setElapsed(0);
          rafRef.current = requestAnimationFrame(tick);
          return;
        }
        setElapsed(duration); setPlaying(false); return;
      }
      setElapsed(t);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current !== null) cancelAnimationFrame(rafRef.current); rafRef.current = null; };
  }, [playing, frames.length, duration, rate, loop, runId]);

  const currentPoints = useMemo(() => {
    if (frames.length === 0) return [] as Pt[];
    if (frames.length === 1) return frames[0].points as Pt[];
    let lo = 0, hi = frames.length - 1;
    while (lo < hi - 1) {
      const m = (lo + hi) >> 1;
      if (frames[m].t <= elapsed) lo = m; else hi = m;
    }
    const a = frames[lo], b = frames[hi];
    const span = b.t - a.t || 1;
    const f = Math.max(0, Math.min(1, (elapsed - a.t) / span));
    return a.points.map((p, i) => {
      const q = b.points[i] ?? p;
      return { x: p.x + (q.x - p.x) * f, y: p.y + (q.y - p.y) * f, visible: p.visible || q.visible };
    });
  }, [frames, elapsed]);

  // Fading motion trails for wrists and ankles.
  const trails = useMemo(() => {
    if (!showTrails || frames.length < 2) return [] as Array<{ j: number; pts: Pt[] }>;
    return TRAIL_JOINTS.map((j) => {
      const pts: Pt[] = [];
      for (const f of frames) {
        if (f.t > elapsed) break;
        if (f.t < elapsed - TRAIL_MS) continue;
        const p = f.points[j] as Pt | undefined;
        if (p && p.visible) pts.push(p);
      }
      const cur = currentPoints[j];
      if (cur && cur.visible) pts.push(cur);
      return { j, pts };
    });
  }, [showTrails, frames, elapsed, currentPoints]);

  // Regions ranked by slowness for the quick-pick list.
  const rankedRegions = useMemo(() => {
    return Object.entries(regionMotion)
      .map(([id, v]) => ({ id, slowness: (v as { slowness?: number })?.slowness ?? 0 }))
      .sort((a, b) => b.slowness - a.slowness)
      .slice(0, 5);
  }, [regionMotion]);

  const handleRestart = () => { setElapsed(0); setPlaying(true); setRunId((n) => n + 1); };
  const handleScrub = (value: number) => { setElapsed(value); setPlaying(false); };

  const handleStep = (dir: 1 | -1, bigMs = 0) => {
    setPlaying(false);
    if (bigMs) {
      setElapsed(Math.max(0, Math.min(duration, elapsedRef.current + dir * bigMs)));
      return;
    }
    const cur = elapsedRef.current;
    if (dir === 1) {
      const next = frames.find((f) => f.t > cur + 0.5);
      setElapsed(next ? next.t : duration);
    } else {
      let prev = 0;
      for (const f of frames) { if (f.t < cur - 0.5) prev = f.t; else break; }
      setElapsed(prev);
    }
  };

  const clampPan = (x: number, y: number, z: number) => {
    const maxX = ((z - 1) * 400) / 2, maxY = ((z - 1) * 800) / 2;
    return { x: Math.max(-maxX, Math.min(maxX, x)), y: Math.max(-maxY, Math.min(maxY, y)) };
  };
  const changeZoom = (delta: number) => {
    setZoom((z) => {
      const nz = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, +(z + delta).toFixed(2)));
      setPan((p) => clampPan(p.x, p.y, nz));
      return nz;
    });
  };
  const resetView = () => { setZoom(1); setPan({ x: 0, y: 0 }); setMirror(false); };

  const onSvgPointerDown = (e: ReactPointerEvent<SVGSVGElement>) => {
    dragRef.current = { px: e.clientX, py: e.clientY, ox: pan.x, oy: pan.y, moved: false };
  };
  const onSvgPointerMove = (e: ReactPointerEvent<SVGSVGElement>) => {
    const d = dragRef.current;
    const el = svgRef.current;
    if (!d || !el) return;
    const dx = e.clientX - d.px, dy = e.clientY - d.py;
    if (!d.moved && Math.hypot(dx, dy) > 4) d.moved = true;
    if (d.moved && zoom > 1) {
      const k = 400 / el.getBoundingClientRect().width;
      setPan(clampPan(d.ox + dx * k, d.oy + dy * k, zoom));
    }
  };
  const onSvgPointerUp = () => { window.setTimeout(() => { dragRef.current = null; }, 0); };

  const handleKey = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).tagName === "INPUT") return;
    switch (e.key) {
      case " ": e.preventDefault(); elapsed >= duration ? handleRestart() : setPlaying((p) => !p); break;
      case "ArrowRight": e.preventDefault(); handleStep(1, e.shiftKey ? 1000 : 0); break;
      case "ArrowLeft": e.preventDefault(); handleStep(-1, e.shiftKey ? 1000 : 0); break;
      case "Home": e.preventDefault(); handleScrub(0); break;
      case "End": e.preventDefault(); handleScrub(duration); break;
      case "l": case "L": setLoop((v) => !v); break;
      case "t": case "T": setShowTrails((v) => !v); break;
      case "s": case "S": setShowSkeleton((v) => !v); break;
      case "b": case "B": setShading((v) => !v); break;
      case "m": case "M": setMirror((v) => !v); break;
      case "+": case "=": changeZoom(0.25); break;
      case "-": changeZoom(-0.25); break;
      case "0": resetView(); break;
      default: break;
    }
  };

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

  const P = (i: number) => currentPoints[i] as Pt | undefined;
  const ls = P(11), rs = P(12), lh = P(23), rh = P(24);
  const le = P(13), re = P(14), lw = P(15), rw = P(16);
  const lk = P(25), rk = P(26), la = P(27), ra = P(28);
  const nose = P(0);

  const shoulderMid = ls && rs && isVis(ls) && isVis(rs) ? mid(ls, rs) : null;
  const shoulderW = ls && rs ? dist(ls, rs) : 120;
  /** Body-size factor: every limb width scales with the person's shoulder width. */
  const sc = Math.max(0.55, Math.min(1.9, shoulderW / 120));

  const torsoPoly = () => {
    if (!ls || !rs || !rh || !lh || ![ls, rs, rh, lh].every(isVis)) return null;
    return `${ls.x},${ls.y} ${rs.x},${rs.y} ${rh.x},${rh.y} ${lh.x},${lh.y}`;
  };
  const headR = Math.max(22, shoulderW * 0.28);
  const headCx = nose && isVis(nose) ? nose.x : (shoulderMid?.x ?? 200);
  /** Head sits slightly lower so the visible neck is shorter. */
  const headDrop = headR * 0.24;
  const headCy = (nose && isVis(nose) ? nose.y - headR * 0.2 : ((shoulderMid?.y ?? 140) - headR - 8)) + headDrop;
  const neckPts = () => {
    if (!shoulderMid || !nose) return null;
    const top = { x: nose.x, y: headCy + headR * 0.6, visible: isVis(nose) };
    const nw = Math.max(10, shoulderW * 0.18);
    return limbPath(top, shoulderMid, nw * 0.78, nw * 1.18);
  };
  /** Outer thigh edge offset: the waist/hips are as wide as the two legs together. */
  const hipOff = 19 * sc;
  const pelvisPath = () => {
    if (!lh || !rh || ![lh, rh].every(isVis)) return null;
    const h = Math.max(18, dist(lh, rh) * 0.45);
    const m = mid(lh, rh);
    const w = dist(lh, rh);
    const [a, b] = lh.x < rh.x ? [lh, rh] : [rh, lh];
    const oa = { x: a.x - hipOff, y: a.y };
    const ob = { x: b.x + hipOff, y: b.y };
    return (
      `M ${pstr(oa)} L ${pstr(ob)} ` +
      `C ${r2(ob.x)} ${r2(ob.y + h * 0.6)} ${r2(m.x + w * 0.16)} ${r2(m.y + h * 1.0)} ${r2(m.x)} ${r2(m.y + h * 1.06)} ` +
      `C ${r2(m.x - w * 0.16)} ${r2(m.y + h * 1.0)} ${r2(oa.x)} ${r2(oa.y + h * 0.6)} ${pstr(oa)} Z`
    );
  };

  // Head tilt follows the ears so the head turns with the person.
  const headTilt = (() => {
    const e7 = P(7), e8 = P(8);
    if (!isVis(e7) || !isVis(e8)) return 0;
    const a = (Math.atan2(e7!.y - e8!.y, e7!.x - e8!.x) * 180) / Math.PI;
    return Math.max(-35, Math.min(35, a));
  })();

  // Torso silhouette: waist taper + chest/hip flare, sampled along the shoulder->hip edges.
  const torso = (() => {
    if (!torsoPoly()) return null;
    const topMid = mid(ls!, rs!), botMid = mid(lh!, rh!);
    // gentle waist (no hourglass) and a flare at the bottom so the torso meets the outer thighs
    const profile = (t: number) => -0.06 + 0.12 * Math.sin(Math.PI * t * 0.85);
    const edge = (s: Pt, h: Pt, t: number): Pt => {
      const base = lerp(s, h, t);
      const c = lerp(topMid, botMid, t);
      const k = profile(t);
      const flare = Math.sign(base.x - c.x) * hipOff * Math.pow(t, 3);
      return { x: base.x + (c.x - base.x) * k + flare, y: base.y + (c.y - base.y) * k, visible: true };
    };
    const edgeL = (t: number) => edge(ls!, lh!, t);
    const edgeR = (t: number) => edge(rs!, rh!, t);
    const band = (t0: number, t1: number) => {
      const n = Math.max(2, Math.round((t1 - t0) * 10));
      const L: Pt[] = [], R: Pt[] = [];
      for (let i = 0; i <= n; i++) { const t = t0 + ((t1 - t0) * i) / n; L.push(edgeL(t)); R.push(edgeR(t)); }
      let d = `M ${pstr(L[0])} `;
      d += t0 === 0 ? `Q ${r2(topMid.x)} ${r2(topMid.y - shoulderW * 0.07)} ${pstr(R[0])} ` : `L ${pstr(R[0])} `;
      for (let i = 1; i <= n; i++) d += `L ${pstr(R[i])} `;
      for (let i = n; i >= 0; i--) d += `L ${pstr(L[i])} `;
      return d + "Z";
    };
    const side = (left: boolean) => {
      const n = 10;
      const outer: Pt[] = [], inner: Pt[] = [];
      for (let i = 0; i <= n; i++) {
        const t = i / n;
        const o = left ? edgeL(t) : edgeR(t);
        const other = left ? edgeR(t) : edgeL(t);
        outer.push(o);
        inner.push(lerp(o, other, 0.26));
      }
      let d = `M ${pstr(outer[0])} `;
      for (let i = 1; i <= n; i++) d += `L ${pstr(outer[i])} `;
      for (let i = n; i >= 0; i--) d += `L ${pstr(inner[i])} `;
      return d + "Z";
    };
    return { topMid, botMid, edgeL, edgeR, band, side };
  })();

  const activeRegion = hoveredRegion ?? selectedRegion;

  const baseShapes: ReactElement[] = [];

  const renderRegions = () => {
    const out: ReactElement[] = [];
    const push = (id: string, el: ReactElement | null) => {
      if (!el) return;
      const isActive = activeRegion === id;
      const dimmed = activeRegion !== null && !isActive;
      const slow = colorByMotion && (regionMotion[id]?.slowness ?? 0) >= 60;
      baseShapes.push(<g key={`base-${id}`}>{el}</g>);
      out.push(
        <g
          key={id}
          fill={regionFill(id)}
          stroke={isActive ? "#ffffff" : "rgba(2,6,23,0.55)"}
          strokeWidth={isActive ? 2 : 0.9}
          strokeLinejoin="round"
          opacity={dimmed ? 0.4 : isActive ? 1 : 0.92}
          filter={isActive ? "url(#abm-glow)" : undefined}
          className={slow && playing && !isActive ? "animate-pulse" : undefined}
          style={{ cursor: "pointer", transition: "opacity 150ms" }}
          role="button"
          aria-label={`${prettyRegion(id)} region`}
          onPointerEnter={() => setHoveredRegion(id)}
          onPointerLeave={() => setHoveredRegion((h) => (h === id ? null : h))}
          onClick={(e) => {
            e.stopPropagation();
            if (dragRef.current?.moved) return;
            setSelectedRegion((s) => (s === id ? null : id));
          }}
        >
          {el}
        </g>,
      );
    };

    // neck first so the head (jaw) overlaps its top edge
    const neck = neckPts();
    push("neck", neck ? <path d={neck} /> : null);
    push(
      "head",
      nose || shoulderMid
        ? <path d={headPath(headCx, headCy, headR * 0.82, headR)} transform={`rotate(${r2(headTilt)} ${r2(headCx)} ${r2(headCy)})`} />
        : null,
    );

    if (torso) {
      push("chest", <path d={torso.band(0, 0.45)} />);
      push("upper-abdomen", <path d={torso.band(0.45, 0.75)} />);
      push("lower-abdomen", <path d={torso.band(0.75, 1)} />);
      push("left-oblique", <path d={torso.side(true)} />);
      push("right-oblique", <path d={torso.side(false)} />);
    }

    // deltoid caps
    if (ls && le && isVis(ls) && isVis(le)) {
      const sp = limbPath(ls, lerp(ls, le, 0.35), shoulderW * 0.2, shoulderW * 0.15, shoulderW * 0.01);
      if (sp) push("left-shoulder", <path d={sp} />);
    }
    if (rs && re && isVis(rs) && isVis(re)) {
      const sp = limbPath(rs, lerp(rs, re, 0.35), shoulderW * 0.2, shoulderW * 0.15, shoulderW * 0.01);
      if (sp) push("right-shoulder", <path d={sp} />);
    }
    const pel = pelvisPath();
    push("pelvis", pel ? <path d={pel} /> : null);

    const limb = (id: string, a?: Pt, b?: Pt, w1 = 14, w2 = 12, bulge = 0) => {
      if (!a || !b) return;
      const d = limbPath(a, b, w1 * sc, w2 * sc, bulge * sc);
      if (d) push(id, <path d={d} />);
    };
    limb("left-upper-arm", ls, le, 15, 12, 2.5);
    limb("right-upper-arm", rs, re, 15, 12, 2.5);
    limb("left-forearm", le, lw, 12, 8, 2);
    limb("right-forearm", re, rw, 12, 8, 2);

    const cx = shoulderMid?.x ?? 200;
    const lHand = lw ? handPath(lw, le ?? lw, sc, cx, P(17), P(19), P(21)) : null;
    const rHand = rw ? handPath(rw, re ?? rw, sc, cx, P(18), P(20), P(22)) : null;
    push("left-hand", lHand ? <path d={lHand} /> : null);
    push("right-hand", rHand ? <path d={rHand} /> : null);

    limb("left-quadriceps", lh, lk, 20, 14, 3);
    limb("right-quadriceps", rh, rk, 20, 14, 3);
    if (lk && isVis(lk)) push("left-knee", <circle cx={lk.x} cy={lk.y} r={13 * sc} />);
    if (rk && isVis(rk)) push("right-knee", <circle cx={rk.x} cy={rk.y} r={13 * sc} />);
    limb("left-tibia", lk ? lerp(lk, la ?? lk, 0.15) : undefined, la ? lerp(lk ?? la, la, 0.6) : undefined, 13, 11, 3);
    limb("right-tibia", rk ? lerp(rk, ra ?? rk, 0.15) : undefined, ra ? lerp(rk ?? ra, ra, 0.6) : undefined, 13, 11, 3);
    limb("left-calf", la ? lerp(lk ?? la, la, 0.55) : undefined, la, 11, 7.5, 1.5);
    limb("right-calf", ra ? lerp(rk ?? ra, ra, 0.55) : undefined, ra, 11, 7.5, 1.5);
    limb("left-ankle", la, la ? { x: la.x + 2, y: la.y + 10 * sc, visible: la.visible } : undefined, 8, 7.5);
    limb("right-ankle", ra, ra ? { x: ra.x - 2, y: ra.y + 10 * sc, visible: ra.visible } : undefined, 8, 7.5);

    const leftHeel = P(29), leftToe = P(31), rightHeel = P(30), rightToe = P(32);
    const lfHeel = isVis(leftHeel) ? leftHeel! : la ? { x: la.x - 2, y: la.y + 8 * sc, visible: la.visible } : undefined;
    const lfToe = isVis(leftToe) ? leftToe! : la ? { x: la.x + 18 * sc, y: la.y + 10 * sc, visible: la.visible } : undefined;
    const rfHeel = isVis(rightHeel) ? rightHeel! : ra ? { x: ra.x + 2, y: ra.y + 8 * sc, visible: ra.visible } : undefined;
    const rfToe = isVis(rightToe) ? rightToe! : ra ? { x: ra.x - 18 * sc, y: ra.y + 10 * sc, visible: ra.visible } : undefined;
    const lFoot = la && lfHeel && lfToe ? footPath(la, lfHeel, lfToe, sc) : null;
    const rFoot = ra && rfHeel && rfToe ? footPath(ra, rfHeel, rfToe, sc) : null;
    push("left-foot", lFoot ? <path d={lFoot} /> : null);
    push("right-foot", rFoot ? <path d={rFoot} /> : null);
    return out;
  };

  if (!motion || frames.length < 2) {
    return (
      <div className={`flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 bg-black/30 p-8 text-center ${className}`}>
        <p className="text-sm font-medium text-slate-200">No motion data captured</p>
        <p className="mt-1 max-w-xs text-xs leading-5 text-slate-500">A movement simulation will appear here once joint movement is recorded during an assessment.</p>
      </div>
    );
  }

  const regionEls = renderRegions();

  const progress = duration > 0 ? Math.min(100, (elapsed / duration) * 100) : 0;
  const groundY = Math.max(
    ...[la, ra, lk, rk].filter((p): p is Pt => isVis(p)).map((p) => p.y),
    700,
  ) + 22;
  const groundX = shoulderMid?.x ?? 200;

  const activeSlowness = activeRegion ? (regionMotion[activeRegion]?.slowness ?? 0) : 0;
  const activeRating = activeRegion ? assessment.regions.find((x) => x.regionId === activeRegion)?.rating : undefined;
  const activeInfo = slownessLabel(activeSlowness);
  const joint = hoveredJoint !== null ? currentPoints[hoveredJoint] : undefined;

  // Subtle anatomical detail lines (non-interactive).
  const detailLines = (() => {
    const out: ReactElement[] = [];
    const stroke = "rgba(255,255,255,0.22)";
    const sw = Math.max(0.8, 1.2 * sc);
    if (torso && shoulderMid) {
      const c32 = lerp(torso.topMid, torso.botMid, 0.3);
      const nav = lerp(torso.topMid, torso.botMid, 0.74);
      out.push(<path key="mid" d={`M ${pstr(lerp(torso.topMid, torso.botMid, 0.1))} L ${pstr(nav)}`} stroke={stroke} strokeWidth={sw} fill="none" strokeLinecap="round" />);
      out.push(<circle key="nav" cx={nav.x} cy={nav.y} r={1.8 * sc} fill="rgba(0,0,0,0.35)" />);
      const pecL = torso.edgeL(0.26), pecR = torso.edgeR(0.26);
      out.push(<path key="pecL" d={`M ${pstr(c32)} Q ${r2((c32.x + pecL.x) / 2)} ${r2(c32.y + 9 * sc)} ${pstr(lerp(pecL, c32, 0.2))}`} stroke={stroke} strokeWidth={sw} fill="none" strokeLinecap="round" />);
      out.push(<path key="pecR" d={`M ${pstr(c32)} Q ${r2((c32.x + pecR.x) / 2)} ${r2(c32.y + 9 * sc)} ${pstr(lerp(pecR, c32, 0.2))}`} stroke={stroke} strokeWidth={sw} fill="none" strokeLinecap="round" />);
      if (ls && rs) {
        const top = lerp(torso.topMid, torso.botMid, 0.03);
        out.push(<path key="clavL" d={`M ${pstr(top)} Q ${r2((top.x + ls.x) / 2)} ${r2(top.y - 3 * sc)} ${pstr(lerp(ls, top, 0.15))}`} stroke={stroke} strokeWidth={sw} fill="none" strokeLinecap="round" />);
        out.push(<path key="clavR" d={`M ${pstr(top)} Q ${r2((top.x + rs.x) / 2)} ${r2(top.y - 3 * sc)} ${pstr(lerp(rs, top, 0.15))}`} stroke={stroke} strokeWidth={sw} fill="none" strokeLinecap="round" />);
      }
    }
    return out;
  })();

  return (
    <div
      className={`flex flex-col gap-3 rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/50 ${className}`}
      tabIndex={0}
      onKeyDown={handleKey}
      aria-label="Body movement simulation. Space to play or pause, arrow keys to step, L loop, T trails, S skeleton, B shading, M mirror, plus and minus to zoom."
    >
      {/* view toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <ToolButton active={showSkeleton} onClick={() => setShowSkeleton((v) => !v)} label="Toggle skeleton (S)">
            {showSkeleton ? <Eye size={15} /> : <EyeOff size={15} />}
          </ToolButton>
          <ToolButton active={showTrails} onClick={() => setShowTrails((v) => !v)} label="Toggle motion trails (T)">
            <Activity size={15} />
          </ToolButton>
          <ToolButton active={shading} onClick={() => setShading((v) => !v)} label="Toggle 3D shading (B)">
            <Sun size={15} />
          </ToolButton>
          <ToolButton active={mirror} onClick={() => setMirror((v) => !v)} label="Mirror view (M)">
            <FlipHorizontal size={15} />
          </ToolButton>
        </div>
        <div className="flex items-center gap-1.5">
          <ToolButton onClick={() => changeZoom(-0.25)} label="Zoom out (-)"><ZoomOut size={15} /></ToolButton>
          <span className="w-10 text-center font-mono text-[11px] tabular-nums text-slate-400">{Math.round(zoom * 100)}%</span>
          <ToolButton onClick={() => changeZoom(0.25)} label="Zoom in (+)"><ZoomIn size={15} /></ToolButton>
          <ToolButton onClick={resetView} label="Reset view (0)"><Maximize2 size={15} /></ToolButton>
        </div>
      </div>

      {/* stage */}
      <div className="relative flex items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-slate-900/80 to-black/60">
        <svg
          ref={svgRef}
          viewBox="0 0 400 800"
          role="img"
          aria-label="Simulated body movement with slow regions highlighted"
          className={`h-auto w-full max-w-[300px] select-none touch-none ${zoom > 1 ? "cursor-grab active:cursor-grabbing" : ""}`}
          onPointerDown={onSvgPointerDown}
          onPointerMove={onSvgPointerMove}
          onPointerUp={onSvgPointerUp}
          onPointerCancel={onSvgPointerUp}
          onClick={() => { if (!dragRef.current?.moved) setSelectedRegion(null); }}
        >
          <defs>
            <filter id="abm-glow" x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="3" result="b" />
              <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
            {/* soft 3D roundness: blurred alpha used as a height map for specular light */}
            <filter id="abm-shade" x="-10%" y="-10%" width="120%" height="120%" colorInterpolationFilters="sRGB">
              <feGaussianBlur in="SourceAlpha" stdDeviation="3.2" result="blur" />
              <feSpecularLighting in="blur" surfaceScale="5" specularConstant="0.7" specularExponent="24" lightingColor="#ffffff" result="spec">
                <feDistantLight azimuth="235" elevation="52" />
              </feSpecularLighting>
              <feComposite in="spec" in2="SourceAlpha" operator="in" result="specIn" />
              <feComposite in="SourceGraphic" in2="specIn" operator="arithmetic" k1="0" k2="1" k3="0.6" k4="0" />
            </filter>
            <pattern id="abm-grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(148,163,184,0.07)" strokeWidth="1" />
            </pattern>
            <radialGradient id="abm-shadow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="rgba(0,0,0,0.55)" />
              <stop offset="100%" stopColor="rgba(0,0,0,0)" />
            </radialGradient>
            <linearGradient id="abm-bone" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#2f7a64" />
              <stop offset="100%" stopColor="#1B4D3E" />
            </linearGradient>
          </defs>

          <rect x={0} y={0} width={400} height={800} fill="url(#abm-grid)" />

          <g transform={`translate(${pan.x} ${pan.y}) translate(200 400) scale(${mirror ? -zoom : zoom} ${zoom}) translate(-200 -400)`}>
            {/* ground shadow, scales with how high the feet are */}
            <ellipse cx={groundX} cy={groundY} rx={Math.max(50, shoulderW * 0.7)} ry={10} fill="url(#abm-shadow)" />
            <line x1={20} y1={groundY} x2={380} y2={groundY} stroke="rgba(148,163,184,0.12)" strokeDasharray="4 6" />

            {/* solid dark silhouette: closes gaps between regions and gives a clean outline */}
            <g fill="#0a1020" stroke="#0a1020" strokeWidth={4} strokeLinejoin="round" opacity={0.95} pointerEvents="none">
              {baseShapes}
            </g>

            <g filter={shading ? "url(#abm-shade)" : undefined}>{regionEls}</g>

            <g pointerEvents="none">{detailLines}</g>

            {/* motion trails */}
            {trails.map(({ j, pts }) =>
              pts.slice(1).map((p, i) => {
                const q = pts[i];
                const a = (i + 1) / pts.length;
                return (
                  <line
                    key={`tr-${j}-${i}`}
                    x1={q.x} y1={q.y} x2={p.x} y2={p.y}
                    stroke="#22d3ee"
                    strokeWidth={1 + a * 3.5}
                    strokeLinecap="round"
                    opacity={a * 0.65}
                    pointerEvents="none"
                  />
                );
              }),
            )}

            {showSkeleton && currentPoints.length > 0 && (
              <g>
                {EXTRA_CONNECTIONS.map(([a, b]) => {
                  const pa = currentPoints[a], pb = currentPoints[b];
                  if (!pa || !pb || !pa.visible || !pb.visible) return null;
                  return <line key={`x-${a}-${b}`} x1={pa.x} y1={pa.y} x2={pb.x} y2={pb.y} stroke="#1B4D3E" strokeWidth={1.5} strokeLinecap="round" opacity={0.55} pointerEvents="none" />;
                })}
                {CONNECTIONS.map(([a, b]) => {
                  const pa = currentPoints[a], pb = currentPoints[b];
                  if (!pa || !pb || !pa.visible || !pb.visible) return null;
                  return <line key={`${a}-${b}`} x1={pa.x} y1={pa.y} x2={pb.x} y2={pb.y} stroke="url(#abm-bone)" strokeWidth={3} strokeLinecap="round" opacity={0.9} pointerEvents="none" />;
                })}
                {currentPoints.map((p, i) => {
                  if (!p.visible || !JOINT_INDEXES.includes(i)) return null;
                  const hot = hoveredJoint === i;
                  return (
                    <g key={i}>
                      <circle cx={p.x} cy={p.y} r={hot ? 6 : 4} fill={hot ? "#ffffff" : "#d8ebe5"} stroke="#1B4D3E" strokeWidth={1.5} pointerEvents="none" />
                      <circle
                        cx={p.x} cy={p.y} r={11} fill="transparent"
                        style={{ cursor: "crosshair" }}
                        onPointerEnter={() => setHoveredJoint(i)}
                        onPointerLeave={() => setHoveredJoint((h) => (h === i ? null : h))}
                      />
                    </g>
                  );
                })}
              </g>
            )}
          </g>
        </svg>

        {/* floating status chips */}
        <div className="pointer-events-none absolute left-2 top-2 flex flex-col gap-1">
          <span className="rounded-md bg-black/50 px-1.5 py-0.5 font-mono text-[10px] text-slate-300">{rate}x{loop ? " \u00b7 loop" : ""}</span>
          {!playing && elapsed < duration && <span className="rounded-md bg-black/50 px-1.5 py-0.5 text-[10px] text-slate-400">paused</span>}
        </div>
        {zoom > 1 && (
          <span className="pointer-events-none absolute bottom-2 left-2 rounded-md bg-black/50 px-1.5 py-0.5 text-[10px] text-slate-400">drag to pan</span>
        )}
      </div>

      {/* info panel */}
      <div className="min-h-[68px] rounded-xl border border-white/10 bg-white/[0.03] p-3 text-xs">
        {activeRegion ? (
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-2 text-sm font-medium text-slate-100">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: regionFill(activeRegion) }} />
                {prettyRegion(activeRegion)}
              </span>
              <span className={`${activeInfo.tone} text-[11px]`}>{activeInfo.text}</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
              <div className="h-full rounded-full transition-all duration-200" style={{ width: `${Math.min(100, activeSlowness)}%`, background: regionFill(activeRegion) }} />
            </div>
            <div className="flex justify-between text-[11px] text-slate-500">
              <span>Slowness {Math.round(activeSlowness)}/100</span>
              {activeRating && <span>Status: {String(activeRating)}</span>}
            </div>
          </div>
        ) : joint && hoveredJoint !== null ? (
          <div className="flex flex-col gap-1">
            <span className="text-sm font-medium text-slate-100">{JOINT_NAMES[hoveredJoint] ?? `Joint ${hoveredJoint}`}</span>
            <span className="font-mono text-[11px] text-slate-400">x {joint.x.toFixed(1)} \u00b7 y {joint.y.toFixed(1)} \u00b7 landmark #{hoveredJoint}</span>
          </div>
        ) : (
          <p className="text-slate-500">Hover or tap a body region to inspect it. Hover a joint dot for its position.</p>
        )}
      </div>

      {/* slowest regions quick-pick */}
      {rankedRegions.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] text-slate-500">Slowest:</span>
          {rankedRegions.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => setSelectedRegion((s) => (s === r.id ? null : r.id))}
              className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 ${
                selectedRegion === r.id ? "border-cyan-400/60 bg-cyan-400/15 text-cyan-100" : "border-white/10 text-slate-300 active:bg-white/10"
              }`}
            >
              <span className="h-2 w-2 rounded-full" style={{ background: regionFill(r.id) }} />
              {prettyRegion(r.id)}
            </button>
          ))}
        </div>
      )}

      {/* transport */}
      <div className="flex items-center gap-2">
        <button onClick={() => (elapsed >= duration ? handleRestart() : setPlaying((p) => !p))} className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-cyan-400 text-slate-950 active:bg-cyan-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300" aria-label={playing ? "Pause simulation" : "Play simulation"}>
          {playing ? <Pause size={18} /> : <Play size={18} />}
        </button>
        <button onClick={handleRestart} className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/15 text-slate-200 active:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300" aria-label="Restart simulation">
          <RotateCcw size={16} />
        </button>
        <ToolButton onClick={() => handleStep(-1)} label="Previous frame (\u2190)"><SkipBack size={15} /></ToolButton>
        <ToolButton onClick={() => handleStep(1)} label="Next frame (\u2192)"><SkipForward size={15} /></ToolButton>
        <ToolButton active={loop} onClick={() => setLoop((v) => !v)} label="Loop (L)"><Repeat size={15} /></ToolButton>
        <span className="ml-auto w-20 text-right font-mono text-xs tabular-nums text-slate-400">{(elapsed / 1000).toFixed(1)}s / {(duration / 1000).toFixed(1)}s</span>
      </div>

      <input
        type="range"
        min={0}
        max={Math.round(duration)}
        value={Math.round(elapsed)}
        onChange={(e) => handleScrub(Number(e.target.value))}
        className="h-2 w-full cursor-pointer appearance-none rounded-full accent-cyan-400"
        style={{ background: `linear-gradient(to right, rgb(34 211 238) ${progress}%, rgba(255,255,255,0.12) ${progress}%)` }}
        aria-label="Scrub through the movement"
      />

      {/* speed */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] text-slate-500">Speed</span>
        <div className="flex gap-1">
          {SPEEDS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setRate(s)}
              aria-pressed={rate === s}
              className={`rounded-md border px-2 py-1 font-mono text-[11px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 ${
                rate === s ? "border-cyan-400/60 bg-cyan-400/15 text-cyan-200" : "border-white/10 text-slate-400 active:bg-white/10"
              }`}
            >
              {s}x
            </button>
          ))}
        </div>
      </div>

      {/* legend */}
      {colorByMotion && (
        <div className="flex flex-wrap items-center justify-center gap-3 text-[11px] text-slate-400">
          <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: RATING_COLORS.green }} />Normal</span>
          <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: RATING_COLORS.yellow }} />Slightly slow</span>
          <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: RATING_COLORS.orange }} />Slow</span>
        </div>
      )}

      <p className="text-center text-[11px] text-slate-500">
        {colorByMotion
          ? "Body regions are driven by recorded MediaPipe joint positions. Colour shows movement slowness: orange = slow / needs attention, yellow = slightly slow, green = normal pace."
          : "Body regions are driven by recorded MediaPipe joint positions. Colour shows assessed health status."}
      </p>
    </div>
  );
}