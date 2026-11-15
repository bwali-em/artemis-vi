import type { HealthConsultationRecord } from "../types/health";

const STORAGE_KEY = "artemis_health_consultations";

function getAll(): HealthConsultationRecord[] {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

function saveAll(records: HealthConsultationRecord[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

export const healthConsultationRepository = {
  getAll(): HealthConsultationRecord[] {
    return getAll();
  },

  getByAstronaut(astronautId: string): HealthConsultationRecord[] {
    return getAll().filter((r) => r.astronautId === astronautId);
  },

  getLatest(astronautId: string): HealthConsultationRecord | null {
    const records = this.getByAstronaut(astronautId);
    return records.length > 0 ? records[records.length - 1] : null;
  },

  save(record: Omit<HealthConsultationRecord, "id">): HealthConsultationRecord {
    const records = getAll();
    const newRecord: HealthConsultationRecord = {
      ...record,
      id: `hc_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    };
    records.push(newRecord);
    saveAll(records);
    return newRecord;
  },

  update(id: string, updates: Partial<HealthConsultationRecord>): HealthConsultationRecord | null {
    const records = getAll();
    const index = records.findIndex((r) => r.id === id);
    if (index === -1) return null;
    records[index] = { ...records[index], ...updates };
    saveAll(records);
    return records[index];
  },

  delete(id: string): boolean {
    const records = getAll();
    const filtered = records.filter((r) => r.id !== id);
    if (filtered.length === records.length) return false;
    saveAll(filtered);
    return true;
  },

  clearAll(): void {
    localStorage.removeItem(STORAGE_KEY);
  },
};