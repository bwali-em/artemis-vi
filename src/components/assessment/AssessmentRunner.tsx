import { useCallback, useEffect, useRef, useState } from "react";
import { CameraView } from "../camera/CameraView";
import { CameraControls } from "../camera/CameraControls";
import { DetectionStatus } from "../camera/DetectionStatus";
import type { DetectionStatus as DetectionStatusType } from "../../types/health";
import { InstructionOverlay } from "./InstructionOverlay";
import { AssessmentSummary } from "./AssessmentSummary";
import type { PoseLandmark } from "../../types/pose";
import { calculateAngles } from "../../services/analysis/angleCalculator";
import { compareLeftRight } from "../../services/analysis/symmetryAnalyzer";
import { scoreSquat, scoreShoulderMobility, scoreBalance, scorePosture } from "../../services/analysis/assessmentScorer";
import { getProtocol } from "../../data/assessmentProtocols";
import type { AssessmentType, AssessmentMetrics } from "../../types/assessment";
import { LandmarkProcessor } from "../../services/mediapipe/landmarkProcessor";
import type { AssessmentRecord } from "../../types/assessment";
import type { AssessmentSummaryProps } from "./AssessmentSummary";
import { assessmentRepository } from "../../storage/assessmentRepository";
import { useGeminiLive } from "../../hooks/useGeminiLive";
import {
  createPoseSnapshot,
  evaluatePositioning,
  type PoseSnapshot,
} from "../../services/assessment/poseCoach";

type CoachPhase = "connecting" | "positioning" | "movement" | "waiting";

interface AssessmentRunnerProps {
  type: AssessmentType;
  onComplete: (record: AssessmentRecord) => void;
  onExit: () => void;
}

interface MovementStep {
  instruction: string;
  status: string;
  durationMs: number;
}

const MOVEMENT_STEPS: MovementStep[] = [
  {
    instruction: "Take two steps backward.",
    status: "Stepping backward",
    durationMs: 4000,
  },
  {
    instruction: "Now take two steps forward.",
    status: "Stepping forward",
    durationMs: 4000,
  },
];

const TOTAL_STEPS = MOVEMENT_STEPS.length + 2;
const ALIGNED_HOLD_MS = 1500;

const API_KEY: string = import.meta.env.VITE_GEMINI_API_KEY || import.meta.env.GEMINI_KEY || "";
const LIVE_MODEL: string | undefined = import.meta.env.VITE_GEMINI_LIVE_MODEL || undefined;

const EMPTY_SNAPSHOT: PoseSnapshot = {
  detected: false,
  visibility: 0,
  centerX: null,
  bodyHeight: null,
  shoulderWidth: null,
};

