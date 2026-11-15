import { Response } from "express";
import { AuthenticatedRequest } from "../middleware/auth.middleware";
import * as medicationService from "../services/medication.service";

function resolvePatientId(req: AuthenticatedRequest): string {
  const targetPatientId = (req.query.patientId || req.body.patientId || req.userId) as string;
  if (!targetPatientId) {
    throw new medicationService.MedicationValidationError("Patient ID is required");
  }
  return String(targetPatientId).trim();
}

export async function createMedication(req: AuthenticatedRequest, res: Response) {
  try {
    const actorId = req.userId!;
    const patientId = (req.body.patientId as string) || actorId;
    const medication = await medicationService.createMedication(patientId, req.body, actorId);

    return res.status(201).json({
      success: true,
      message: "Medication created successfully",
      medication,
    });
  } catch (error: any) {
    const status = error.name === "MedicationValidationError" ? 400 : 500;
    return res.status(status).json({
      success: false,
      message: error.message || "Failed to create medication",
    });
  }
}

export async function getMedications(req: AuthenticatedRequest, res: Response) {
  try {
    const actorId = req.userId!;
    const patientId = resolvePatientId(req);
    const medications = await medicationService.getMedications(patientId, actorId);

    return res.status(200).json({
      success: true,
      medications,
    });
  } catch (error: any) {
    return res.status(400).json({
      success: false,
      message: error.message || "Failed to fetch medications",
    });
  }
}

export async function getMedicationById(req: AuthenticatedRequest, res: Response) {
  try {
    const actorId = req.userId!;
    const patientId = resolvePatientId(req);
    const medicationId = req.params.id as string;
    const medication = await medicationService.getMedicationById(patientId, medicationId, actorId);

    return res.status(200).json({
      success: true,
      medication,
    });
  } catch (error: any) {
    const status = error.name === "MedicationNotFoundError" ? 404 : 400;
    return res.status(status).json({
      success: false,
      message: error.message || "Failed to fetch medication",
    });
  }
}

export async function updateMedication(req: AuthenticatedRequest, res: Response) {
  try {
    const actorId = req.userId!;
    const patientId = resolvePatientId(req);
    const medicationId = req.params.id as string;
    const medication = await medicationService.updateMedication(patientId, medicationId, req.body, actorId);

    return res.status(200).json({
      success: true,
      message: "Medication updated successfully",
      medication,
    });
  } catch (error: any) {
    const status = error.name === "MedicationValidationError" ? 400 : error.name === "MedicationNotFoundError" ? 404 : 500;
    return res.status(status).json({
      success: false,
      message: error.message || "Failed to update medication",
    });
  }
}

export async function discontinueMedication(req: AuthenticatedRequest, res: Response) {
  try {
    const actorId = req.userId!;
    const patientId = resolvePatientId(req);
    const medicationId = req.params.id as string;
    const medication = await medicationService.discontinueMedication(patientId, medicationId, actorId);

    return res.status(200).json({
      success: true,
      message: "Medication discontinued successfully",
      medication,
    });
  } catch (error: any) {
    return res.status(400).json({
      success: false,
      message: error.message || "Failed to discontinue medication",
    });
  }
}

export async function deleteMedication(req: AuthenticatedRequest, res: Response) {
  try {
    const actorId = req.userId!;
    const patientId = resolvePatientId(req);
    const medicationId = req.params.id as string;
    const result = await medicationService.deleteMedication(patientId, medicationId, actorId);

    return res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error: any) {
    const status = error.name === "MedicationNotFoundError" ? 404 : 400;
    return res.status(status).json({
      success: false,
      message: error.message || "Failed to delete medication",
    });
  }
}

export async function getTodaySchedule(req: AuthenticatedRequest, res: Response) {
  try {
    const actorId = req.userId!;
    const patientId = resolvePatientId(req);
    const targetDate = req.query.date ? new Date(String(req.query.date)) : new Date();
    const doses = await medicationService.getTodayMedicationSchedule(patientId, targetDate, actorId);

    return res.status(200).json({
      success: true,
      date: targetDate.toISOString(),
      doses,
    });
  } catch (error: any) {
    return res.status(400).json({
      success: false,
      message: error.message || "Failed to fetch today's medication schedule",
    });
  }
}

export async function getUpcomingDoses(req: AuthenticatedRequest, res: Response) {
  try {
    const actorId = req.userId!;
    const patientId = resolvePatientId(req);
    const hours = req.query.hours ? Number(req.query.hours) : 24;
    const doses = await medicationService.getUpcomingDoses(patientId, hours, actorId);

    return res.status(200).json({
      success: true,
      upcomingDoses: doses,
    });
  } catch (error: any) {
    return res.status(400).json({
      success: false,
      message: error.message || "Failed to fetch upcoming doses",
    });
  }
}

export async function recordDoseAction(req: AuthenticatedRequest, res: Response) {
  try {
    const actorId = req.userId!;
    const patientId = resolvePatientId(req);
    const doseId = req.params.doseId as string;
    const { action, notes, snoozeMinutes } = req.body;

    if (!action) {
      return res.status(400).json({
        success: false,
        message: "Dose action is required (TAKEN, MISSED, SKIPPED, SNOOZED)",
      });
    }

    const updatedDose = await medicationService.recordDoseAction(patientId, doseId, action, actorId, {
      notes,
      snoozeMinutes,
    });

    return res.status(200).json({
      success: true,
      message: `Dose recorded as ${action}`,
      dose: updatedDose,
    });
  } catch (error: any) {
    const status = error.name === "MedicationValidationError" ? 400 : error.name === "MedicationNotFoundError" ? 404 : 500;
    return res.status(status).json({
      success: false,
      message: error.message || "Failed to record dose action",
    });
  }
}

export async function getAdherence(req: AuthenticatedRequest, res: Response) {
  try {
    const actorId = req.userId!;
    const patientId = resolvePatientId(req);
    const timeframe = (req.query.timeframe as any) || "weekly";
    const stats = await medicationService.getAdherenceStats(patientId, timeframe, actorId);

    return res.status(200).json({
      success: true,
      adherence: stats,
    });
  } catch (error: any) {
    return res.status(400).json({
      success: false,
      message: error.message || "Failed to calculate adherence",
    });
  }
}

