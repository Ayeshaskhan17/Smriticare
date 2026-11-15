import { Response } from "express";
import { AuthenticatedRequest } from "../middleware/auth.middleware";
import { prisma } from "../config/database";
import * as notificationService from "../services/notification.service";
import { NotificationType } from "@prisma/client";

export async function getNotificationLogs(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.userId!;
    const patientId = (req.query.patientId as string) || userId;

    const logs = await prisma.notificationLog.findMany({
      where: { patientId },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    return res.status(200).json({
      success: true,
      logs,
    });
  } catch (error: any) {
    return res.status(400).json({
      success: false,
      message: error.message || "Failed to fetch notification logs",
    });
  }
}

export async function triggerNotificationCycle(req: AuthenticatedRequest, res: Response) {
  try {
    const stats = await notificationService.runNotificationCycle();

    return res.status(200).json({
      success: true,
      message: "Notification cycle completed successfully",
      stats,
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to run notification cycle",
    });
  }
}

export async function testSendEmail(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.userId!;
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    const targetEmail = req.body.email || user.email;
    const result = await notificationService.dispatchNotification({
      patientId: userId,
      recipientEmail: targetEmail,
      type: NotificationType.MEDICATION_UPCOMING,
      title: "Test Healthcare Notification",
      content: `Hello ${user.fullName},\n\nThis is a verified test email from the SmritiCare Automated Healthcare Platform. Email notification system is operational.`,
      idempotencyKey: `test-${userId}-${Date.now()}`,
    });

    return res.status(200).json({
      success: true,
      message: "Test notification dispatched successfully",
      notification: result,
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to dispatch test notification",
    });
  }
}

