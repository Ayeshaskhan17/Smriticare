const assert = require("node:assert/strict");
const careIntelligence = require("../dist/services/careIntelligence.service.js");
const { prisma } = require("../dist/config/database.js");

async function main() {
  console.log("Starting Care Intelligence Unit Tests...");

  const mockPatient = { id: "pat_001", fullName: "Kashif Sen" };
  const mockDoses = [];

  prisma.user = {
    findUnique: async () => mockPatient,
  };

  prisma.doseRecord = {
    findMany: async () => mockDoses,
  };

  // Test 1: Empty dose history baseline
  const baseline = await careIntelligence.generateCareIntelligenceReport("pat_001");
  assert.equal(baseline.adherenceScore, 100);
  assert.equal(baseline.riskLevel, "LOW");
  assert.ok(baseline.disclaimer.includes("does not replace professional healthcare guidance"));
  console.log("PASS Care Intelligence handles empty history with safe non-diagnostic baseline");

  // Test 2: Missed doses pattern detection (afternoon cluster)
  const now = new Date();
  for (let i = 0; i < 5; i++) {
    const afternoonTime = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    afternoonTime.setHours(14, 0, 0, 0); // 2:00 PM
    mockDoses.push({
      id: `d_miss_${i}`,
      patientId: "pat_001",
      scheduledTime: afternoonTime,
      status: "MISSED",
      medication: { name: "Blood Pressure Med" },
    });
  }
  for (let i = 0; i < 15; i++) {
    const morningTime = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    morningTime.setHours(8, 0, 0, 0);
    mockDoses.push({
      id: `d_taken_${i}`,
      patientId: "pat_001",
      scheduledTime: morningTime,
      status: "TAKEN",
      medication: { name: "Multivitamin" },
    });
  }

  const report = await careIntelligence.generateCareIntelligenceReport("pat_001");
  assert.ok(report.adherenceScore === 75); // 15 taken out of 20 = 75%
  assert.equal(report.riskLevel, "HIGH");
  assert.ok(report.patternsDetected.some((p) => p.includes("Afternoon")), "Should identify Afternoon miss pattern");
  assert.ok(report.actionableInsights.length > 0);
  assert.ok(report.caregiverRecommendations.length > 0);
  console.log("PASS Pattern analysis identifies afternoon medication misses and actionable caregiver recommendations");
}

main().catch((err) => {
  console.error("Test failure:", err);
  process.exitCode = 1;
});

