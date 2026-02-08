import { useEffect, useRef, useState } from "react";
import logo from "../assets/ares-icon.svg";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
};

type ChatPanelProps = {
  messages: Message[];
  loading: boolean;
  error: string | null;
  notice?: string | null;
  onSend: (message: string) => void;
  disabled?: boolean;
  disabledReason?: string | null;
};

export default function ChatPanel({
  messages,
  loading,
  error,
  notice,
  onSend,
  disabled = false,
  disabledReason
}: ChatPanelProps) {
  const [input, setInput] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  return (
    <section className="panel chat-panel">
      <div className="panel-header">
        <h2>Chat</h2>
        <span className="panel-subtitle">Ask in plain language</span>
      </div>

      <div className="chat-stream">
        {messages.map((msg) => (
          <div key={msg.id} className={`chat-bubble ${msg.role}`}>
            {msg.role === "assistant" && (
              <div className="assistant-avatar">
                <img src={logo} alt="ARES" />
              </div>
            )}
            <div className="chat-content">
              <div className="chat-meta">{msg.role === "assistant" ? "ARES" : "You"}</div>
              <div className="chat-text">{msg.content}</div>
            </div>
          </div>
        ))}
        {loading && (
          <div className="chat-bubble assistant thinking">
            <div className="assistant-avatar thinking-ring">
              <img src={logo} alt="ARES" />
            </div>
            <div className="chat-content">
              <div className="chat-meta">ARES</div>
              <div className="chat-text">
                <span className="thinking-dots">
                  <span />
                  <span />
                  <span />
                </span>
                Generating SQL + analysis...
              </div>
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {notice && <div className="notice-banner">{notice}</div>}
      {disabledReason && <div className="error-banner">{disabledReason}</div>}
      {error && <div className="error-banner">{error}</div>}

      <div className="chat-input">
        <textarea
          value={input}
          placeholder="e.g. Show monthly revenue trends for the last 6 months"
          onChange={(event) => setInput(event.target.value)}
          rows={2}
          disabled={disabled}
        />
        <button
          className="send-button"
          onClick={() => {
            onSend(input);
            setInput("");
          }}
          disabled={loading || disabled}
        >
          Send
        </button>
      </div>
    </section>
  );
}
