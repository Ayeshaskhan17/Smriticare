import nodemailer, { Transporter } from "nodemailer";
import { prisma } from "../config/database";
import { NotificationType, NotificationDeliveryStatus, DoseStatus, AppointmentStatus } from "@prisma/client";
import { ENV } from "../config/env";

export type EmailPayload = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

let mailTransporter: Transporter | null = null;

function getTransporter(): Transporter | null {
  if (mailTransporter) return mailTransporter;

  if (ENV.SMTP_USER && ENV.SMTP_PASS) {
    mailTransporter = nodemailer.createTransport({
      host: ENV.SMTP_HOST,
      port: ENV.SMTP_PORT,
      secure: ENV.SMTP_PORT === 465,
      auth: {
        user: ENV.SMTP_USER,
        pass: ENV.SMTP_PASS,
      },
      tls: {
        rejectUnauthorized: false,
      },
    });
  }
  return mailTransporter;
}

/**
 * Transmit email via configured SMTP or structured test-mode simulation.
 */
export async function sendEmail(payload: EmailPayload): Promise<{ success: boolean; simulated: boolean; info?: any; error?: string }> {
  const transporter = getTransporter();

  if (!transporter || ENV.EMAIL_SIMULATION_MODE) {
    // Transparent Test Mode simulation (as mandated by Challenge Priority D)
    console.log(`[EMAIL DISPATCH - SIMULATION MODE]
To: ${payload.to}
From: ${ENV.FROM_EMAIL}
Subject: ${payload.subject}
Content: ${payload.text}
----------------------------------------`);
    return {
      success: true,
      simulated: true,
      info: { messageId: `simulated-${Date.now()}` },
    };
  }

  try {
    const info = await transporter.sendMail({
      from: `"${ENV.FROM_EMAIL}" <${ENV.FROM_EMAIL}>`,
      to: payload.to,
      subject: payload.subject,
      text: payload.text,
      html: payload.html,
    });
    return { success: true, simulated: false, info };
  } catch (err: any) {
    console.error("[Email Delivery Failed]", err.message);
    return { success: false, simulated: false, error: err.message };
  }
}

/**
 * Log and send notification idempotently.
 */
