import { getToken } from "./authStorage";
import { API_BASE_URL } from "../constants/api";

export type CareIntelligenceReport = {
  patientId: string;
  patientName: string;
  adherenceScore: number;
  riskLevel: "LOW" | "MODERATE" | "HIGH" | "CRITICAL";
  patternsDetected: string[];
  actionableInsights: string[];
  caregiverRecommendations: string[];
  summaryText: string;
  calculatedAt: string;
  disclaimer: string;
};

export async function getCareIntelligenceReport(patientId?: string): Promise<CareIntelligenceReport> {
  const token = await getToken();
  const query = patientId ? `?patientId=${encodeURIComponent(patientId)}` : "";
  const response = await fetch(`${API_BASE_URL}/api/care-intelligence/report${query}`, {
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  const data = await response.json();
  if (!response.ok || !data.success) {
    throw new Error(data.message || "Failed to load care intelligence report");
  }
  return data.report;
}