export function AssessmentRunner({ type, onComplete, onExit }: AssessmentRunnerProps) {
  const protocol = getProtocol(type);

  const [phase, setPhase] = useState<CoachPhase>("connecting");
  const [instruction, setInstruction] = useState("Connecting to your AI coach...");
  const [statusText, setStatusText] = useState("Connecting");
  const [coachDisplay, setCoachDisplay] = useState<string | undefined>(undefined);
  const [stepIndex, setStepIndex] = useState(0);
  const [visibility, setVisibility] = useState<DetectionStatusType>({
    detected: false,
    confidence: 0,
    visibility: 0,
    missingLandmarks: [],
  });
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [paused, setPaused] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [processingStage, setProcessingStage] = useState<AssessmentSummaryProps["stage"]>("analyzing");
  const [processingProgress, setProcessingProgress] = useState(0);

  const angleHistoryRef = useRef<Array<{ timestamp: number; angles: Record<string, number | null> }>>([]);
  const landmarksHistoryRef = useRef<Array<{ timestamp: number; landmarks: PoseLandmark[] }>>([]);
  const startTimeRef = useRef<number>(0);
  const latestSnapshotRef = useRef<PoseSnapshot>(EMPTY_SNAPSHOT);
  const lastCueIdRef = useRef<string | null>(null);
  const alignedSinceRef = useRef<number | null>(null);
  const startedRef = useRef(false);
  const spokenStepRef = useRef(-1);
  const waitSpokenRef = useRef(false);
  const processingStartedRef = useRef(false);

  const {
    isConnected,
    error: aiError,
    initialize,
    say,
    setPlaybackPaused,
    resumeAudio,
    disconnect,
  } = useGeminiLive({ apiKey: API_KEY, model: LIVE_MODEL });

  const sayRef = useRef(say);
  sayRef.current = say;

  const aiSay = useCallback((text: string) => {
    if (!text) return;
    sayRef.current(text);
  }, []);

  const runProcessing = useCallback(async () => {
    const stages: AssessmentSummaryProps["stage"][] = ["analyzing", "evaluating", "comparing", "generating"];
    let progress = 10;

    for (const stage of stages) {
      setProcessingStage(stage);
      await new Promise((resolve) => setTimeout(resolve, 700));
      progress += 25;
      setProcessingProgress(Math.min(progress, 90));
    }

    setProcessingProgress(100);
    await new Promise((resolve) => setTimeout(resolve, 400));

    const metrics = computeMetrics();
    const { score } = scoreResult(metrics);
    const record: AssessmentRecord = {
      id: `artemis_${Date.now()}`,
      type,
      name: protocol.name,
      date: Date.now(),
      duration: startTimeRef.current > 0 ? performance.now() - startTimeRef.current : 0,
      metrics,
      score,
      findings: generateFindings(metrics, type),
      recommendations: generateRecommendations(metrics, score),
      status: "completed",
    };

    try {
      await assessmentRepository.save(record);
    } catch (err) {
      console.warn("Failed to persist assessment:", err);
    }

    setProcessing(false);
    onComplete(record);
  }, [onComplete, protocol.name, type]);

  const computeMetrics = (): AssessmentMetrics => {
    const angles = angleHistoryRef.current.map((h) => h.angles);
    const lkValues = angles.map((a) => a.leftKnee).filter((v): v is number => v !== null);
    const hipValues = angles.map((a) => a.leftHip).filter((v): v is number => v !== null);

    const avgKnee = lkValues.length ? lkValues.reduce((a, b) => a + b, 0) / lkValues.length : null;
    const avgHip = hipValues.length ? hipValues.reduce((a, b) => a + b, 0) / hipValues.length : null;

    const kneeSym = compareLeftRight(avgKnee ?? null, avgKnee ?? null);

    const detectionQuality =
      landmarksHistoryRef.current.length > 0
        ? (landmarksHistoryRef.current.filter((h) => h.landmarks.length > 0).length /
            landmarksHistoryRef.current.length) *
          100
        : 0;

    const duration = startTimeRef.current > 0 ? performance.now() - startTimeRef.current : 0;

    return {
      repetitionCount: 0,
      averageKneeFlexion: avgKnee ?? undefined,
      averageHipFlexion: avgHip ?? undefined,
      squatDepth: lkValues.length ? Math.round(Math.min(...lkValues)) : undefined,
      leftRightSymmetry: kneeSym.symmetryScore ?? undefined,
      movementDuration: duration,
      repetitionConsistency: undefined,
      detectionQuality,
    };
  };

  const scoreResult = (metrics: AssessmentMetrics) => {
    switch (type) {
      case "squat": return scoreSquat(metrics);
      case "shoulder_mobility": return scoreShoulderMobility(metrics);
      case "balance": return scoreBalance(metrics);
      case "posture": return scorePosture(metrics);
      default: return scoreSquat(metrics);
    }
  };

  const generateFindings = (metrics: AssessmentMetrics, t: AssessmentType): string[] => {
    const findings: string[] = [];
    if (metrics.detectionQuality != null) {
      findings.push(`Pose detection quality: ${Math.round(metrics.detectionQuality)}% of frames.`);
    }
    if (metrics.leftRightSymmetry != null) {
      findings.push(`Left-right movement symmetry: ${Math.round(metrics.leftRightSymmetry)}%.`);
    }
    if (metrics.movementDuration != null && metrics.movementDuration > 0) {
      findings.push(`Total movement duration: ${((metrics.movementDuration / 1000) % 60).toFixed(1)} seconds.`);
    }
    if (t === "posture" && metrics.averageHipFlexion != null) {
      findings.push(`Average hip flexion: ${Math.round(metrics.averageHipFlexion)} degrees.`);
    }
    if (findings.length === 0) findings.push("Assessment completed with limited measurement data.");
    return findings;
  };

  const generateRecommendations = (metrics: AssessmentMetrics, score: number): string[] => {
    const recs: string[] = [];
    if (score < 70) {
      recs.push("Repeat the assessment with improved camera positioning for clearer landmark detection.");
    }
    if (metrics.leftRightSymmetry != null && metrics.leftRightSymmetry < 80) {
      recs.push("Discuss persistent movement asymmetry with the mission medical officer.");
    }
    if (metrics.detectionQuality != null && metrics.detectionQuality < 70) {
      recs.push("Ensure sufficient lighting and full body visibility before repeating.");
    }
    recs.push("Repeat the assessment later to establish a reliable performance trend.");
    return recs;
  };

  const handlePose = useCallback(
    ({ landmarks, visibility: vis }: { landmarks: PoseLandmark[]; visibility: DetectionStatusType }) => {
      if (paused) return;

      const now = performance.now();
      if (startTimeRef.current === 0) startTimeRef.current = now;

      const processed = LandmarkProcessor.process(landmarks);
      const get = (name: string): PoseLandmark | null => processed.byName[name] ?? null;

      const angleResults = calculateAngles({
        leftHip: get("leftHip"),
        rightHip: get("rightHip"),
        leftKnee: get("leftKnee"),
        rightKnee: get("rightKnee"),
        leftAnkle: get("leftAnkle"),
        rightAnkle: get("rightAnkle"),
        leftShoulder: get("leftShoulder"),
        rightShoulder: get("rightShoulder"),
        leftElbow: get("leftElbow"),
        rightElbow: get("rightElbow"),
        leftWrist: get("leftWrist"),
        rightWrist: get("rightWrist"),
      });

      const angles: Record<string, number | null> = {};
      for (const key of Object.keys(angleResults)) {
        angles[key] = angleResults[key as keyof typeof angleResults].angle ?? null;
      }

      angleHistoryRef.current.push({ timestamp: now, angles });
      landmarksHistoryRef.current.push({ timestamp: now, landmarks });

      latestSnapshotRef.current = createPoseSnapshot(landmarks, vis.visibility, vis.detected);
      setVisibility(vis);
    },
    [paused]
  );

  useEffect(() => {
    void initialize({ type, phase: "connecting", repCount: 0, targetReps: 3, feedback: "" });
    return () => {
      void disconnect();
    };
  }, [initialize, disconnect, type]);

  useEffect(() => {
    setPlaybackPaused(paused);
    if (paused) {
      alignedSinceRef.current = null;
    }
  }, [paused, setPlaybackPaused]);

  useEffect(() => {
    const resume = () => {
      void resumeAudio();
    };
    window.addEventListener("pointerdown", resume);
    window.addEventListener("keydown", resume);
    return () => {
      window.removeEventListener("pointerdown", resume);
      window.removeEventListener("keydown", resume);
    };
  }, [resumeAudio]);

  useEffect(() => {
    if (!isConnected || startedRef.current) return;

    startedRef.current = true;
    setPhase("positioning");
    setInstruction("Position yourself so I can see your whole body.");
    setStatusText("Positioning");
    aiSay(`Welcome. Let's begin the ${protocol.name}. Position yourself so I can see your whole body.`);
  }, [isConnected, aiSay, protocol.name]);

  useEffect(() => {
    if (phase !== "positioning" || paused) return;

    let cancelled = false;

    const tick = () => {
      if (cancelled) return;

      const cue = evaluatePositioning(latestSnapshotRef.current);
      setCoachDisplay(cue.display);

      if (cue.id !== lastCueIdRef.current) {
        lastCueIdRef.current = cue.id;
        aiSay(cue.speech);
      }

      if (cue.aligned) {
        if (alignedSinceRef.current === null) {
          alignedSinceRef.current = performance.now();
        } else if (performance.now() - alignedSinceRef.current >= ALIGNED_HOLD_MS) {
          setPhase("movement");
        }
      } else {
        alignedSinceRef.current = null;
      }
    };

    tick();
    const interval = window.setInterval(tick, 700);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [phase, paused, aiSay]);

  useEffect(() => {
    if (phase !== "movement" || paused) return;

    const step = MOVEMENT_STEPS[stepIndex];
    if (!step) {
      setPhase("waiting");
      return;
    }

    setInstruction(step.instruction);
    setStatusText(step.status);
    setCoachDisplay(undefined);

    if (spokenStepRef.current !== stepIndex) {
      spokenStepRef.current = stepIndex;
      aiSay(step.instruction);
    }

    const timer = window.setTimeout(() => {
      if (stepIndex + 1 < MOVEMENT_STEPS.length) {
        setStepIndex(stepIndex + 1);
      } else {
        setPhase("waiting");
      }
    }, step.durationMs);

    return () => window.clearTimeout(timer);
  }, [phase, paused, stepIndex, aiSay]);

  useEffect(() => {
    if (phase !== "waiting" || paused) return;

    const message = "Please wait while I analyze your movement.";
    setInstruction(message);
    setStatusText("Please wait");
    setCoachDisplay(undefined);

    if (!waitSpokenRef.current) {
      waitSpokenRef.current = true;
      aiSay(message);
    }

    const timer = window.setTimeout(() => setProcessing(true), 3000);
    return () => window.clearTimeout(timer);
  }, [phase, paused, aiSay]);

  useEffect(() => {
    if (!processing || processingStartedRef.current) return;
    processingStartedRef.current = true;
    void disconnect();
    void runProcessing();
  }, [processing, disconnect, runProcessing]);

  if (processing) {
    return (
      <div className="fixed inset-0 z-50 bg-ARTEMIS-navy flex flex-col items-center justify-center">
        <AssessmentSummary stage={processingStage} progress={processingProgress} />
      </div>
    );
  }

  const stepNum =
    phase === "positioning" ? 1 : phase === "movement" ? stepIndex + 2 : TOTAL_STEPS;
  const progress = ((stepNum - 1) / TOTAL_STEPS) * 100;

  const handleRetryVoice = () => {
    void initialize({ type, phase, repCount: 0, targetReps: 3, feedback: "" });
  };

  const handleStartWithoutVoice = () => {
    if (startedRef.current) return;
    startedRef.current = true;
    setPhase("positioning");
    setInstruction("Position yourself so I can see your whole body.");
    setStatusText("Positioning");
  };

  return (
    <div className="relative flex flex-col h-full bg-ARTEMIS-navy">
      <CameraView
        onPoseDetected={handlePose}
        onError={setCameraError}
        width={1280}
        height={720}
      />

      <div className="absolute inset-0 z-10 pointer-events-none flex flex-col justify-between p-6">
        <div className="flex justify-between items-start">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-ARTEMIS-cyan" />
            <span className="text-xs font-mono text-ARTEMIS-cyan">ARTEMIS TELEMETRY</span>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-ARTEMIS-navy/80 backdrop-blur-sm border border-ARTEMIS-cyan/30">
              <div
                className={`w-2 h-2 rounded-full transition-colors ${
                  isConnected ? "bg-ARTEMIS-cyan animate-pulse" : "bg-ARTEMIS-amber"
                }`}
              />
              <span className="text-xs font-mono text-ARTEMIS-cyan">
                {isConnected ? "AI COACH SPEAKING" : "AI COACH CONNECTING"}
              </span>
              {!isConnected && aiError && (
                <button
                  onClick={handleRetryVoice}
                  className="ml-2 px-2 py-1 rounded text-xs font-mono bg-ARTEMIS-amber/20 text-ARTEMIS-amber"
                >
                  RETRY
                </button>
              )}
            </div>

            <CameraControls
              paused={paused}
              onPause={() => setPaused(true)}
              onResume={() => setPaused(false)}
              onExit={onExit}
            />
          </div>
        </div>

        <div className="flex justify-between items-end">
          <DetectionStatus status={visibility} />
        </div>
      </div>

      <div className="absolute inset-0 z-20 pointer-events-none">
        <InstructionOverlay
          assessmentName={protocol.name}
          instruction={instruction}
          step={stepNum}
          totalSteps={TOTAL_STEPS}
          status={statusText}
          progress={progress}
          feedback={coachDisplay}
        />
      </div>

      {aiError && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-40 max-w-md rounded-lg border border-ARTEMIS-red/40 bg-red-950/80 px-4 py-3 text-center">
          <p className="text-xs text-red-100">
            AI coach unavailable: {aiError}. Check the Gemini API key and connection.
          </p>
          <button
            onClick={handleStartWithoutVoice}
            className="mt-2 min-h-[2.75rem] px-4 py-2 text-xs font-mono text-ARTEMIS-cyan underline"
          >
            CONTINUE WITHOUT VOICE
          </button>
        </div>
      )}

      {cameraError && (
        <div className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-red-900/90 backdrop-blur text-center p-6">
          <div className="text-ARTEMIS-red text-xl font-bold mb-2">Camera Unavailable</div>
          <p className="text-red-100 text-sm mb-4">{cameraError}</p>
          <button
            onClick={() => setCameraError(null)}
            className="min-h-[2.75rem] min-w-[2.75rem] px-4 py-2 text-sm text-ARTEMIS-cyan active:text-ARTEMIS-cyan/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 underline"
          >
            Retry Camera
          </button>
        </div>
      )}
    </div>
  );
}