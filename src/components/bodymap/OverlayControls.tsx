import { useId } from "react";
import { ChevronDown, FlipHorizontal, Layers, RotateCcw } from "lucide-react";
import type { BodyOverlayController, BodyOverlayMode } from "../../hooks/useBodyOverlay";

const MODE_LABELS: Record<BodyOverlayMode, string> = {
  "behind-regions": "Behind regions",
  "above-regions": "Above regions",
  "follow-skeleton": "Follow skeleton",
  fixed: "Fixed pose",
};

const DEFAULT_MODES: BodyOverlayMode[] = ["above-regions", "behind-regions"];

export interface OverlayControlsProps {
  overlay: BodyOverlayController;
  /** Modes offered in the select. The static map only needs the two layer modes. */
  modes?: BodyOverlayMode[];
  className?: string;
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className="inline-flex items-center gap-1.5 rounded-md px-1 py-1 text-[11px] text-slate-300 transition-colors hover:text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 motion-reduce:transition-none"
    >
      <span>{label}</span>
      <span
        aria-hidden="true"
        className={`relative inline-flex h-4 w-7 shrink-0 items-center rounded-full border transition-colors motion-reduce:transition-none ${
          checked ? "border-cyan-400/60 bg-cyan-400/25" : "border-white/15 bg-white/10"
        }`}
      >
        <span
          className={`absolute h-2.5 w-2.5 rounded-full transition-transform motion-reduce:transition-none ${
            checked ? "translate-x-3.5 bg-cyan-200" : "translate-x-0.5 bg-slate-400"
          }`}
        />
      </span>
    </button>
  );
}

function Slider({
  id,
  label,
  value,
  min,
  max,
  step,
  display,
  onChange,
  disabled = false,
}: {
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  display: string;
  onChange: (next: number) => void;
  disabled?: boolean;
}) {
  return (
    <label htmlFor={id} className={`block ${disabled ? "opacity-45" : ""}`}>
      <span className="flex items-center justify-between gap-2 text-[11px] text-slate-400">
        <span>{label}</span>
        <span className="font-mono tabular-nums text-slate-300">{display}</span>
      </span>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label={label}
        className="mt-1 h-1.5 w-full cursor-pointer appearance-none rounded-full bg-white/10 accent-cyan-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 disabled:cursor-not-allowed"
      />
    </label>
  );
}

/**
 * Compact, collapsible calibration panel for the human-image overlay.
 * All controls are native inputs/buttons so they stay keyboard accessible.
 */
export function OverlayControls({ overlay, modes = DEFAULT_MODES, className = "" }: OverlayControlsProps) {
  const reactId = useId();
  const panelId = `overlay-panel-${reactId.replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const field = (name: string) => `${panelId}-${name}`;
  const activeMode = modes.includes(overlay.mode) ? overlay.mode : modes[0] ?? overlay.mode;

  return (
    <div className={className} onKeyDown={(event) => event.stopPropagation()}>
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => overlay.setPanelOpen((open) => !open)}
          aria-expanded={overlay.panelOpen}
          aria-controls={panelId}
          className={`inline-flex h-8 items-center gap-1.5 rounded-lg border px-2 text-[11px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 motion-reduce:transition-none ${
            overlay.panelOpen
              ? "border-cyan-400/60 bg-cyan-400/15 text-cyan-200"
              : "border-white/10 bg-white/[0.03] text-slate-300 active:bg-white/10"
          }`}
        >
          <Layers size={13} />
          <span>Body image</span>
          <ChevronDown
            size={13}
            className={`transition-transform motion-reduce:transition-none ${overlay.panelOpen ? "rotate-180" : ""}`}
          />
        </button>

        <Toggle
          label="Overlay"
          checked={overlay.enabled}
          onChange={(next) => overlay.set("enabled", next)}
        />
      </div>

      {overlay.panelOpen && (
        <div
          id={panelId}
          role="group"
          aria-label="Body image overlay controls"
          className="mt-2 space-y-2 rounded-xl border border-white/10 bg-white/[0.03] p-2.5"
        >
          <Slider
            id={field("opacity")}
            label="Opacity"
            value={overlay.opacity}
            min={0}
            max={1}
            step={0.05}
            display={`${Math.round(overlay.opacity * 100)}%`}
            onChange={(next) => overlay.set("opacity", next)}
          />

          <div className="grid grid-cols-2 gap-2">
            <Slider
              id={field("stretch-x")}
              label="Stretch X"
              value={overlay.stretchX}
              min={0.5}
              max={1.5}
              step={0.01}
              display={`${overlay.stretchX.toFixed(2)}x`}
              onChange={(next) => overlay.set("stretchX", next)}
            />
            <Slider
              id={field("stretch-y")}
              label="Stretch Y"
              value={overlay.stretchY}
              min={0.5}
              max={1.5}
              step={0.01}
              display={`${overlay.stretchY.toFixed(2)}x`}
              onChange={(next) => overlay.set("stretchY", next)}
              disabled={overlay.lockAspect}
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Slider
              id={field("offset-x")}
              label="Offset X"
              value={overlay.offsetX}
              min={-100}
              max={100}
              step={1}
              display={`${Math.round(overlay.offsetX)}`}
              onChange={(next) => overlay.set("offsetX", next)}
            />
            <Slider
              id={field("offset-y")}
              label="Offset Y"
              value={overlay.offsetY}
              min={-100}
              max={100}
              step={1}
              display={`${Math.round(overlay.offsetY)}`}
              onChange={(next) => overlay.set("offsetY", next)}
            />
          </div>

          <label className="flex items-center justify-between gap-2 text-[11px] text-slate-400">
            <span>Mode</span>
            <select
              value={activeMode}
              onChange={(e) => overlay.set("mode", e.target.value as BodyOverlayMode)}
              aria-label="Image placement mode"
              className="h-7 rounded-md border border-white/10 bg-slate-900 px-1.5 text-[11px] text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
            >
              {modes.map((mode) => (
                <option key={mode} value={mode}>
                  {MODE_LABELS[mode]}
                </option>
              ))}
            </select>
          </label>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-white/10 pt-2">
            <Toggle
              label="Lock aspect"
              checked={overlay.lockAspect}
              onChange={(next) => overlay.set("lockAspect", next)}
            />
            <Toggle
              label="Flip image"
              checked={overlay.flip}
              onChange={(next) => overlay.set("flip", next)}
            />
            <Toggle
              label="Fade regions"
              checked={overlay.regionsFaded}
              onChange={(next) => overlay.set("regionsFaded", next)}
            />
            <Toggle
              label="Blend"
              checked={overlay.blend}
              onChange={(next) => overlay.set("blend", next)}
            />
            <Toggle
              label="Outline"
              checked={overlay.outline}
              onChange={(next) => overlay.set("outline", next)}
            />
          </div>

          <div className="flex items-center justify-between gap-2 border-t border-white/10 pt-2">
            <span className="inline-flex items-center gap-1 text-[10px] text-slate-500">
              <FlipHorizontal size={12} />
              Screen blend suits the X-ray figure.
            </span>
            <button
              type="button"
              onClick={overlay.reset}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] px-2 text-[11px] text-slate-300 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 active:bg-white/10 motion-reduce:transition-none"
            >
              <RotateCcw size={13} />
              Reset
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
