"use client";

import { useState } from "react";

const cannedReplies: Array<{ match: RegExp; reply: string }> = [
  {
    match: /price|pricing|cost|plan/i,
    reply: "ARES offers Starter, Professional, and Enterprise tiers. The Console Bay provides custom plans for enterprises."
  },
  {
    match: /security|zero trust|compliance/i,
    reply: "ARES uses a zero-trust model with role-based access and audit-ready analytics for enterprise workloads."
  },
  {
    match: /console|login|signup/i,
    reply: "Access the ARES Console via Console Bay. It is the dedicated product environment for workflows and analytics."
  },
  {
    match: /demo|use case|example/i,
    reply: "ARES powers operational dashboards, AI-driven SQL, and secure insights across teams."
  }
];

export default function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<{ role: "user" | "bot"; text: string }[]>([
    { role: "bot", text: "Hi, I am ARES Concierge. Ask me about the platform." }
  ]);
  const [input, setInput] = useState("");

  function handleSend() {
    if (!input.trim()) return;
    const userText = input.trim();
    const match = cannedReplies.find((item) => item.match.test(userText));
    const reply = match ? match.reply : "ARES is the AI platform for enterprise analytics. Ask about pricing, security, or Console Bay.";

    setMessages((prev) => [...prev, { role: "user", text: userText }, { role: "bot", text: reply }]);
    setInput("");
  }

  return (
    <div className="chat-widget">
      {open && (
        <div className="glass-card chat-window">
          <div className="flex items-center justify-between p-4 border-b border-white/10">
            <div>
              <div className="text-sm font-semibold">ARES Concierge</div>
              <div className="text-xs text-white/60">Instant answers</div>
            </div>
            <button
              className="text-xs text-white/60 hover:text-white"
              onClick={() => setOpen(false)}
            >
              Close
            </button>
          </div>
          <div className="p-4">
            <div className="chat-messages mb-3">
              {messages.map((msg, index) => (
                <div key={index} className={`chat-bubble ${msg.role === "user" ? "user" : ""}`}>
                  {msg.text}
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                className="flex-1 rounded-full bg-white/10 border border-white/10 px-3 py-2 text-sm text-white"
                placeholder="Ask about ARES"
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") handleSend();
                }}
              />
              <button className="primary-cta text-sm" onClick={handleSend}>
                Send
              </button>
            </div>
          </div>
        </div>
      )}
      <button className="concierge-button" onClick={() => setOpen((prev) => !prev)}>
        {open ? "×" : "A"}
      </button>
    </div>
  );
}
