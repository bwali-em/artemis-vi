export interface UserDetails {
  id: string;
  username: string;
  userRole: string;
  position: string;
  healthStatus: string;
  medicalHistory: string;
  currentIssues: string;
  updatedAt: number;
}

export interface SleepLog {
  id: string;
  userId: string;
  startTime: number;
  endTime: number;
  durationMs: number;
  date: string; // YYYY-MM-DD (local)
  day: string;  // e.g. Monday
}

export type SleepQuality = "Healthy" | "Borderline" | "Insufficient" | "Excessive";

export interface SleepAnalysis {
  quality: SleepQuality;
  message: string;
  recommendedMinHours: number;
  recommendedMaxHours: number;
}
