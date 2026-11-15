import { Router } from "express";
import { authenticate } from "../middleware/auth.middleware";
import * as appointmentController from "../controllers/appointment.controller";

const router = Router();

router.use(authenticate);

router.post("/", appointmentController.createAppointment);
router.get("/", appointmentController.getAppointments);
router.get("/upcoming", appointmentController.getUpcomingAppointments);
router.get("/history", appointmentController.getAppointmentHistory);
router.get("/:id", appointmentController.getAppointmentById);
router.put("/:id", appointmentController.updateAppointment);
router.post("/:id/cancel", appointmentController.cancelAppointment);

export default router;

