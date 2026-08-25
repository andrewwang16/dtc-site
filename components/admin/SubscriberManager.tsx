"use client";

import { useState, useTransition } from "react";
import { setSubscriberStatusAction } from "@/app/admin/subscribers/actions";

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

const buttonStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "0.7rem 1.4rem",
  borderRadius: "999px",
  border: "1px solid #8a1024",
  fontWeight: 800,
  cursor: "pointer",
  fontSize: "0.95rem",
};

export default function SubscriberManager() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(isSubscriber: boolean) {
    setMessage(null);
    setError(null);

    startTransition(async () => {
      const result = await setSubscriberStatusAction(email, isSubscriber);

      if (!result.ok) {
        setError(result.error);
        return;
      }

      setMessage(result.message);
    });
  }

  return (
    <div
      style={{
        border: "1px solid var(--line)",
        borderRadius: "18px",
        background: "var(--panel)",
        padding: "1.5rem",
        display: "grid",
        gap: "1rem",
        maxWidth: "480px",
      }}
    >
      <div>
        <p className="kicker" style={{ marginBottom: "0.4rem" }}>
          User Email
        </p>
        <input
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="viewer@example.com"
          style={inputStyle}
        />
        <p style={{ margin: "0.4rem 0 0", color: "var(--muted)", fontSize: "0.82rem" }}>
          The account must already exist (they need to have signed up via /sign-up).
        </p>
      </div>

      <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap" }}>
        <button
          type="button"
          onClick={() => handleSubmit(true)}
          disabled={isPending}
          style={{ ...buttonStyle, background: "var(--accent)", color: "white" }}
        >
          {isPending ? "Working..." : "Grant Subscriber Access"}
        </button>
        <button
          type="button"
          onClick={() => handleSubmit(false)}
          disabled={isPending}
          style={{ ...buttonStyle, background: "var(--panel)", color: "var(--text)", borderColor: "var(--line)" }}
        >
          {isPending ? "Working..." : "Revoke Access"}
        </button>
      </div>

      {message && <p style={{ margin: 0, color: "#1a7a3c", fontWeight: 700 }}>{message}</p>}
      {error && <p style={{ margin: 0, color: "#b42318", fontWeight: 700 }}>{error}</p>}

      <p style={{ margin: 0, color: "var(--muted)", fontSize: "0.82rem" }}>
        The user needs to sign out and back in for a status change to take effect — their
        session snapshot doesn&apos;t update until then.
      </p>
    </div>
  );
}
