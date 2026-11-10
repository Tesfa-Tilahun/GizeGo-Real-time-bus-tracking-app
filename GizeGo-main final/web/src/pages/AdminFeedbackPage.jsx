import { useCallback, useEffect, useState } from "react";
import { fetchAdminFeedback, reviewFeedback } from "../api";

const STATUSES = [
  { id: "all", label: "All" },
  { id: "pending", label: "Pending" },
  { id: "accepted", label: "Accepted" },
  { id: "rejected", label: "Rejected" },
];

const CATEGORIES = {
  service: "Service",
  delay: "Delay",
  safety: "Safety",
  driver: "Driver",
  other: "Other",
  general: "General",
};

function statusClass(status) {
  if (status === "accepted") return "bus-status-pill active";
  if (status === "rejected") return "bus-status-pill out_of_service";
  return "bus-status-pill maintenance";
}

function Stars({ rating }) {
  return (
    <span className="feedback-stars" aria-label={`${rating} out of 5 stars`}>
      {"★".repeat(rating)}
      {"☆".repeat(5 - rating)}
    </span>
  );
}

export default function AdminFeedbackPage() {
  const [items, setItems] = useState([]);
  const [statusFilter, setStatusFilter] = useState("pending");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [reviewNote, setReviewNote] = useState({});
  const [expandedId, setExpandedId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await fetchAdminFeedback({
        status: statusFilter === "all" ? undefined : statusFilter,
      });
      setItems(data.feedback ?? []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleReview(feedbackId, status) {
    setBusyId(feedbackId);
    setMessage("");
    setError("");
    try {
      await reviewFeedback(feedbackId, {
        status,
        reviewNote: reviewNote[feedbackId]?.trim() || undefined,
      });
      setMessage(status === "accepted" ? "Feedback accepted." : "Feedback rejected.");
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="admin-page">
      <div className="page-header">
        <div>
          <h1>Passenger feedback</h1>
          <p className="subtitle">
            Review feedback submitted from the mobile app. Accept valid reports or reject spam.
          </p>
        </div>
        <button type="button" className="btn-secondary" onClick={() => void load()} disabled={loading}>
          {loading ? "Loading…" : "Refresh"}
        </button>
      </div>

      {message && <p className="status success">{message}</p>}
      {error && <p className="status error">{error}</p>}

      <section className="admin-section filter-bar">
        <label>
          Status
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            {STATUSES.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
      </section>

      <section className="admin-section">
        <h2>
          Feedback ({items.length})
        </h2>
        {loading ? (
          <p className="status">Loading feedback…</p>
        ) : items.length === 0 ? (
          <p className="status">No feedback for this filter.</p>
        ) : (
          <div className="feedback-list">
            {items.map((item) => (
              <article key={item.id} className="feedback-card">
                <div className="feedback-card-head">
                  <div>
                    <strong>{item.userName}</strong>
                    {item.userEmail && <span className="feedback-meta"> · {item.userEmail}</span>}
                  </div>
                  <span className={statusClass(item.status)}>{item.status}</span>
                </div>
                <div className="feedback-card-meta">
                  <Stars rating={item.rating} />
                  <span>{CATEGORIES[item.category] ?? item.category}</span>
                  <span>{new Date(item.createdAt).toLocaleString()}</span>
                  {item.routeName && <span>Route: {item.routeName}</span>}
                </div>
                <p className="feedback-comment">
                  {expandedId === item.id || item.comment.length <= 200
                    ? item.comment
                    : `${item.comment.slice(0, 200)}…`}
                </p>
                {item.comment.length > 200 && (
                  <button
                    type="button"
                    className="btn-text"
                    onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}
                  >
                    {expandedId === item.id ? "Show less" : "Show more"}
                  </button>
                )}
                {item.reviewNote && (
                  <p className="feedback-review-note">
                    <strong>Admin note:</strong> {item.reviewNote}
                  </p>
                )}
                {item.status === "pending" && (
                  <div className="feedback-actions">
                    <input
                      type="text"
                      placeholder="Optional note for internal use…"
                      value={reviewNote[item.id] ?? ""}
                      onChange={(e) =>
                        setReviewNote({ ...reviewNote, [item.id]: e.target.value })
                      }
                      maxLength={500}
                    />
                    <button
                      type="button"
                      className="btn-primary small"
                      disabled={busyId === item.id}
                      onClick={() => void handleReview(item.id, "accepted")}
                    >
                      Accept
                    </button>
                    <button
                      type="button"
                      className="btn-danger solid small"
                      disabled={busyId === item.id}
                      onClick={() => void handleReview(item.id, "rejected")}
                    >
                      Reject
                    </button>
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
