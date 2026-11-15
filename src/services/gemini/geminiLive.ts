import {
  GoogleGenAI,
  Modality,
  type LiveCallbacks,
  type LiveConnectConfig,
  type LiveServerMessage,
} from "@google/genai";

export interface GeminiLiveConfig {
  apiKey: string;
  model?: string;
  systemInstruction?: string;
  onAudioData?: (audioData: string) => void;
  onTranscription?: (text: string) => void;
  onError?: (error: Error) => void;
  onClose?: () => void;
  onOpen?: () => void;
}

export interface AssessmentContext {
  type: string;
  phase: string;
  repCount: number;
  targetReps: number;
  feedback: string;
}

export const DEFAULT_LIVE_MODEL = "gemini-3.8-live";

const DEFAULT_SYSTEM_INSTRUCTION = `You are ARTEMIS, the voice coach for astronaut movement assessments.
You speak the assessment instructions out loud. The app sends you short cue texts prefixed with "SAY:".
When you receive a "SAY:" message, speak that text aloud, word for word, once. Do not add greetings, explanations, or follow-up questions.
Keep your tone calm, clear and encouraging. Never describe what you are doing; just say the line.
If you receive a "WAIT:" message, reply with only the sound of silence.`;

export class GeminiLiveService {
  private ai: GoogleGenAI;
  private session: { sendClientContent: (params: unknown) => void; close: () => void } | null = null;
  private config: Required<Omit<GeminiLiveConfig, "onAudioData" | "onTranscription" | "onError" | "onClose" | "onOpen">> & {
    onAudioData: (audioData: string) => void;
    onTranscription: (text: string) => void;
    onError: (error: Error) => void;
    onClose: () => void;
    onOpen: () => void;
  };
  private isConnected = false;
  private audioContext: AudioContext | null = null;
  private audioQueue: AudioBuffer[] = [];
  private activeSources = new Set<AudioBufferSourceNode>();
  private isPlaying = false;
  private playbackPaused = false;
  private closed = false;

constructor(config: GeminiLiveConfig) {
    this.config = {
      apiKey: config.apiKey,
      model: config.model || DEFAULT_LIVE_MODEL,
      systemInstruction: config.systemInstruction || DEFAULT_SYSTEM_INSTRUCTION,
      onAudioData: config.onAudioData || (() => {}),
      onTranscription: config.onTranscription || (() => {}),
      onError: config.onError || ((e) => console.error("[ARTEMIS voice]", e)),
      onClose: config.onClose || (() => {}),
      onOpen: config.onOpen || (() => {}),
    };

    this.ai = new GoogleGenAI({
      apiKey: this.config.apiKey,
      httpOptions: {
        baseUrl: "https://generativelanguage.googleapis.com",
        apiVersion: "v1beta",
      },
    });
  }

  async connect(assessmentContext?: AssessmentContext): Promise<void> {
    if (this.isConnected || this.closed) return;

    console.log("[ARTEMIS voice] Connecting to Gemini Live...", {
      model: this.config.model,
      hasContext: !!assessmentContext,
    });

    const liveConfig: LiveConnectConfig = {
      responseModalities: [Modality.AUDIO],
      outputAudioTranscription: {},
      systemInstruction: this.buildSystemInstruction(assessmentContext),
      temperature: 0.4,
      topP: 0.9,
      topK: 32,
    };

    const callbacks: LiveCallbacks = {
      onopen: () => {
        console.log("[ARTEMIS voice] WebSocket connected");
        this.isConnected = true;
        void this.resumeAudio();
        this.config.onOpen();
      },
      onmessage: (msg: LiveServerMessage) => this.handleMessage(msg),
      onerror: (event: ErrorEvent) => {
        console.error("[ARTEMIS voice] WebSocket error:", event);
        const error = event.error || new Error(String(event.message ?? "Gemini Live error"));
        this.config.onError(error);
      },
      onclose: (event: CloseEvent) => {
        console.log("[ARTEMIS voice] WebSocket closed:", event.code, event.reason);
        this.isConnected = false;
        this.config.onClose();
      },
    };

    try {
      const session = await this.ai.live.connect({
        model: this.config.model,
        config: liveConfig,
        callbacks,
      });

      if (this.closed) {
        try {
          session.close();
        } catch {
          /* ignored */
        }
        return;
      }

      this.session = session as unknown as GeminiLiveService["session"];
      await this.initAudioContext();
      console.log("[ARTEMIS voice] Session established");
    } catch (err) {
      console.error("[ARTEMIS voice] Connection failed:", err);
      this.config.onError(err instanceof Error ? err : new Error(String(err)));
      throw err;
    }
  }

