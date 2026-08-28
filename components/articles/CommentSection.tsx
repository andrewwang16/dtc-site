"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { postCommentAction, deleteCommentAction } from "@/app/articles/[slug]/actions";
import type { Comment } from "@/lib/comments";

const cardStyle: React.CSSProperties = {
  border: "1px solid var(--line)",
  borderRadius: "18px",
  background: "var(--panel)",
  padding: "1.15rem",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "0.75rem 1rem",
  borderRadius: "12px",
  border: "1px solid var(--line)",
  background: "var(--bg-soft)",
  color: "var(--text)",
  fontSize: "1rem",
  fontFamily: "inherit",
};

function formatCommentDate(iso: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

export default function CommentSection({
  articleSlug,
  initialComments,
  isPremium,
  hasPremiumAccess,
}: {
  articleSlug: string;
  initialComments: Comment[];
  isPremium: boolean;
  hasPremiumAccess: boolean;
}) {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isDeletePending, startDeleteTransition] = useTransition();

  const isAdmin = Boolean(session?.user?.isAdmin);

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    startTransition(async () => {
      const result = await postCommentAction(articleSlug, draft, isPremium);

      if (!result.ok) {
        setError(result.error);
        return;
      }

      setDraft("");
      router.refresh();
    });
  }

  function handleDelete(commentId: number) {
    if (!window.confirm("Delete this comment? This can't be undone.")) {
      return;
    }

    setDeleteError(null);
    setDeletingId(commentId);

    startDeleteTransition(async () => {
      const result = await deleteCommentAction(articleSlug, commentId);

      if (!result.ok) {
        setDeleteError(result.error);
        setDeletingId(null);
        return;
      }

      router.refresh();
    });
  }

  return (
    <section style={{ marginTop: "2.5rem" }}>
      <p className="kicker" style={{ marginBottom: "0.9rem" }}>
        Comments ({initialComments.length})
      </p>

      <div style={{ display: "grid", gap: "0.9rem", marginBottom: "1.5rem" }}>
        {initialComments.length === 0 ? (
          <p style={{ margin: 0, color: "var(--muted)" }}>
            No comments yet — be the first to share your thoughts.
          </p>
        ) : (
          initialComments.map((comment) => {
            const canDelete = isAdmin || comment.authorEmail === session?.user?.email;

            return (
              <div key={comment.id} style={cardStyle}>
                <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: "1rem" }}>
                  <div>
                    <p style={{ margin: 0, fontWeight: 700 }}>{comment.authorName}</p>
                    <p style={{ margin: "0.2rem 0 0.6rem", color: "var(--muted)", fontSize: "0.8rem" }}>
                      {formatCommentDate(comment.createdAt)}
                    </p>
                  </div>

                  {canDelete && (
                    <button
                      type="button"
                      onClick={() => handleDelete(comment.id)}
                      disabled={isDeletePending && deletingId === comment.id}
                      style={{
                        background: "none",
                        border: "none",
                        color: "#b42318",
                        fontWeight: 700,
                        fontSize: "0.8rem",
                        cursor: "pointer",
                        padding: 0,
                        flexShrink: 0,
                      }}
                    >
                      {isDeletePending && deletingId === comment.id ? "Deleting..." : "Delete"}
                    </button>
                  )}
                </div>
                <p style={{ margin: 0, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{comment.body}</p>
              </div>
            );
          })
        )}
      </div>

      {deleteError && (
        <p style={{ margin: "0 0 1rem", color: "#b42318", fontWeight: 700 }}>{deleteError}</p>
      )}

      {status === "authenticated" && isPremium && !hasPremiumAccess ? (
        <p style={{ margin: 0, color: "var(--muted)" }}>
          <Link href="/subscribe" style={{ color: "var(--accent-soft)", fontWeight: 700 }}>
            Subscribe
          </Link>{" "}
          to comment on this article.
        </p>
      ) : status === "authenticated" ? (
        <form onSubmit={handleSubmit} style={{ display: "grid", gap: "0.6rem" }}>
          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Add a comment..."
            rows={3}
            style={{ ...inputStyle, resize: "vertical" }}
          />

          {error && <p style={{ margin: 0, color: "#b42318", fontWeight: 700 }}>{error}</p>}

          <button
            type="submit"
            disabled={isPending}
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "0.7rem 1.4rem",
              borderRadius: "999px",
              border: "1px solid #8a1024",
              background: isPending ? "rgba(196,30,58,0.4)" : "var(--accent)",
              color: "white",
              fontWeight: 800,
              cursor: isPending ? "not-allowed" : "pointer",
              fontSize: "0.95rem",
              justifySelf: "start",
            }}
          >
            {isPending ? "Posting..." : "Post Comment"}
          </button>
        </form>
      ) : status !== "loading" ? (
        <p style={{ margin: 0, color: "var(--muted)" }}>
          <Link href="/sign-in" style={{ color: "var(--accent-soft)", fontWeight: 700 }}>
            Sign in
          </Link>{" "}
          to leave a comment.
        </p>
      ) : null}
    </section>
  );
}
