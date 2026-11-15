import { prisma } from "../config/database";
import { AppointmentStatus } from "@prisma/client";
import { requireCaregiverPatientAccess } from "./caregiverAccess.service";

export type CreateAppointmentInput = {
  doctorName: string;
  hospital: string;
  department?: string | null;
  appointmentDate: string | Date;
  reason: string;
  notes?: string | null;
  followUpDate?: string | Date | null;
  status?: AppointmentStatus;
};

export type UpdateAppointmentInput = Partial<CreateAppointmentInput>;

export class AppointmentValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AppointmentValidationError";
  }
}

export class AppointmentNotFoundError extends Error {
  constructor(message = "Appointment not found") {
    super(message);
    this.name = "AppointmentNotFoundError";
  }
}

function parseDate(value: string | Date | undefined, fieldName: string): Date {
  if (!value) throw new AppointmentValidationError(`${fieldName} is required`);
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new AppointmentValidationError(`Invalid ${fieldName}`);
  }
  return date;
}

async function assertPatientAccess(actorId: string, patientId: string) {
  if (actorId === patientId) return;
  await requireCaregiverPatientAccess(actorId, patientId);
}

export async function createAppointment(
  patientId: string,
  input: CreateAppointmentInput,
  actorId = patientId
) {
  await assertPatientAccess(actorId, patientId);

  const doctorName = input.doctorName?.trim();
  if (!doctorName) throw new AppointmentValidationError("Doctor name is required");

  const hospital = input.hospital?.trim();
  if (!hospital) throw new AppointmentValidationError("Hospital/Clinic name is required");

  const reason = input.reason?.trim();
  if (!reason) throw new AppointmentValidationError("Reason for appointment is required");

  const appointmentDate = parseDate(input.appointmentDate, "appointmentDate");
  const followUpDate = input.followUpDate ? parseDate(input.followUpDate, "followUpDate") : null;

  return prisma.appointment.create({
    data: {
      patientId,
      doctorName,
      hospital,
      department: input.department?.trim() || null,
      appointmentDate,
      reason,
      notes: input.notes?.trim() || null,
      followUpDate,
      status: input.status || AppointmentStatus.SCHEDULED,
    },
  });
}

export async function getAppointments(patientId: string, actorId = patientId) {
  await assertPatientAccess(actorId, patientId);

  return prisma.appointment.findMany({
    where: { patientId },
    orderBy: { appointmentDate: "desc" },
  });
}

export async function getUpcomingAppointments(patientId: string, actorId = patientId) {
  await assertPatientAccess(actorId, patientId);

  const now = new Date();
  return prisma.appointment.findMany({
    where: {
      patientId,
      appointmentDate: { gte: now },
      status: { in: [AppointmentStatus.SCHEDULED, AppointmentStatus.RESCHEDULED] },
    },
    orderBy: { appointmentDate: "asc" },
  });
}

export async function getAppointmentHistory(patientId: string, actorId = patientId) {
  await assertPatientAccess(actorId, patientId);

  const now = new Date();
  return prisma.appointment.findMany({
    where: {
      patientId,
      OR: [
        { appointmentDate: { lt: now } },
        { status: { in: [AppointmentStatus.COMPLETED, AppointmentStatus.CANCELLED] } },
      ],
    },
    orderBy: { appointmentDate: "desc" },
  });
}

export async function getAppointmentById(patientId: string, appointmentId: string, actorId = patientId) {
  await assertPatientAccess(actorId, patientId);

  const appointment = await prisma.appointment.findFirst({
    where: { id: appointmentId, patientId },
  });

  if (!appointment) throw new AppointmentNotFoundError();
  return appointment;
}

export async function updateAppointment(
  patientId: string,
  appointmentId: string,
  input: UpdateAppointmentInput,
  actorId = patientId
) {
  await assertPatientAccess(actorId, patientId);

  const existing = await prisma.appointment.findFirst({
    where: { id: appointmentId, patientId },
  });
  if (!existing) throw new AppointmentNotFoundError();

  const data: any = {};
  if (input.doctorName !== undefined) {
    const trimmed = input.doctorName.trim();
    if (!trimmed) throw new AppointmentValidationError("Doctor name cannot be empty");
    data.doctorName = trimmed;
  }
  if (input.hospital !== undefined) {
    const trimmed = input.hospital.trim();
    if (!trimmed) throw new AppointmentValidationError("Hospital name cannot be empty");
    data.hospital = trimmed;
  }
  if (input.department !== undefined) data.department = input.department ? input.department.trim() : null;
  if (input.reason !== undefined) {
    const trimmed = input.reason.trim();
    if (!trimmed) throw new AppointmentValidationError("Reason cannot be empty");
    data.reason = trimmed;
  }
  if (input.notes !== undefined) data.notes = input.notes ? input.notes.trim() : null;
  if (input.appointmentDate !== undefined) {
    data.appointmentDate = parseDate(input.appointmentDate, "appointmentDate");
  }
  if (input.followUpDate !== undefined) {
    data.followUpDate = input.followUpDate ? parseDate(input.followUpDate, "followUpDate") : null;
  }
  if (input.status !== undefined) data.status = input.status;

  return prisma.appointment.update({
    where: { id: appointmentId },
    data,
  });
}

export async function cancelAppointment(patientId: string, appointmentId: string, actorId = patientId) {
  return updateAppointment(patientId, appointmentId, { status: AppointmentStatus.CANCELLED }, actorId);
}

