"use client";

import { useEffect } from "react";

const apiBase = process.env.NEXT_PUBLIC_API_BASE ?? "https://ares-prod-ce9q.onrender.com/api";

function sendEvent(event: string, payload: Record<string, any>) {
  const body = JSON.stringify({
    event,
    payload,
    ts: new Date().toISOString()
  });

  fetch(`${apiBase}/public/analytics`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    keepalive: true
  }).catch(() => {});
}

export default function AnalyticsTracker() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    sendEvent("page_view", { path: window.location.pathname });

    const clickHandler = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;
      const track = target.closest("[data-track]") as HTMLElement | null;
      if (!track) return;
      const name = track.dataset.track || "click";
      sendEvent(name, {
        text: track.textContent?.trim() || "",
        href: (track as HTMLAnchorElement).href || undefined
      });
    };

    const thresholds = [25, 50, 75, 100];
    const fired = new Set<number>();
    const onScroll = () => {
      const scrollTop = window.scrollY;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      const progress = docHeight > 0 ? Math.min(100, Math.round((scrollTop / docHeight) * 100)) : 100;
      thresholds.forEach((threshold) => {
        if (progress >= threshold && !fired.has(threshold)) {
          fired.add(threshold);
          sendEvent("scroll_depth", { value: threshold });
        }
      });
    };

    const sections = Array.from(document.querySelectorAll("[data-section]")) as HTMLElement[];
    let activeSection: string | null = null;
    let enteredAt = Date.now();

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const sectionId = (entry.target as HTMLElement).dataset.section || "unknown";
          if (activeSection && activeSection !== sectionId) {
            sendEvent("section_time", {
              section: activeSection,
              ms: Date.now() - enteredAt
            });
            enteredAt = Date.now();
          }
          activeSection = sectionId;
        });
      },
      { threshold: 0.5 }
    );

    sections.forEach((section) => observer.observe(section));

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("click", clickHandler);

    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("click", clickHandler);
      observer.disconnect();
      if (activeSection) {
        sendEvent("section_time", {
          section: activeSection,
          ms: Date.now() - enteredAt
        });
      }
    };
  }, []);

  return null;
}
