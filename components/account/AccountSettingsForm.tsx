"use client";

import { useState, useTransition } from "react";
import { useSession } from "next-auth/react";
import { updateDisplayNameAction, changePasswordAction } from "@/app/account/actions";

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

const cardStyle: React.CSSProperties = {
  border: "1px solid var(--line)",
  borderRadius: "18px",
  background: "var(--panel)",
  padding: "1.5rem",
  display: "grid",
  gap: "1rem",
  maxWidth: "420px",
};

const buttonStyle = (disabled: boolean): React.CSSProperties => ({
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "0.75rem 1.5rem",
  borderRadius: "999px",
  border: "1px solid #8a1024",
  background: disabled ? "rgba(196,30,58,0.4)" : "var(--accent)",
  color: "white",
  fontWeight: 800,
  cursor: disabled ? "not-allowed" : "pointer",
  fontSize: "1rem",
});

function MembershipBadge({ isAdmin, isSubscriber }: { isAdmin: boolean; isSubscriber: boolean }) {
  const label = isAdmin ? "Admin" : isSubscriber ? "Subscriber" : "Free";

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "0.25rem 0.7rem",
        borderRadius: "999px",
        background: "rgba(15,31,61,0.06)",
        color: "var(--accent-soft)",
        fontWeight: 700,
        fontSize: "0.78rem",
      }}
    >
      {label}
    </span>
  );
}

export default function AccountSettingsForm({
  email,
  displayName,
  isAdmin,
  isSubscriber,
}: {
  email: string;
  displayName: string;
  isAdmin: boolean;
  isSubscriber: boolean;
}) {
  const { update } = useSession();
  const [isNamePending, startNameTransition] = useTransition();
  const [name, setName] = useState(displayName);
  const [nameMessage, setNameMessage] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);

  const [isPasswordPending, startPasswordTransition] = useTransition();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  function handleNameSubmit(event: React.FormEvent) {
    event.preventDefault();
    setNameMessage(null);
    setNameError(null);

    startNameTransition(async () => {
      const result = await updateDisplayNameAction(name);

      if (!result.ok) {
        setNameError(result.error);
        return;
      }

      await update({ name: name.trim() });
      setNameMessage("Display name updated.");
    });
  }

  function handlePasswordSubmit(event: React.FormEvent) {
    event.preventDefault();
    setPasswordMessage(null);
    setPasswordError(null);

    if (newPassword !== confirmPassword) {
      setPasswordError("New passwords don't match.");
      return;
    }

    startPasswordTransition(async () => {
      const result = await changePasswordAction({ currentPassword, newPassword });

      if (!result.ok) {
        setPasswordError(result.error);
        return;
      }

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPasswordMessage("Password changed.");
    });
  }

  return (
    <div style={{ display: "grid", gap: "1.5rem" }}>
      <div style={cardStyle}>
        <div>
          <p className="kicker" style={{ marginBottom: "0.4rem" }}>
            Email
          </p>
          <p style={{ margin: 0, fontWeight: 700 }}>{email}</p>
        </div>

        <div>
          <p className="kicker" style={{ marginBottom: "0.4rem" }}>
            Membership
          </p>
          <MembershipBadge isAdmin={isAdmin} isSubscriber={isSubscriber} />
        </div>
      </div>

      <form onSubmit={handleNameSubmit} style={cardStyle}>
        <h2 style={{ margin: 0 }}>Display Name</h2>
        <p style={{ margin: 0, color: "var(--muted)" }}>
          Shown on comments and any articles you write.
        </p>

        <input
          type="text"
          value={name}
          onChange={(event) => setName(event.target.value)}
          required
          maxLength={60}
          style={inputStyle}
        />

        {nameMessage && <p style={{ margin: 0, color: "#1a7a3c", fontWeight: 700 }}>{nameMessage}</p>}
        {nameError && <p style={{ margin: 0, color: "#b42318", fontWeight: 700 }}>{nameError}</p>}

        <button type="submit" disabled={isNamePending} style={buttonStyle(isNamePending)}>
          {isNamePending ? "Saving..." : "Save Name"}
        </button>
      </form>

      <form onSubmit={handlePasswordSubmit} style={cardStyle}>
        <h2 style={{ margin: 0 }}>Change Password</h2>

        <div>
          <p className="kicker" style={{ marginBottom: "0.4rem" }}>
            Current Password
          </p>
          <input
            type="password"
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
            required
            autoComplete="current-password"
            style={inputStyle}
          />
        </div>

        <div>
          <p className="kicker" style={{ marginBottom: "0.4rem" }}>
            New Password
          </p>
          <input
            type="password"
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
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
            Confirm New Password
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

        {passwordMessage && (
          <p style={{ margin: 0, color: "#1a7a3c", fontWeight: 700 }}>{passwordMessage}</p>
        )}
        {passwordError && <p style={{ margin: 0, color: "#b42318", fontWeight: 700 }}>{passwordError}</p>}

        <button type="submit" disabled={isPasswordPending} style={buttonStyle(isPasswordPending)}>
          {isPasswordPending ? "Saving..." : "Change Password"}
        </button>
      </form>
    </div>
  );
}
