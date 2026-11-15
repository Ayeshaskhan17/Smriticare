const assert = require("node:assert/strict");
const notificationService = require("../dist/services/notification.service.js");
const { prisma } = require("../dist/config/database.js");

async function main() {
  console.log("Starting Automated Notification Unit Tests...");

  const mockLogs = [];
  const mockUsers = [
    {
      id: "patient_001",
      fullName: "Elderly Parent",
      email: "parent@example.com",
      notificationEmail: null,
      emailNotificationsEnabled: true,
    },
  ];

  prisma.notificationLog = {
    findUnique: async ({ where }) => {
      return mockLogs.find((l) => l.idempotencyKey === where.idempotencyKey) || null;
    },
    upsert: async ({ where, create, update }) => {
      const existing = mockLogs.find((l) => l.idempotencyKey === where.idempotencyKey);
      if (existing) {
        Object.assign(existing, update);
        return existing;
      }
      const newLog = {
        id: `log_${Date.now()}_${Math.random()}`,
        status: "PENDING",
        attempts: 1,
        createdAt: new Date(),
        ...create,
      };
      mockLogs.push(newLog);
      return newLog;
    },
    update: async ({ where, data }) => {
      const idx = mockLogs.findIndex((l) => l.id === where.id);
      if (idx === -1) throw new Error("Log not found");
      mockLogs[idx] = { ...mockLogs[idx], ...data };
      return mockLogs[idx];
    },
  };

  prisma.user = {
    findUnique: async ({ where }) => {
      return mockUsers.find((u) => u.id === where.id) || null;
    },
  };

  // Test 1: Dispatch notification in verified simulation test mode
  const idempotencyKey = `med_reminder_${Date.now()}`;
  const dispatched = await notificationService.dispatchNotification({
    patientId: "patient_001",
    recipientEmail: "parent@example.com",
    type: "MEDICATION_UPCOMING",
    title: "Upcoming Dose: Aspirin",
    content: "Please take Aspirin 75mg after food.",
    idempotencyKey,
  });

  assert.ok(dispatched);
  assert.equal(dispatched.status, "SENT");
  assert.equal(dispatched.idempotencyKey, idempotencyKey);
  console.log("PASS Server-side email notification dispatch with simulation mode verification");

  // Test 2: Idempotency protection against duplicate notifications
  const duplicateAttempt = await notificationService.dispatchNotification({
    patientId: "patient_001",
    recipientEmail: "parent@example.com",
    type: "MEDICATION_UPCOMING",
    title: "Upcoming Dose: Aspirin",
    content: "Duplicate attempt",
    idempotencyKey,
  });

  assert.equal(duplicateAttempt.id, dispatched.id);
  assert.equal(mockLogs.length, 1, "Duplicate notification must not be inserted into logs");
  console.log("PASS Idempotency protection prevents duplicate emails");

  // Test 3: Respect user notification preferences
  mockUsers[0].emailNotificationsEnabled = false;
  const disabledAttempt = await notificationService.dispatchNotification({
    patientId: "patient_001",
    recipientEmail: "parent@example.com",
    type: "MEDICATION_UPCOMING",
    title: "Should Not Send",
    content: "Testing preference enforcement",
    idempotencyKey: `disabled_pref_${Date.now()}`,
  });

  assert.equal(disabledAttempt, null, "Notification must be skipped when user opted out");
  console.log("PASS Notification preferences respected");
}

main().catch((err) => {
  console.error("Test failure:", err);
  process.exitCode = 1;
});

