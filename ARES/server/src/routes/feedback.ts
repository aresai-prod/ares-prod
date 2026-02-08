import { Router } from "express";
import { v4 as uuidv4 } from "uuid";
import { updateUser } from "../storage/db.js";
import { requireAuth, type AuthRequest } from "../middleware/auth.js";

const router = Router();

router.post("/", requireAuth, (req, res) => {
  const { userId } = req as AuthRequest;
  const { conversationId, messageId, rating, comment } = req.body as {
    conversationId: string;
    messageId: string;
    rating: "up" | "down";
    comment?: string;
  };

  if (!conversationId || !messageId || !rating) {
    return res.status(400).json({ error: "conversationId, messageId, and rating are required." });
  }

  updateUser(userId, (user) => ({
    ...user,
    feedback: [
      ...user.feedback,
      {
        id: uuidv4(),
        conversationId,
        messageId,
        rating,
        comment,
        createdAt: new Date().toISOString()
      }
    ]
  }));

  res.json({ ok: true });
});

export default router;
