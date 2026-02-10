import { Router } from "express";
import crypto from "crypto";
import Razorpay from "razorpay";
import { requireAuth, type AuthRequest } from "../middleware/auth.js";
import { getUserAndOrg, isOrgAdmin } from "../services/access.js";
import { createTokenBucket } from "../services/billingService.js";
import { readDb, updateOrg, updateUser } from "../storage/db.js";

const router = Router();

function devUpgradeAllowed(): boolean {
  if (process.env.BILLING_ALLOW_DEV_UPGRADE === "false") return false;
  return true;
}

function cleanEnv(value?: string): string {
  if (!value) return "";
  return value.trim().replace(/^['"]|['"]$/g, "");
}

function getRazorpayClient(): Razorpay {
  const keyId = cleanEnv(process.env.RAZORPAY_KEY_ID);
  const keySecret = cleanEnv(process.env.RAZORPAY_KEY_SECRET);
  if (!keyId || !keySecret) {
    throw new Error("Razorpay is not configured. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET.");
  }
  return new Razorpay({ key_id: keyId, key_secret: keySecret });
}

function isRazorpayConfigured(): boolean {
  return Boolean(cleanEnv(process.env.RAZORPAY_KEY_ID) && cleanEnv(process.env.RAZORPAY_KEY_SECRET));
}

function buildReceipt(orgId: string): string {
  const compactOrg = orgId.replace(/[^a-zA-Z0-9]/g, "").slice(0, 8) || "org";
  const suffix = Date.now().toString().slice(-10);
  return `ares_${compactOrg}_${suffix}`.slice(0, 40);
}

function toPaiseFromEnv(rawValue: string | undefined, fallbackInr: number): number {
  const fallbackPaise = Math.max(100, Math.round(fallbackInr * 100));
  if (!rawValue) return fallbackPaise;
  const parsed = Number(cleanEnv(rawValue));
  if (!Number.isFinite(parsed) || parsed <= 0) return fallbackPaise;
  const amount = parsed < 100 ? Math.round(parsed * 100) : Math.round(parsed);
  return Math.max(100, amount);
}

function amountForPlan(plan: string, seats: number): number {
  const individual = toPaiseFromEnv(process.env.RAZORPAY_INDIVIDUAL_AMOUNT, 1);
  const businessBase = toPaiseFromEnv(process.env.RAZORPAY_BUSINESS_BASE_AMOUNT, 2);
  const businessSeat = toPaiseFromEnv(process.env.RAZORPAY_BUSINESS_SEAT_AMOUNT, 1);
  if (plan === "INDIVIDUAL") return individual;
  if (plan === "BUSINESS") {
    const seatCount = Math.max(1, seats);
    return businessBase + businessSeat * Math.max(0, seatCount - 1);
  }
  return individual;
}

function extractGatewayError(error: unknown): string {
  if (error instanceof Error && error.message.trim()) return error.message.trim();
  if (typeof error !== "object" || error === null) return "Unable to create order.";

  const record = error as Record<string, unknown>;
  const nested = (record.error as Record<string, unknown> | undefined) ?? undefined;
  const parts = [
    nested?.description,
    nested?.reason,
    nested?.message,
    record.description,
    record.message
  ]
    .map((value) => (typeof value === "string" ? value.trim() : ""))
    .filter(Boolean);

  if (parts.length > 0) return parts.join(" | ");
  try {
    const compact = JSON.stringify(record);
    if (compact && compact !== "{}") return compact.slice(0, 260);
  } catch {
    // ignore JSON stringify issues
  }
  return "Unable to create order.";
}

router.get("/license", requireAuth, (req, res) => {
  const { userId } = req as AuthRequest;
  try {
    const { user, org } = getUserAndOrg(userId);
    return res.json({
      license: org.license,
      accountType: org.accountType,
      upgradeAvailable: true,
      devUpgradeAllowed: devUpgradeAllowed(),
      checkoutConfigured: isRazorpayConfigured()
    });
  } catch (err) {
    return res.status(400).json({ error: err instanceof Error ? err.message : "Unable to load license." });
  }
});

router.post("/razorpay/order", requireAuth, async (req, res) => {
  const { userId } = req as AuthRequest;
  const { plan, seats } = req.body as { plan?: "INDIVIDUAL" | "BUSINESS"; seats?: number };
  if (!plan) {
    return res.status(400).json({ error: "plan is required." });
  }

  try {
    const { user, org } = getUserAndOrg(userId);
    if (!isOrgAdmin(user)) {
      return res.status(403).json({ error: "Only admins can purchase licenses." });
    }
    const client = getRazorpayClient();
    const amount = amountForPlan(plan, seats ?? org.license.seats);
    const order = await client.orders.create({
      amount,
      currency: "INR",
      receipt: buildReceipt(org.id),
      notes: {
        orgId: org.id,
        userId: user.id,
        plan
      }
    });

    return res.json({ order, keyId: cleanEnv(process.env.RAZORPAY_KEY_ID) });
  } catch (err) {
    const message = extractGatewayError(err);
    return res.status(400).json({ error: message });
  }
});

router.post("/razorpay/verify", requireAuth, (req, res) => {
  const { userId } = req as AuthRequest;
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature, plan, seats } = req.body as {
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
    plan: "INDIVIDUAL" | "BUSINESS";
    seats?: number;
  };

  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !plan) {
    return res.status(400).json({ error: "Missing payment verification fields." });
  }

  try {
    const { user, org } = getUserAndOrg(userId);
    if (!isOrgAdmin(user)) {
      return res.status(403).json({ error: "Only admins can verify payments." });
    }

    const secret = cleanEnv(process.env.RAZORPAY_KEY_SECRET);
    if (!secret) {
      return res.status(400).json({ error: "Razorpay secret is missing on server." });
    }
    const body = `${razorpay_order_id}|${razorpay_payment_id}`;
    const expected = crypto.createHmac("sha256", secret).update(body).digest("hex");
    if (expected !== razorpay_signature) {
      return res.status(400).json({ error: "Invalid signature." });
    }

    const now = new Date().toISOString();
    const updatedOrg = updateOrg(org.id, (current) => {
      const tier = plan === "INDIVIDUAL" ? "INDIVIDUAL" : "BUSINESS";
      const accountType = plan === "BUSINESS" ? "BUSINESS" : current.accountType;
      return {
        ...current,
        accountType,
        license: {
          ...current.license,
          tier,
          status: "active",
          seats: plan === "BUSINESS" ? Math.max(1, seats ?? current.license.seats) : 1,
          pricePerSeat: plan === "BUSINESS" ? 1 : 1,
          tokenBucket: createTokenBucket(tier),
          upgradedAt: now
        },
        updatedAt: now
      };
    });

    const snapshot = readDb();
    snapshot.users
      .filter((entry) => entry.orgId === org.id)
      .forEach((entry) => {
        updateUser(entry.id, (current) => ({
          ...current,
          licenseType: updatedOrg.license.tier
        }));
      });

    return res.json({ ok: true, license: updatedOrg.license, org: updatedOrg });
  } catch (err) {
    return res.status(400).json({ error: err instanceof Error ? err.message : "Verification failed." });
  }
});

