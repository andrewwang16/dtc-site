"use client";

import { useState, useTransition } from "react";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signUpAction } from "@/app/sign-up/actions";

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

export default function SignUpForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [signingIn, setSigningIn] = useState(false);

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("Passwords don't match.");
      return;
    }

    startTransition(async () => {
      const result = await signUpAction({ email, password });

      if (!result.ok) {
        setError(result.error);
        return;
      }

      setSigningIn(true);
      await signIn("credentials", { email, password, redirect: false });
      router.push("/articles");
      router.refresh();
    });
  }

  const submitting = isPending || signingIn;

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
          minLength={8}
          autoComplete="new-password"
          style={inputStyle}
        />
        <p style={{ margin: "0.35rem 0 0", color: "var(--muted)", fontSize: "0.8rem" }}>
          At least 8 characters.
        </p>
      </div>

      <div>
        <p className="kicker" style={{ marginBottom: "0.4rem" }}>
          Confirm Password
        </p>
        <input
          type="password"
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          required
          minLength={8}
          autoComplete="new-password"
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
        {submitting ? "Creating account..." : "Create Account"}
      </button>

      <p style={{ margin: 0, color: "var(--muted)", fontSize: "0.9rem" }}>
        Already have an account?{" "}
        <Link href="/sign-in" style={{ color: "var(--accent-soft)", fontWeight: 700 }}>
          Sign in
        </Link>
      </p>
    </form>
  );
}
