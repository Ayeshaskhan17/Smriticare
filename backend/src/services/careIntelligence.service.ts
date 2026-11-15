import { prisma } from "../config/database";
import { DoseStatus } from "@prisma/client";
import { requireCaregiverPatientAccess } from "./caregiverAccess.service";

export type CareIntelligenceReport = {
  patientId: string;
  patientName: string;
  adherenceScore: number; // 0 - 100
  riskLevel: "LOW" | "MODERATE" | "HIGH" | "CRITICAL";
  patternsDetected: string[];
  actionableInsights: string[];
  caregiverRecommendations: string[];
  summaryText: string;
  calculatedAt: string;
  disclaimer: string;
};

const MEDICAL_DISCLAIMER =
  "SmritiCare Intelligence provides behavioral adherence analytics based on logged timestamps. It is not a medical diagnosis, does not modify prescribed dosages, and does not replace professional healthcare guidance.";

export async function generateCareIntelligenceReport(
  patientId: string,
  actorId = patientId
): Promise<CareIntelligenceReport> {
  if (actorId !== patientId) {
    await requireCaregiverPatientAccess(actorId, patientId);
  }

  const patient = await prisma.user.findUnique({
    where: { id: patientId },
    select: { fullName: true },
  });

  const patientName = patient?.fullName || "Patient";

  const now = new Date();
  const past30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  // Retrieve past 30 days doses up to now
  const doses = await prisma.doseRecord.findMany({
    where: {
      patientId,
      scheduledTime: {
        gte: past30Days,
        lte: now,
      },
    },
    include: {
      medication: true,
    },
    orderBy: {
      scheduledTime: "asc",
    },
  });

  const totalDoses = doses.length;
  if (totalDoses === 0) {
    return {
      patientId,
      patientName,
      adherenceScore: 100,
      riskLevel: "LOW",
      patternsDetected: ["No historical dose records yet."],
      actionableInsights: ["Schedule your daily medications to start tracking adherence trends."],
      caregiverRecommendations: ["Ensure all active prescriptions and daily dose timings are accurately registered."],
      summaryText: `${patientName} has no overdue or recorded doses in the past 30 days.`,
      calculatedAt: now.toISOString(),
      disclaimer: MEDICAL_DISCLAIMER,
    };
  }

  let takenCount = 0;
  let missedCount = 0;
  let skippedCount = 0;

  // Patterns buckets
  const timeOfDayMisses = {
    Morning: 0, // 05:00 - 11:59
    Afternoon: 0, // 12:00 - 16:59
    Evening: 0, // 17:00 - 21:59
    Night: 0, // 22:00 - 04:59
  };

  const weekendMisses = { weekend: 0, weekday: 0 };
  const medicationMissCount: Record<string, { name: string; missed: number; total: number }> = {};

  for (const dose of doses) {
    const medName = dose.medication.name;
    if (!medicationMissCount[medName]) {
      medicationMissCount[medName] = { name: medName, missed: 0, total: 0 };
    }
    medicationMissCount[medName].total += 1;

    const hour = dose.scheduledTime.getHours();
    const day = dose.scheduledTime.getDay();
    const isWeekend = day === 0 || day === 6;

    if (dose.status === DoseStatus.TAKEN) {
      takenCount++;
    } else if (dose.status === DoseStatus.MISSED) {
      missedCount++;
      medicationMissCount[medName].missed += 1;

      if (isWeekend) weekendMisses.weekend++;
      else weekendMisses.weekday++;

      if (hour >= 5 && hour < 12) timeOfDayMisses.Morning++;
      else if (hour >= 12 && hour < 17) timeOfDayMisses.Afternoon++;
      else if (hour >= 17 && hour < 22) timeOfDayMisses.Evening++;
      else timeOfDayMisses.Night++;
    } else if (dose.status === DoseStatus.SKIPPED) {
      skippedCount++;
    }
  }

  const adherenceScore = Math.round((takenCount / totalDoses) * 100);

  // Risk Level determination
  let riskLevel: CareIntelligenceReport["riskLevel"] = "LOW";
  if (adherenceScore < 60 || missedCount >= 7) {
    riskLevel = "CRITICAL";
  } else if (adherenceScore < 75 || missedCount >= 4) {
    riskLevel = "HIGH";
  } else if (adherenceScore < 88 || missedCount >= 2) {
    riskLevel = "MODERATE";
  }

  const patternsDetected: string[] = [];
  const actionableInsights: string[] = [];
  const caregiverRecommendations: string[] = [];

  // Identify peak miss window
  const highestWindow = Object.entries(timeOfDayMisses).reduce((max, curr) => (curr[1] > max[1] ? curr : max), ["None", 0]);
  if (highestWindow[1] >= 2) {
    patternsDetected.push(`Highest concentration of missed doses occurs in the ${highestWindow[0]} (${highestWindow[1]} missed doses).`);
    actionableInsights.push(`Doses scheduled in the ${highestWindow[0]} window need reinforced reminders.`);
    caregiverRecommendations.push(`Consider a phone check-in or alarm calibration during ${highestWindow[0]} hours.`);
  }

  // Identify weekend vs weekday differences
  if (weekendMisses.weekend >= 3 && weekendMisses.weekend > weekendMisses.weekday) {
    patternsDetected.push("Higher frequency of missed doses on weekends compared to weekdays.");
    actionableInsights.push("Disrupted weekend routines appear to correlate with forgotten medication.");
    caregiverRecommendations.push("Set audio or caregiver reminders tailored specifically for Saturday and Sunday.");
  }

  // Identify specific problematic medications
  const problematicMeds = Object.values(medicationMissCount).filter((m) => m.missed >= 2);
  for (const med of problematicMeds) {
    const medAdherence = Math.round(((med.total - med.missed) / med.total) * 100);
    patternsDetected.push(`${med.name} has an adherence rate of ${medAdherence}% (${med.missed} missed out of ${med.total}).`);
  }

  if (actionableInsights.length === 0) {
    actionableInsights.push("Overall medication adherence is consistent and aligned with prescribed schedules.");
  }
  if (caregiverRecommendations.length === 0) {
    caregiverRecommendations.push("Maintain current reminder schedule and continue positive reinforcement.");
  }

  const summaryText = `${patientName}'s 30-day medication adherence is ${adherenceScore}%. With ${takenCount} taken and ${missedCount} missed doses, the patient is currently assessed at ${riskLevel} risk.`;

  return {
    patientId,
    patientName,
    adherenceScore,
    riskLevel,
    patternsDetected,
    actionableInsights,
    caregiverRecommendations,
    summaryText,
    calculatedAt: now.toISOString(),
    disclaimer: MEDICAL_DISCLAIMER,
  };
}

