import { useCallback, useEffect, useRef, useState } from "react";
import { GeminiLiveService, type AssessmentContext } from "../services/gemini/geminiLive";

interface UseGeminiLiveOptions {
  apiKey: string;
  model?: string;
}

export function useGeminiLive({ apiKey, model }: UseGeminiLiveOptions) {
  const serviceRef = useRef<GeminiLiveService | null>(null);
  const connectingRef = useRef(false);
  const [isConnected, setIsConnected] = useState(false);
  const [lastTranscription, setLastTranscription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [connectionState, setConnectionState] = useState<"idle" | "connecting" | "connected" | "error">("idle");

  const initialize = useCallback(
    async (initialContext?: AssessmentContext) => {
      console.log("[useGeminiLive] initialize called", { hasApiKey: !!apiKey, phase: initialContext?.phase });
      if (!apiKey) {
        console.log("[useGeminiLive] No API key");
        setError("Missing Gemini API key.");
        setConnectionState("error");
        throw new Error("Missing Gemini API key.");
      }
      if (serviceRef.current?.connected || connectingRef.current) {
        console.log("[useGeminiLive] Already connected or connecting");
        return;
      }

      connectingRef.current = true;
      setError(null);
      setConnectionState("connecting");

      const service = new GeminiLiveService({
        apiKey,
        model,
        onOpen: () => {
          console.log("[useGeminiLive] onOpen");
          if (serviceRef.current !== service) return;
          connectingRef.current = false;
          setIsConnected(true);
          setConnectionState("connected");
        },
        onClose: () => {
          console.log("[useGeminiLive] onClose");
          if (serviceRef.current !== service) return;
          connectingRef.current = false;
          setIsConnected(false);
          setConnectionState("idle");
        },
        onError: (e: Error) => {
          console.error("[useGeminiLive] onError:", e.message);
          if (serviceRef.current !== service) return;
          connectingRef.current = false;
          setError(e.message);
          setConnectionState("error");
        },
        onTranscription: (text: string) => setLastTranscription(text),
      });

      serviceRef.current = service;

      const timeout = window.setTimeout(() => {
        if (!service.connected) {
          console.log("[useGeminiLive] Connection timeout");
          connectingRef.current = false;
          setError("Timed out while connecting to the AI coach.");
          setConnectionState("error");
          void disconnect();
        }
      }, 15000);

      try {
        console.log("[useGeminiLive] Calling service.connect...");
        await service.connect(initialContext);
        console.log("[useGeminiLive] service.connect completed");
      } catch (e) {
        console.error("[useGeminiLive] service.connect error:", e);
        connectingRef.current = false;
        setError(e instanceof Error ? e.message : "Failed to connect to the AI coach.");
        setConnectionState("error");
        throw e;
      } finally {
        window.clearTimeout(timeout);
      }
    },
    [apiKey, model]
  );

  const say = useCallback((text: string) => {
    serviceRef.current?.say(text);
  }, []);

  const setPlaybackPaused = useCallback((paused: boolean) => {
    serviceRef.current?.setPlaybackPaused(paused);
  }, []);

  const resumeAudio = useCallback(() => {
    void serviceRef.current?.resumeAudio();
  }, []);

  const disconnect = useCallback(async () => {
    console.log("[useGeminiLive] disconnect called");
    const service = serviceRef.current;
    serviceRef.current = null;
    connectingRef.current = false;
    setIsConnected(false);
    setConnectionState("idle");
    await service?.close();
  }, []);

  useEffect(() => {
    return () => {
      console.log("[useGeminiLive] cleanup");
      void serviceRef.current?.close();
      serviceRef.current = null;
    };
  }, []);

  return {
    isConnected,
    connectionState,
    lastTranscription,
    error,
    initialize,
    say,
    setPlaybackPaused,
    resumeAudio,
    disconnect,
  };
}