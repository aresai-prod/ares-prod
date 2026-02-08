import { useEffect, useState } from "react";
import type { InsightPost, User } from "../lib/types";
import { commentInsight, createInsight, fetchInsights, likeInsight } from "../lib/api";

type InsightsPanelProps = {
  podId?: string;
  user: User;
};

export default function InsightsPanel({ podId, user }: InsightsPanelProps) {
  const [insights, setInsights] = useState<InsightPost[]>([]);
  const [draft, setDraft] = useState("");
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    if (!podId) return;
    fetchInsights(podId)
      .then(setInsights)
      .catch((err) => setStatus(err instanceof Error ? err.message : "Failed to load insights"));
  }, [podId]);

  async function handlePost() {
    if (!podId || !draft.trim()) return;
    const next = await createInsight(podId, draft.trim());
    setInsights(next);
    setDraft("");
  }

  async function handleLike(insightId: string) {
    if (!podId) return;
    const next = await likeInsight(podId, insightId);
    setInsights(next);
  }

  async function handleComment(insightId: string) {
    if (!podId) return;
    const comment = window.prompt("Add a comment:");
    if (!comment) return;
    const next = await commentInsight(podId, insightId, comment);
    setInsights(next);
  }

  return (
    <div className="drawer-panel">
      <div className="panel-header">
        <h2>Insights</h2>
        <span className="panel-subtitle">Enterprise-only shared insights</span>
      </div>

      {status && <div className="error-banner">{status}</div>}

      <div className="insight-editor">
        <textarea
          value={draft}
          placeholder="Share a key insight from your analysis..."
          onChange={(event) => setDraft(event.target.value)}
        />
        <button className="primary-button" onClick={handlePost}>Share Insight</button>
      </div>

      <div className="insight-list">
        {insights.map((post) => (
          <div key={post.id} className="insight-card">
            <div className="insight-meta">Shared by {post.userId === user.id ? "You" : post.userId}</div>
            <div className="insight-content">{post.content}</div>
            <div className="insight-actions">
              <button className="ghost-button" onClick={() => handleLike(post.id)}>
                Like ({post.likes.length})
              </button>
              <button className="ghost-button" onClick={() => handleComment(post.id)}>
                Comment ({post.comments.length})
              </button>
            </div>
            <div className="insight-comments">
              {post.comments.map((comment) => (
                <div key={comment.id} className="insight-comment">
                  <strong>{comment.userId === user.id ? "You" : comment.userId}</strong>: {comment.content}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
