import { Response } from "express";
import { AuthenticatedRequest } from "../middleware/auth.middleware";
import * as timelineService from "../services/timeline.service";

export async function getSharedTimeline(req: AuthenticatedRequest, res: Response) {
  try {
    const actorId = req.userId!;
    const patientId = (req.query.patientId as string) || (req.body.patientId as string) || actorId;
    const limit = req.query.limit ? Number(req.query.limit) : 50;

    const timeline = await timelineService.getSharedActivityTimeline(patientId, actorId, limit);

    return res.status(200).json({
      success: true,
      timeline,
    });
  } catch (error: any) {
    return res.status(400).json({
      success: false,
      message: error.message || "Failed to fetch shared activity timeline",
    });
  }
}

