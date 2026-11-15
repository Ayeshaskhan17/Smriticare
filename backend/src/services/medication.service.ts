import { prisma } from "../config/database";
import { DoseStatus, MedicationStatus } from "@prisma/client";
import { requireCaregiverPatientAccess } from "./caregiverAccess.service";

export type CreateMedicationInput = {
  name: string;
  dosage: string;
  unit?: string;
  frequency?: string;
  scheduledTimes: string[]; // e.g. ["08:00", "20:00"]
  startDate: string | Date;
  endDate?: string | Date | null;
  foodTiming?: string; // "BEFORE_FOOD" | "AFTER_FOOD" | "WITH_FOOD" | "NO_RESTRICTION"
  prescribingDoctor?: string | null;
  instructions?: string | null;
  status?: MedicationStatus;
};

export type UpdateMedicationInput = Partial<CreateMedicationInput>;

export class MedicationValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MedicationValidationError";
  }
}

export class MedicationNotFoundError extends Error {
  constructor(message = "Medication not found") {
    super(message);
    this.name = "MedicationNotFoundError";
  }
}

export class MedicationAuthorizationError extends Error {
  constructor(message = "Not authorized to access this medication") {
    super(message);
    this.name = "MedicationAuthorizationError";
  }
}

function parseDate(value: string | Date | undefined, fieldName: string): Date {
  if (!value) throw new MedicationValidationError(`${fieldName} is required`);
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new MedicationValidationError(`Invalid ${fieldName}`);
  }
  return date;
}

function parseScheduledTimes(times: unknown): string[] {
  let list: string[] = [];
  if (Array.isArray(times)) {
    list = times.map((t) => String(t).trim());
  } else if (typeof times === "string") {
    try {
      const parsed = JSON.parse(times);
      if (Array.isArray(parsed)) list = parsed.map((t) => String(t).trim());
      else list = [times.trim()];
    } catch {
      list = times.split(",").map((t) => t.trim());
    }
  }

  const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
  const validated = list.filter((t) => timeRegex.test(t));
  if (validated.length === 0) {
    throw new MedicationValidationError("At least one valid scheduled dose time (HH:MM format) is required");
  }
  return Array.from(new Set(validated)).sort();
}

/**
 * Ensures user or caregiver has access to patient data.
 */
export async function assertPatientAccess(actorId: string, patientId: string) {
  if (actorId === patientId) return;
  await requireCaregiverPatientAccess(actorId, patientId);
}

/**
 * Add a new medication for a patient.
 */
export async function createMedication(
  patientId: string,
  input: CreateMedicationInput,
  actorId = patientId
) {
  await assertPatientAccess(actorId, patientId);

  const name = input.name?.trim();
  if (!name) throw new MedicationValidationError("Medicine name is required");

  const dosage = input.dosage?.trim();
  if (!dosage) throw new MedicationValidationError("Dosage is required");

  const scheduledTimes = parseScheduledTimes(input.scheduledTimes);
  const startDate = parseDate(input.startDate, "startDate");
  const endDate = input.endDate ? parseDate(input.endDate, "endDate") : null;

  if (endDate && endDate < startDate) {
    throw new MedicationValidationError("End date cannot be earlier than start date");
  }

  const medication = await prisma.medication.create({
    data: {
      patientId,
      name,
      dosage,
      unit: input.unit?.trim() || "mg",
      frequency: input.frequency?.trim() || "DAILY",
      scheduledTimes: JSON.stringify(scheduledTimes),
      startDate,
      endDate,
      foodTiming: input.foodTiming?.trim() || "AFTER_FOOD",
      prescribingDoctor: input.prescribingDoctor?.trim() || null,
      instructions: input.instructions?.trim() || null,
      status: input.status || MedicationStatus.ACTIVE,
    },
  });

  // Automatically generate today's doses if medication is active
  if (medication.status === MedicationStatus.ACTIVE) {
    await generateDosesForDate(patientId, new Date(), [medication]);
  }

  return {
    ...medication,
    scheduledTimes,
  };
}

/**
 * Retrieve all medications for a patient.
 */
export async function getMedications(patientId: string, actorId = patientId) {
  await assertPatientAccess(actorId, patientId);

  const list = await prisma.medication.findMany({
    where: { patientId },
    orderBy: { createdAt: "desc" },
  });

  return list.map((m) => ({
    ...m,
    scheduledTimes: JSON.parse(m.scheduledTimes || "[]"),
  }));
}

