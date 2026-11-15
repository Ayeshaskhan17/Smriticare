import { Router } from "express";
import { authenticate } from "../middleware/auth.middleware";
import * as medicationController from "../controllers/medication.controller";

const router = Router();

router.use(authenticate);

router.post("/", medicationController.createMedication);
router.get("/", medicationController.getMedications);
router.get("/today", medicationController.getTodaySchedule);
router.get("/upcoming", medicationController.getUpcomingDoses);
router.get("/adherence", medicationController.getAdherence);

router.get("/:id", medicationController.getMedicationById);
router.put("/:id", medicationController.updateMedication);
router.delete("/:id", medicationController.deleteMedication);
router.post("/:id/discontinue", medicationController.discontinueMedication);

router.post("/doses/:doseId/action", medicationController.recordDoseAction);

export default router;