export async function dispatchNotification(params: {
  patientId: string;
  recipientEmail: string;
  type: NotificationType;
  title: string;
  content: string;
  idempotencyKey: string;
}) {
  // Check if already dispatched
  const existing = await prisma.notificationLog.findUnique({
    where: { idempotencyKey: params.idempotencyKey },
  });

  if (existing && existing.status === NotificationDeliveryStatus.SENT) {
    return existing;
  }

  const patient = await prisma.user.findUnique({
    where: { id: params.patientId },
    select: { emailNotificationsEnabled: true },
  });

  if (patient && !patient.emailNotificationsEnabled) {
    return null; // Patient notification preferences respected
  }

  const log = await prisma.notificationLog.upsert({
    where: { idempotencyKey: params.idempotencyKey },
    create: {
      patientId: params.patientId,
      recipientEmail: params.recipientEmail,
      type: params.type,
      title: params.title,
      content: params.content,
      status: NotificationDeliveryStatus.PENDING,
      idempotencyKey: params.idempotencyKey,
    },
    update: {
      attempts: { increment: 1 },
    },
  });

  const emailResult = await sendEmail({
    to: params.recipientEmail,
    subject: `[SmritiCare] ${params.title}`,
    text: params.content,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #D9DDD4; border-radius: 8px; overflow: hidden;">
        <div style="background-color: #3F6F45; color: #FFFFFF; padding: 18px 24px; text-align: center;">
          <h1 style="margin: 0; font-size: 22px;">SmritiCare Healthcare Alerts</h1>
        </div>
        <div style="padding: 24px; background-color: #FBF9F1; color: #1B1C17;">
          <h2 style="color: #3F6F45; margin-top: 0;">${params.title}</h2>
          <p style="font-size: 16px; line-height: 1.5; white-space: pre-line;">${params.content}</p>
          <hr style="border: 0; border-top: 1px solid #CDD2C8; margin: 20px 0;" />
          <p style="font-size: 13px; color: #565A52;">This is an automated healthcare reminder sent on behalf of your SmritiCare care circle. Please confirm medication via the SmritiCare app.</p>
        </div>
      </div>
    `,
  });

  if (emailResult.success) {
    return prisma.notificationLog.update({
      where: { id: log.id },
      data: {
        status: NotificationDeliveryStatus.SENT,
        sentAt: new Date(),
        lastError: null,
      },
    });
  } else {
    return prisma.notificationLog.update({
      where: { id: log.id },
      data: {
        status: NotificationDeliveryStatus.FAILED,
        lastError: emailResult.error || "Delivery failed",
      },
    });
  }
}

// ============================================================
// AUTOMATED SCHEDULING CYCLE (BACKGROUND RUNNER)
// ============================================================

export async function runNotificationCycle(): Promise<{ upcomingDoses: number; missedDoses: number; appointments: number; escalations: number }> {
  const now = new Date();
  let upcomingDosesCount = 0;
  let missedDosesCount = 0;
  let appointmentsCount = 0;
  let escalationsCount = 0;

  // 1. UPCOMING MEDICATION DOSES (due in next 30 minutes)
  const windowEnd = new Date(now.getTime() + 30 * 60 * 1000);
  const upcomingDoses = await prisma.doseRecord.findMany({
    where: {
      scheduledTime: { gte: now, lte: windowEnd },
      status: DoseStatus.PENDING,
    },
    include: {
      patient: true,
      medication: true,
    },
  });

  for (const dose of upcomingDoses) {
    const email = dose.patient.notificationEmail || dose.patient.email;
    if (!email) continue;

    const timeFormatted = dose.scheduledTime.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
    const idempotencyKey = `upcoming-med-${dose.id}-${dose.scheduledTime.toISOString().slice(0, 16)}`;

    await dispatchNotification({
      patientId: dose.patientId,
      recipientEmail: email,
      type: NotificationType.MEDICATION_UPCOMING,
      title: `Upcoming Dose Reminder: ${dose.medication.name}`,
      content: `Hello ${dose.patient.fullName},\n\nIt is time for your scheduled medication:\n- Medicine: ${dose.medication.name} (${dose.medication.dosage} ${dose.medication.unit})\n- Time: ${timeFormatted}\n- Instructions: ${dose.medication.foodTiming || "Take as prescribed"}\n\nPlease take your dose and confirm it in your SmritiCare app.`,
      idempotencyKey,
    });
    upcomingDosesCount++;
  }

  // 2. MISSED MEDICATION DOSES (overdue > 30 minutes, mark as MISSED & send alert)
  const overdueCutoff = new Date(now.getTime() - 30 * 60 * 1000);
  const overdueDoses = await prisma.doseRecord.findMany({
    where: {
      scheduledTime: { lte: overdueCutoff },
      status: DoseStatus.PENDING,
    },
    include: {
      patient: true,
      medication: true,
    },
  });

  for (const dose of overdueDoses) {
    // Mark as missed in DB
    await prisma.doseRecord.update({
      where: { id: dose.id },
      data: { status: DoseStatus.MISSED },
    });

    const email = dose.patient.notificationEmail || dose.patient.email;
    if (email) {
      const timeFormatted = dose.scheduledTime.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
      const idempotencyKey = `missed-med-${dose.id}`;

      await dispatchNotification({
        patientId: dose.patientId,
        recipientEmail: email,
        type: NotificationType.MEDICATION_MISSED,
        title: `Missed Medication Alert: ${dose.medication.name}`,
        content: `Hello ${dose.patient.fullName},\n\nYou missed your dose of ${dose.medication.name} scheduled for ${timeFormatted}.\n\nPlease check your schedule and consult your caregiver or healthcare provider if you need assistance.`,
        idempotencyKey,
      });
      missedDosesCount++;
    }
  }

  // 3. REPEATED MISSED DOSE ESCALATION TO CAREGIVERS
  // Check if any patient has >= 2 missed doses in the last 24 hours
  const past24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const patientsWithMissed = await prisma.doseRecord.groupBy({
    by: ["patientId"],
    where: {
      status: DoseStatus.MISSED,
      scheduledTime: { gte: past24h },
    },
    _count: { id: true },
    having: { id: { _count: { gte: 2 } } },
  });

  for (const group of patientsWithMissed) {
    const patientId = group.patientId;
    const connections = await prisma.caregiverPatient.findMany({
      where: { patientId },
      include: { caregiver: true, patient: true },
    });

    for (const conn of connections) {
      const caregiverEmail = conn.caregiver.email;
      if (!caregiverEmail) continue;

      const dateStr = now.toISOString().slice(0, 10);
      const idempotencyKey = `escalation-${patientId}-${conn.caregiverId}-${dateStr}`;

      await dispatchNotification({
        patientId,
        recipientEmail: caregiverEmail,
        type: NotificationType.MISSED_DOSE_ESCALATION,
        title: `Caregiver Escalation: Multiple Missed Doses for ${conn.patient.fullName}`,
        content: `Attention ${conn.caregiver.fullName},\n\nYour connected patient ${conn.patient.fullName} has missed ${group._count.id} scheduled medication doses in the last 24 hours.\n\nPlease check in with them or review their medication adherence in your SmritiCare Caregiver Dashboard.`,
        idempotencyKey,
      });
      escalationsCount++;
    }
  }

  // 4. UPCOMING DOCTOR APPOINTMENTS (within next 24 hours)
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const upcomingAppointments = await prisma.appointment.findMany({
    where: {
      appointmentDate: { gte: now, lte: tomorrow },
      status: AppointmentStatus.SCHEDULED,
      reminderSent: false,
    },
    include: {
      patient: true,
    },
  });

  for (const appt of upcomingAppointments) {
    const email = appt.patient.notificationEmail || appt.patient.email;
    if (email) {
      const apptFormatted = appt.appointmentDate.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });
      const idempotencyKey = `upcoming-appt-${appt.id}`;

      await dispatchNotification({
        patientId: appt.patientId,
        recipientEmail: email,
        type: NotificationType.APPOINTMENT_UPCOMING,
        title: `Doctor Appointment Reminder: Dr. ${appt.doctorName}`,
        content: `Hello ${appt.patient.fullName},\n\nThis is a reminder for your upcoming medical appointment:\n- Doctor: Dr. ${appt.doctorName}\n- Hospital/Clinic: ${appt.hospital}\n- Date & Time: ${apptFormatted}\n- Reason: ${appt.reason}\n\nPlease arrive 15 minutes before your scheduled appointment time.`,
        idempotencyKey,
      });

      await prisma.appointment.update({
        where: { id: appt.id },
        data: { reminderSent: true },
      });
      appointmentsCount++;
    }
  }

  return {
    upcomingDoses: upcomingDosesCount,
    missedDoses: missedDosesCount,
    appointments: appointmentsCount,
    escalations: escalationsCount,
  };
}

let schedulerTimer: NodeJS.Timeout | null = null;

export function startBackgroundScheduler(intervalMs = 60000) {
  if (schedulerTimer) return;
  console.log(`[SmritiCare Notification Scheduler] Started (Interval: ${intervalMs}ms)`);
  schedulerTimer = setInterval(async () => {
    try {
      await runNotificationCycle();
    } catch (err: any) {
      console.error("[Notification Scheduler Error]", err.message);
    }
  }, intervalMs);
}

export function stopBackgroundScheduler() {
  if (schedulerTimer) {
    clearInterval(schedulerTimer);
    schedulerTimer = null;
  }
}
