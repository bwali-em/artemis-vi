interface CameraControlsProps {
  onPause: () => void;
  onResume: () => void;
  onExit: () => void;
  paused: boolean;
}

export function CameraControls({ onPause, onResume, onExit, paused }: CameraControlsProps) {
  return (
    <div className="pointer-events-auto flex items-center gap-2">
      <button
        onClick={paused ? onResume : onPause}
        className="px-4 py-2 min-h-[2.75rem] min-w-[2.75rem] rounded border border-ARTEMIS-amber/50 bg-ARTEMIS-amber/10 text-ARTEMIS-amber active:bg-ARTEMIS-amber/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 transition text-sm font-medium"
      >
        {paused ? "Resume" : "Pause"}
      </button>
      <button
        onClick={onExit}
        className="px-4 py-2 min-h-[2.75rem] min-w-[2.75rem] rounded border border-ARTEMIS-red/50 bg-ARTEMIS-red/10 text-ARTEMIS-red active:bg-ARTEMIS-red/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 transition text-sm font-medium"
      >
        Exit
      </button>
    </div>
  );
}
