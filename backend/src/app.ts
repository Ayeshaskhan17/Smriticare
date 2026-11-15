import express from "express";
import cors from "cors";
import path from "path";
import helmet from "helmet";
import rateLimit from "express-rate-limit";

import authRoutes from "./routes/auth.routes";
import caregiverConnectionRoutes from "./routes/caregiverConnection.routes";
import taskRoutes from "./routes/task.routes";
import emergencyContactRoutes from "./routes/emergencyContact.routes";
import memoryRoutes from "./routes/memory.routes";
import memoryUploadRoutes from "./routes/memoryUpload.routes";
import profileImageRoutes from "./routes/profileImage.routes";
import locationRoutes from "./routes/location.routes";
import gameRoutes from "./routes/game.routes";
import syncRoutes from "./routes/sync.routes";
import alertRoutes from "./routes/alert.routes";
import medicationRoutes from "./routes/medication.routes";
import appointmentRoutes from "./routes/appointment.routes";
import notificationRoutes from "./routes/notification.routes";
import timelineRoutes from "./routes/timeline.routes";
import careIntelligenceRoutes from "./routes/careIntelligence.routes";
import { errorHandler } from "./middleware/error.middleware";

const app = express();

// Security HTTP headers
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
  })
);

// CORS configuration
app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// General API rate limiter (prevents DOS while keeping unit tests fast)
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === "test",
});

// Stricter rate limiter for authentication endpoints to prevent brute force
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many authentication requests, please try again in 15 minutes.",
  },
  skip: () => process.env.NODE_ENV === "test",
});

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Static local uploads fallback route
app.use(
  "/uploads",
  express.static(path.join(process.cwd(), "uploads"))
);

// Health check endpoint
app.get("/api/health", (_req, res) => {
  res.json({
    success: true,
    message: "SmritiCare backend is running",
    timestamp: new Date().toISOString(),
    status: "healthy",
  });
});

// Apply rate limiting
app.use("/api", generalLimiter);
app.use("/api/auth", authLimiter);

// Existing feature routes
app.use("/api/auth", authRoutes);
app.use("/api/caregiver-connections", caregiverConnectionRoutes);
app.use("/api/tasks", taskRoutes);
app.use("/api/emergency-contacts", emergencyContactRoutes);
app.use("/api/memories", memoryRoutes);
app.use("/api/memories/upload", memoryUploadRoutes);
app.use("/api/auth/profile-image", profileImageRoutes);
app.use("/api/location", locationRoutes);
app.use("/api/games", gameRoutes);
app.use("/api/sync", syncRoutes);
app.use("/api/alerts", alertRoutes);

// Hackathon Core Enhancement Routes
app.use("/api/medications", medicationRoutes);
app.use("/api/appointments", appointmentRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/timeline", timelineRoutes);
app.use("/api/care-intelligence", careIntelligenceRoutes);

// Central error handler
app.use(errorHandler);

export default app;
