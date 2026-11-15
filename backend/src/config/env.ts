import "dotenv/config";

export const ENV = {
  PORT: Number(process.env.PORT) || 5000,
  NODE_ENV: process.env.NODE_ENV || "development",
  JWT_SECRET: process.env.JWT_SECRET || "smriticare_jwt_secure_development_secret_2026",
  
  // Database
  DATABASE_HOST: process.env.DATABASE_HOST || "localhost",
  DATABASE_PORT: Number(process.env.DATABASE_PORT) || 3306,
  DATABASE_USER: process.env.DATABASE_USER || "root",
  DATABASE_PASSWORD: process.env.DATABASE_PASSWORD || "",
  DATABASE_NAME: process.env.DATABASE_NAME || "smriticare",
  DATABASE_SSL: process.env.DATABASE_SSL === "true",

  // AWS S3
  AWS_REGION: process.env.AWS_REGION || "ap-south-1",
  S3_BUCKET_NAME: process.env.S3_BUCKET_NAME || "smriticcare-private-files-kashif-2026-2",

  // Email Notification Settings
  SMTP_HOST: process.env.SMTP_HOST || "smtp.gmail.com",
  SMTP_PORT: Number(process.env.SMTP_PORT) || 587,
  SMTP_USER: process.env.SMTP_USER || "",
  SMTP_PASS: process.env.SMTP_PASS || "",
  FROM_EMAIL: process.env.FROM_EMAIL || "notifications@smriticare.org",
  EMAIL_SIMULATION_MODE: process.env.EMAIL_SIMULATION_MODE !== "false", // Safe default: test/simulation mode if credentials not provided
};

export default ENV;

