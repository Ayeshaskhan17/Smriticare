import { prisma } from "../config/database";
import { requireCaregiverPatientAccess } from "./caregiverAccess.service";

export type TimelineEvent = {
  id: string;
  type: "MEDICATION_DOSE" | "APPOINTMENT" | "ALERT" | "COGNITIVE_SCORE" | "TASK";
  title: string;
  description: string;
  timestamp: Date;
  status?: string;
  badgeColor?: string;
  metadata?: any;
};

export async function getSharedActivityTimeline(
  patientId: string,
  actorId = patientId,
  limit = 50
): Promise<TimelineEvent[]> {
  if (actorId !== patientId) {
    await requireCaregiverPatientAccess(actorId, patientId);
  }

  const [doses, appointments, alerts, tasks] = await Promise.all([
    // Medication doses
    prisma.doseRecord.findMany({
      where: { patientId },
      include: { medication: true },
      orderBy: { scheduledTime: "desc" },
      take: limit,
    }),
    // Appointments
    prisma.appointment.findMany({
      where: { patientId },
      orderBy: { appointmentDate: "desc" },
      take: limit,
    }),
    // Alerts
    prisma.alert.findMany({
      where: { patientId },
      orderBy: { createdAt: "desc" },
      take: limit,
    }),
    // Tasks
    prisma.task.findMany({
      where: { userId: patientId },
      orderBy: { scheduledAt: "desc" },
      take: limit,
    }),
  ]);

  const events: TimelineEvent[] = [];

  for (const dose of doses) {
    let badgeColor = "#72766D";
    if (dose.status === "TAKEN") badgeColor = "#3F6F45";
    else if (dose.status === "MISSED") badgeColor = "#9B3F32";
    else if (dose.status === "SNOOZED") badgeColor = "#8A6040";

    events.push({
      id: `dose-${dose.id}`,
      type: "MEDICATION_DOSE",
      title: `${dose.medication.name} (${dose.medication.dosage} ${dose.medication.unit})`,
      description: `Status: ${dose.status}${dose.takenAt ? ` (Taken at ${dose.takenAt.toLocaleTimeString()})` : ""}${dose.notes ? ` - ${dose.notes}` : ""}`,
      timestamp: dose.takenAt || dose.scheduledTime,
      status: dose.status,
      badgeColor,
      metadata: { medicationId: dose.medicationId, scheduledTime: dose.scheduledTime },
    });
  }

  for (const appt of appointments) {
    events.push({
      id: `appt-${appt.id}`,
      type: "APPOINTMENT",
      title: `Doctor Appointment: Dr. ${appt.doctorName}`,
      description: `${appt.hospital} (${appt.reason}) - Status: ${appt.status}`,
      timestamp: appt.appointmentDate,
      status: appt.status,
      badgeColor: "#315A36",
      metadata: { appointmentId: appt.id },
    });
  }

  for (const alert of alerts) {
    events.push({
      id: `alert-${alert.id}`,
      type: "ALERT",
      title: alert.title,
      description: `${alert.description} [${alert.typeLabel}]`,
      timestamp: alert.createdAt,
      status: alert.status,
      badgeColor: alert.status === "ACTIVE" ? "#9B3F32" : "#565A52",
      metadata: { alertId: alert.id },
    });
  }

  for (const task of tasks) {
    events.push({
      id: `task-${task.id}`,
      type: "TASK",
      title: task.title,
      description: task.description || (task.completed ? "Completed task" : "Scheduled routine"),
      timestamp: task.scheduledAt,
      status: task.completed ? "COMPLETED" : "PENDING",
      badgeColor: task.completed ? "#3F6F45" : "#72766D",
      metadata: { taskId: task.id },
    });
  }

  // Sort unified events in descending chronological order
  events.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

  return events.slice(0, limit);
}

