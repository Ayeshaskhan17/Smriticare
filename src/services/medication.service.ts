import { getToken } from "./authStorage";
import { API_BASE_URL } from "../constants/api";

export type Medication = {
  id: string;
  patientId: string;
  name: string;
  dosage: string;
  unit: string;
  frequency: string;
  scheduledTimes: string[];
  startDate: string;
  endDate?: string | null;
  foodTiming: string;
  prescribingDoctor?: string | null;
  instructions?: string | null;
  status: "ACTIVE" | "PAUSED" | "DISCONTINUED";
  createdAt: string;
  updatedAt: string;
};

export type DoseRecord = {
  id: string;
  patientId: string;
  medicationId: string;
  scheduledTime: string;
  status: "PENDING" | "TAKEN" | "MISSED" | "SKIPPED" | "SNOOZED";
  takenAt?: string | null;
  snoozedUntil?: string | null;
  recordedById?: string | null;
  notes?: string | null;
  medication: Medication;
};

export type AdherenceStats = {
  timeframe: string;
  periodStart: string;
  periodEnd: string;
  adherenceRate: number;
  totalEligibleDoses: number;
  takenDoses: number;
  missedDoses: number;
  skippedDoses: number;
  pendingOverdueDoses: number;
  medicationBreakdown: {
    medicationId: string;
    name: string;
    totalDoses: number;
    takenDoses: number;
    missedDoses: number;
    adherenceRate: number;
  }[];
  missedDosesHistory: {
    id: string;
    medicationName: string;
    dosage: string;
    scheduledTime: string;
    status: string;
  }[];
};

async function authenticatedFetch(path: string, options: RequestInit = {}) {
  const token = await getToken();
  const headers = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {}),
  };

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  });

  const data = await response.json();
  if (!response.ok || !data.success) {
    throw new Error(data.message || `Request failed with status ${response.status}`);
  }
  return data;
}

export async function getMedications(patientId?: string): Promise<Medication[]> {
  const query = patientId ? `?patientId=${encodeURIComponent(patientId)}` : "";
  const data = await authenticatedFetch(`/api/medications${query}`);
  return data.medications || [];
}

export async function createMedication(payload: {
  patientId?: string;
  name: string;
  dosage: string;
  unit?: string;
  frequency?: string;
  scheduledTimes: string[];
  startDate: string | Date;
  endDate?: string | Date | null;
  foodTiming?: string;
  prescribingDoctor?: string;
  instructions?: string;
}): Promise<Medication> {
  const data = await authenticatedFetch("/api/medications", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return data.medication;
}

export async function updateMedication(id: string, payload: any, patientId?: string): Promise<Medication> {
  const query = patientId ? `?patientId=${encodeURIComponent(patientId)}` : "";
  const data = await authenticatedFetch(`/api/medications/${id}${query}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
  return data.medication;
}

export async function deleteMedication(id: string, patientId?: string): Promise<void> {
  const query = patientId ? `?patientId=${encodeURIComponent(patientId)}` : "";
  await authenticatedFetch(`/api/medications/${id}${query}`, {
    method: "DELETE",
  });
}

export async function getTodayMedicationSchedule(date?: string, patientId?: string): Promise<DoseRecord[]> {
  const params = new URLSearchParams();
  if (date) params.append("date", date);
  if (patientId) params.append("patientId", patientId);
  const qs = params.toString() ? `?${params.toString()}` : "";

  const data = await authenticatedFetch(`/api/medications/today${qs}`);
  return data.doses || [];
}

export async function getUpcomingDoses(hours = 24, patientId?: string): Promise<DoseRecord[]> {
  const params = new URLSearchParams();
  params.append("hours", String(hours));
  if (patientId) params.append("patientId", patientId);

  const data = await authenticatedFetch(`/api/medications/upcoming?${params.toString()}`);
  return data.upcomingDoses || [];
}

export async function recordDoseAction(
  doseId: string,
  action: "TAKEN" | "MISSED" | "SKIPPED" | "SNOOZED",
  patientId?: string,
  options?: { notes?: string; snoozeMinutes?: number }
): Promise<DoseRecord> {
  const query = patientId ? `?patientId=${encodeURIComponent(patientId)}` : "";
  const data = await authenticatedFetch(`/api/medications/doses/${doseId}/action${query}`, {
    method: "POST",
    body: JSON.stringify({ action, ...options }),
  });
  return data.dose;
}

export async function getAdherenceStats(timeframe = "weekly", patientId?: string): Promise<AdherenceStats> {
  const params = new URLSearchParams();
  params.append("timeframe", timeframe);
  if (patientId) params.append("patientId", patientId);

  const data = await authenticatedFetch(`/api/medications/adherence?${params.toString()}`);
  return data.adherence;
}

