import { useState, useEffect } from "react";
import { DashboardPage } from "./pages/DashboardPage";
import { EarthBackdrop } from "./components/layout/EarthBackdrop";
import {
  AiSymptomAssistant,
  type LoggedAssessment,
} from "./components/wellbeing/AiSymptomAssistant";

const STORAGE_KEY = "astra_mission_triage_logs";

export default function App() {
  const [missionTriageLogs, setMissionTriageLogs] = useState<LoggedAssessment[]>(
    () => {
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        return saved ? JSON.parse(saved) : [];
      } catch {
        return [];
      }
    }
  );

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(missionTriageLogs));
    } catch {
      // Ignore storage quota errors
    }
  }, [missionTriageLogs]);

  const handleClearMissionLogs = () => {
    setMissionTriageLogs([]);
    localStorage.removeItem(STORAGE_KEY);
  };

  const handleAddMissionLog = (log: LoggedAssessment) => {
    setMissionTriageLogs((prev) => [...prev, log]);
  };

  return (
    <div className="relative min-h-[100svh] overflow-hidden bg-[#020617]">
      <EarthBackdrop />
      <div className="relative z-10 min-h-[100svh]">
        <DashboardPage missionTriageLogs={missionTriageLogs} />

        <div className="mt-6 max-w-7xl mx-auto px-4 pb-12 space-y-6">
          <AiSymptomAssistant
            missionTriageLogs={missionTriageLogs}
            onAddMissionLog={handleAddMissionLog}
            onClearMissionLogs={handleClearMissionLogs}
          />
        </div>
      </div>
    </div>
  );
}