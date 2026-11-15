import { useCallback, useEffect, useRef, useState } from "react";
import { CameraView } from "../camera/CameraView";
import { CameraControls } from "../camera/CameraControls";
import { DetectionStatus } from "../camera/DetectionStatus";
import type { DetectionStatus as DetectionStatusType } from "../../types/health";
import { InstructionOverlay } from "./InstructionOverlay";
import type { PoseLandmark } from "../../types/pose";
import { calculateAngles } from "../../services/analysis/angleCalculator";
import { compareLeftRight } from "../../services/analysis/symmetryAnalyzer";
import { scoreSquat, scoreShoulderMobility, scoreBalance, scorePosture } from "../../services/analysis/assessmentScorer";
import { getProtocol } from "../../data/assessmentProtocols";
import type { AssessmentType, AssessmentMetrics } from "../../types/assessment";
import { LandmarkProcessor } from "../../services/mediapipe/landmarkProcessor";
import type { AssessmentRecord } from "../../types/assessment";
import { assessmentRepository } from "../../storage/assessmentRepository";
import { useGeminiLive } from "../../hooks/useGeminiLive";
import {
  createPoseSnapshot,
  evaluatePositioning,
  type PoseSnapshot,
} from "../../services/assessment/poseCoach";
import { analyzeBodyMap } from "../../services/analysis/bodyMapAnalyzer";
import type { BodyMapAssessment } from "../../types/bodyMap";
import { BodyMapPage } from "../../pages/BodyMapPage";

type CoachPhase =
  | "connecting"
  | "positioning"
  | "movement"
  | "question"
  | "analyzing"
  | "complete"
  | "error";

interface ConversationalAssessmentRunnerProps {
  type: AssessmentType;
  onComplete: (record: AssessmentRecord) => void;
  onExit: () => void;
}

const EMPTY_SNAPSHOT: PoseSnapshot = {
  detected: false,
  visibility: 0,
  centerX: null,
  bodyHeight: null,
  shoulderWidth: null,
};

const API_KEY: string = import.meta.env.VITE_GEMINI_API_KEY || import.meta.env.GEMINI_KEY || "";
const LIVE_MODEL: string | undefined = import.meta.env.VITE_GEMINI_LIVE_MODEL || undefined;
const USE_DEMO_MODE = !API_KEY;

/** How long each instruction is held on screen / spoken before moving on. */
const INSTRUCTION_HOLD_MS = 12000;
/** How long the AI waits for the astronaut to respond to a question. */
const QUESTION_HOLD_MS = 14000;

interface MovementStep {
  instruction: string;
  /** A follow-up question the AI asks after the movement. */
  question: string;
}

interface AssessmentScript {
  welcome: string;
  positioning: string;
  movements: MovementStep[];
  analyzing: string;
  complete: string;
}

/**
 * Slower, more conversational movement scripts. Each movement is followed by a
 * check-in question so the AI can gather more information before moving on.
 */
