import { Router } from "express";
import { authenticate } from "../middleware/auth.middleware";
import * as careIntelligenceController from "../controllers/careIntelligence.controller";

const router = Router();

router.use(authenticate);

router.get("/report", careIntelligenceController.getCareIntelligenceReport);

export default router;

