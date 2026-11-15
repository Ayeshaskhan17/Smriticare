import { Response } from "express";
import { AuthenticatedRequest } from "../middleware/auth.middleware";
import * as appointmentService from "../services/appointment.service";

function resolvePatientId(req: AuthenticatedRequest): string {
  const targetPatientId = (req.query.patientId || req.body.patientId || req.userId) as string;
  if (!targetPatientId) {
    throw new appointmentService.AppointmentValidationError("Patient ID is required");
  }
  return String(targetPatientId).trim();
}

export async function createAppointment(req: AuthenticatedRequest, res: Response) {
  try {
    const actorId = req.userId!;
    const patientId = (req.body.patientId as string) || actorId;
    const appointment = await appointmentService.createAppointment(patientId, req.body, actorId);

    return res.status(201).json({
      success: true,
      message: "Appointment created successfully",
      appointment,
    });
  } catch (error: any) {
    const status = error.name === "AppointmentValidationError" ? 400 : 500;
    return res.status(status).json({
      success: false,
      message: error.message || "Failed to create appointment",
    });
  }
}

export async function getAppointments(req: AuthenticatedRequest, res: Response) {
  try {
    const actorId = req.userId!;
    const patientId = resolvePatientId(req);
    const appointments = await appointmentService.getAppointments(patientId, actorId);

    return res.status(200).json({
      success: true,
      appointments,
    });
  } catch (error: any) {
    return res.status(400).json({
      success: false,
      message: error.message || "Failed to fetch appointments",
    });
  }
}

export async function getUpcomingAppointments(req: AuthenticatedRequest, res: Response) {
  try {
    const actorId = req.userId!;
    const patientId = resolvePatientId(req);
    const upcomingAppointments = await appointmentService.getUpcomingAppointments(patientId, actorId);

    return res.status(200).json({
      success: true,
      upcomingAppointments,
    });
  } catch (error: any) {
    return res.status(400).json({
      success: false,
      message: error.message || "Failed to fetch upcoming appointments",
    });
  }
}

export async function getAppointmentHistory(req: AuthenticatedRequest, res: Response) {
  try {
    const actorId = req.userId!;
    const patientId = resolvePatientId(req);
    const history = await appointmentService.getAppointmentHistory(patientId, actorId);

    return res.status(200).json({
      success: true,
      history,
    });
  } catch (error: any) {
    return res.status(400).json({
      success: false,
      message: error.message || "Failed to fetch appointment history",
    });
  }
}

export async function getAppointmentById(req: AuthenticatedRequest, res: Response) {
  try {
    const actorId = req.userId!;
    const patientId = resolvePatientId(req);
    const appointmentId = req.params.id as string;
    const appointment = await appointmentService.getAppointmentById(patientId, appointmentId, actorId);

    return res.status(200).json({
      success: true,
      appointment,
    });
  } catch (error: any) {
    const status = error.name === "AppointmentNotFoundError" ? 404 : 400;
    return res.status(status).json({
      success: false,
      message: error.message || "Failed to fetch appointment",
    });
  }
}

export async function updateAppointment(req: AuthenticatedRequest, res: Response) {
  try {
    const actorId = req.userId!;
    const patientId = resolvePatientId(req);
    const appointmentId = req.params.id as string;
    const appointment = await appointmentService.updateAppointment(patientId, appointmentId, req.body, actorId);

    return res.status(200).json({
      success: true,
      message: "Appointment updated successfully",
      appointment,
    });
  } catch (error: any) {
    const status = error.name === "AppointmentValidationError" ? 400 : error.name === "AppointmentNotFoundError" ? 404 : 500;
    return res.status(status).json({
      success: false,
      message: error.message || "Failed to update appointment",
    });
  }
}

export async function cancelAppointment(req: AuthenticatedRequest, res: Response) {
  try {
    const actorId = req.userId!;
    const patientId = resolvePatientId(req);
    const appointmentId = req.params.id as string;
    const appointment = await appointmentService.cancelAppointment(patientId, appointmentId, actorId);

    return res.status(200).json({
      success: true,
      message: "Appointment cancelled successfully",
      appointment,
    });
  } catch (error: any) {
    return res.status(400).json({
      success: false,
      message: error.message || "Failed to cancel appointment",
    });
  }
}

