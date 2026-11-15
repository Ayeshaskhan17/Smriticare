import { getToken } from "./authStorage";
import { API_BASE_URL } from "../constants/api";

export type TimelineEvent = {
  id: string;
  type: "MEDICATION_DOSE" | "APPOINTMENT" | "ALERT" | "COGNITIVE_SCORE" | "TASK";
  title: string;
  description: string;
  timestamp: string;
  status?: string;
  badgeColor?: string;
  metadata?: any;
};

export async function getSharedTimeline(patientId?: string, limit = 50): Promise<TimelineEvent[]> {
  const token = await getToken();
  const params = new URLSearchParams();
  if (patientId) params.append("patientId", patientId);
  params.append("limit", String(limit));

  const response = await fetch(`${API_BASE_URL}/api/timeline?${params.toString()}`, {
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  const data = await response.json();
  if (!response.ok || !data.success) {
    throw new Error(data.message || "Failed to load shared activity timeline");
  }
  return data.timeline || [];
}

