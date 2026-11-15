import type { AnatomyRegion } from "../types/bodyMap";

/**
 * Front-facing anatomical body map, drawn in a 400 x 800 viewBox.
 * Approximately 30 selectable regions. The left/right naming is the
 * astronaut's own left/right (i.e. the right side of the screen when
 * facing the viewer, mirrored to match the camera).
 */
export const ANATOMY_REGIONS: AnatomyRegion[] = [
  // ---- Head & neck ----
  {
    id: "head",
    name: "Head",
    category: "head_neck",
    side: "center",
    path: "M200 22 C176 22 160 40 160 66 C160 92 178 112 200 112 C222 112 240 92 240 66 C240 40 224 22 200 22 Z",
  },
  {
    id: "neck",
    name: "Neck",
    category: "head_neck",
    side: "center",
    path: "M184 110 L216 110 L220 140 L180 140 Z",
  },
  // ---- Torso ----
  {
    id: "left-shoulder",
    name: "Left Shoulder",
    category: "torso",
    side: "left",
    path: "M180 140 C160 140 128 150 112 168 C104 178 108 196 120 200 C138 206 168 200 184 190 L184 140 Z",
  },
  {
    id: "right-shoulder",
    name: "Right Shoulder",
    category: "torso",
    side: "right",
    path: "M220 140 C240 140 272 150 288 168 C296 178 292 196 280 200 C262 206 232 200 216 190 L216 140 Z",
  },
  {
    id: "chest",
    name: "Chest",
    category: "torso",
    side: "center",
    path: "M184 140 L216 140 L216 200 C216 220 224 236 224 250 L176 250 C176 236 184 220 184 200 Z",
  },
  {
    id: "upper-abdomen",
    name: "Upper Abdomen",
    category: "torso",
    side: "center",
    path: "M176 252 L224 252 L230 300 L170 300 Z",
  },
  {
    id: "lower-abdomen",
    name: "Lower Abdomen",
    category: "torso",
    side: "center",
    path: "M170 302 L230 302 L234 348 L166 348 Z",
  },
  {
    id: "left-oblique",
    name: "Left Oblique",
    category: "torso",
    side: "left",
    path: "M184 190 C168 200 148 208 140 214 C138 240 150 280 160 300 L176 250 C184 226 184 208 184 190 Z",
  },
  {
    id: "right-oblique",
    name: "Right Oblique",
    category: "torso",
    side: "right",
    path: "M216 190 C232 200 252 208 260 214 C262 240 250 280 240 300 L224 250 C216 226 216 208 216 190 Z",
  },
  // ---- Arms ----
  {
    id: "left-upper-arm",
    name: "Left Upper Arm",
    category: "arm",
    side: "left",
    path: "M120 200 C112 230 108 262 112 288 C124 292 138 290 146 284 C146 256 144 224 138 200 Z",
  },
  {
    id: "right-upper-arm",
    name: "Right Upper Arm",
    category: "arm",
    side: "right",
    path: "M280 200 C288 230 292 262 288 288 C276 292 262 290 254 284 C254 256 256 224 262 200 Z",
  },
  {
    id: "left-forearm",
    name: "Left Forearm",
    category: "arm",
    side: "left",
    path: "M112 288 C108 314 108 340 114 360 C124 364 136 362 144 356 C144 332 142 308 140 288 Z",
  },
  {
    id: "right-forearm",
    name: "Right Forearm",
    category: "arm",
    side: "right",
    path: "M288 288 C292 314 292 340 286 360 C276 364 264 362 256 356 C256 332 258 308 260 288 Z",
  },
  {
    id: "left-hand",
    name: "Left Hand",
    category: "hand",
    side: "left",
    path: "M114 360 C110 372 112 384 118 392 C126 396 136 394 142 388 C144 378 144 368 144 356 C134 362 122 364 114 360 Z",
  },
  {
    id: "right-hand",
    name: "Right Hand",
    category: "hand",
    side: "right",
    path: "M286 360 C290 372 288 384 282 392 C274 396 264 394 258 388 C256 378 256 368 256 356 C266 362 278 364 286 360 Z",
  },
  // ---- Pelvis ----
  {
    id: "pelvis",
    name: "Pelvis",
    category: "pelvis",
    side: "center",
    path: "M166 350 L234 350 C238 366 232 384 216 392 L184 392 C168 384 162 366 166 350 Z",
  },
  // ---- Legs ----
  {
    id: "left-quadriceps",
    name: "Left Quadriceps",
    category: "leg",
    side: "left",
    path: "M166 394 C160 420 158 448 160 472 L186 472 C188 446 188 418 184 394 Z",
  },
  {
    id: "right-quadriceps",
    name: "Right Quadriceps",
    category: "leg",
    side: "right",
    path: "M234 394 C240 420 242 448 240 472 L214 472 C212 446 212 418 216 394 Z",
  },
  {
    id: "left-knee",
    name: "Left Knee",
    category: "leg",
    side: "left",
    path: "M160 474 C158 484 160 494 166 500 L186 500 C190 492 190 482 186 472 L160 474 Z",
  },
  {
    id: "right-knee",
    name: "Right Knee",
    category: "leg",
    side: "right",
    path: "M240 474 C242 484 240 494 234 500 L214 500 C210 492 210 482 214 472 L240 474 Z",
  },
  {
    id: "left-tibia",
    name: "Left Tibia (Shin)",
    category: "leg",
    side: "left",
    path: "M166 502 C162 532 162 566 168 596 C176 602 186 600 192 594 C192 566 188 532 186 502 Z",
  },
  {
    id: "right-tibia",
    name: "Right Tibia (Shin)",
    category: "leg",
    side: "right",
    path: "M234 502 C238 532 238 566 232 596 C224 602 214 600 208 594 C208 566 212 532 214 502 Z",
  },
  {
    id: "left-calf",
    name: "Left Calf",
    category: "leg",
    side: "left",
    path: "M168 598 C166 610 170 622 178 628 C186 632 194 628 198 620 C198 610 194 600 192 596 C186 600 174 602 168 598 Z",
  },
  {
    id: "right-calf",
    name: "Right Calf",
    category: "leg",
    side: "right",
    path: "M232 598 C234 610 230 622 222 628 C214 632 206 628 202 620 C202 610 206 600 208 596 C214 600 226 602 232 598 Z",
  },
  {
    id: "left-ankle",
    name: "Left Ankle",
    category: "foot",
    side: "left",
    path: "M178 630 C174 638 176 648 182 652 L196 652 C200 646 200 636 198 628 C192 632 182 632 178 630 Z",
  },
  {
    id: "right-ankle",
    name: "Right Ankle",
    category: "foot",
    side: "right",
    path: "M222 630 C226 638 224 648 218 652 L204 652 C200 646 200 636 202 628 C208 632 218 632 222 630 Z",
  },
  {
    id: "left-foot",
    name: "Left Foot",
    category: "foot",
    side: "left",
    path: "M182 654 C176 662 174 674 178 684 C186 690 198 688 204 680 C206 670 204 660 198 654 Z",
  },
  {
    id: "right-foot",
    name: "Right Foot",
    category: "foot",
    side: "right",
    path: "M218 654 C224 662 226 674 222 684 C214 690 202 688 196 680 C194 670 196 660 202 654 Z",
  },
];

export const REGION_BY_ID: Record<string, AnatomyRegion> = Object.fromEntries(
  ANATOMY_REGIONS.map((r) => [r.id, r])
);

export const STATUS_COLORS: Record<string, string> = {
  normal: "#95C11E",
  monitor: "#F2C811",
  attention: "#F08A1E",
  critical: "#E03131",
  unassessed: "#6B7280",
};

export const RATING_COLORS: Record<string, string> = {
  green: "#95C11E",
  yellow: "#F2C811",
  orange: "#F08A1E",
  red: "#E03131",
  grey: "#6B7280",
};

export const RATING_LABELS: Record<string, string> = {
  green: "Normal",
  yellow: "Monitor",
  orange: "Attention",
  red: "Critical",
  grey: "Not Assessed",
};