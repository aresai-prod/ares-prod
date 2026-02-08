import { useMemo, useState } from "react";
import logo from "../assets/ares-icon.svg";
import { sendConciergeMessage } from "../lib/api";

type ConciergeMessage = {
  id: string;
  role: "assistant" | "user";
  content: string;
};

const initialMessage: ConciergeMessage = {
  id: "welcome",
  role: "assistant",
  content:
    "Hi, I’m your ARES concierge. Ask about onboarding, connectors, dashboards, or where to find a feature."
};

export default function ConciergeWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ConciergeMessage[]>([initialMessage]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const suggestions = useMemo(
    () => [
      "Connect a database",
      "Create a dashboard",
      "Set API keys",
      "Invite a teammate"
    ],
    []
  );

  async function handleSend(message: string) {
    if (!message.trim() || sending) return;
    const userMessage: ConciergeMessage = {
      id: `user_${Date.now()}`,
      role: "user",
      content: message.trim()
    };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setError(null);
    setSending(true);
    try {
      const history = [...messages, userMessage].map((msg) => ({
        role: msg.role,
        content: msg.content
      }));
      const response = await sendConciergeMessage({
        message: userMessage.content,
        history
      });
      const assistantMessage: ConciergeMessage = {
        id: `assistant_${Date.now()}`,
        role: "assistant",
        content: response.reply
      };
      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Concierge failed.");
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      {open && (
        <div className="concierge-panel">
          <div className="concierge-header">
            <div className="concierge-title">ARES Concierge</div>
            <button className="ghost-button" onClick={() => setOpen(false)}>
              Close
            </button>
          </div>
          <div className="concierge-messages">
            {messages.map((msg) => (
              <div key={msg.id} className={`concierge-message ${msg.role}`}>
                {msg.content}
              </div>
            ))}
          </div>
          <div className="concierge-input">
            <input
              value={input}
              placeholder="Ask about ARES features"
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") handleSend(input);
              }}
            />
            <button onClick={() => handleSend(input)} disabled={sending}>
              {sending ? "..." : "Send"}
            </button>
          </div>
          {error && <div className="error-banner">{error}</div>}
          <div className="text-muted">Suggestions: {suggestions.join(" · ")}</div>
        </div>
      )}
      <button className="concierge-button" onClick={() => setOpen((prev) => !prev)} aria-label="Ares concierge">
        <img src={logo} alt="ARES" />
      </button>
    </>
  );
}
