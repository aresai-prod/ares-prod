"use client";

import { useEffect, useMemo, useState } from "react";
import Preloader from "../components/Preloader";
import ChatWidget from "../components/ChatWidget";
import UseCaseModal from "../components/UseCaseModal";

const consoleUrl = process.env.NEXT_PUBLIC_CONSOLE_URL ?? "http://localhost:5173/?mode=login";
const apiBase = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8787/api";

const useCases = [
  {
    title: "Revenue Intelligence",
    description: "Unified revenue dashboards with AI-driven cohort analysis and forecasting."
  },
  {
    title: "Ops Signal Room",
    description: "Real-time operational insights across teams, pipelines, and SLAs."
  },
  {
    title: "Customer Pulse",
    description: "Segment health, churn signals, and support outcomes without manual SQL."
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
    const words = ["Project:", "ARES"];
    let index = 0;
    let timer: number | null = null;
    const tick = () => {
      index += 1;
      setProjectLabel(words.slice(0, index).join(" "));
      if (index < words.length) {
        timer = window.setTimeout(tick, 300);
      }
    };
    tick();
    return () => {
      if (timer) window.clearTimeout(timer);
    };
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
    const onMove = (event: MouseEvent) => {
      const x = (event.clientX / window.innerWidth) * 100;
      const y = (event.clientY / window.innerHeight) * 100;
      document.documentElement.style.setProperty("--mx", `${x}%`);
      document.documentElement.style.setProperty("--my", `${y}%`);
      document.documentElement.style.setProperty("--splash-x", `${event.clientX}px`);
      document.documentElement.style.setProperty("--splash-y", `${event.clientY}px`);
      document.documentElement.style.setProperty("--splash-opacity", "0.35");
      if (onMove.timeoutId) window.clearTimeout(onMove.timeoutId);
      onMove.timeoutId = window.setTimeout(() => {
        document.documentElement.style.setProperty("--splash-opacity", "0");
      }, 140);
    };
    onMove.timeoutId = null as unknown as number | null;
    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
  }, []);

  useEffect(() => {
    let active = true;
    async function initAnimations() {
      const gsapModule = await import("gsap");
      const scrollModule = await import("gsap/ScrollTrigger");
      const gsap = gsapModule.gsap;
      const ScrollTrigger = scrollModule.ScrollTrigger;
      if (!active) return;
      gsap.registerPlugin(ScrollTrigger);

      gsap.utils.toArray<HTMLElement>(".reveal").forEach((element) => {
        gsap.fromTo(
          element,
          { opacity: 0, y: 40 },
          {
            opacity: 1,
            y: 0,
            duration: 1,
            ease: "power3.out",
            scrollTrigger: {
              trigger: element,
              start: "top 80%"
            }
          }
        );
      });

      gsap.to(".shield-core", {
        scale: 1.08,
        opacity: 1,
        scrollTrigger: {
          trigger: "#security",
          start: "top 80%",
          end: "bottom 20%",
          scrub: true
        }
      });
    }

    initAnimations();

    return () => {
      active = false;
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
      setUpgradeStatus("Please sign in to upgrade.");
      return;
    }
    try {
      setUpgradeStatus("Upgrading...");
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

  const activeModal = useMemo(() => {
    if (activeCase === null) return null;
    return useCases[activeCase];
  }, [activeCase]);

  async function handleContactSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setContactStatus(null);
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(contactForm)
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error ?? "Unable to submit form.");
      }
      setContactStatus("Thanks! We received your request.");
      setContactForm({ name: "", email: "", company: "", message: "" });
    } catch (err) {
      setContactStatus(err instanceof Error ? err.message : "Unable to submit form.");
    }
  }

  return (
    <div className="relative">
      {loading && <Preloader onDone={() => setLoading(false)} />}

      <header className="fixed top-0 left-0 right-0 z-40 px-8 py-6 backdrop-blur-md bg-white/60 flex items-center justify-between border-b border-white/40">
        <div className="flex items-center gap-3 text-ares">
          <img src="/ares-icon.svg" alt="ARES" className="w-8 h-8" />
          <span className="text-sm uppercase tracking-[0.3em]">ARES</span>
        </div>
        <nav className="hidden md:flex items-center gap-6 text-sm text-ares-muted">
          <a href="#product" className="hover:text-ares">Product</a>
          <a href="#features" className="hover:text-ares">Features</a>
          <a href="#use-cases" className="hover:text-ares">Use Cases</a>
          <a href="#security" className="hover:text-ares">Security</a>
          <a href="#pricing" className="hover:text-ares">Pricing</a>
          <a href="#contact" className="hover:text-ares">Contact</a>
        </nav>
        <a
          href={consoleUrl}
          data-track="console_bay_click"
          className="primary-cta text-sm"
        >
          Console Bay
        </a>
      </header>

      <section
        id="home"
        data-section="home"
        className="section-shell min-h-screen flex items-center pt-32 melt"
      >
        <div className="hero-bg" />
        <div className="relative z-10 grid lg:grid-cols-[1.1fr_0.9fr] gap-12 items-center">
          <div className="space-y-8 reveal">
            <p className="text-xs uppercase tracking-[0.4em] text-ares-faint font-semibold">{projectLabel}</p>
            <h1 className="hero-title font-semibold">Liquid Intelligence for Enterprise Data</h1>
            <p className="hero-subtitle text-ares-muted">
              ARES is the AI operations platform that transforms data into secure, explainable insights. The website is
              only the gateway. The real product lives in the ARES Console.
            </p>
            <div className="flex flex-wrap gap-4">
              <a
                href={consoleUrl}
                data-track="console_bay_click"
                className="primary-cta"
              >
                Enter Console Bay
              </a>
              <a href="#product" className="secondary-cta">Explore the Platform</a>
            </div>
          </div>
          <div className="h-[420px] lg:h-[520px] glass-card neon-border reveal flex items-center justify-center">
            <img src="/ares-hero.svg" alt="ARES" className="w-[80%] h-[80%] object-contain" />
          </div>
        </div>
      </section>

      <section id="product" data-section="product" className="section-shell melt">
        <div className="max-w-5xl mx-auto">
          <div className="text-center space-y-4 reveal">
            <p className="text-xs uppercase tracking-[0.4em] text-ares-faint">Product</p>
            <h2 className="text-3xl md:text-4xl font-semibold">From Raw Data to Actionable Insight</h2>
            <p className="text-ares-muted">
              ARES connects to your sources, orchestrates AI workflows, and delivers governed analytics with full audit
              trails.
            </p>
          </div>
          <div className="mt-12 grid md:grid-cols-3 gap-6 reveal">
            {["Data Ingestion", "AI Processing", "Insight Delivery"].map((stage, index) => (
              <div key={stage} className="glass-card p-6 space-y-4">
                <div className="text-2xl font-semibold text-ares">0{index + 1}</div>
                <div className="text-lg font-semibold">{stage}</div>
                <p className="text-sm text-ares-muted">
                  {stage === "Data Ingestion"
                    ? "Secure connectors ingest SQL, warehouse, and operational data."
                    : stage === "AI Processing"
                      ? "ARES applies domain rules, governance, and RAG to your context."
                      : "Insights flow into dashboards, chat, and automated workflows."}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="features" data-section="features" className="section-shell melt">
        <div className="max-w-6xl mx-auto">
          <div className="text-center space-y-4 reveal">
            <p className="text-xs uppercase tracking-[0.4em] text-ares-faint">Features</p>
            <h2 className="text-3xl md:text-4xl font-semibold">Everything Your Teams Need</h2>
            <p className="text-ares-muted">
              The ARES Console delivers data connectivity, custom business context, dashboarding, and AI-driven SQL —
              all in one secure workspace.
            </p>
          </div>
          <div className="mt-12 grid md:grid-cols-3 gap-6 reveal">
            {[
              {
                title: "Data Sources",
                detail: "PostgreSQL, MySQL, Firebase, and secure hosted databases."
              },
              {
                title: "Custom Inputs",
                detail: "Data dictionary, column metadata, filters, business context, and metric definitions."
              },
              {
                title: "AI Query Generation",
                detail: "Natural language questions transformed into SQL with guardrails."
              },
              {
                title: "Dashboarding",
                detail: "Multi-metric dashboards with joins, filters, and trend widgets."
              },
              {
                title: "Knowledge Bank",
                detail: "Company intelligence entries shared across pods and teams."
              },
              {
                title: "Enterprise Controls",
                detail: "Role-based access, audit trails, and analytics monitoring."
              }
            ].map((feature) => (
              <div key={feature.title} className="glass-card p-6 space-y-4 card-static">
                <div className="text-lg font-semibold">{feature.title}</div>
                <p className="text-sm text-ares-muted">{feature.detail}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="use-cases" data-section="use-cases" className="section-shell melt">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between flex-wrap gap-6 reveal">
            <div>
              <p className="text-xs uppercase tracking-[0.4em] text-ares-faint">Use Cases</p>
              <h2 className="text-3xl md:text-4xl font-semibold">Live ARES Scenarios</h2>
            </div>
          </div>
          <div className="mt-10 grid md:grid-cols-3 gap-6 reveal">
            {useCases.map((item, index) => (
              <button
                key={item.title}
                className="glass-card p-6 text-left card-static"
                onClick={() => setActiveCase(index)}
              >
                <h3 className="text-lg font-semibold mb-2">{item.title}</h3>
                <p className="text-sm text-ares-muted">{item.description}</p>
              </button>
            ))}
          </div>
        </div>
      </section>

      <section id="security" data-section="security" className="section-shell melt">
        <div className="max-w-6xl mx-auto grid lg:grid-cols-[1fr_1fr] gap-12 items-center">
          <div className="space-y-4 reveal">
            <p className="text-xs uppercase tracking-[0.4em] text-ares-faint">Security</p>
            <h2 className="text-3xl md:text-4xl font-semibold">Enterprise Security + Zero Trust</h2>
            <p className="text-ares-muted">
              ARES enforces role-based permissions, isolated pods, and audit-grade analytics. Every query is traceable.
            </p>
            <div className="flex gap-4">
              <div className="glass-card p-4 text-sm">SOC-ready access controls</div>
              <div className="glass-card p-4 text-sm">Encrypted context pipelines</div>
            </div>
          </div>
          <div className="glass-card p-8 relative overflow-hidden reveal">
            <div className="absolute inset-0 bg-ares-gradient opacity-20" />
            <div className="relative z-10 flex flex-col items-center gap-4">
              <div className="w-40 h-40 rounded-full border border-ares-cyan/60 flex items-center justify-center shadow-neon animate-pulse shield-core">
                <div className="w-24 h-24 rounded-full border border-ares-violet/60" />
              </div>
              <div className="text-sm uppercase tracking-[0.3em] text-ares-faint">Shielded Core</div>
            </div>
          </div>
        </div>
      </section>

      <section id="pricing" data-section="pricing" className="section-shell melt">
        <div className="max-w-6xl mx-auto text-center">
          <p className="text-xs uppercase tracking-[0.4em] text-ares-faint reveal">Pricing</p>
          <h2 className="text-3xl md:text-4xl font-semibold reveal">Launch with the Tier that Fits</h2>
          <div className="mt-10 grid md:grid-cols-3 gap-6 reveal">
            {[
              { tier: "Free", price: "$0", detail: "Limited tokens + 2 pods", plan: null },
              { tier: "Individual", price: "$2/mo", detail: "Single user, full ARES access.", plan: "INDIVIDUAL" as const },
              { tier: "Enterprise", price: "$10 base + $5/user", detail: "Team access + role controls.", plan: "BUSINESS" as const }
            ].map((plan) => (
              <div key={plan.tier} className="glass-card p-6 card-static">
                <div className="text-sm uppercase tracking-[0.3em] text-ares-faint">{plan.tier}</div>
                <div className="text-3xl font-semibold my-4">{plan.price}</div>
                <p className="text-sm text-ares-muted">{plan.detail}</p>
                {isAuthed && plan.plan && (
                  <button
                    className="primary-cta mt-6 inline-flex"
                    onClick={() => handleUpgrade(plan.plan)}
                  >
                    Upgrade
                  </button>
                )}
              </div>
            ))}
          </div>
          {upgradeStatus && <div className="mt-6 text-sm text-ares-cyan">{upgradeStatus}</div>}
        </div>
      </section>

      <section id="contact" data-section="contact" className="section-shell">
        <div className="max-w-5xl mx-auto text-center space-y-6">
          <p className="text-xs uppercase tracking-[0.4em] text-ares-faint reveal">Contact</p>
          <h2 className="text-3xl md:text-4xl font-semibold reveal">Talk to the ARES Team</h2>
          <p className="text-ares-muted">
            Ready for a tailored ARES Console experience? Send us your details and we will orchestrate onboarding.
          </p>
          <form
            className="glass-card p-6 max-w-3xl mx-auto grid gap-4 text-left"
            onSubmit={handleContactSubmit}
          >
            <div className="grid md:grid-cols-2 gap-4">
              <div className="grid gap-2">
                <label className="text-xs uppercase tracking-[0.2em] text-ares-faint">Name</label>
                <input
                  className="rounded-xl input-ares px-4 py-3"
                  value={contactForm.name}
                  onChange={(event) => setContactForm({ ...contactForm, name: event.target.value })}
                  required
                />
              </div>
              <div className="grid gap-2">
                <label className="text-xs uppercase tracking-[0.2em] text-ares-faint">Email</label>
                <input
                  className="rounded-xl input-ares px-4 py-3"
                  type="email"
                  value={contactForm.email}
                  onChange={(event) => setContactForm({ ...contactForm, email: event.target.value })}
                  required
                />
              </div>
            </div>
            <div className="grid gap-2">
              <label className="text-xs uppercase tracking-[0.2em] text-ares-faint">Company</label>
              <input
                className="rounded-xl input-ares px-4 py-3"
                value={contactForm.company}
                onChange={(event) => setContactForm({ ...contactForm, company: event.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <label className="text-xs uppercase tracking-[0.2em] text-ares-faint">Message</label>
              <textarea
                className="rounded-xl input-ares px-4 py-3 min-h-[120px]"
                value={contactForm.message}
                onChange={(event) => setContactForm({ ...contactForm, message: event.target.value })}
                required
              />
            </div>
            {contactStatus && <div className="text-sm text-ares-cyan">{contactStatus}</div>}
            <div className="flex flex-wrap gap-4 justify-center">
              <button type="submit" className="primary-cta">Contact Sales</button>
              <a href={consoleUrl} data-track="console_bay_click" className="secondary-cta">Go to Console</a>
            </div>
          </form>
        </div>
        <footer className="mt-16 flex flex-col md:flex-row items-center justify-between text-xs text-ares-faint gap-4 footer-links">
          <span>© 2026 ARES. All rights reserved.</span>
          <div className="flex gap-4">
            <a href="#product" className="hover:text-ares">Product</a>
            <a href="#security" className="hover:text-ares">Security</a>
            <a href="#pricing" className="hover:text-ares">Pricing</a>
          </div>
        </footer>
      </section>

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
