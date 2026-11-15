import { Router } from "express";
import { authenticate } from "../middleware/auth.middleware";
import * as timelineController from "../controllers/timeline.controller";

const router = Router();

router.use(authenticate);

router.get("/", timelineController.getSharedTimeline);

export default router;

