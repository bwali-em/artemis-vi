import type { PoseLandmark } from "../../types/pose";

export interface PoseSnapshot {
  detected: boolean;
  visibility: number;
  centerX: number | null;
  bodyHeight: number | null;
  shoulderWidth: number | null;
}

export interface CoachingCue {
  id: string;
  speech: string;
  display: string;
  aligned: boolean;
}

export interface PositioningThresholds {
  centerTolerance: number;
  minHeight: number;
  maxHeight: number;
  minVisibility: number;
}

export const DEFAULT_POSITIONING_THRESHOLDS: PositioningThresholds = {
  centerTolerance: 0.08,
  minHeight: 0.45,
  maxHeight: 0.92,
  minVisibility: 0.4,
};

const at = (landmarks: PoseLandmark[], index: number): PoseLandmark | null =>
  landmarks[index] ?? null;

const avgX = (points: Array<PoseLandmark | null>): number | null => {
  const xs = points.filter((p): p is PoseLandmark => p !== null).map((p) => p.x);
  if (xs.length === 0) return null;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
};

export function createPoseSnapshot(
  landmarks: PoseLandmark[],
  visibility: number,
  detected: boolean
): PoseSnapshot {
  const leftShoulder = at(landmarks, 11);
  const rightShoulder = at(landmarks, 12);
  const leftHip = at(landmarks, 23);
  const rightHip = at(landmarks, 24);
  const leftAnkle = at(landmarks, 27);
  const rightAnkle = at(landmarks, 28);
  const nose = at(landmarks, 0);
  const leftEar = at(landmarks, 7);
  const rightEar = at(landmarks, 8);

  const centerX = avgX([leftShoulder, rightShoulder, leftHip, rightHip]);

  const topY = Math.min(
    ...[nose?.y, leftEar?.y, rightEar?.y, leftShoulder?.y, rightShoulder?.y].filter(
      (v): v is number => typeof v === "number"
    )
  );
  const bottomY = Math.max(
    ...[leftAnkle?.y, rightAnkle?.y, leftHip?.y, rightHip?.y].filter(
      (v): v is number => typeof v === "number"
    )
  );

  const bodyHeight =
    Number.isFinite(topY) && Number.isFinite(bottomY) ? Math.abs(bottomY - topY) : null;

  const shoulderWidth =
    leftShoulder && rightShoulder ? Math.abs(leftShoulder.x - rightShoulder.x) : null;

  return {
    detected,
    visibility,
    centerX,
    bodyHeight,
    shoulderWidth,
  };
}

export function evaluatePositioning(
  snapshot: PoseSnapshot,
  thresholds: PositioningThresholds = DEFAULT_POSITIONING_THRESHOLDS
): CoachingCue {
  if (!snapshot.detected || snapshot.visibility < thresholds.minVisibility) {
    return {
      id: "searching",
      speech: "I'm having trouble seeing you. Please step into the camera view and make sure your whole body is visible.",
      display: "Step into view so I can see your whole body",
      aligned: false,
    };
  }

  if (snapshot.centerX !== null) {
    if (snapshot.centerX < 0.5 - thresholds.centerTolerance) {
      return {
        id: "move-right",
        speech: "Move a little to your right.",
        display: "Move a little to your right",
        aligned: false,
      };
    }
    if (snapshot.centerX > 0.5 + thresholds.centerTolerance) {
      return {
        id: "move-left",
        speech: "Move a little to your left.",
        display: "Move a little to your left",
        aligned: false,
      };
    }
  }

  if (snapshot.bodyHeight !== null) {
    if (snapshot.bodyHeight < thresholds.minHeight) {
      return {
        id: "step-closer",
        speech: "Step a little closer to the camera.",
        display: "Step a little closer to the camera",
        aligned: false,
      };
    }
    if (snapshot.bodyHeight > thresholds.maxHeight) {
      return {
        id: "step-back",
        speech: "Step back a little so I can see your full body.",
        display: "Step back a little",
        aligned: false,
      };
    }
  }

  return {
    id: "aligned",
    speech: "Perfect. Hold that position.",
    display: "Position confirmed",
    aligned: true,
  };
}