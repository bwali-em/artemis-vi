import { useCallback, useEffect, useState } from "react";

export type BodyOverlayMode =
  | "behind-regions"
  | "above-regions"
  | "follow-skeleton"
  | "fixed";

export interface BodyOverlaySettings {
  enabled: boolean;
  /** 0-1 image opacity. */
  opacity: number;
  /** 0.5-1.5 horizontal calibration. */
  stretchX: number;
  /** 0.5-1.5 vertical calibration. */
  stretchY: number;
  /** -100..100 user units. */
  offsetX: number;
  /** -100..100 user units. */
  offsetY: number;
  lockAspect: boolean;
  flip: boolean;
  mode: BodyOverlayMode;
  /**
   * Internal flag: once a person explicitly picks a mode, per-map defaults
   * (above-regions for the static map, follow-skeleton for the animated map)
   * stop overriding the saved choice.
   */
  modeUserSet: boolean;
  /** Draw regions at ~35% so the image can be aligned through them. */
  regionsFaded: boolean;
  /** mixBlendMode: "screen" on the image. */
  blend: boolean;
  /** Faint cyan region outlines while the controls panel is open. */
  outline: boolean;
}

export interface UseBodyOverlayOptions {
  initialEnabled?: boolean;
  initialOpacity?: number;
  initialMode?: BodyOverlayMode;
}

export const BODY_OVERLAY_STORAGE_KEY = "bodymap.overlay.v1";

export const BODY_OVERLAY_DEFAULTS: BodyOverlaySettings = {
  enabled: false,
  opacity: 0.6,
  stretchX: 1,
  stretchY: 1,
  offsetX: 0,
  offsetY: 0,
  lockAspect: true,
  flip: false,
  mode: "above-regions",
  modeUserSet: false,
  regionsFaded: false,
  blend: false,
  outline: false,
};

const MODES: readonly BodyOverlayMode[] = [
  "behind-regions",
  "above-regions",
  "follow-skeleton",
  "fixed",
];

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function readNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function readBoolean(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

function readMode(value: unknown): BodyOverlayMode | undefined {
  return MODES.includes(value as BodyOverlayMode) ? (value as BodyOverlayMode) : undefined;
}

function readStored(): Record<string, unknown> | null {
  try {
    const raw = localStorage.getItem(BODY_OVERLAY_STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}

function parseSettings(raw: Record<string, unknown> | null): Partial<BodyOverlaySettings> {
  if (!raw) return {};
  const out: Partial<BodyOverlaySettings> = {};

  const enabled = readBoolean(raw.enabled);
  if (enabled !== undefined) out.enabled = enabled;

  const opacity = readNumber(raw.opacity);
  if (opacity !== undefined) out.opacity = clamp(opacity, 0, 1);

  const stretchX = readNumber(raw.stretchX);
  if (stretchX !== undefined) out.stretchX = clamp(stretchX, 0.5, 1.5);

  const stretchY = readNumber(raw.stretchY);
  if (stretchY !== undefined) out.stretchY = clamp(stretchY, 0.5, 1.5);

  const offsetX = readNumber(raw.offsetX);
  if (offsetX !== undefined) out.offsetX = clamp(offsetX, -100, 100);

  const offsetY = readNumber(raw.offsetY);
  if (offsetY !== undefined) out.offsetY = clamp(offsetY, -100, 100);

  const lockAspect = readBoolean(raw.lockAspect);
  if (lockAspect !== undefined) out.lockAspect = lockAspect;

  const flip = readBoolean(raw.flip);
  if (flip !== undefined) out.flip = flip;

  const mode = readMode(raw.mode);
  if (mode !== undefined) out.mode = mode;

  const modeUserSet = readBoolean(raw.modeUserSet);
  if (modeUserSet !== undefined) out.modeUserSet = modeUserSet;

  const regionsFaded = readBoolean(raw.regionsFaded);
  if (regionsFaded !== undefined) out.regionsFaded = regionsFaded;

  const blend = readBoolean(raw.blend);
  if (blend !== undefined) out.blend = blend;

  const outline = readBoolean(raw.outline);
  if (outline !== undefined) out.outline = outline;

  return out;
}

function buildInitialState(options: UseBodyOverlayOptions): BodyOverlaySettings {
  const stored = parseSettings(readStored());
  const mode = stored.modeUserSet
    ? stored.mode ?? BODY_OVERLAY_DEFAULTS.mode
    : options.initialMode ?? BODY_OVERLAY_DEFAULTS.mode;
  return {
    ...BODY_OVERLAY_DEFAULTS,
    ...stored,
    enabled: options.initialEnabled ?? stored.enabled ?? BODY_OVERLAY_DEFAULTS.enabled,
    opacity:
      options.initialOpacity !== undefined
        ? clamp(options.initialOpacity, 0, 1)
        : stored.opacity ?? BODY_OVERLAY_DEFAULTS.opacity,
    mode,
  };
}

/**
 * Shared calibration state for the body-image overlay.
 * Persists calibrated values to localStorage and exposes a reset action.
 */
export function useBodyOverlay(options: UseBodyOverlayOptions = {}) {
  const [settings, setSettings] = useState<BodyOverlaySettings>(() => buildInitialState(options));
  const [panelOpen, setPanelOpen] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(BODY_OVERLAY_STORAGE_KEY, JSON.stringify(settings));
    } catch {
      // Storage can be unavailable or full; calibration still works in memory.
    }
  }, [settings]);

  const set = useCallback(
    <K extends keyof BodyOverlaySettings>(key: K, value: BodyOverlaySettings[K]): void => {
      setSettings((prev) => {
        if (key === "stretchX" && typeof value === "number") {
          return {
            ...prev,
            stretchX: value,
            stretchY: prev.lockAspect ? value : prev.stretchY,
          };
        }
        if (key === "stretchY" && typeof value === "number") {
          return {
            ...prev,
            stretchY: value,
            stretchX: prev.lockAspect ? value : prev.stretchX,
          };
        }
        if (key === "mode") {
          return { ...prev, mode: value as BodyOverlayMode, modeUserSet: true };
        }
        if (key === "lockAspect" && value === true) {
          return { ...prev, lockAspect: true, stretchY: prev.stretchX };
        }
        return { ...prev, [key]: value };
      });
    },
    [],
  );

  const patch = useCallback((next: Partial<BodyOverlaySettings>): void => {
    setSettings((prev) => ({
      ...prev,
      ...next,
      ...(next.mode !== undefined ? { modeUserSet: true } : {}),
    }));
  }, []);

  const reset = useCallback((): void => {
    setSettings({ ...BODY_OVERLAY_DEFAULTS });
  }, []);

  return {
    ...settings,
    set,
    patch,
    reset,
    panelOpen,
    setPanelOpen,
  };
}

export type BodyOverlayController = ReturnType<typeof useBodyOverlay>;

/** True when the OS asks for reduced motion. */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  return reduced;
}
