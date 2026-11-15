import type { PoseLandmark } from "../../types/pose";

const CONNECTIONS: [number, number][] = [
  [11, 13], [13, 15],
  [12, 14], [14, 16],
  [11, 12],
  [11, 23], [12, 24],
  [23, 24],
  [23, 25], [25, 27],
  [24, 26], [26, 28],
  [11, 7], [12, 8],
  [7, 9], [8, 10],
  [0, 7], [0, 8],
];

const LABELS: Record<number, string> = {
  0: "Head",
  7: "L Ear",
  8: "R Ear",
  11: "L Shoulder",
  12: "R Shoulder",
  13: "L Elbow",
  14: "R Elbow",
  15: "L Wrist",
  16: "R Wrist",
  23: "L Hip",
  24: "R Hip",
  25: "L Knee",
  26: "R Knee",
  27: "L Ankle",
  28: "R Ankle",
};

export interface RenderConfig {
  landmarkColor: string;
  connectionColor: string;
  landmarkRadius: number;
  lineWidth: number;
  lowVisibilityColor: string;
  visibilityThreshold: number;
  showLabels: boolean;
  labelColor: string;
  labelFont: string;
}

const DEFAULT_CONFIG: RenderConfig = {
  landmarkColor: "#22d3ee",
  connectionColor: "rgba(34, 211, 238, 0.5)",
  landmarkRadius: 4,
  lineWidth: 2,
  lowVisibilityColor: "rgba(34, 211, 238, 0.2)",
  visibilityThreshold: 0.5,
  showLabels: true,
  labelColor: "#e2f8ff",
  labelFont: "600 11px ui-monospace, SFMono-Regular, Menlo, monospace",
};

export class SkeletonRenderer {
  private ctx: CanvasRenderingContext2D;
  private config: RenderConfig;

  constructor(canvas: HTMLCanvasElement, config: Partial<RenderConfig> = {}) {
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas context not available");
    this.ctx = ctx;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  resize(width: number, height: number): void {
    this.ctx.canvas.width = Math.max(1, Math.floor(width));
    this.ctx.canvas.height = Math.max(1, Math.floor(height));
  }

  clear(): void {
    const { width, height } = this.ctx.canvas;
    this.ctx.clearRect(0, 0, width, height);
  }

  render(
    landmarks: PoseLandmark[],
    videoWidth: number,
    videoHeight: number,
    mirror = false
  ): void {
    this.clear();
    if (landmarks.length === 0 || videoWidth <= 0 || videoHeight <= 0) return;

    const canvasW = this.ctx.canvas.width;
    const canvasH = this.ctx.canvas.height;
    const coverScale = Math.max(canvasW / videoWidth, canvasH / videoHeight);
    const dispW = videoWidth * coverScale;
    const dispH = videoHeight * coverScale;
    const offsetX = (canvasW - dispW) / 2;
    const offsetY = (canvasH - dispH) / 2;
    const px = (lm: PoseLandmark) => ({
      x: offsetX + (mirror ? 1 - lm.x : lm.x) * dispW,
      y: offsetY + lm.y * dispH,
    });

    this.ctx.lineCap = "round";

    for (const [a, b] of CONNECTIONS) {
      const lmA = landmarks[a];
      const lmB = landmarks[b];
      if (!lmA || !lmB) continue;

      const visible =
        lmA.visibility >= this.config.visibilityThreshold &&
        lmB.visibility >= this.config.visibilityThreshold;
      const pa = px(lmA);
      const pb = px(lmB);

      this.ctx.beginPath();
      this.ctx.moveTo(pa.x, pa.y);
      this.ctx.lineTo(pb.x, pb.y);
      this.ctx.strokeStyle = visible
        ? this.config.connectionColor
        : this.config.lowVisibilityColor;
      this.ctx.lineWidth = this.config.lineWidth;
      this.ctx.stroke();
    }

    for (const lm of landmarks) {
      const visible = lm.visibility >= this.config.visibilityThreshold;
      const p = px(lm);
      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y, this.config.landmarkRadius, 0, Math.PI * 2);
      this.ctx.fillStyle = visible ? this.config.landmarkColor : this.config.lowVisibilityColor;
      this.ctx.fill();
    }

    if (this.config.showLabels) {
      this.ctx.font = this.config.labelFont;
      this.ctx.textBaseline = "middle";
      this.ctx.textAlign = "left";

      for (const [index, label] of Object.entries(LABELS)) {
        const lm = landmarks[Number(index)];
        if (!lm || lm.visibility < this.config.visibilityThreshold) continue;

        const p = px(lm);
        const text = label;
        const textX = p.x + 9;
        const textY = p.y - 10;

        this.ctx.lineWidth = 3;
        this.ctx.strokeStyle = "rgba(2, 6, 23, 0.85)";
        this.ctx.strokeText(text, textX, textY);

        this.ctx.fillStyle = this.config.labelColor;
        this.ctx.fillText(text, textX, textY);
      }
    }
  }

  updateConfig(config: Partial<RenderConfig>): void {
    this.config = { ...this.config, ...config };
  }
}