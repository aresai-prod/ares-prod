import { Router } from "express";
import { v4 as uuidv4 } from "uuid";
import { updateUser } from "../storage/db.js";
import { requireAuth, type AuthRequest } from "../middleware/auth.js";

const router = Router();

router.post("/track", requireAuth, (req, res) => {
  const { userId } = req as AuthRequest;
  const { event, payload } = req.body as {
    event: string;
    payload?: Record<string, unknown>;
  };

  if (!event) {
    return res.status(400).json({ error: "Event name is required." });
  }

  updateUser(userId, (user) => ({
    ...user,
    analytics: [
      ...user.analytics,
      {
        id: uuidv4(),
        event,
        payload,
        createdAt: new Date().toISOString()
      }
    ]
  }));

  res.json({ ok: true });
});

export default router;