/**
 * Get single medication with dose records.
 */
export async function getMedicationById(
  patientId: string,
  medicationId: string,
  actorId = patientId
) {
  await assertPatientAccess(actorId, patientId);

  const medication = await prisma.medication.findFirst({
    where: { id: medicationId, patientId },
    include: {
      doseRecords: {
        orderBy: { scheduledTime: "desc" },
        take: 30,
      },
    },
  });

  if (!medication) throw new MedicationNotFoundError();

  return {
    ...medication,
    scheduledTimes: JSON.parse(medication.scheduledTimes || "[]"),
  };
}

/**
 * Update an existing medication.
 */
export async function updateMedication(
  patientId: string,
  medicationId: string,
  input: UpdateMedicationInput,
  actorId = patientId
) {
  await assertPatientAccess(actorId, patientId);

  const existing = await prisma.medication.findFirst({
    where: { id: medicationId, patientId },
  });
  if (!existing) throw new MedicationNotFoundError();

  const data: any = {};
  if (input.name !== undefined) {
    const trimmed = input.name.trim();
    if (!trimmed) throw new MedicationValidationError("Medicine name cannot be empty");
    data.name = trimmed;
  }
  if (input.dosage !== undefined) {
    const trimmed = input.dosage.trim();
    if (!trimmed) throw new MedicationValidationError("Dosage cannot be empty");
    data.dosage = trimmed;
  }
  if (input.unit !== undefined) data.unit = input.unit.trim();
  if (input.frequency !== undefined) data.frequency = input.frequency.trim();
  if (input.scheduledTimes !== undefined) {
    data.scheduledTimes = JSON.stringify(parseScheduledTimes(input.scheduledTimes));
  }
  if (input.startDate !== undefined) {
    data.startDate = parseDate(input.startDate, "startDate");
  }
  if (input.endDate !== undefined) {
    data.endDate = input.endDate ? parseDate(input.endDate, "endDate") : null;
  }
  if (input.foodTiming !== undefined) data.foodTiming = input.foodTiming.trim();
  if (input.prescribingDoctor !== undefined) {
    data.prescribingDoctor = input.prescribingDoctor ? input.prescribingDoctor.trim() : null;
  }
  if (input.instructions !== undefined) {
    data.instructions = input.instructions ? input.instructions.trim() : null;
  }
  if (input.status !== undefined) data.status = input.status;

  const updated = await prisma.medication.update({
    where: { id: medicationId },
    data,
  });

  return {
    ...updated,
    scheduledTimes: JSON.parse(updated.scheduledTimes || "[]"),
  };
}

/**
 * Discontinue medication safely.
 */
export async function discontinueMedication(
  patientId: string,
  medicationId: string,
  actorId = patientId
) {
  return updateMedication(patientId, medicationId, { status: MedicationStatus.DISCONTINUED }, actorId);
}

/**
 * Delete a medication permanently.
 */
export async function deleteMedication(
  patientId: string,
  medicationId: string,
  actorId = patientId
) {
  await assertPatientAccess(actorId, patientId);

  const existing = await prisma.medication.findFirst({
    where: { id: medicationId, patientId },
  });
  if (!existing) throw new MedicationNotFoundError();

  await prisma.medication.delete({
    where: { id: medicationId },
  });

  return { message: "Medication deleted successfully" };
}

// ============================================================
// DOSE GENERATION & TODAY'S SCHEDULE
// ============================================================

/**
 * Generates dose records for a specific date if not already generated.
 */
export async function generateDosesForDate(
  patientId: string,
  targetDate: Date,
  medicationsInput?: any[]
) {
  const targetDayStart = new Date(targetDate);
  targetDayStart.setHours(0, 0, 0, 0);

  const targetDayEnd = new Date(targetDate);
  targetDayEnd.setHours(23, 59, 59, 999);

  const medications =
    medicationsInput ||
    (await prisma.medication.findMany({
      where: {
        patientId,
        status: MedicationStatus.ACTIVE,
        startDate: { lte: targetDayEnd },
        OR: [{ endDate: null }, { endDate: { gte: targetDayStart } }],
      },
    }));

  for (const med of medications) {
    let times: string[] = [];
    try {
      times = Array.isArray(med.scheduledTimes) ? med.scheduledTimes : JSON.parse(med.scheduledTimes || "[]");
    } catch {
      times = [];
    }

    for (const timeStr of times) {
      const [h, m] = timeStr.split(":").map(Number);
      const doseTime = new Date(targetDate);
      doseTime.setHours(h, m, 0, 0);

      // Verify date is within medication start and end
      if (doseTime < med.startDate) continue;
      if (med.endDate && doseTime > med.endDate) continue;

      // Idempotently create dose record if it does not exist
      try {
        await prisma.doseRecord.upsert({
          where: {
            medicationId_scheduledTime: {
              medicationId: med.id,
              scheduledTime: doseTime,
            },
          },
          create: {
            patientId,
            medicationId: med.id,
            scheduledTime: doseTime,
            status: DoseStatus.PENDING,
          },
          update: {}, // Keep existing status if already recorded
        });
      } catch (err) {
        // Unique constraint caught cleanly
      }
    }
  }
}

