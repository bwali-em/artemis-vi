import { useCallback, useEffect, useRef, useState } from "react";
import { Mic, MicOff, X, Volume2, VolumeX, CheckCircle2, AlertCircle, Stethoscope, Loader2, Mic2, Brain, RotateCcw } from "lucide-react";
import { useGeminiLive } from "../hooks/useGeminiLive";
import { useVoiceInput } from "../hooks/useVoiceInput";
import { useMedicalData } from "../hooks/useMedicalData";
import { healthConsultationRepository } from "../storage/healthConsultationRepository";

// Try to get API key from environment, fallback to local voice mode if not available
const GEMINI_API_KEY: string =
  import.meta.env.VITE_GEMINI_API_KEY ||
  import.meta.env.GEMINI_KEY ||
  "";

const USE_DEMO_MODE = !GEMINI_API_KEY;

if (USE_DEMO_MODE) {
  console.warn("[AIConsultation] No Gemini API key found. Running in local voice mode. Set VITE_GEMINI_API_KEY or GEMINI_KEY environment variable for live AI.");
}

const HEALTH_SIGNS = [
  { id: "nausea", label: "Nausea", icon: "🤢" },
  { id: "fatigue", label: "Fatigue", icon: "😴" },
  { id: "body_pains", label: "Body Pains", icon: "💪" },
  { id: "flu_symptoms", label: "Flu Symptoms", icon: "🤧" },
  { id: "headache", label: "Headache", icon: "🤕" },
  { id: "dizziness", label: "Dizziness", icon: "💫" },
  { id: "shortness_of_breath", label: "Shortness of Breath", icon: "🫁" },
  { id: "chest_pain", label: "Chest Pain", icon: "🫀" },
  { id: "fever", label: "Fever", icon: "🌡️" },
  { id: "other", label: "Other", icon: "❓" },
] as const;

// Map question index to symptom ID
const QUESTION_TO_SIGN: Record<number, HealthSignId> = {
  0: "nausea",
  1: "fatigue",
  2: "body_pains",
  3: "flu_symptoms",
  4: "headache",
  5: "dizziness",
  6: "shortness_of_breath",
  7: "chest_pain",
  8: "fever",
};

type HealthSignId = (typeof HEALTH_SIGNS)[number]["id"];

interface ConsultationState {
  phase: "idle" | "connecting" | "questioning" | "final_question" | "processing" | "results" | "error";
  detectedSigns: Set<HealthSignId>;
  currentQuestionIndex: number;
  questions: string[];
  transcript: string;
  error: string | null;
}

const QUESTIONS = [
  "Hello, I'm ARTEMIS, your medical AI assistant. Let's begin your health check. First, are you experiencing any nausea or vomiting?",
  "Are you feeling unusual fatigue or exhaustion?",
  "Do you have any body pains, muscle aches, or joint pain?",
  "Are you experiencing any flu-like symptoms such as cough, congestion, or sore throat?",
  "Do you have a headache or any head discomfort?",
  "Are you feeling dizzy, lightheaded, or unsteady?",
  "Are you having any difficulty breathing or shortness of breath?",
  "Do you have any chest pain or discomfort?",
  "Have you noticed any fever or chills?",
];

