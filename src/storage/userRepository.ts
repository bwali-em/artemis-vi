import type { UserDetails, SleepLog } from "../types/user";

const USER_KEY = "artemis_user_details";
const SLEEP_KEY = "artemis_sleep_logs";

const DEFAULT_USER: UserDetails = {
  id: "user-1",
  username: "",
  userRole: "",
  position: "",
  healthStatus: "",
  medicalHistory: "",
  currentIssues: "",
  updatedAt: 0,
};

export const userRepository = {
  get(): UserDetails {
    try {
      const raw = localStorage.getItem(USER_KEY);
      if (!raw) return { ...DEFAULT_USER };
      return { ...DEFAULT_USER, ...(JSON.parse(raw) as Partial<UserDetails>) };
    } catch {
      return { ...DEFAULT_USER };
    }
  },
  save(details: Omit<UserDetails, "id" | "updatedAt"> & { id?: string }): UserDetails {
    const record: UserDetails = {
      ...DEFAULT_USER,
      ...details,
      id: details.id || "user-1",
      updatedAt: Date.now(),
    };
    localStorage.setItem(USER_KEY, JSON.stringify(record));
    return record;
  },
};

function readSleepLogs(): SleepLog[] {
  try {
    const raw = localStorage.getItem(SLEEP_KEY);
    return raw ? (JSON.parse(raw) as SleepLog[]) : [];
  } catch {
    return [];
  }
}

function writeSleepLogs(logs: SleepLog[]): void {
  localStorage.setItem(SLEEP_KEY, JSON.stringify(logs));
}

export const sleepRepository = {
  getAll(userId = "user-1"): SleepLog[] {
    return readSleepLogs()
      .filter((l) => l.userId === userId)
      .sort((a, b) => b.startTime - a.startTime);
  },
  getActive(userId = "user-1"): SleepLog | null {
    const logs = readSleepLogs().filter((l) => l.userId === userId && !l.endTime);
    return logs[0] ?? null;
  },
  start(userId = "user-1"): SleepLog {
    const logs = readSleepLogs();
    const existing = logs.find((l) => l.userId === userId && !l.endTime);
    if (existing) return existing;
    const start = Date.now();
    const d = new Date(start);
    const log: SleepLog = {
      id: `sleep_${start}_${Math.random().toString(36).slice(2, 8)}`,
      userId,
      startTime: start,
      endTime: 0,
      durationMs: 0,
      date: d.toISOString().slice(0, 10),
      day: d.toLocaleDateString(undefined, { weekday: "long" }),
    };
    logs.push(log);
    writeSleepLogs(logs);
    return log;
  },
  stop(userId = "user-1"): SleepLog | null {
    const logs = readSleepLogs();
    const idx = logs.findIndex((l) => l.userId === userId && !l.endTime);
    if (idx === -1) return null;
    const end = Date.now();
    const start = logs[idx].startTime;
    logs[idx] = { ...logs[idx], endTime: end, durationMs: Math.max(0, end - start) };
    writeSleepLogs(logs);
    return logs[idx];
  },
  clearAll(): void {
    localStorage.removeItem(SLEEP_KEY);
  },
};

export function analyzeSleep(durationMs: number): import("../types/user").SleepAnalysis {
  const hours = durationMs / 3600000;
  const recommendedMinHours = 7;
  const recommendedMaxHours = 9;
  if (hours >= 7 && hours <= 9) {
    return { quality: "Healthy", message: "Sleep duration is within the recommended 7–9 hour range for astronauts during mission operations.", recommendedMinHours, recommendedMaxHours };
  }
  if (hours >= 6 && hours < 7) {
    return { quality: "Borderline", message: "Sleep duration is slightly below the recommended range. Monitor fatigue and consider adjusting schedule.", recommendedMinHours, recommendedMaxHours };
  }
  if (hours > 9 && hours <= 10) {
    return { quality: "Borderline", message: "Sleep duration is slightly above the typical recommended range. Review recovery needs and schedule demands.", recommendedMinHours, recommendedMaxHours };
  }
  if (hours < 6) {
    return { quality: "Insufficient", message: "Sleep duration is below the recommended range. Insufficient sleep may affect alertness, mood, and performance.", recommendedMinHours, recommendedMaxHours };
  }
  return { quality: "Excessive", message: "Sleep duration is well above the typical recommended range. Persistent excess may warrant review of fatigue or health factors.", recommendedMinHours, recommendedMaxHours };
}
