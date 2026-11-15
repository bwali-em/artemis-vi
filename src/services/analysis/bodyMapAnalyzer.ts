import type { PoseLandmark } from "../../types/pose";
import { POSE_LANDMARK_NAMES } from "../../types/pose";
import type { AssessmentMetrics } from "../../types/assessment";
import type { AssessmentType } from "../../types/assessment";
import type {
  AnatomyRegion,
  BodyJointMap,
  BodyMapAssessment,
  HealthRating,
  JointCoordinate,
  MotionFrame,
  RegionAssessment,
  RegionMotion,
  RegionStatus,
} from "../../types/bodyMap";
import { ANATOMY_REGIONS } from "../../data/anatomyRegions";

const STATUS_FOR_SCORE = (score: number | null): RegionStatus => {
  if (score === null) return "unassessed";
  if (score >= 85) return "normal";
  if (score >= 70) return "monitor";
  if (score >= 55) return "attention";
  return "critical";
};

const RATING_FOR_STATUS: Record<RegionStatus, HealthRating> = {
  normal: "green",
  monitor: "yellow",
  attention: "orange",
  critical: "red",
  unassessed: "grey",
};

/** Extract a coordinate map from raw MediaPipe landmarks, keyed by name. */
export function extractJointCoordinates(landmarks: PoseLandmark[]): BodyJointMap {
  const map: BodyJointMap = {};
  for (let i = 0; i < landmarks.length; i++) {
    const name = POSE_LANDMARK_NAMES[i];
    if (!name) continue;
    const lm = landmarks[i];
    const coord: JointCoordinate = {
      index: i,
      name,
      x: lm.x,
      y: lm.y,
      z: lm.z,
      visibility: lm.visibility,
    };
    map[name] = coord;
  }
  return map;
}

interface RegionRule {
  /** Which named MediaPipe landmarks this region depends on for visibility. */
  landmarks: string[];
  /** Baseline score when there is no angle/symmetry signal. */
  baseScore: number;
}

/** Map each anatomical region to the joints that inform it. */
export const REGION_RULES: Record<string, RegionRule> = {
  head: { landmarks: ["nose", "left_ear", "right_ear"], baseScore: 90 },
  neck: { landmarks: ["left_ear", "right_ear", "left_shoulder", "right_shoulder"], baseScore: 88 },
  "left-shoulder": { landmarks: ["left_shoulder", "left_elbow"], baseScore: 86 },
  "right-shoulder": { landmarks: ["right_shoulder", "right_elbow"], baseScore: 86 },
  chest: { landmarks: ["left_shoulder", "right_shoulder"], baseScore: 88 },
  "upper-abdomen": { landmarks: ["left_shoulder", "right_shoulder", "left_hip", "right_hip"], baseScore: 86 },
  "lower-abdomen": { landmarks: ["left_hip", "right_hip"], baseScore: 86 },
  "left-oblique": { landmarks: ["left_shoulder", "left_hip"], baseScore: 84 },
  "right-oblique": { landmarks: ["right_shoulder", "right_hip"], baseScore: 84 },
  "left-upper-arm": { landmarks: ["left_shoulder", "left_elbow"], baseScore: 85 },
  "right-upper-arm": { landmarks: ["right_shoulder", "right_elbow"], baseScore: 85 },
  "left-forearm": { landmarks: ["left_elbow", "left_wrist"], baseScore: 85 },
  "right-forearm": { landmarks: ["right_elbow", "right_wrist"], baseScore: 85 },
  "left-hand": { landmarks: ["left_wrist"], baseScore: 84 },
  "right-hand": { landmarks: ["right_wrist"], baseScore: 84 },
  pelvis: { landmarks: ["left_hip", "right_hip"], baseScore: 86 },
  "left-quadriceps": { landmarks: ["left_hip", "left_knee"], baseScore: 85 },
  "right-quadriceps": { landmarks: ["right_hip", "right_knee"], baseScore: 85 },
  "left-knee": { landmarks: ["left_knee"], baseScore: 84 },
  "right-knee": { landmarks: ["right_knee"], baseScore: 84 },
  "left-tibia": { landmarks: ["left_knee", "left_ankle"], baseScore: 84 },
  "right-tibia": { landmarks: ["right_knee", "right_ankle"], baseScore: 84 },
  "left-calf": { landmarks: ["left_knee", "left_ankle"], baseScore: 82 },
  "right-calf": { landmarks: ["right_knee", "right_ankle"], baseScore: 82 },
  "left-ankle": { landmarks: ["left_ankle"], baseScore: 82 },
  "right-ankle": { landmarks: ["right_ankle"], baseScore: 82 },
  "left-foot": { landmarks: ["left_ankle", "left_foot_index", "left_heel"], baseScore: 80 },
  "right-foot": { landmarks: ["right_ankle", "right_foot_index", "right_heel"], baseScore: 80 },
};