/**
 * View today's medication schedule and mark overdue pending doses as MISSED.
 */
export async function getTodayMedicationSchedule(
  patientId: string,
  targetDate = new Date(),
  actorId = patientId
) {
  await assertPatientAccess(actorId, patientId);

  // Generate doses for target date
  await generateDosesForDate(patientId, targetDate);

  const dayStart = new Date(targetDate);
  dayStart.setHours(0, 0, 0, 0);

  const dayEnd = new Date(targetDate);
  dayEnd.setHours(23, 59, 59, 999);

  // Overdue check: past scheduled doses that are still PENDING (> 60 mins past) are considered missed
  const now = new Date();
  if (dayStart <= now) {
    const overdueCutoff = new Date(now.getTime() - 60 * 60 * 1000);
    await prisma.doseRecord.updateMany({
      where: {
        patientId,
        status: DoseStatus.PENDING,
        scheduledTime: {
          gte: dayStart,
          lte: overdueCutoff,
        },
      },
      data: {
        status: DoseStatus.MISSED,
      },
    });
  }

  const doses = await prisma.doseRecord.findMany({
    where: {
      patientId,
      scheduledTime: {
        gte: dayStart,
        lte: dayEnd,
      },
    },
    include: {
      medication: true,
    },
    orderBy: {
      scheduledTime: "asc",
    },
  });

  return doses.map((d) => ({
    ...d,
    medication: {
      ...d.medication,
      scheduledTimes: JSON.parse(d.medication.scheduledTimes || "[]"),
    },
  }));
}

/**
 * View upcoming doses (e.g. next 24 hours).
 */
export async function getUpcomingDoses(
  patientId: string,
  hoursAhead = 24,
  actorId = patientId
) {
  await assertPatientAccess(actorId, patientId);

  const now = new Date();
  const future = new Date(now.getTime() + hoursAhead * 60 * 60 * 1000);

  // Ensure today's and tomorrow's doses are generated
  await generateDosesForDate(patientId, now);
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  await generateDosesForDate(patientId, tomorrow);

  const doses = await prisma.doseRecord.findMany({
    where: {
      patientId,
      scheduledTime: {
        gte: now,
        lte: future,
      },
      status: {
        in: [DoseStatus.PENDING, DoseStatus.SNOOZED],
      },
    },
    include: {
      medication: true,
    },
    orderBy: {
      scheduledTime: "asc",
    },
  });

  return doses.map((d) => ({
    ...d,
    medication: {
      ...d.medication,
      scheduledTimes: JSON.parse(d.medication.scheduledTimes || "[]"),
    },
  }));
}

// ============================================================
// DOSE ACTIONS & ADHERENCE TRACKING
// ============================================================

/**
 * Record action for a dose (TAKEN, MISSED, SKIPPED, SNOOZED).
 */
