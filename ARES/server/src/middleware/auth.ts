import type { NextFunction, Request, Response } from "express";
import { cleanupExpiredSessions, findSession, findUserById, readDb } from "../storage/db.js";
import { verifyToken } from "../services/authService.js";

export type AuthRequest = Request & { userId: string; sessionId: string };

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing auth token." });
  }

  const token = authHeader.slice("Bearer ".length);
  try {
    const { userId, sessionId } = verifyToken(token);
    const db = readDb();
    cleanupExpiredSessions(new Date());
    const session = findSession(db, sessionId);
    if (!session || session.userId !== userId) {
      return res.status(401).json({ error: "Session expired. Please log in again." });
    }
    const user = findUserById(db, userId);
    if (!user) {
      return res.status(401).json({ error: "User not found." });
    }
    (req as AuthRequest).userId = userId;
    (req as AuthRequest).sessionId = sessionId;
    return next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid token." });
  }
}
