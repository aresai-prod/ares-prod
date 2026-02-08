"use client";

import { useEffect } from "react";

type UseCaseModalProps = {
  open: boolean;
  title: string;
  description: string;
  onClose: () => void;
};

export default function UseCaseModal({ open, title, description, onClose }: UseCaseModalProps) {
  useEffect(() => {
    if (!open) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
      <div className="glass-card max-w-lg w-full p-6">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-semibold">{title}</h3>
          <button className="text-white/60 hover:text-white" onClick={onClose}>
            Close
          </button>
        </div>
        <p className="mt-4 text-sm text-white/70">{description}</p>
        <div className="mt-6 rounded-2xl border border-white/10 bg-black/40 p-4 text-xs text-white/70">
          Live preview: ARES will orchestrate AI workflows, query your data sources, and generate secure insights in Console Bay.
        </div>
      </div>
    </div>
  );
}