export function AIConsultation() {
  const { selectedAstronautId } = useMedicalData();
  
  const [state, setState] = useState<ConsultationState>({
    phase: "idle",
    detectedSigns: new Set(),
    currentQuestionIndex: 0,
    questions: QUESTIONS,
    transcript: "",
    error: null,
  });
  const [isMuted, setIsMuted] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const questionSpokenRef = useRef(false);
  const processingTimeoutRef = useRef<number | null>(null);
  const demoQuestionTimeoutRef = useRef<number | null>(null);

  const { isConnected, connectionState, initialize, say, disconnect, error: geminiError } = useGeminiLive({
    apiKey: GEMINI_API_KEY,
  });

  // Determine actual connection status (local mode or live)
  const isActuallyConnected = USE_DEMO_MODE || isConnected;
  const currentConnectionState = USE_DEMO_MODE ? "connected" : connectionState;

  useEffect(() => {
    if (geminiError) {
      setState((s) => ({ ...s, phase: "error", error: geminiError }));
    }
  }, [geminiError]);

  const handleUserResponse = useCallback((transcript: string) => {
    console.log("[AIConsultation] User response:", transcript);
    const lower = transcript.toLowerCase();
    
    // Check if answer is affirmative or negative
    const hasNo = /\b(no|nope|not|don't|do not|haven't|have not|never)\b/i.test(lower);
    const hasYes = /\b(yes|yeah|yep|yup|i do|i have|i am|i'm|definitely|absolutely|sure)\b/i.test(lower);
    
    // Determine if this is an affirmative answer (add symptoms) or negative (don't add)
    const isAffirmative = hasYes || (!hasNo && (lower.includes("i have") || lower.includes("i am") || lower.includes("i'm") || lower.includes("i feel") || lower.includes("i've") || lower.includes("got") || lower.includes("experiencing")));
    
    console.log("[AIConsultation] Answer analysis:", { hasNo, hasYes, isAffirmative, transcript: lower });

    setState((s) => {
      const newSigns = new Set(s.detectedSigns);

      // If in questioning phase and answer is affirmative, add the symptom for current question
      if (s.phase === "questioning" && isAffirmative) {
        const questionSign = QUESTION_TO_SIGN[s.currentQuestionIndex];
        if (questionSign) {
          newSigns.add(questionSign);
          console.log("[AIConsultation] Added symptom for question", s.currentQuestionIndex, ":", questionSign);
        }
      }

      // Also detect any explicitly mentioned symptoms in the response (if affirmative)
      if (isAffirmative) {
        HEALTH_SIGNS.forEach((sign) => {
          const keywords: Record<string, string[]> = {
            nausea: ["nausea", "nauseous", "vomit", "throw up", "sick to stomach", "queasy", "feeling sick"],
            fatigue: ["fatigue", "tired", "exhausted", "weary", "no energy", "drained", "sleepy", "worn out", "exhaustion"],
            body_pains: ["pain", "ache", "sore", "hurt", "muscle", "joint", "body pain", "body ache", "back pain", "neck pain"],
            flu_symptoms: ["flu", "cough", "congestion", "sore throat", "runny nose", "sniffles", "cold", "sinus", "stuffy"],
            headache: ["headache", "head hurt", "migraine", "head pain", "headache", "pounding head"],
            dizziness: ["dizzy", "lightheaded", "unsteady", "vertigo", "spinning", "faint", "woozy"],
            shortness_of_breath: ["shortness of breath", "breath", "breathing", "can't breathe", "hard to breathe", "out of breath", "winded"],
            chest_pain: ["chest pain", "chest hurt", "chest discomfort", "tight chest", "chest tightness"],
            fever: ["fever", "chills", "temperature", "hot", "burning up", "sweating", "cold sweats"],
            other: [],
          };

          if (keywords[sign.id]?.some((k) => lower.includes(k))) {
            newSigns.add(sign.id);
            console.log("[AIConsultation] Detected sign:", sign.id, "from keyword match (affirmative)");
          }
        });
      } else {
        console.log("[AIConsultation] Negative/neutral answer - not adding symptoms");
      }

      console.log("[AIConsultation] Updated signs:", Array.from(newSigns));

      return {
        ...s,
        detectedSigns: newSigns,
        transcript: `${s.transcript}\nUser: ${transcript}`,
      };
    });

    // Process based on phase
    if (state.phase === "questioning") {
      // Move to next question after a brief delay
      setTimeout(() => {
        setState((s) => {
          const nextIndex = s.currentQuestionIndex + 1;
          if (nextIndex >= s.questions.length) {
            return { ...s, phase: "final_question" };
          }
          return { ...s, currentQuestionIndex: nextIndex };
        });
        questionSpokenRef.current = false;
      }, 1500);
    } else if (state.phase === "final_question") {
      // Check for yes/no with word boundaries
      const finalHasNo = /\b(no|nope|nothing else|that's all|that is all)\b/i.test(lower);
      const finalHasYes = /\b(yes|yeah|yep|also|add|more)\b/i.test(lower);
      
      if (finalHasNo) {
        startProcessing();
      } else if (finalHasYes) {
        // Let them add more - AI will handle, stay in final_question
        questionSpokenRef.current = false;
      }
    }
  }, [state.phase]);

  const { start: startListening, stop: stopListening } = useVoiceInput({
    onTranscript: handleUserResponse,
    onError: (err) => console.warn("Voice input error:", err),
    continuous: true,
    interimResults: false,
  });

  const askCurrentQuestion = useCallback(() => {
    if (state.phase === "questioning" && !questionSpokenRef.current) {
      const question = state.questions[state.currentQuestionIndex];
      if (USE_DEMO_MODE) {
        // Local mode: use speech synthesis
        const utterance = new SpeechSynthesisUtterance(question);
        utterance.rate = 0.95;
        utterance.volume = isMuted ? 0 : 1;
        window.speechSynthesis.speak(utterance);
      } else {
        say(question);
      }
      questionSpokenRef.current = true;
    } else if (state.phase === "final_question" && !questionSpokenRef.current) {
      const finalQuestion = "Is there anything else you'd like to mention about your health?";
      if (USE_DEMO_MODE) {
        const utterance = new SpeechSynthesisUtterance(finalQuestion);
        utterance.rate = 0.95;
        utterance.volume = isMuted ? 0 : 1;
        window.speechSynthesis.speak(utterance);
      } else {
        say(finalQuestion);
      }
      questionSpokenRef.current = true;
    }
  }, [state.phase, state.questions, state.currentQuestionIndex, say, isMuted]);

  useEffect(() => {
    askCurrentQuestion();
  }, [askCurrentQuestion]);

  useEffect(() => {
    if (state.phase === "questioning" || state.phase === "final_question") {
      startListening();
      setIsListening(true);
    } else {
      stopListening();
      setIsListening(false);
    }
    return () => {
      stopListening();
      setIsListening(false);
    };
  }, [state.phase, startListening, stopListening]);

  const startProcessing = useCallback(() => {
    stopListening();
    setState((s) => ({ ...s, phase: "processing" }));

    // Simulate processing and save consultation record
    processingTimeoutRef.current = window.setTimeout(() => {
      // Save consultation record
      if (selectedAstronautId) {
        const record = healthConsultationRepository.save({
          astronautId: selectedAstronautId,
          date: Date.now(),
          detectedSigns: Array.from(state.detectedSigns) as HealthSignId[],
          transcript: state.transcript,
          status: "completed",
        });
        console.log("[AIConsultation] Saved consultation record:", record.id);
      }
      setState((s) => ({ ...s, phase: "results" }));
    }, 2000);
  }, [stopListening, selectedAstronautId, state.detectedSigns, state.transcript]);

  const startConsultation = useCallback(async () => {
    setState({
      phase: "connecting",
      detectedSigns: new Set(),
      currentQuestionIndex: 0,
      questions: QUESTIONS,
      transcript: "",
      error: null,
    });
    questionSpokenRef.current = false;

    if (USE_DEMO_MODE) {
      // Local mode: simulate connection
      demoQuestionTimeoutRef.current = window.setTimeout(() => {
        setState((s) => ({ ...s, phase: "questioning" }));
      }, 500);
    } else {
      try {
        await initialize({
          type: "health_consultation",
          phase: "active",
          repCount: 0,
          targetReps: 0,
          feedback: "Health consultation started",
        });
        setState((s) => ({ ...s, phase: "questioning" }));
      } catch (e) {
        setState((s) => ({ ...s, phase: "error", error: e instanceof Error ? e.message : "Failed to connect" }));
      }
    }
  }, [initialize]);

  const endConsultation = useCallback(() => {
    if (processingTimeoutRef.current) {
      clearTimeout(processingTimeoutRef.current);
    }
    if (demoQuestionTimeoutRef.current) {
      clearTimeout(demoQuestionTimeoutRef.current);
    }
    window.speechSynthesis.cancel();
    disconnect();
    stopListening();
    setState({
      phase: "idle",
      detectedSigns: new Set(),
      currentQuestionIndex: 0,
      questions: QUESTIONS,
      transcript: "",
      error: null,
    });
    questionSpokenRef.current = false;
  }, [disconnect, stopListening]);

  const retryConnection = useCallback(() => {
    startConsultation();
  }, [startConsultation]);

  const formatTime = () => new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  if (state.phase === "idle") {
    return (
      <div className="min-h-[100svh] bg-[#020617] text-white flex flex-col">
        <header className="border-b border-white/10 bg-black/40 px-5 py-4 sm:px-8 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-300 text-slate-950"><Stethoscope size={20} strokeWidth={2.5} /></div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-cyan-300">Medical operations / AI consultation</p>
              <h1 className="text-xl font-semibold text-white">ARTEMIS HEALTH Consultation</h1>
            </div>
          </div>
        </header>
        <main className="flex-1 flex items-center justify-center p-8">
          <div className="text-center max-w-md">
            <div className="mx-auto mb-6 h-24 w-24 rounded-full bg-cyan-400/10 border border-cyan-400/20 flex items-center justify-center">
              <Brain size={48} className="text-cyan-300" />
            </div>
            <h2 className="text-2xl font-semibold text-white mb-3">AI Health Consultation</h2>
            <p className="text-slate-400 mb-8 leading-relaxed">
              ARTEMIS will ask you a series of health questions. Respond naturally by voice.
              Your symptoms will be tracked in real-time. At the end, you'll receive a summary.
            </p>
            <ul className="text-left text-sm text-slate-300 mb-8 space-y-2 max-w-xs mx-auto">
              {HEALTH_SIGNS.slice(0, 6).map((sign) => (
                <li key={sign.id} className="flex items-center gap-2">{sign.icon} {sign.label}</li>
              ))}
              <li className="flex items-center gap-2 text-slate-500">+ {HEALTH_SIGNS.length - 6} more...</li>
            </ul>
            <button
              onClick={startConsultation}
              className="inline-flex items-center justify-center gap-2 min-h-[3rem] rounded-xl bg-cyan-400 px-8 py-4 text-base font-bold text-slate-950 shadow-lg shadow-cyan-950/30 active:bg-cyan-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 transition"
            >
              <Brain className="mr-1" size={20} />
              Start Consultation
            </button>
            <p className="mt-4 text-[11px] text-slate-500">Requires microphone access. Works best in Chrome/Edge.</p>
            {USE_DEMO_MODE && (
              <p className="mt-2 text-[10px] text-amber-400">Local voice mode: using browser speech synthesis (no API key)</p>
            )}
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-[100svh] bg-[#020617] text-white flex flex-col">
      {/* Header */}
      <header className="border-b border-white/10 bg-black/40 px-5 py-3 sm:px-8 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={endConsultation} className="rounded-lg border border-white/10 min-h-[2.75rem] min-w-[2.75rem] px-3 py-2 text-sm text-cyan-300 active:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 transition">
            <X size={20} />
          </button>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-cyan-300">Medical operations / AI consultation</p>
            <h1 className="text-lg font-semibold text-white">Health Consultation in Progress</h1>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-xs">
            <span className={`h-2 w-2 rounded-full ${
              currentConnectionState === "connected" ? "bg-emerald-400" :
              currentConnectionState === "connecting" ? "bg-amber-400 animate-pulse" :
              "bg-rose-400"
            }`} />
            <span className="font-mono text-slate-300 capitalize">
              {currentConnectionState === "connected" ? "connected" :
               currentConnectionState === "connecting" ? "connecting" :
               "disconnected"}
              {USE_DEMO_MODE && " · Local mode"}
            </span>
          </div>
          {state.error && (
            <button onClick={retryConnection} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-500/20 border border-rose-500/30 text-rose-300 text-xs font-medium hover:bg-rose-500/30 transition">
              <RotateCcw size={12} className="animate-spin" /> Retry
            </button>
          )}
        </div>
      </header>

      <main className="flex-1 flex flex-col relative">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#07111f] via-[#0a1628] to-[#07111f]" />
        
        {/* Decorative elements */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full bg-cyan-400/10 blur-3xl animate-pulse" />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 rounded-full bg-emerald-400/10 blur-3xl animate-pulse" style={{animationDelay: '1s'}} />
        </div>

        {/* Content */}
        <div className="relative z-10 flex flex-col h-full items-center justify-center p-4 sm:p-8">
          {/* AI Avatar / Status indicator */}
          <div className="mb-8 flex flex-col items-center">
            <div className={`relative w-32 h-32 rounded-full bg-gradient-to-br from-cyan-400 to-emerald-400 flex items-center justify-center ${isActuallyConnected ? "animate-pulse-ring" : "opacity-50"}`}>
              <Brain size={40} className="text-slate-950" />
              {isActuallyConnected && (
                <span className="absolute -inset-1 rounded-full border-2 border-cyan-400/50 animate-ping" />
              )}
            </div>
            <p className="mt-4 text-sm font-mono text-cyan-300 uppercase tracking-wider">
              {currentConnectionState === "connected" ? "AI CONNECTED" : currentConnectionState === "connecting" ? "CONNECTING..." : "DISCONNECTED"}
              {USE_DEMO_MODE && " · Local mode"}
            </p>
          </div>

          {/* Current Question Display */}
          {(state.phase === "questioning" || state.phase === "final_question") && (
            <div className="w-full max-w-3xl mb-8 text-center animate-fade-in">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-cyan-300 mb-3">
                {state.phase === "final_question" ? "Final Question" : `Question ${state.currentQuestionIndex + 1} of ${state.questions.length}`}
              </p>
              <p className="text-xl sm:text-2xl font-medium text-white leading-relaxed">
                {state.phase === "final_question"
                  ? "Is there anything else you'd like to mention about your health?"
                  : state.questions[state.currentQuestionIndex]}
              </p>
              <div className="mt-6 flex items-center justify-center gap-4">
                <div className={`flex items-center gap-2 px-4 py-2 rounded-full bg-black/40 backdrop-blur-sm border ${isListening ? "border-cyan-400/50 bg-cyan-400/10" : "border-white/10"}`}>
                  <Mic2 size={16} className={isListening ? "text-cyan-300 animate-pulse" : "text-slate-500"} />
                  <span className={`text-sm font-medium ${isListening ? "text-cyan-300" : "text-slate-300"}`}>
                    {isListening ? "Listening..." : "Tap to speak"}
                  </span>
                </div>
                <button
                  onClick={() => {
                    if (isListening) stopListening();
                    else startListening();
                  }}
                  className={`p-3 rounded-full transition ${isListening ? "bg-cyan-400 text-slate-950 animate-pulse" : "bg-white/5 text-slate-300 hover:bg-white/10"}`}
                  aria-label={isListening ? "Stop listening" : "Start listening"}
                >
                  {isListening ? <MicOff size={20} /> : <Mic size={20} />}
                </button>
              </div>
            </div>
          )}

          {state.phase === "processing" && (
            <div className="w-full max-w-3xl mb-8 text-center">
              <Loader2 size={48} className="mx-auto mb-4 text-amber-300 animate-spin" />
              <p className="text-lg font-medium text-amber-200">Processing your health assessment...</p>
            </div>
          )}

          {state.phase === "results" && (
            <div className="w-full max-w-3xl mb-8 text-center">
              <CheckCircle2 size={48} className="mx-auto mb-4 text-emerald-400" />
              <p className="text-lg font-medium text-emerald-200">Consultation Complete</p>
              <p className="text-sm text-slate-400 mt-1">Results displayed in the panel</p>
            </div>
          )}

          {/* Signs Panel - Full width on mobile, side panel on desktop */}
          <div className="w-full max-w-4xl">
            <div className="bg-black/50 backdrop-blur-xl rounded-2xl border border-white/10 overflow-hidden">
              <div className="p-4 border-b border-white/10 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                  <AlertCircle size={16} className="text-cyan-300" />
                  Detected Signs
                </h3>
                <span className="text-xs font-mono text-cyan-300 bg-cyan-400/10 px-2 py-1 rounded">
                  {state.detectedSigns.size}/{HEALTH_SIGNS.length}
                </span>
              </div>
              <div className="p-4 space-y-2">
                {HEALTH_SIGNS.map((sign) => {
                  const detected = state.detectedSigns.has(sign.id);
                  return (
                    <div
                      key={sign.id}
                      className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                        detected
                          ? "bg-emerald-500/15 border border-emerald-500/30"
                          : "bg-white/5 border border-white/10"
                      }`}
                    >
                      <span className="text-2xl" aria-hidden="true">{sign.icon}</span>
                      <span className={`flex-1 text-sm font-medium ${detected ? "text-emerald-200" : "text-slate-300"}`}>
                        {sign.label}
                      </span>
                      {detected && <CheckCircle2 size={18} className="text-emerald-400" />}
                    </div>
                  );
                })}
              </div>
              <div className="px-4 pb-4 border-t border-white/10">
                <p className="text-[10px] text-slate-500 text-center">
                  {state.phase === "questioning"
                    ? `Question ${state.currentQuestionIndex + 1} of ${state.questions.length}`
                    : state.phase === "final_question"
                    ? "Final question"
                    : state.phase === "processing"
                    ? "Analyzing..."
                    : state.phase === "results"
                    ? "Complete - Review results above"
                    : "Ready to begin"}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom controls */}
        <div className="relative z-10 p-4 w-full max-w-4xl">
          <div className="flex items-center justify-center gap-4">
            <button
              onClick={() => setIsMuted(!isMuted)}
              className={`p-3 rounded-full transition ${isMuted ? "bg-rose-500/20 text-rose-300 border border-rose-500/30" : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"}`}
              aria-label={isMuted ? "Unmute AI" : "Mute AI"}
            >
              {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
            </button>
            <button
              onClick={endConsultation}
              className="px-6 py-3 rounded-full bg-white/5 border border-white/10 text-slate-300 hover:bg-white/10 transition font-medium"
            >
              End Consultation
            </button>
          </div>
        </div>
      </main>

      {/* Results Modal */}
      {state.phase === "results" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-2xl bg-[#0d1b2b] rounded-2xl border border-emerald-400/30 overflow-hidden animate-slide-up">
            <div className="p-5 border-b border-white/10 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                <CheckCircle2 size={20} className="text-emerald-400" />
                Health Consultation Summary
              </h2>
              <span className="text-xs font-mono text-slate-400">{formatTime()}</span>
            </div>
            <div className="p-5 space-y-4 max-h-[60vh] overflow-y-auto">
              {state.detectedSigns.size === 0 ? (
                <div className="text-center py-8">
                  <CheckCircle2 size={48} className="mx-auto mb-3 text-emerald-400" />
                  <p className="text-white font-medium">No concerns detected</p>
                  <p className="text-sm text-slate-400 mt-1">You reported no symptoms during the consultation.</p>
                </div>
              ) : (
                <>
                  <p className="text-sm text-slate-300">The following signs were detected:</p>
                  <div className="space-y-2">
                    {Array.from(state.detectedSigns).map((signId) => {
                      const sign = HEALTH_SIGNS.find((s) => s.id === signId);
                      return (
                        <div key={signId} className="flex items-center gap-3 px-4 py-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                          <span className="text-2xl">{sign?.icon}</span>
                          <span className="font-medium text-emerald-200">{sign?.label}</span>
                        </div>
                      );
                    })}
                  </div>
                  <div className="pt-4 border-t border-white/10">
                    <p className="text-sm text-slate-400">Full transcript:</p>
                    <pre className="mt-2 p-3 bg-black/40 rounded-lg text-[11px] text-slate-300 whitespace-pre-wrap max-h-40 overflow-y-auto">
                      {state.transcript || "No transcript available"}
                    </pre>
                  </div>
                </>
              )}
            </div>
            <div className="p-4 border-t border-white/10 flex gap-3">
              <button
                onClick={endConsultation}
                className="flex-1 min-h-[2.75rem] rounded-lg bg-white/5 border border-white/10 text-slate-300 hover:bg-white/10 transition font-medium"
              >
                Done
              </button>
              <button
                onClick={() => {
                  questionSpokenRef.current = false;
                  startConsultation();
                }}
                className="flex-1 min-h-[2.75rem] rounded-lg bg-cyan-400 text-slate-950 hover:bg-cyan-300 font-medium"
              >
                New Consultation
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Error State */}
      {state.phase === "error" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-md bg-[#0d1b2b] rounded-2xl border border-rose-400/30 p-6 text-center">
            <AlertCircle size={48} className="mx-auto mb-3 text-rose-400" />
            <h2 className="text-lg font-semibold text-white mb-2">Connection Error</h2>
            <p className="text-sm text-slate-400 mb-4">{state.error}</p>
            <div className="flex gap-3">
              <button onClick={retryConnection} className="flex-1 min-h-[2.75rem] rounded-lg bg-rose-500 text-white font-medium">
                Retry
              </button>
              <button onClick={endConsultation} className="flex-1 min-h-[2.75rem] rounded-lg bg-white/5 border border-white/10 text-slate-300">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}