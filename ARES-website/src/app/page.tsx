"use client";

import { useEffect, useMemo, useState } from "react";
import Preloader from "../components/Preloader";
import ChatWidget from "../components/ChatWidget";
import UseCaseModal from "../components/UseCaseModal";

const consoleUrl = process.env.NEXT_PUBLIC_CONSOLE_URL ?? "https://aresai-production.web.app/?mode=login";
const apiBase = process.env.NEXT_PUBLIC_API_BASE ?? "https://ares-prod-ce9q.onrender.com/api";

const useCases = [
  {
    title: "Finance Command Center",
    description: "Track revenue, aging receivables, and margin shift in one governed view."
  },
  {
    title: "Support Quality Radar",
    description: "Detect issue clusters, SLA breaches, and team bottlenecks before escalation."
  },
  {
    title: "Executive Weekly Pulse",
    description: "Generate trend snapshots from metrics and knowledge context with explainable SQL."
  }
];

export default function HomePage() {
  const [loading, setLoading] = useState(true);
  const [activeCase, setActiveCase] = useState<number | null>(null);
  const [contactStatus, setContactStatus] = useState<string | null>(null);
  const [upgradeStatus, setUpgradeStatus] = useState<string | null>(null);
  const [isAuthed, setIsAuthed] = useState(false);
  const [projectLabel, setProjectLabel] = useState("");
  const [contactForm, setContactForm] = useState({
    name: "",
    email: "",
    company: "",
    message: ""
  });

  useEffect(() => {
    const full = "PROJECT: ARES";
    let index = 0;
    const timer = window.setInterval(() => {
      index += 1;
      setProjectLabel(full.slice(0, index));
      if (index >= full.length) window.clearInterval(timer);
    }, 85);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const readCookie = () => {
      if (typeof document === "undefined") return "";
      const match = document.cookie.split("; ").find((entry) => entry.startsWith("ares_token="));
      return match ? decodeURIComponent(match.split("=")[1] ?? "") : "";
    };
    const localToken = typeof window !== "undefined" ? window.localStorage.getItem("ares_token") : "";
    const cookieToken = readCookie();
    setIsAuthed(Boolean(localToken || cookieToken));
  }, []);

  useEffect(() => {
    let rafId = 0;
    let fadeTimer = 0;
    const onMove = (event: MouseEvent) => {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        const x = (event.clientX / window.innerWidth) * 100;
        const y = (event.clientY / window.innerHeight) * 100;
        document.documentElement.style.setProperty("--mx", `${x}%`);
        document.documentElement.style.setProperty("--my", `${y}%`);
        document.documentElement.style.setProperty("--splash-x", `${event.clientX}px`);
        document.documentElement.style.setProperty("--splash-y", `${event.clientY}px`);
        document.documentElement.style.setProperty("--splash-opacity", "0.22");
      });
      if (fadeTimer) window.clearTimeout(fadeTimer);
      fadeTimer = window.setTimeout(() => {
        document.documentElement.style.setProperty("--splash-opacity", "0");
      }, 200);
    };
    window.addEventListener("mousemove", onMove);
    return () => {
      window.removeEventListener("mousemove", onMove);
      if (rafId) cancelAnimationFrame(rafId);
      if (fadeTimer) window.clearTimeout(fadeTimer);
    };
  }, []);

  async function handleUpgrade(plan: "INDIVIDUAL" | "BUSINESS") {
    setUpgradeStatus(null);
    const token =
      (typeof window !== "undefined" && window.localStorage.getItem("ares_token")) ||
      (typeof document !== "undefined"
        ? document.cookie.split("; ").find((entry) => entry.startsWith("ares_token="))?.split("=")[1]
        : null);
    if (!token) {
      setUpgradeStatus("Sign in to continue with upgrade.");
      return;
    }
    try {
      setUpgradeStatus("Applying upgrade...");
      const res = await fetch(`${apiBase}/billing/upgrade`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${decodeURIComponent(token)}`
        },
        body: JSON.stringify({ plan, seats: plan === "BUSINESS" ? 1 : undefined })
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error ?? "Upgrade failed.");
      }
      setUpgradeStatus(`Upgraded to ${plan}.`);
    } catch (err) {
      setUpgradeStatus(err instanceof Error ? err.message : "Upgrade failed.");
    }
  }

  async function handleContactSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setContactStatus(null);
    try {
      const res = await fetch(`${apiBase}/public/contact`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(contactForm)
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error ?? "Unable to submit form.");
      }
      setContactStatus("Thanks. We received your request.");
      setContactForm({ name: "", email: "", company: "", message: "" });
    } catch (err) {
      setContactStatus(err instanceof Error ? err.message : "Unable to submit form.");
    }
  }

  const activeModal = useMemo(() => {
    if (activeCase === null) return null;
    return useCases[activeCase];
  }, [activeCase]);

  return (
    <div className="site-root">
      {loading && <Preloader onDone={() => setLoading(false)} />}

      <header className="site-header">
        <a className="site-logo" href="#product">
          <img src="/ares-icon.svg" alt="ARES" />
          <span>ARES</span>
        </a>
        <nav className="site-nav">
          <a href="#product">Product</a>
          <a href="#features">Features</a>
          <a href="#use-cases">Use Cases</a>
          <a href="#security">Security</a>
          <a href="#pricing">Pricing</a>
          <a href="#contact">Contact</a>
        </nav>
        <a href={consoleUrl} data-track="console_bay_click" className="site-cta">
          Console Bay
        </a>
      </header>

      <main>
        <section id="product" className="hero-section">
          <div className="hero-grid-bg" />
          <p className="project-typing">{projectLabel}</p>
          <h1 className="dot-heading">FIX. LEARN.</h1>

          <div className="flow-map">
            <div className="flow-line top">
              <span />
              <label>Customer</label>
              <span />
              <label>Code</label>
            </div>
            <div className="flow-core">
              <div className="flow-core-inner">
                <img src="/ares-icon.svg" alt="ARES core" />
              </div>
            </div>
            <div className="flow-line bottom">
              <span />
              <label>Issue</label>
              <span />
              <label>PR</label>
            </div>
          </div>

          <h2 className="dot-heading secondary">PREVENT.</h2>
          <p className="hero-description">
            ARES brings AI to enterprise analytics by linking data sources, business context, and explainable query
            workflows.
          </p>
          <div className="hero-actions">
            <a href={consoleUrl} data-track="console_bay_click" className="primary-btn">
              Enter Console
            </a>
            <a href="#features" className="secondary-btn">
              Explore Platform
            </a>
          </div>
        </section>

        <section className="proof-strip">
          <article>
            <div className="proof-title">KEYDATA</div>
            <div className="proof-value">3x</div>
            <p>Faster insight turnaround</p>
          </article>
          <article>
            <div className="proof-title">CAYUSE</div>
            <div className="proof-value">92%</div>
            <p>Defects found before release</p>
          </article>
          <article>
            <div className="proof-title">ARES</div>
            <div className="proof-copy">
              Connect data sources, run secure AI analysis, and turn questions into trusted operational actions.
            </div>
          </article>
        </section>

        <section id="features" className="section-block">
          <div className="section-head">
            <p>FEATURES</p>
            <h3>Everything teams need in one workspace</h3>
          </div>
          <div className="mono-card-grid">
            {[
              ["Data Sources", "PostgreSQL, MySQL, Firebase, local SQL, and hosted connectors."],
              ["Custom Inputs", "Dictionaries, rules, metrics, and business context grounded to pods."],
              ["AI Query Generation", "Natural language to SQL, result analysis, and chart suggestions."],
              ["Dashboards", "Metric widgets with filters, groupings, and trend visualizations."],
              ["Knowledge Bank", "Shared enterprise memory with highlights and lowlights by period."],
              ["Access Control", "Team roles, pod permissions, and managed enterprise user access."]
            ].map(([title, body]) => (
              <article key={title} className="mono-card">
                <h4>{title}</h4>
                <p>{body}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="use-cases" className="section-block">
          <div className="section-head">
            <p>USE CASES</p>
            <h3>Live ARES scenarios</h3>
          </div>
          <div className="mono-card-grid">
            {useCases.map((item, index) => (
              <button key={item.title} className="mono-card mono-card-button" onClick={() => setActiveCase(index)}>
                <h4>{item.title}</h4>
                <p>{item.description}</p>
              </button>
            ))}
          </div>
        </section>

        <section id="security" className="section-block security-block">
          <div className="section-head">
            <p>SECURITY</p>
            <h3>Zero trust architecture, enterprise ready</h3>
          </div>
          <div className="security-layout">
            <p>
              Role-based access, pod-level isolation, and auditable query history keep your analysis secure without
              slowing teams down.
            </p>
            <div className="security-badges">
              <span>SOC-ready controls</span>
              <span>Encrypted context routing</span>
              <span>Session-safe auth</span>
            </div>
          </div>
        </section>

        <section id="pricing" className="section-block">
          <div className="section-head centered">
            <p>PRICING</p>
            <h3>Launch with the tier that fits</h3>
          </div>
          <div className="price-grid">
            {[
              { tier: "Starter", price: "INR 0", detail: "Limited tokens + 2 pods", plan: null },
              {
                tier: "Individual",
                price: "INR 1 / mo",
                detail: "Single user, full ARES access.",
                plan: "INDIVIDUAL" as const
              },
              {
                tier: "Enterprise",
                price: "INR 2 base + INR 1/user",
                detail: "Team access + role controls.",
                plan: "BUSINESS" as const
              }
            ].map((plan) => (
              <article key={plan.tier} className="price-card">
                <div className="tier">{plan.tier}</div>
                <div className="value">{plan.price}</div>
                <p>{plan.detail}</p>
                {isAuthed && plan.plan && (
                  <button className="primary-btn compact" onClick={() => handleUpgrade(plan.plan)}>
                    Upgrade
                  </button>
                )}
              </article>
            ))}
          </div>
          {upgradeStatus && <div className="status-note">{upgradeStatus}</div>}
        </section>

        <section id="contact" className="section-block">
          <div className="section-head centered">
            <p>CONTACT</p>
            <h3>Talk to the ARES team</h3>
          </div>
          <form className="contact-form" onSubmit={handleContactSubmit}>
            <div className="contact-grid">
              <label>
                Name
                <input
                  value={contactForm.name}
                  onChange={(event) => setContactForm({ ...contactForm, name: event.target.value })}
                  required
                />
              </label>
              <label>
                Email
                <input
                  type="email"
                  value={contactForm.email}
                  onChange={(event) => setContactForm({ ...contactForm, email: event.target.value })}
                  required
                />
              </label>
            </div>
            <label>
              Company
              <input
                value={contactForm.company}
                onChange={(event) => setContactForm({ ...contactForm, company: event.target.value })}
              />
            </label>
            <label>
              Message
              <textarea
                value={contactForm.message}
                onChange={(event) => setContactForm({ ...contactForm, message: event.target.value })}
                required
              />
            </label>
            <div className="contact-actions">
              <button type="submit" className="primary-btn compact">
                Contact sales
              </button>
              <a href={consoleUrl} data-track="console_bay_click" className="secondary-btn compact">
                Go to console
              </a>
            </div>
            {contactStatus && <div className="status-note">{contactStatus}</div>}
          </form>
        </section>
      </main>

      <footer className="site-footer">
        <span>© 2026 ARES. All rights reserved.</span>
        <div>
          <a href="#product">Product</a>
          <a href="#security">Security</a>
          <a href="#pricing">Pricing</a>
        </div>
      </footer>

      <ChatWidget />

      {activeModal && (
        <UseCaseModal
          open={Boolean(activeModal)}
          title={activeModal.title}
          description={activeModal.description}
          onClose={() => setActiveCase(null)}
        />
      )}
    </div>
  );
}
