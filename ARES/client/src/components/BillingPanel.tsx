import { useEffect, useState } from "react";
import type { License, Organization, User } from "../lib/types";
import { createRazorpayOrder, fetchLicense, upgradeSubscription, verifyRazorpayPayment } from "../lib/api";

type UpgradePlan = "INDIVIDUAL" | "BUSINESS";

type PendingUpgrade = {
  plan: UpgradePlan;
  seats: number;
};

type RazorpayOrderResponse = {
  order: {
    id: string;
    amount: number;
    currency: string;
  };
  keyId: string;
};

type RazorpayPaymentResponse = {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
};

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => {
      open: () => void;
      on: (event: string, handler: (response: any) => void) => void;
    };
  }
}

type BillingPanelProps = {
  org: Organization | null;
  user: User;
  onDowngrade: () => Promise<{ ok: boolean; license: License; org: Organization }>;
  onCancel: () => Promise<{ ok: boolean; license: License; org: Organization }>;
  onOrgUpdated: (org: Organization) => void;
};

export default function BillingPanel({ org, user, onDowngrade, onCancel, onOrgUpdated }: BillingPanelProps) {
  const [license, setLicense] = useState<License | null>(null);
  const [orderInfo, setOrderInfo] = useState<RazorpayOrderResponse | null>(null);
  const [seats, setSeats] = useState(1);
  const [status, setStatus] = useState<string | null>(null);
  const [paymentFailed, setPaymentFailed] = useState(false);
  const [retryUpgrade, setRetryUpgrade] = useState<PendingUpgrade | null>(null);
  const [processingPayment, setProcessingPayment] = useState(false);
  const [devUpgradeAllowed, setDevUpgradeAllowed] = useState(false);
  const isLocal = typeof window !== "undefined" && ["localhost", "127.0.0.1"].includes(window.location.hostname);

  useEffect(() => {
    fetchLicense()
      .then((data) => {
        setLicense(data.license);
        setDevUpgradeAllowed(Boolean(data.devUpgradeAllowed) || isLocal);
      })
      .catch((err) => setStatus(err instanceof Error ? err.message : "Failed to load license"));
  }, [isLocal]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.Razorpay) return;
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    document.body.appendChild(script);
    return () => {
      if (script.parentNode) {
        script.parentNode.removeChild(script);
      }
    };
  }, []);

  async function runDevUpgrade(plan: UpgradePlan, seatCount: number) {
    const result = await upgradeSubscription(plan, seatCount);
    setLicense(result.license);
    onOrgUpdated(result.org);
    setStatus(`Upgraded to ${result.license.tier}.`);
    setPaymentFailed(false);
    setRetryUpgrade(null);
  }

  async function openCheckout(orderPayload: RazorpayOrderResponse, plan: UpgradePlan, seatCount: number) {
    if (typeof window === "undefined" || !window.Razorpay) {
      throw new Error("Razorpay checkout failed to load.");
    }
    setProcessingPayment(true);
    return await new Promise<void>((resolve, reject) => {
      const checkout = new window.Razorpay({
        key: orderPayload.keyId,
        amount: orderPayload.order.amount,
        currency: orderPayload.order.currency ?? "INR",
        name: "ARES",
        description: plan === "BUSINESS" ? "ARES Enterprise upgrade" : "ARES Individual upgrade",
        order_id: orderPayload.order.id,
        prefill: {
          name: user.name,
          email: user.email
        },
        theme: { color: "#a54f2f" },
        modal: {
          ondismiss: () => {
            setProcessingPayment(false);
            setPaymentFailed(true);
            setRetryUpgrade({ plan, seats: seatCount });
            setStatus("Payment cancelled. Retry to complete your upgrade.");
            reject(new Error("Payment cancelled."));
          }
        },
        handler: async (response: RazorpayPaymentResponse) => {
          try {
            const verified = await verifyRazorpayPayment({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              plan,
              seats: seatCount
            });
            setLicense(verified.license);
            onOrgUpdated(verified.org);
            setPaymentFailed(false);
            setRetryUpgrade(null);
            setStatus(`Payment successful. Upgraded to ${verified.license.tier}.`);
            resolve();
          } catch (err) {
            setPaymentFailed(true);
            setRetryUpgrade({ plan, seats: seatCount });
            setStatus(err instanceof Error ? err.message : "Payment verification failed.");
            reject(err instanceof Error ? err : new Error("Payment verification failed."));
          } finally {
            setProcessingPayment(false);
          }
        }
      });
      checkout.on("payment.failed", () => {
        setProcessingPayment(false);
        setPaymentFailed(true);
        setRetryUpgrade({ plan, seats: seatCount });
        setStatus("Payment failed. Please retry.");
        reject(new Error("Payment failed."));
      });
      checkout.open();
    });
  }

  async function handleOrder(plan: UpgradePlan, overrideSeats?: number) {
    const seatCount = plan === "BUSINESS" ? Math.max(1, overrideSeats ?? seats) : 1;
    setStatus(null);
    setPaymentFailed(false);
    setRetryUpgrade(null);
    try {
      const order = (await createRazorpayOrder(plan, seatCount)) as RazorpayOrderResponse;
      setOrderInfo(order);
      await openCheckout(order, plan, seatCount);
    } catch (err) {
      if (isLocal && devUpgradeAllowed) {
        try {
          await runDevUpgrade(plan, seatCount);
          return;
        } catch (upgradeErr) {
          setStatus(upgradeErr instanceof Error ? upgradeErr.message : "Unable to upgrade.");
          setPaymentFailed(true);
          setRetryUpgrade({ plan, seats: seatCount });
        }
        return;
      }
      setStatus(err instanceof Error ? err.message : "Unable to create order");
      setPaymentFailed(true);
      setRetryUpgrade({ plan, seats: seatCount });
    } finally {
      setProcessingPayment(false);
    }
  }

  return (
    <div className="drawer-panel">
      <div className="panel-header">
        <h2>License</h2>
        <span className="panel-subtitle">Manage plan + billing</span>
      </div>

      {status && <div className={paymentFailed ? "error-banner" : "notice-banner"}>{status}</div>}
      {paymentFailed && retryUpgrade && (
        <button
          className="primary-button"
          onClick={() => handleOrder(retryUpgrade.plan, retryUpgrade.seats)}
          disabled={processingPayment}
        >
          {processingPayment ? "Processing..." : "Retry payment"}
        </button>
      )}

      {license && (
        <div className="license-card">
          <div className="license-row">
            <span>Account type</span>
            <strong>{org?.accountType ?? "INDIVIDUAL"}</strong>
          </div>
          <div className="license-row">
            <span>Plan</span>
            <strong>{license.tier}</strong>
          </div>
          <div className="license-row">
            <span>Seats</span>
            <strong>{license.seats ?? 1}</strong>
          </div>
          <div className="license-row">
            <span>Tokens used</span>
            <strong>
              {license.tokenBucket.used} / {license.tokenBucket.limit}
            </strong>
          </div>
          <div className="license-row">
            <span>Reset</span>
            <strong>{new Date(license.tokenBucket.resetAt).toLocaleDateString()}</strong>
          </div>
        </div>
      )}

      <div className="pricing-grid">
        <div className="pricing-card">
          <div className="card-title">Individual</div>
          <div className="pricing-price">INR 1 / month</div>
          <div className="panel-subtitle">Single user, full ARES access.</div>
          {user.role === "admin" && (
            <button className="primary-button" onClick={() => handleOrder("INDIVIDUAL")} disabled={processingPayment}>
              Upgrade to Individual
            </button>
          )}
        </div>

        <div className="pricing-card">
          <div className="card-title">Enterprise</div>
          <div className="pricing-price">INR 2 base + INR 1 per additional user</div>
          <div className="panel-subtitle">Includes first seat. Team access + role controls.</div>
          <label className="panel-subtitle">Seats</label>
          <input
            type="number"
            value={seats}
            min={1}
            onChange={(event) => setSeats(Math.max(1, Number(event.target.value) || 1))}
            placeholder="Seats"
          />
          {user.role === "admin" && (
            <button className="primary-button" onClick={() => handleOrder("BUSINESS")} disabled={processingPayment}>
              Upgrade to Enterprise
            </button>
          )}
        </div>
      </div>

      {user.role === "admin" && (
        <div className="license-actions">
          <button
            className="ghost-button"
            onClick={async () => {
              try {
                const result = await onDowngrade();
                setLicense(result.license);
                onOrgUpdated(result.org);
                setStatus("Downgraded to Individual.");
              } catch (err) {
                setStatus(err instanceof Error ? err.message : "Downgrade failed.");
              }
            }}
          >
            Downgrade to Individual
          </button>
          <button
            className="ghost-button"
            onClick={async () => {
              try {
                const result = await onCancel();
                setLicense(result.license);
                onOrgUpdated(result.org);
                setStatus("Subscription cancelled. You're on Free tier.");
              } catch (err) {
                setStatus(err instanceof Error ? err.message : "Cancel failed.");
              }
            }}
          >
            Cancel subscription
          </button>
        </div>
      )}

      {orderInfo && (
        <div className="order-card">
          <div className="panel-subtitle">Order Details</div>
          <pre className="code-block">{JSON.stringify(orderInfo, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}