const ASSESSMENT_SCRIPTS: Record<AssessmentType, AssessmentScript> = {
  squat: {
    welcome:
      "Welcome. I'm ARTEMIS, your movement AI coach. We'll take this one movement at a time, slowly. Let's begin your squat assessment.",
    positioning:
      "Stand facing the camera with your feet shoulder-width apart. Make sure I can see your full body from head to toe. Let me know when you're ready.",
    movements: [
      {
        instruction:
          "Slowly bend your knees and lower your hips as if sitting on a chair. Keep your chest up and take your time.",
        question:
          "How does that feel? Do you notice any discomfort in either knee or hip, left versus right?",
      },
      {
        instruction:
          "Now hold the bottom position for a few seconds. I'm checking your knee and hip angles while you hold.",
        question:
          "Are you able to hold this comfortably, or does one side feel tighter than the other?",
      },
      {
        instruction:
          "Slowly return to standing, then perform two more controlled repetitions at your own pace.",
        question:
          "Any pain, pinching, or instability during those repetitions? Which side, if so?",
      },
    ],
    analyzing: "Please wait while I analyze your squat technique, symmetry and joint angles.",
    complete:
      "Your squat assessment is complete. I've mapped the regions of your body that may need attention.",
  },
  shoulder_mobility: {
    welcome:
      "Welcome. I'm ARTEMIS, your movement AI coach. We'll go slowly and check in between movements. Let's assess your shoulder mobility.",
    positioning:
      "Stand facing the camera with your arms relaxed at your sides. Ensure your shoulders and elbows are visible. Tell me when you're ready.",
    movements: [
      {
        instruction:
          "Extend both arms straight out to your sides at shoulder height, and hold them there.",
        question:
          "Does either shoulder feel stiff or painful at this height? Left or right?",
      },
      {
        instruction:
          "Now slowly raise both arms overhead as high as you can comfortably go. Take your time.",
        question:
          "How high did you get, and did one arm lag behind the other?",
      },
      {
        instruction:
          "Slowly lower your arms back down to your sides, then repeat the raise once more.",
        question:
          "Any pinching, clicking, or sharp pain during that final raise?",
      },
    ],
    analyzing: "Please wait while I analyze your shoulder range of motion and symmetry.",
    complete:
      "Your shoulder mobility assessment is complete. I've mapped the regions that may need attention.",
  },
  balance: {
    welcome:
      "Welcome. I'm ARTEMIS, your movement AI coach. We'll move slowly and stay safe. Let's test your balance and stability.",
    positioning:
      "Stand facing the camera with your feet together, near a wall or rail if you need support. Make sure your full body is visible.",
    movements: [
      {
        instruction:
          "Shift your weight to your left foot and slowly lift your right foot off the ground. Hold for a few seconds.",
        question:
          "How steady did that feel? Did you need to adjust or put the foot down?",
      },
      {
        instruction:
          "Now lower your right foot and slowly lift your left foot instead. Hold steady.",
        question:
          "Did this side feel different from the first? More wobble or more control?",
      },
      {
        instruction:
          "Lower your foot and stand tall with both feet down. Take a slow, deep breath.",
        question:
          "Any dizziness, light-headedness or unsteadiness after those holds?",
      },
    ],
    analyzing: "Please wait while I analyze your balance control and postural sway.",
    complete:
      "Your balance assessment is complete. I've mapped the regions that may need attention.",
  },
  posture: {
    welcome:
      "Welcome. I'm ARTEMIS, your movement AI coach. We'll hold each position calmly. Let's evaluate your posture.",
    positioning:
      "Stand facing the camera in a relaxed, natural stance, arms at your sides. Full body visible. Let me know when you're set.",
    movements: [
      {
        instruction:
          "Hold this relaxed position while I analyze your shoulder and hip alignment. Stay still and breathe normally.",
        question:
          "Are you standing naturally, or are you having to hold yourself in an unusual way to stay balanced?",
      },
      {
        instruction:
          "Now roll your shoulders back gently and stand as tall as you can, then relax again.",
        question:
          "Did standing taller feel easier or harder than your resting stance?",
      },
    ],
    analyzing: "Please wait while I analyze your postural alignment and symmetry.",
    complete:
      "Your posture assessment is complete. I've mapped the regions that may need attention.",
  },
  full_body: {
    welcome:
      "Welcome. I'm ARTEMIS, your movement AI coach. This is a comprehensive assessment. We'll go one movement at a time and check in after each. Let's begin.",
    positioning:
      "Stand facing the camera with your full body visible. We'll go through several movement tests slowly.",
    movements: [
      {
        instruction:
          "First, turn to your side so I can see your profile, and perform one controlled squat.",
        question:
          "How did that squat feel on each leg? Any difference between left and right?",
      },
      {
        instruction:
          "Now face the camera again and raise both arms overhead for shoulder mobility.",
        question:
          "Did both arms reach comfortably overhead, or was one side more limited?",
      },
      {
        instruction:
          "Finally, balance on your right foot for a few seconds, then switch to your left foot.",
        question:
          "Which side felt more stable? Any wobbling, pain or dizziness?",
      },
    ],
    analyzing: "Please wait while I analyze your full body movement patterns.",
    complete:
      "Your full body assessment is complete. I've mapped the regions that may need attention.",
  },
};