  private buildSystemInstruction(context?: AssessmentContext): string {
    let instruction = this.config.systemInstruction;

    if (context) {
      instruction += `\n\nAssessment: ${context.type.replace(/_/g, " ")}.`;
      instruction += `\nPhase: ${context.phase}.`;
    }

    return instruction;
  }

  private async initAudioContext(): Promise<void> {
    if (this.audioContext) {
      await this.resumeAudio();
      return;
    }

    const AudioContextCtor =
      window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;

    if (!AudioContextCtor) {
      this.config.onError(new Error("Web Audio is not supported in this browser."));
      return;
    }

    this.audioContext = new AudioContextCtor({ sampleRate: 24000 });
    await this.resumeAudio();
  }

  async resumeAudio(): Promise<void> {
    if (this.audioContext && this.audioContext.state === "suspended") {
      try {
        await this.audioContext.resume();
      } catch {
        /* ignored: resumed on the next user gesture */
      }
    }
  }

  private handleMessage(msg: LiveServerMessage): void {
    const parts = msg.serverContent?.modelTurn?.parts ?? [];

    for (const part of parts) {
      if (part.inlineData?.data) {
        this.config.onAudioData(part.inlineData.data);
        void this.playPcm24k(part.inlineData.data);
      }
    }

    if (msg.serverContent?.outputTranscription?.text) {
      this.config.onTranscription(msg.serverContent.outputTranscription.text);
    }

    if (msg.serverContent?.interrupted) {
      this.stopSpeaking();
    }
  }

  private async playPcm24k(base64Pcm: string): Promise<void> {
    if (!this.audioContext || this.playbackPaused) return;

    const binaryString = atob(base64Pcm);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    const pcm = new Int16Array(bytes.buffer, 0, Math.floor(bytes.length / 2));
    const float32 = new Float32Array(pcm.length);
    for (let i = 0; i < pcm.length; i++) {
      float32[i] = pcm[i] / 32768;
    }

    const audioBuffer = this.audioContext.createBuffer(1, float32.length, 24000);
    audioBuffer.copyToChannel(float32, 0);
    this.audioQueue.push(audioBuffer);

    if (!this.isPlaying) {
      void this.processAudioQueue();
    }
  }

  private async processAudioQueue(): Promise<void> {
    this.isPlaying = true;

    while (this.audioQueue.length > 0 && !this.playbackPaused) {
      const buffer = this.audioQueue.shift();
      if (!buffer) break;
      await this.playBuffer(buffer);
    }

    if (this.playbackPaused) {
      this.audioQueue = [];
    }

    this.isPlaying = false;
  }

  private playBuffer(buffer: AudioBuffer): Promise<void> {
    return new Promise((resolve) => {
      if (!this.audioContext) {
        resolve();
        return;
      }

      const source = this.audioContext.createBufferSource();
      source.buffer = buffer;
      source.connect(this.audioContext.destination);
      this.activeSources.add(source);

      const cleanup = () => {
        this.activeSources.delete(source);
        resolve();
      };

      source.onended = cleanup;
      source.start(0);
    });
  }

  stopSpeaking(): void {
    this.audioQueue = [];
    for (const source of this.activeSources) {
      try {
        source.stop();
      } catch {
        /* already stopped */
      }
    }
    this.activeSources.clear();
  }

  setPlaybackPaused(paused: boolean): void {
    this.playbackPaused = paused;

    if (paused) {
      this.stopSpeaking();
      void this.audioContext?.suspend();
    } else {
      void this.resumeAudio();
    }
  }

  say(text: string): void {
    if (!this.session || !this.isConnected || !text) return;

    try {
      this.session.sendClientContent({
        turns: [{ role: "user", parts: [{ text: `SAY: ${text}` }] }],
        turnComplete: true,
      });
    } catch (error) {
      this.config.onError(error instanceof Error ? error : new Error(String(error)));
    }
  }

  sendText(text: string): void {
    this.say(text);
  }

  async close(): Promise<void> {
    if (this.closed) return;
    this.closed = true;

    if (this.session) {
      try {
        this.session.close();
      } catch {
        /* socket may already be closed */
      }
      this.session = null;
    }

    this.isConnected = false;
    this.stopSpeaking();

    if (this.audioContext) {
      try {
        await this.audioContext.close();
      } catch {
        /* ignored */
      }
      this.audioContext = null;
    }
  }

  get connected(): boolean {
    return this.isConnected;
  }
}