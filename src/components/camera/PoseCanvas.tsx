import { useEffect, useRef } from "react";
import { SkeletonRenderer } from "../../services/mediapipe/skeletonRenderer";
import type { PoseLandmark } from "../../types/pose";

interface PoseCanvasProps {
  landmarks: PoseLandmark[];
  width?: number;
  height?: number;
  mirror?: boolean;
  showLabels?: boolean;
}

export function PoseCanvas({
  landmarks,
  width = 1280,
  height = 720,
  mirror = true,
  showLabels = true,
}: PoseCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<SkeletonRenderer | null>(null);
  const landmarksRef = useRef<PoseLandmark[]>(landmarks);

  landmarksRef.current = landmarks;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const renderer = new SkeletonRenderer(canvas, { showLabels });
    rendererRef.current = renderer;

    const draw = () => {
      const rect = canvas.getBoundingClientRect();
      const cssW = rect.width || canvas.clientWidth || width;
      const cssH = rect.height || canvas.clientHeight || height;
      renderer.resize(cssW, cssH);
      renderer.render(landmarksRef.current, width, height, mirror);
    };

    draw();

    const observer = new ResizeObserver(draw);
    observer.observe(canvas);
    window.addEventListener("resize", draw);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", draw);
      rendererRef.current = null;
    };
  }, [width, height, mirror, showLabels]);

  useEffect(() => {
    const renderer = rendererRef.current;
    if (!renderer) return;
    renderer.render(landmarks, width, height, mirror);
  }, [landmarks, width, height, mirror]);

  return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />;
}