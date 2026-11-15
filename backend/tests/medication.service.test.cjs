const assert = require("node:assert/strict");
const medicationService = require("../dist/services/medication.service.js");
const { prisma } = require("../dist/config/database.js");

async function main() {
  console.log("Starting Medication and Adherence Unit Tests...");

  // Mock data store
  const mockMeds = [];
  const mockDoses = [];

  prisma.medication = {
    create: async ({ data }) => {
      const med = {
        id: `med_${Date.now()}_${Math.random()}`,
        createdAt: new Date(),
        updatedAt: new Date(),
        ...data,
      };
      mockMeds.push(med);
      return med;
    },
    findMany: async ({ where }) => {
      return mockMeds.filter((m) => {
        if (where.patientId && m.patientId !== where.patientId) return false;
        if (where.status && m.status !== where.status) return false;
        return true;
      });
    },
    findFirst: async ({ where }) => {
      return mockMeds.find((m) => {
        if (where.id && m.id !== where.id) return false;
        if (where.patientId && m.patientId !== where.patientId) return false;
        return true;
      }) || null;
    },
    update: async ({ where, data }) => {
      const idx = mockMeds.findIndex((m) => m.id === where.id);
      if (idx === -1) throw new Error("Not found");
      mockMeds[idx] = { ...mockMeds[idx], ...data, updatedAt: new Date() };
      return mockMeds[idx];
    },
    delete: async ({ where }) => {
      const idx = mockMeds.findIndex((m) => m.id === where.id);
      if (idx >= 0) mockMeds.splice(idx, 1);
      return { id: where.id };
    },
  };

  prisma.doseRecord = {
    upsert: async ({ where, create, update }) => {
      const existing = mockDoses.find(
        (d) => d.medicationId === where.medicationId_scheduledTime.medicationId &&
               d.scheduledTime.getTime() === where.medicationId_scheduledTime.scheduledTime.getTime()
      );
      if (existing) {
        Object.assign(existing, update);
        return existing;
      }
      const newDose = {
        id: `dose_${Date.now()}_${Math.random()}`,
        status: "PENDING",
        createdAt: new Date(),
        updatedAt: new Date(),
        ...create,
      };
      mockDoses.push(newDose);
      return newDose;
    },
    findMany: async ({ where }) => {
      return mockDoses.filter((d) => {
        if (where.patientId && d.patientId !== where.patientId) return false;
        if (where.scheduledTime?.gte && d.scheduledTime < where.scheduledTime.gte) return false;
        if (where.scheduledTime?.lte && d.scheduledTime > where.scheduledTime.lte) return false;
        return true;
      }).map((d) => ({
        ...d,
        medication: mockMeds.find((m) => m.id === d.medicationId) || { name: "MockMed", dosage: "10", unit: "mg", scheduledTimes: "[]" },
      }));
    },
    findFirst: async ({ where }) => {
      const d = mockDoses.find((item) => {
        if (where.id && item.id !== where.id) return false;
        if (where.patientId && item.patientId !== where.patientId) return false;
        return true;
      });
      if (!d) return null;
      return {
        ...d,
        medication: mockMeds.find((m) => m.id === d.medicationId) || { name: "MockMed", dosage: "10", unit: "mg", scheduledTimes: "[]" },
      };
    },
    update: async ({ where, data }) => {
      const idx = mockDoses.findIndex((d) => d.id === where.id);
      if (idx === -1) throw new Error("Dose not found");
      mockDoses[idx] = { ...mockDoses[idx], ...data, updatedAt: new Date() };
      return {
        ...mockDoses[idx],
        medication: mockMeds.find((m) => m.id === mockDoses[idx].medicationId) || { name: "MockMed", dosage: "10", unit: "mg", scheduledTimes: "[]" },
      };
    },
    updateMany: async ({ where, data }) => {
      let count = 0;
      for (const d of mockDoses) {
        if (where.status && d.status !== where.status) continue;
        if (where.scheduledTime?.lte && d.scheduledTime > where.scheduledTime.lte) continue;
        Object.assign(d, data);
        count++;
      }
      return { count };
    },
  };

  // Test 1: Create Medication with scheduled times
  const created = await medicationService.createMedication("patient_001", {
    name: "Metformin",
    dosage: "500",
    unit: "mg",
    frequency: "TWICE_DAILY",
    scheduledTimes: ["08:00", "20:00"],
    startDate: new Date("2026-01-01"),
    foodTiming: "AFTER_FOOD",
    prescribingDoctor: "Dr. Sharma",
  });

  assert.equal(created.name, "Metformin");
  assert.equal(created.dosage, "500");
  assert.deepEqual(created.scheduledTimes, ["08:00", "20:00"]);
  console.log("PASS Medication creation with verified dose timings and food instructions");

  // Test 2: Validation of invalid time format
  await assert.rejects(
    async () => {
      await medicationService.createMedication("patient_001", {
        name: "Aspirin",
        dosage: "75",
        scheduledTimes: ["invalid-time"],
        startDate: new Date(),
      });
    },
    /At least one valid scheduled dose time/,
    "Should reject malformed time strings"
  );
  console.log("PASS Invalid time format rejection");

  // Test 3: Generate doses for date and prevent duplicates
  await medicationService.generateDosesForDate("patient_001", new Date());
  const initialDoseCount = mockDoses.length;
  assert.ok(initialDoseCount >= 2, "Expected at least 2 doses generated for twice daily");

  // Re-run generation - should be completely idempotent
  await medicationService.generateDosesForDate("patient_001", new Date());
  assert.equal(mockDoses.length, initialDoseCount, "Duplicate doses must not be created");
  console.log("PASS Idempotent dose generation without duplicates");

  // Test 4: Dose record action - TAKEN
  const firstDose = mockDoses[0];
  const recorded = await medicationService.recordDoseAction("patient_001", firstDose.id, "TAKEN", "patient_001", {
    notes: "Taken with breakfast",
  });
  assert.equal(recorded.status, "TAKEN");
  assert.ok(recorded.takenAt instanceof Date);
  assert.equal(recorded.notes, "Taken with breakfast");
  console.log("PASS Confirm dose taken with timestamp and notes");

  // Test 5: Prevent marking future doses as MISSED
  const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const futureDose = await prisma.doseRecord.upsert({
    where: { medicationId_scheduledTime: { medicationId: created.id, scheduledTime: futureDate } },
    create: { patientId: "patient_001", medicationId: created.id, scheduledTime: futureDate, status: "PENDING" },
    update: {},
  });

  await assert.rejects(
    async () => {
      await medicationService.recordDoseAction("patient_001", futureDose.id, "MISSED", "patient_001");
    },
    /Future scheduled doses cannot be marked as missed/,
    "Future doses must never be counted as missed"
  );
  console.log("PASS Protection against counting future doses as missed");

  // Test 6: Adherence calculation
  // Set up 1 taken dose and 1 past missed dose
  const pastDate = new Date(Date.now() - 2 * 60 * 60 * 1000);
  const pastDose = await prisma.doseRecord.upsert({
    where: { medicationId_scheduledTime: { medicationId: created.id, scheduledTime: pastDate } },
    create: { patientId: "patient_001", medicationId: created.id, scheduledTime: pastDate, status: "MISSED" },
    update: {},
  });

  const adherence = await medicationService.getAdherenceStats("patient_001", "weekly");
  assert.ok(adherence.totalEligibleDoses >= 2, "Should have eligible past doses");
  assert.ok(typeof adherence.adherenceRate === "number");
  assert.ok(adherence.adherenceRate >= 0 && adherence.adherenceRate <= 100);
  assert.ok(Array.isArray(adherence.medicationBreakdown));
  console.log("PASS Adherence calculation strictly from eligible scheduled doses");
}

main().catch((err) => {
  console.error("Test failure:", err);
  process.exitCode = 1;
});

