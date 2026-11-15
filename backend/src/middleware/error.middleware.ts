import { Request, Response, NextFunction } from "express";

export function errorHandler(
  err: any,
  _req: Request,
  res: Response,
  _next: NextFunction
) {
  const statusCode = typeof err.statusCode === "number" ? err.statusCode : 500;
  const message = err.message || "An unexpected internal server error occurred.";

  if (process.env.NODE_ENV !== "test" && statusCode === 500) {
    console.error("[Internal Error]", err);
  }

  res.status(statusCode).json({
    success: false,
    message,
    ...(process.env.NODE_ENV === "development" ? { stack: err.stack } : {}),
  });
}