function avgVisibility(joints: BodyJointMap, names: string[]): number | null {
  const vals = names
    .map((n) => joints[n]?.visibility)
    .filter((v): v is number => typeof v === "number");
  if (vals.length === 0) return null;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

function applySymmetry(
  score: number,
  side: "left" | "right" | "center",
  metrics: AssessmentMetrics
): number {
  const sym = metrics.leftRightSymmetry;
  if (sym == null || side === "center") return score;
  // Lower symmetry drags the affected side down.
  if (sym < 80) {
    const penalty = Math.min(35, (80 - sym) * 0.6);
    return Math.max(0, score - penalty);
  }
  return score;
}

function computeRegionScore(
  region: AnatomyRegion,
  joints: BodyJointMap,
  metrics: AssessmentMetrics,
  type: AssessmentType
): { score: number | null; note: string } {
  const rule = REGION_RULES[region.id];
  if (!rule) return { score: null, note: "No measurement rule for this region." };

  const vis = avgVisibility(joints, rule.landmarks);
  if (vis === null) {
    return { score: null, note: "No joint data captured for this region." };
  }

  let score = rule.baseScore;

  // Visibility lowers confidence in the region.
  if (vis < 0.5) {
    score = Math.min(score, 45);
  } else if (vis < 0.75) {
    score = Math.min(score, 70);
  }

  score = applySymmetry(score, region.side ?? "center", metrics);

  // Assessment-specific adjustments.
  if (type === "squat") {
    if (region.id.includes("quadriceps") || region.id.includes("knee")) {
      if (metrics.squatDepth != null) {
        score = metrics.squatDepth;
      }
    }
  }

  if (type === "shoulder_mobility") {
    if (region.id.includes("shoulder")) {
      if (metrics.maxShoulderElevation != null) {
        score = Math.min(100, metrics.maxShoulderElevation);
      }
      if (metrics.shoulderRangeDifference != null) {
        score = Math.max(0, score - metrics.shoulderRangeDifference);
      }
    }
  }

  if (type === "balance") {
    if (
      region.id.includes("calf") ||
      region.id.includes("ankle") ||
      region.id.includes("foot")
    ) {
      if (metrics.trunkSway != null) {
        score = Math.max(0, 100 - metrics.trunkSway * 1000);
      }
      if (metrics.balanceLeftRightDifference != null) {
        score = Math.max(0, score - metrics.balanceLeftRightDifference * 100);
      }
    }
  }

  if (type === "posture") {
    if (region.id.includes("shoulder") && metrics.shoulderAlignment != null) {
      score = Math.max(0, 100 - metrics.shoulderAlignment * 200);
    }
    if ((region.id.includes("oblique") || region.id === "chest") && metrics.trunkInclination != null) {
      score = Math.max(0, 100 - metrics.trunkInclination * 10);
    }
    if (region.id === "pelvis" && metrics.hipAlignment != null) {
      score = Math.max(0, 100 - metrics.hipAlignment * 200);
    }
  }

  const rounded = Math.round(Math.max(0, Math.min(100, score)) * 10) / 10;
  const visNote = vis < 0.5 ? "low visibility, " : "";
  return { score: rounded, note: `${visNote}${Math.round(vis * 100)}% joint visibility.` };
}

export interface LandmarkFrame {
  timestamp: number;
  landmarks: PoseLandmark[];
}

const VIEW_W = 400;
const VIEW_H = 800;
/** Maximum number of frames retained for playback (downsample long recordings). */
const MAX_MOTION_FRAMES = 240;

function toViewPoint(lm: PoseLandmark): { x: number; y: number } {
  return { x: lm.x * VIEW_W, y: lm.y * VIEW_H };
}

/** Convert recorded landmark frames into viewBox-space motion frames (downsampled). */
function buildMotionFrames(frames: LandmarkFrame[]): MotionFrame[] {
  if (frames.length === 0) return [];
  const stride = Math.max(1, Math.ceil(frames.length / MAX_MOTION_FRAMES));
  const sampled: LandmarkFrame[] = [];
  for (let i = 0; i < frames.length; i += stride) sampled.push(frames[i]);
  // Always keep the final frame so the animation ends at the real final pose.
  const last = frames[frames.length - 1];
  if (sampled[sampled.length - 1] !== last) sampled.push(last);

  const start = sampled[0]?.timestamp ?? 0;
  return sampled.map((f) => ({
    t: f.timestamp - start,
    points: f.landmarks.map((lm) => {
      const p = toViewPoint(lm);
      return { x: p.x, y: p.y, visible: lm.visibility >= 0.5 };
    }),
  }));
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

/**
 * Analyze joint movement speed across the recording to find regions that moved
 * slowly (i.e. where the body "needed attention"). Speed is measured in
 * viewBox units per millisecond for the joints each region depends on.
 */
function analyzeMotion(frames: LandmarkFrame[]): NonNullable<BodyMapAssessment["motion"]> {
  if (frames.length < 2) {
    const regionMotion: Record<string, RegionMotion> = {};
    for (const region of ANATOMY_REGIONS) {
      regionMotion[region.id] = {
        regionId: region.id,
        avgSpeed: 0,
        peakSpeed: 0,
        slowness: 0,
        note: "Insufficient motion data for this region.",
      };
    }
    return { frames: [], regionMotion, baselineSpeed: 0, durationMs: 0 };
  }

  const motionFrames = buildMotionFrames(frames);
  const durationMs = motionFrames[motionFrames.length - 1].t - motionFrames[0].t || 1;

  // Per-landmark speed samples across consecutive motion frames.
  const perLandmarkSpeeds: number[][] = Array.from({ length: 33 }, () => []);
  for (let i = 1; i < motionFrames.length; i++) {
    const prev = motionFrames[i - 1];
    const cur = motionFrames[i];
    const dt = Math.max(1, cur.t - prev.t);
    for (let j = 0; j < cur.points.length; j++) {
      const a = prev.points[j];
      const b = cur.points[j];
      if (!a || !b) continue;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      perLandmarkSpeeds[j]?.push(dist / dt);
    }
  }

  const allSpeeds = perLandmarkSpeeds.flat();
  const baselineSpeed = median(allSpeeds);

  const regionMotion: Record<string, RegionMotion> = {};
  for (const region of ANATOMY_REGIONS) {
    const rule = REGION_RULES[region.id];
    const indices = (rule?.landmarks ?? [])
      .map((name) => landmarkIndexForName(name))
      .filter((i) => i >= 0);

    const speeds = indices.flatMap((i) => perLandmarkSpeeds[i] ?? []);
    if (speeds.length === 0) {
      regionMotion[region.id] = {
        regionId: region.id,
        avgSpeed: 0,
        peakSpeed: 0,
        slowness: 0,
        note: "No motion captured for this region.",
      };
      continue;
    }

    const avgSpeed = speeds.reduce((a, b) => a + b, 0) / speeds.length;
    const peakSpeed = Math.max(...speeds);

    // slowness: 0 when moving at/above baseline, up to 100 when barely moving.
    let slowness = 0;
    if (baselineSpeed > 0) {
      const ratio = avgSpeed / baselineSpeed;
      slowness = Math.round(Math.max(0, Math.min(100, (1 - ratio) * 100)));
    }

    let note: string;
    if (slowness >= 60) {
      note = `Moved slowly (${avgSpeed.toFixed(1)} u/ms vs ${baselineSpeed.toFixed(1)} baseline). Worth reviewing.`;
    } else if (slowness >= 30) {
      note = `Slightly slower than the session baseline (${avgSpeed.toFixed(1)} u/ms).`;
    } else {
      note = `Moved at a normal pace (${avgSpeed.toFixed(1)} u/ms).`;
    }

    regionMotion[region.id] = {
      regionId: region.id,
      avgSpeed: Math.round(avgSpeed * 100) / 100,
      peakSpeed: Math.round(peakSpeed * 100) / 100,
      slowness,
      note,
    };
  }

  return { frames: motionFrames, regionMotion, baselineSpeed, durationMs };
}

// Lazy import to avoid a circular dependency at module load time.
function landmarkIndexForName(name: string): number {
  const entry = Object.entries(POSE_LANDMARK_NAMES).find(([, n]) => n === name);
  return entry ? Number(entry[0]) : -1;
}

export function analyzeBodyMap(
  landmarks: PoseLandmark[],
  metrics: AssessmentMetrics,
  type: AssessmentType,
  landmarkFrames?: LandmarkFrame[]
): BodyMapAssessment {
  const joints = extractJointCoordinates(landmarks);

  const regions: RegionAssessment[] = ANATOMY_REGIONS.map((region) => {
    const rule = REGION_RULES[region.id];
    if (!rule) {
      return {
        regionId: region.id,
        name: region.name,
        status: "unassessed",
        rating: "grey",
        score: null,
        note: "Region not mapped to any joints.",
      };
    }

    const { score, note } = computeRegionScore(region, joints, metrics, type);
    const status = STATUS_FOR_SCORE(score);
    const rating = RATING_FOR_STATUS[status];

    const extra = applyRegionContext(region.id, metrics, type);
    const combinedNote = extra ? `${note} ${extra}` : note;

    return {
      regionId: region.id,
      name: region.name,
      status,
      rating,
      score,
      note: combinedNote,
    };
  });

  const assessed = regions.filter((r) => r.status !== "unassessed");
  const summary = {
    totalAssessed: assessed.length,
    normal: regions.filter((r) => r.status === "normal").length,
    monitoring: regions.filter((r) => r.status === "monitor").length,
    attention: regions.filter((r) => r.status === "attention").length,
    critical: regions.filter((r) => r.status === "critical").length,
  };

  return {
    regions,
    joints,
    summary,
    motion: landmarkFrames ? analyzeMotion(landmarkFrames) : undefined,
  };
}

function applyRegionContext(
  regionId: string,
  metrics: AssessmentMetrics,
  type: AssessmentType
): string {
  const notes: string[] = [];
  if (type === "posture" && metrics.trunkInclination != null && regionId.includes("oblique")) {
    notes.push(`Trunk inclination ${metrics.trunkInclination.toFixed(1)}°.`);
  }
  if (type === "balance" && metrics.balanceLeftRightDifference != null && regionId.includes("foot")) {
    notes.push(`L/R balance difference ${Math.round(metrics.balanceLeftRightDifference * 100)}%.`);
  }
  return notes.join(" ");
}