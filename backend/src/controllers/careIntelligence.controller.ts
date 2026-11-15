import { Response } from "express";
import { AuthenticatedRequest } from "../middleware/auth.middleware";
import * as careIntelligenceService from "../services/careIntelligence.service";

export async function getCareIntelligenceReport(req: AuthenticatedRequest, res: Response) {
  try {
    const actorId = req.userId!;
    const patientId = (req.query.patientId as string) || (req.body.patientId as string) || actorId;

    const report = await careIntelligenceService.generateCareIntelligenceReport(patientId, actorId);

    return res.status(200).json({
      success: true,
      report,
    });
  } catch (error: any) {
    return res.status(400).json({
      success: false,
      message: error.message || "Failed to generate care intelligence report",
    });
  }
}

