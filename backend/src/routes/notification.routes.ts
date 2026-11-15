import { Router } from "express";
import { authenticate } from "../middleware/auth.middleware";
import * as notificationController from "../controllers/notification.controller";

const router = Router();

router.use(authenticate);

router.get("/logs", notificationController.getNotificationLogs);
router.post("/trigger-cycle", notificationController.triggerNotificationCycle);
router.post("/test-send", notificationController.testSendEmail);

export default router;