export function ConversationalAssessmentRunner({ type, onComplete, onExit }: ConversationalAssessmentRunnerProps) {
  const protocol = getProtocol(type);
  const script = ASSESSMENT_SCRIPTS[type];

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

  const [bodyMap, setBodyMap] = useState<BodyMapAssessment | null>(null);
  const [completedRecord, setCompletedRecord] = useState<AssessmentRecord | null>(null);

  const angleHistoryRef = useRef<Array<{ timestamp: number; angles: Record<string, number | null> }>>([]);
  const landmarksHistoryRef = useRef<Array<{ timestamp: number; landmarks: PoseLandmark[] }>>([]);
  const latestLandmarksRef = useRef<PoseLandmark[]>([]);
  const startTimeRef = useRef<number>(0);
  const latestSnapshotRef = useRef<PoseSnapshot>(EMPTY_SNAPSHOT);
  const lastCueIdRef = useRef<string | null>(null);
  const alignedSinceRef = useRef<number | null>(null);
  const startedRef = useRef(false);
  const spokenStepRef = useRef(-1);
  const questionSpokenRef = useRef(-1);
  const waitSpokenRef = useRef(false);
  const processingStartedRef = useRef(false);
  const positioningDoneRef = useRef(false);

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
    if (USE_DEMO_MODE) {
      window.speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(text);
      utter.rate = 0.92;
      utter.pitch = 1;
      window.speechSynthesis.speak(utter);
    } else {
      sayRef.current(text);
    }
  }, []);

  const computeMetrics = useCallback((): AssessmentMetrics => {
    const angles = angleHistoryRef.current.map((h) => h.angles);
    const lkValues = angles.map((a) => a.leftKnee).filter((v): v is number => v !== null);
    const hkValues = angles.map((a) => a.leftHip).filter((v): v is number => v !== null);
    const lhkValues = angles.map((a) => a.leftHip).filter((v): v is number => v !== null);
    const rhkValues = angles.map((a) => a.rightHip).filter((v): v is number => v !== null);

    const avgKnee = lkValues.length ? lkValues.reduce((a, b) => a + b, 0) / lkValues.length : null;
    const avgHip = hkValues.length ? hkValues.reduce((a, b) => a + b, 0) / hkValues.length : null;
    const leftHipAvg = lhkValues.length ? lhkValues.reduce((a, b) => a + b, 0) / lhkValues.length : null;
    const rightHipAvg = rhkValues.length ? rhkValues.reduce((a, b) => a + b, 0) / rhkValues.length : null;

    const kneeSym = compareLeftRight(avgKnee ?? null, avgKnee ?? null);
    const hipSym = leftHipAvg !== null && rightHipAvg !== null ? compareLeftRight(leftHipAvg, rightHipAvg) : { symmetryScore: null };

    const detectionQuality =
      landmarksHistoryRef.current.length > 0
        ? (landmarksHistoryRef.current.filter((h) => h.landmarks.length > 0).length /
            landmarksHistoryRef.current.length) *
          100
        : 0;

    const duration = startTimeRef.current > 0 ? performance.now() - startTimeRef.current : 0;

    return {
      repetitionCount: script.movements.length,
      averageKneeFlexion: avgKnee ?? undefined,
      averageHipFlexion: avgHip ?? undefined,
      squatDepth: lkValues.length ? Math.round(Math.min(...lkValues)) : undefined,
      leftRightSymmetry: kneeSym.symmetryScore ?? hipSym.symmetryScore ?? undefined,
      movementDuration: duration,
      repetitionConsistency: undefined,
      detectionQuality,
      maxShoulderElevation: undefined,
      shoulderRangeDifference: undefined,
      shoulderMovementConsistency: undefined,
      shoulderCompletionRate: undefined,
      trunkSway: undefined,
      hipDisplacement: undefined,
      balanceDuration: undefined,
      balanceLeftRightDifference: undefined,
      shoulderAlignment: undefined,
      hipAlignment: undefined,
      trunkInclination: undefined,
      postureLeftRightAsymmetry: undefined,
    };
  }, [script.movements.length]);

  const scoreResult = (metrics: AssessmentMetrics) => {
    switch (type) {
      case "squat": return scoreSquat(metrics);
      case "shoulder_mobility": return scoreShoulderMobility(metrics);
      case "balance": return scoreBalance(metrics);
      case "posture": return scorePosture(metrics);
      default: return scoreSquat(metrics);
    }
  };

  const generateFindings = (metrics: AssessmentMetrics, _t: AssessmentType): string[] => {
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
    if (metrics.squatDepth != null) {
      findings.push(`Minimum knee angle (squat depth): ${metrics.squatDepth} degrees.`);
    }
    if (findings.length === 0) findings.push("Assessment completed with limited measurement data.");
    return findings;
  };

  const generateRecommendations = (metrics: AssessmentMetrics, score: number): string[] => {
    const recs: string[] = [];
    if (score < 70) {
      recs.push("Consider repeating the assessment with improved camera positioning for clearer landmark detection.");
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

  const runProcessing = useCallback(async () => {
    setStatusText("Analyzing");

    const metrics = computeMetrics();
    const { score } = scoreResult(metrics);

    // Build the anatomical body map from the latest MediaPipe joint coordinates,
    // and the motion analysis from the full recorded joint-movement frames.
    const map = analyzeBodyMap(latestLandmarksRef.current, metrics, type, landmarksHistoryRef.current);
    setBodyMap(map);

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
      bodyMap: map,
    };

    try {
      await assessmentRepository.save(record);
    } catch (err) {
      console.warn("Failed to persist assessment:", err);
    }

    setCompletedRecord(record);
    setPhase("complete");
  }, [computeMetrics, protocol.name, type]);

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
      latestLandmarksRef.current = landmarks;

      latestSnapshotRef.current = createPoseSnapshot(landmarks, vis.visibility, vis.detected);
      setVisibility(vis);
    },
    [paused]
  );

  useEffect(() => {
    if (USE_DEMO_MODE) {
      startedRef.current = true;
      setPhase("positioning");
      setInstruction(script.positioning);
      setStatusText("Positioning");
      aiSay(script.welcome);
      setTimeout(() => aiSay(script.positioning), 2200);
      return;
    }
    void initialize({ type, phase: "connecting", repCount: 0, targetReps: script.movements.length, feedback: "" });
    return () => {
      void disconnect();
    };
  }, [initialize, disconnect, type, aiSay, script.welcome, script.positioning, script.movements.length]);

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
    if (USE_DEMO_MODE) return;
    if (!isConnected || startedRef.current) return;

    startedRef.current = true;
    setPhase("positioning");
    setInstruction(script.positioning);
    setStatusText("Positioning");
    aiSay(script.welcome);
    setTimeout(() => aiSay(script.positioning), 2200);
  }, [isConnected, aiSay, script.welcome, script.positioning]);

  useEffect(() => {
    if (phase !== "positioning" || paused) return;

    let cancelled = false;
    const ALIGNED_HOLD_MS = 2200;

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
        } else if (performance.now() - alignedSinceRef.current >= ALIGNED_HOLD_MS && !positioningDoneRef.current) {
          positioningDoneRef.current = true;
          setPhase("movement");
          setStepIndex(0);
        }
      } else {
        alignedSinceRef.current = null;
      }
    };

    tick();
    const interval = window.setInterval(tick, 900);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [phase, paused, aiSay]);

  // Movement phase: present the instruction, hold it, then ask the follow-up question.
  useEffect(() => {
    if (phase !== "movement" || paused) return;

    const step = script.movements[stepIndex];
    if (!step) {
      setPhase("analyzing");
      return;
    }

    setInstruction(step.instruction);
    setStatusText(`Movement ${stepIndex + 1} of ${script.movements.length}`);
    setCoachDisplay(undefined);

    if (spokenStepRef.current !== stepIndex) {
      spokenStepRef.current = stepIndex;
      aiSay(step.instruction);
    }

    const timer = window.setTimeout(() => {
      setPhase("question");
    }, INSTRUCTION_HOLD_MS);

    return () => window.clearTimeout(timer);
  }, [phase, paused, stepIndex, aiSay, script.movements]);

  // Question phase: the AI asks a follow-up question and waits for a response.
  useEffect(() => {
    if (phase !== "question" || paused) return;

    const step = script.movements[stepIndex];
    if (!step) {
      setPhase("movement");
      return;
    }

    setInstruction(step.question);
    setStatusText("AI is asking a question");
    setCoachDisplay(undefined);

    if (questionSpokenRef.current !== stepIndex) {
      questionSpokenRef.current = stepIndex;
      aiSay(step.question);
    }

    const timer = window.setTimeout(() => {
      if (stepIndex + 1 < script.movements.length) {
        setStepIndex(stepIndex + 1);
        setPhase("movement");
      } else {
        setPhase("analyzing");
      }
    }, QUESTION_HOLD_MS);

    return () => window.clearTimeout(timer);
  }, [phase, paused, stepIndex, aiSay, script.movements]);

  useEffect(() => {
    if (phase !== "analyzing" || paused) return;

    const message = script.analyzing;
    setInstruction(message);
    setStatusText("Analyzing");
    setCoachDisplay(undefined);

    if (!waitSpokenRef.current) {
      waitSpokenRef.current = true;
      aiSay(message);
    }

    const timer = window.setTimeout(() => {
      if (!processingStartedRef.current) {
        processingStartedRef.current = true;
        void disconnect();
        void runProcessing();
      }
    }, 3500);
    return () => window.clearTimeout(timer);
  }, [phase, paused, aiSay, script.analyzing, disconnect, runProcessing]);

  // When complete, speak the closing line once.
  useEffect(() => {
    if (phase === "complete") {
      aiSay(script.complete);
    }
  }, [phase, aiSay, script.complete]);

  // Render the body map screen once analysis finishes.
  if (phase === "complete" && bodyMap) {
    return (
      <BodyMapPage
        assessment={bodyMap}
        title={`${completedRecord?.name ?? protocol.name} — body map`}
        onBack={() => {
          if (completedRecord) onComplete(completedRecord);
          else onExit();
        }}
      />
    );
  }

  const totalSteps = script.movements.length * 2 + 2; // positioning + (instruction + question) per movement + analyzing
  const stepNum =
    phase === "positioning"
      ? 1
      : phase === "movement"
        ? stepIndex * 2 + 2
        : phase === "question"
          ? stepIndex * 2 + 3
          : totalSteps;
  const progress = Math.min(100, ((stepNum - 1) / totalSteps) * 100);

  const handleRetryVoice = () => {
    if (USE_DEMO_MODE) {
      startedRef.current = false;
      positioningDoneRef.current = false;
      setPhase("connecting");
      setInstruction("Connecting to your AI coach...");
      setTimeout(() => {
        startedRef.current = true;
        setPhase("positioning");
        setInstruction(script.positioning);
        setStatusText("Positioning");
        aiSay(script.welcome);
        setTimeout(() => aiSay(script.positioning), 2200);
      }, 500);
    } else {
      void initialize({ type, phase: "connecting", repCount: 0, targetReps: script.movements.length, feedback: "" });
    }
  };

  const handleStartWithoutVoice = () => {
    if (startedRef.current) return;
    startedRef.current = true;
    setPhase("positioning");
    setInstruction(script.positioning);
    setStatusText("Positioning");
    aiSay(script.welcome);
    setTimeout(() => aiSay(script.positioning), 2200);
  };

  return (
    <div className="relative flex flex-col h-full bg-artemis-navy">
      <CameraView
        onPoseDetected={handlePose}
        onError={setCameraError}
        width={1280}
        height={720}
      />

      <div className="absolute inset-0 z-10 pointer-events-none flex flex-col justify-between p-6">
        <div className="flex justify-between items-start">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-artemis-cyan" />
            <span className="text-xs font-mono text-artemis-cyan">ARTEMIS TELEMETRY</span>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-artemis-navy/80 backdrop-blur-sm border border-artemis-cyan/30">
              <div
                className={`w-2 h-2 rounded-full transition-colors ${
                  (USE_DEMO_MODE || isConnected) ? "bg-artemis-cyan animate-pulse" : "bg-artemis-amber"
                }`}
              />
              <span className="text-xs font-mono text-artemis-cyan">
                {USE_DEMO_MODE || isConnected ? "AI COACH SPEAKING" : "AI COACH CONNECTING"}
              </span>
              {!isConnected && !USE_DEMO_MODE && aiError && (
                <button
                  onClick={handleRetryVoice}
                  className="ml-2 px-2 py-1 rounded text-xs font-mono bg-artemis-amber/20 text-artemis-amber"
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
          totalSteps={totalSteps}
          status={statusText}
          progress={progress}
          feedback={coachDisplay}
        />
      </div>

      {aiError && !USE_DEMO_MODE && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-40 max-w-md rounded-lg border border-artemis-red/40 bg-red-950/80 px-4 py-3 text-center">
          <p className="text-xs text-red-100">
            AI coach unavailable: {aiError}. Check the Gemini API key and connection.
          </p>
          <button
            onClick={handleStartWithoutVoice}
            className="mt-2 min-h-[2.75rem] px-4 py-2 text-xs font-mono text-artemis-cyan underline"
          >
            CONTINUE WITHOUT VOICE
          </button>
        </div>
      )}

      {USE_DEMO_MODE && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-40 max-w-md rounded-lg border border-artemis-amber/40 bg-amber-950/80 px-4 py-3 text-center">
          <p className="text-xs text-amber-100">
            Running in local voice mode. Set VITE_GEMINI_API_KEY for live AI coach.
          </p>
        </div>
      )}

      {cameraError && (
        <div className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-red-900/90 backdrop-blur text-center p-6">
          <div className="text-artemis-red text-xl font-bold mb-2">Camera Unavailable</div>
          <p className="text-red-100 text-sm mb-4">{cameraError}</p>
          <button
            onClick={() => setCameraError(null)}
            className="min-h-[2.75rem] min-w-[2.75rem] px-4 py-2 text-sm text-artemis-cyan active:text-artemis-cyan/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 underline"
          >
            Retry Camera
          </button>
        </div>
      )}
    </div>
  );
}