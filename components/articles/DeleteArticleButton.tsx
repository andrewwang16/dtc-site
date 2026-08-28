"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteArticleAction } from "@/app/articles/[slug]/actions";

export default function DeleteArticleButton({ articleSlug }: { articleSlug: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    if (!window.confirm("Delete this article? This can't be undone.")) {
      return;
    }

    setError(null);

    startTransition(async () => {
      const result = await deleteArticleAction(articleSlug);

      if (!result.ok) {
        setError(result.error);
        return;
      }

      router.push("/articles");
    });
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleDelete}
        disabled={isPending}
        style={{
          display: "inline-flex",
          alignItems: "center",
          padding: "0.4rem 0.9rem",
          borderRadius: "999px",
          border: "1px solid rgba(180,35,24,0.4)",
          background: "rgba(180,35,24,0.08)",
          color: "#b42318",
          fontWeight: 700,
          cursor: isPending ? "not-allowed" : "pointer",
          fontSize: "0.8rem",
        }}
      >
        {isPending ? "Deleting..." : "Delete Article"}
      </button>

      {error && <p style={{ margin: "0.5rem 0 0", color: "#b42318", fontWeight: 700 }}>{error}</p>}
    </div>
  );
}
