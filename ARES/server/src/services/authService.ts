import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { v4 as uuidv4 } from "uuid";
import type { Session, UserRecord } from "../models/types.js";

const DEFAULT_SESSION_DAYS = 7;

function getJwtSecret(): string {
  const secret = process.env.ARES_JWT_SECRET;
  if (!secret) {
    return "ares-dev-secret";
  }
  return secret;
}

export function getSessionDays(): number {
  const raw = process.env.ARES_SESSION_DAYS;
  const parsed = raw ? Number(raw) : DEFAULT_SESSION_DAYS;
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_SESSION_DAYS;
  return parsed;
}

export async function hashPassword(password: string): Promise<string> {
  const saltRounds = 12;
  return bcrypt.hash(password, saltRounds);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function createSession(userId: string): Session {
  const now = new Date();
  const expires = new Date(now.getTime() + getSessionDays() * 24 * 60 * 60 * 1000);
  return {
    id: uuidv4(),
    userId,
    createdAt: now.toISOString(),
    expiresAt: expires.toISOString()
  };
}

export function signToken(user: UserRecord, session: Session): string {
  const secret = getJwtSecret();
  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
      sessionId: session.id
    },
    secret,
    {
      expiresIn: `${getSessionDays()}d`
    }
  );
}

export function verifyToken(token: string): { userId: string; sessionId: string } {
  const secret = getJwtSecret();
  const payload = jwt.verify(token, secret) as { sub: string; sessionId: string };
  return { userId: payload.sub, sessionId: payload.sessionId };
}
