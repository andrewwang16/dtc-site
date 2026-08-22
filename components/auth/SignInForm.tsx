"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";

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

export default function SignInForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    setSubmitting(false);

    if (!result || result.error) {
      setError("Incorrect email or password.");
      return;
    }

    router.push(searchParams.get("callbackUrl") ?? "/articles");
    router.refresh();
  }

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        border: "1px solid var(--line)",
        borderRadius: "18px",
        background: "var(--panel)",
        padding: "1.5rem",
        display: "grid",
        gap: "1rem",
        maxWidth: "380px",
      }}
    >
      <div>
        <p className="kicker" style={{ marginBottom: "0.4rem" }}>
          Email
        </p>
        <input
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
          autoComplete="username"
          style={inputStyle}
        />
      </div>

      <div>
        <p className="kicker" style={{ marginBottom: "0.4rem" }}>
          Password
        </p>
        <input
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
          autoComplete="current-password"
          style={inputStyle}
        />
      </div>

      {error && <p style={{ margin: 0, color: "#b42318", fontWeight: 700 }}>{error}</p>}

      <button
        type="submit"
        disabled={submitting}
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "0.75rem 1.5rem",
          borderRadius: "999px",
          border: "1px solid #8a1024",
          background: submitting ? "rgba(196,30,58,0.4)" : "var(--accent)",
          color: "white",
          fontWeight: 800,
          cursor: submitting ? "not-allowed" : "pointer",
          fontSize: "1rem",
        }}
      >
        {submitting ? "Signing in..." : "Sign in"}
      </button>
    </form>
  );
}