export async function recordDoseAction(
  patientId: string,
  doseRecordId: string,
  action: DoseStatus,
  actorId: string,
  options?: { notes?: string; snoozeMinutes?: number }
) {
  await assertPatientAccess(actorId, patientId);

  const dose = await prisma.doseRecord.findFirst({
    where: { id: doseRecordId, patientId },
    include: { medication: true },
  });

  if (!dose) throw new MedicationNotFoundError("Dose record not found");

  const now = new Date();

  // Rule: Never count future doses as missed
  if (action === DoseStatus.MISSED && dose.scheduledTime > now) {
    throw new MedicationValidationError("Future scheduled doses cannot be marked as missed");
  }

  // Prevent invalid status transitions: taken/skipped doses cannot accidentally be marked missed
  if ((dose.status === DoseStatus.TAKEN || dose.status === DoseStatus.SKIPPED) && action === DoseStatus.MISSED) {
    throw new MedicationValidationError(`Dose already recorded as ${dose.status} and cannot be marked missed`);
  }

  const updateData: any = {
    status: action,
    recordedById: actorId,
    updatedAt: now,
  };

  if (options?.notes !== undefined) {
    updateData.notes = options.notes?.trim() || null;
  }

  if (action === DoseStatus.TAKEN) {
    updateData.takenAt = now;
    updateData.snoozedUntil = null;
  } else if (action === DoseStatus.SNOOZED) {
    const minutes = options?.snoozeMinutes || 15;
    updateData.snoozedUntil = new Date(now.getTime() + minutes * 60 * 1000);
  } else if (action === DoseStatus.MISSED || action === DoseStatus.SKIPPED) {
    updateData.snoozedUntil = null;
  }

  const updatedDose = await prisma.doseRecord.update({
    where: { id: doseRecordId },
    data: updateData,
    include: {
      medication: true,
    },
  });

  return {
    ...updatedDose,
    medication: {
      ...updatedDose.medication,
      scheduledTimes: JSON.parse(updatedDose.medication.scheduledTimes || "[]"),
    },
  };
}

/**
 * Calculate medication adherence metrics strictly from eligible past doses.
 */
export async function getAdherenceStats(
  patientId: string,
  timeframe: "daily" | "weekly" | "monthly" | "all" = "weekly",
  actorId = patientId
) {
  await assertPatientAccess(actorId, patientId);

  const now = new Date();
  const startDate = new Date();

  if (timeframe === "daily") {
    startDate.setHours(0, 0, 0, 0);
  } else if (timeframe === "weekly") {
    startDate.setDate(startDate.getDate() - 7);
    startDate.setHours(0, 0, 0, 0);
  } else if (timeframe === "monthly") {
    startDate.setDate(startDate.getDate() - 30);
    startDate.setHours(0, 0, 0, 0);
  } else {
    startDate.setFullYear(startDate.getFullYear() - 1);
  }

  // All eligible scheduled doses must have scheduledTime <= now
  const eligibleDoses = await prisma.doseRecord.findMany({
    where: {
      patientId,
      scheduledTime: {
        gte: startDate,
        lte: now,
      },
    },
    include: {
      medication: true,
    },
    orderBy: {
      scheduledTime: "desc",
    },
  });

  const totalEligible = eligibleDoses.length;
  let takenCount = 0;
  let missedCount = 0;
  let skippedCount = 0;
  let pendingCount = 0;

  const medMap = new Map<string, { name: string; total: number; taken: number; missed: number }>();
  const missedDosesHistory: any[] = [];

  for (const dose of eligibleDoses) {
    const medId = dose.medicationId;
    if (!medMap.has(medId)) {
      medMap.set(medId, {
        name: dose.medication.name,
        total: 0,
        taken: 0,
        missed: 0,
      });
    }
    const stat = medMap.get(medId)!;
    stat.total += 1;

    if (dose.status === DoseStatus.TAKEN) {
      takenCount += 1;
      stat.taken += 1;
    } else if (dose.status === DoseStatus.MISSED) {
      missedCount += 1;
      stat.missed += 1;
      missedDosesHistory.push({
        id: dose.id,
        medicationName: dose.medication.name,
        dosage: `${dose.medication.dosage} ${dose.medication.unit}`,
        scheduledTime: dose.scheduledTime,
        status: dose.status,
      });
    } else if (dose.status === DoseStatus.SKIPPED) {
      skippedCount += 1;
    } else {
      // Dose is past due but still pending
      pendingCount += 1;
    }
  }

  const adherenceRate = totalEligible > 0 ? Math.round((takenCount / totalEligible) * 100) : 100;

  const medicationBreakdown = Array.from(medMap.entries()).map(([id, val]) => ({
    medicationId: id,
    name: val.name,
    totalDoses: val.total,
    takenDoses: val.taken,
    missedDoses: val.missed,
    adherenceRate: val.total > 0 ? Math.round((val.taken / val.total) * 100) : 100,
  }));

  return {
    timeframe,
    periodStart: startDate,
    periodEnd: now,
    adherenceRate,
    totalEligibleDoses: totalEligible,
    takenDoses: takenCount,
    missedDoses: missedCount,
    skippedDoses: skippedCount,
    pendingOverdueDoses: pendingCount,
    medicationBreakdown,
    missedDosesHistory: missedDosesHistory.slice(0, 20),
  };
}