router.post("/upgrade", requireAuth, (req, res) => {
  const { userId } = req as AuthRequest;
  const { plan, seats } = req.body as { plan?: "INDIVIDUAL" | "BUSINESS"; seats?: number };
  if (!plan) {
    return res.status(400).json({ error: "plan is required." });
  }
  if (!devUpgradeAllowed()) {
    return res.status(403).json({ error: "Dev upgrade is disabled." });
  }
  try {
    const { user, org } = getUserAndOrg(userId);
    if (!isOrgAdmin(user)) {
      return res.status(403).json({ error: "Only admins can upgrade." });
    }
    const now = new Date().toISOString();
    const updatedOrg = updateOrg(org.id, (current) => {
      const tier = plan === "INDIVIDUAL" ? "INDIVIDUAL" : "BUSINESS";
      const accountType = plan === "BUSINESS" ? "BUSINESS" : "INDIVIDUAL";
      return {
        ...current,
        accountType,
        license: {
          ...current.license,
          tier,
          status: "active",
          seats: plan === "BUSINESS" ? Math.max(1, seats ?? current.license.seats) : 1,
          pricePerSeat: plan === "BUSINESS" ? 1 : 1,
          tokenBucket: createTokenBucket(tier),
          upgradedAt: now
        },
        updatedAt: now
      };
    });

    const snapshot = readDb();
    snapshot.users
      .filter((entry) => entry.orgId === org.id)
      .forEach((entry) => {
        updateUser(entry.id, (current) => ({
          ...current,
          licenseType: updatedOrg.license.tier
        }));
      });

    return res.json({ ok: true, license: updatedOrg.license, org: updatedOrg });
  } catch (err) {
    return res.status(400).json({ error: err instanceof Error ? err.message : "Upgrade failed." });
  }
});

router.post("/downgrade", requireAuth, (req, res) => {
  const { userId } = req as AuthRequest;
  try {
    const { user, org } = getUserAndOrg(userId);
    if (!isOrgAdmin(user)) {
      return res.status(403).json({ error: "Only admins can downgrade." });
    }
    const now = new Date().toISOString();
    const updatedOrg = updateOrg(org.id, (current) => ({
      ...current,
      accountType: "INDIVIDUAL",
      license: {
        ...current.license,
        tier: "INDIVIDUAL",
        status: "active",
        seats: 1,
        pricePerSeat: 1,
        tokenBucket: createTokenBucket("INDIVIDUAL"),
        upgradedAt: now
      },
      updatedAt: now
    }));

    const snapshot = readDb();
    snapshot.users
      .filter((entry) => entry.orgId === org.id)
      .forEach((entry) => {
        updateUser(entry.id, (current) => ({
          ...current,
          licenseType: updatedOrg.license.tier,
          role: current.role
        }));
      });

    return res.json({ ok: true, license: updatedOrg.license, org: updatedOrg });
  } catch (err) {
    return res.status(400).json({ error: err instanceof Error ? err.message : "Downgrade failed." });
  }
});

router.post("/cancel", requireAuth, (req, res) => {
  const { userId } = req as AuthRequest;
  try {
    const { user, org } = getUserAndOrg(userId);
    if (!isOrgAdmin(user)) {
      return res.status(403).json({ error: "Only admins can cancel subscriptions." });
    }
    const now = new Date().toISOString();
    const updatedOrg = updateOrg(org.id, (current) => ({
      ...current,
      accountType: "INDIVIDUAL",
      license: {
        ...current.license,
        tier: "FREE",
        status: "active",
        seats: 1,
        pricePerSeat: 0,
        tokenBucket: createTokenBucket("FREE"),
        upgradedAt: now
      },
      updatedAt: now
    }));

    const snapshot = readDb();
    snapshot.users
      .filter((entry) => entry.orgId === org.id)
      .forEach((entry) => {
        updateUser(entry.id, (current) => ({
          ...current,
          licenseType: updatedOrg.license.tier
        }));
      });

    return res.json({ ok: true, license: updatedOrg.license, org: updatedOrg });
  } catch (err) {
    return res.status(400).json({ error: err instanceof Error ? err.message : "Cancel failed." });
  }
});

export default router;
