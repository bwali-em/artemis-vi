export type RegionStatus = "normal" | "monitor" | "attention" | "critical" | "unassessed";

export type HealthRating = "green" | "yellow" | "orange" | "red" | "grey";

export interface AnatomyRegion {
  id: string;
  name: string;
  category: "head_neck" | "torso" | "arm" | "hand" | "pelvis" | "leg" | "foot";
  side?: "left" | "right" | "center";
  /** SVG path data for the region, drawn in the 400x800 body viewBox. */
  path: string;
}

export interface RegionAssessment {
  regionId: string;
  name: string;
  status: RegionStatus;
  rating: HealthRating;
  /** Numeric 0-100 health score for this region, when measurable. */
  score: number | null;
  /** Human readable reason for the rating. */
  note: string;
}

export interface JointCoordinate {
  /** MediaPipe landmark index (e.g. 25 = left knee). */
  index: number;
  name: string;
  x: number;
  y: number;
  z: number;
  visibility: number;
}

export type BodyJointMap = Record<string, JointCoordinate>;

/** A single sampled pose frame used for playback / motion simulation. */
export interface MotionFrame {
  /** Relative time in milliseconds from the start of the recording. */
  t: number;
  /** Landmark positions normalized to the 400x800 body viewBox. */
  points: Array<{ x: number; y: number; visible: boolean }>;
}

export interface RegionMotion {
  regionId: string;
  /** Average movement speed of the joints in this region (viewBox units / ms). */
  avgSpeed: number;
  /** Peak movement speed observed in this region. */
  peakSpeed: number;
  /** 0-100: higher means the region moved more slowly than the session norm. */
  slowness: number;
  /** Human readable observation about the region's movement. */
  note: string;
}

export interface BodyMapAssessment {
  regions: RegionAssessment[];
  joints: BodyJointMap;
  /** Overall summary for the screen. */
  summary: {
    totalAssessed: number;
    normal: number;
    monitoring: number;
    attention: number;
    critical: number;
  };
  /** Recorded motion frames + per-region speed analysis, for simulation. */
  motion?: {
    frames: MotionFrame[];
    regionMotion: Record<string, RegionMotion>;
    /** Median joint speed across the whole session (the "normal" baseline). */
    baselineSpeed: number;
    durationMs: number;
  };
}