import { useEffect, useState } from "react";
import type { License, Organization, User } from "../lib/types";
import { createRazorpayOrder, fetchLicense, upgradeSubscription } from "../lib/api";

type BillingPanelProps = {
  org: Organization | null;
  user: User;
  onDowngrade: () => Promise<{ ok: boolean; license: License; org: Organization }>;
  onCancel: () => Promise<{ ok: boolean; license: License; org: Organization }>;
  onOrgUpdated: (org: Organization) => void;
};

export default function BillingPanel({ org, user, onDowngrade, onCancel, onOrgUpdated }: BillingPanelProps) {
  const [license, setLicense] = useState<License | null>(null);
  const [orderInfo, setOrderInfo] = useState<any | null>(null);
  const [seats, setSeats] = useState(1);
  const [status, setStatus] = useState<string | null>(null);
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

  async function handleOrder(plan: "INDIVIDUAL" | "BUSINESS") {
    try {
      if (devUpgradeAllowed) {
        const result = await upgradeSubscription(plan, seats);
        setLicense(result.license);
        onOrgUpdated(result.org);
        setStatus(`Upgraded to ${result.license.tier}.`);
        return;
      }
      const order = await createRazorpayOrder(plan, seats);
      setOrderInfo(order);
      setStatus("Order created. Use Postman to complete verification in test mode.");
    } catch (err) {
      if (isLocal) {
        try {
          const result = await upgradeSubscription(plan, seats);
          setLicense(result.license);
          onOrgUpdated(result.org);
          setStatus(`Upgraded to ${result.license.tier}.`);
          return;
        } catch (upgradeErr) {
          setStatus(upgradeErr instanceof Error ? upgradeErr.message : "Unable to upgrade.");
          return;
        }
      }
      setStatus(err instanceof Error ? err.message : "Unable to create order");
    }
  }

  return (
    <div className="drawer-panel">
      <div className="panel-header">
        <h2>License</h2>
        <span className="panel-subtitle">Manage plan + billing</span>
      </div>

      {status && <div className="error-banner">{status}</div>}

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
            <button className="primary-button" onClick={() => handleOrder("INDIVIDUAL")}>
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
            <button className="primary-button" onClick={() => handleOrder("BUSINESS")}>
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
