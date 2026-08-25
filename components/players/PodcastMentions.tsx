"use client";

import { useState } from "react";
import type { PodcastMention } from "@/lib/podcast-mentions";

// Keep in sync with the 3-column .podcast-mentions-grid rule in globals.css.
const PAGE_SIZE = 3;

const pillButtonStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "0.6rem 1rem",
  borderRadius: "999px",
  border: "1px solid var(--line)",
  background: "var(--panel)",
  color: "var(--text)",
  fontWeight: 700,
  cursor: "pointer",
  fontSize: "0.9rem",
};

function formatMentionDate(iso: string) {
  if (!iso) {
    return "";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(iso));
}

export default function PodcastMentions({ mentions }: { mentions: PodcastMention[] }) {
  const [page, setPage] = useState(0);

  if (mentions.length === 0) {
    return null;
  }

  const totalPages = Math.ceil(mentions.length / PAGE_SIZE);
  const start = page * PAGE_SIZE;
  const visible = mentions.slice(start, start + PAGE_SIZE);
  const hasNewer = page > 0;
  const hasOlder = page < totalPages - 1;

  return (
    <div style={{ display: "grid", gap: "1rem" }}>
      <div className="podcast-mentions-grid" style={{ gap: "1rem" }}>
        {visible.map((mention) => (
          <a
            key={mention.videoId}
            href={`https://www.youtube.com/watch?v=${mention.videoId}`}
            target="_blank"
            rel="noreferrer"
            style={{
              display: "grid",
              border: "1px solid var(--line)",
              borderRadius: "18px",
              background: "var(--panel)",
              overflow: "hidden",
              color: "inherit",
              textDecoration: "none",
            }}
          >
            <div style={{ aspectRatio: "16 / 9", overflow: "hidden", background: "rgba(15,31,61,.08)" }}>
              {mention.thumbnailUrl && (
                <img
                  src={mention.thumbnailUrl}
                  alt={mention.title}
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              )}
            </div>

            <div style={{ padding: "1rem", display: "grid", gap: "0.4rem" }}>
              <p className="kicker" style={{ margin: 0 }}>
                {mention.showLabel}
                {mention.publishedAt ? ` · ${formatMentionDate(mention.publishedAt)}` : ""}
              </p>
              <p style={{ margin: 0, fontWeight: 700, fontSize: "0.95rem", lineHeight: 1.35 }}>
                {mention.title}
              </p>
            </div>
          </a>
        ))}
      </div>

      {totalPages > 1 && (
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={() => setPage((current) => Math.max(0, current - 1))}
            disabled={!hasNewer}
            style={{ ...pillButtonStyle, opacity: hasNewer ? 1 : 0.4 }}
          >
            ← Newer
          </button>

          <span style={{ color: "var(--muted)", fontWeight: 600, fontSize: "0.9rem" }}>
            Page {page + 1} of {totalPages}
          </span>

          <button
            type="button"
            onClick={() => setPage((current) => Math.min(totalPages - 1, current + 1))}
            disabled={!hasOlder}
            style={{ ...pillButtonStyle, opacity: hasOlder ? 1 : 0.4 }}
          >
            Older →
          </button>
        </div>
      )}
    </div>
  );
}
