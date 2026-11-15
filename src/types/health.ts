export interface HealthScore {
  value: number;
  max: number;
  label: string;
  isMedical: boolean;
}

export interface AssessmentFinding {
  id: string;
  text: string;
  severity: "info" | "attention" | "critical";
}

export interface AssessmentRecommendation {
  id: string;
  text: string;
  priority: "low" | "medium" | "high";
}

export interface LandmarkVisibility {
  landmark: string;
  visible: boolean;
  visibility: number;
}

export interface DetectionStatus {
  detected: boolean;
  confidence: number;
  visibility: number;
  missingLandmarks: string[];
}

export interface AstronautProfile {
  id: string;
  name: string;
  crewId: string;
  missionName: string;
  missionRole: string;
  missionStatus: string;
  avatarUrl: string | null;
}

export interface AlertItem {
  id: number;
  title: string;
  detail: string;
  severity: "info" | "attention" | "critical";
  status: "new" | "acknowledged" | "under_review" | "resolved";
  time: string;
}

// Health Consultation Types
export type HealthSignId = 
  | "nausea" 
  | "fatigue" 
  | "body_pains" 
  | "flu_symptoms" 
  | "headache" 
  | "dizziness" 
  | "shortness_of_breath" 
  | "chest_pain" 
  | "fever" 
  | "other";

export interface HealthConsultationRecord {
  id: string;
  astronautId: string;
  date: number;
  detectedSigns: HealthSignId[];
  transcript: string;
  status: "completed" | "in_progress";
}
