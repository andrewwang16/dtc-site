"use client";

import { useState, useTransition } from "react";
import {
  runSeedAction,
  createAdminSetupAction,
  dropImageColumnAction,
  createCommentsTableAction,
  addPaywallColumnsAction,
  addDisplayNameColumnAction,
} from "@/app/setup/actions";

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

const buttonStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "0.75rem 1.5rem",
  borderRadius: "999px",
  border: "1px solid #8a1024",
  background: "var(--accent)",
  color: "white",
  fontWeight: 800,
  cursor: "pointer",
  fontSize: "1rem",
};

export default function SetupPanel({ setupKey }: { setupKey: string }) {
  const [isPending, startTransition] = useTransition();
  const [seedMessage, setSeedMessage] = useState<string | null>(null);
  const [seedError, setSeedError] = useState<string | null>(null);

  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [adminMessage, setAdminMessage] = useState<string | null>(null);
  const [adminError, setAdminError] = useState<string | null>(null);

  const [migrateMessage, setMigrateMessage] = useState<string | null>(null);
  const [migrateError, setMigrateError] = useState<string | null>(null);

  const [commentsMessage, setCommentsMessage] = useState<string | null>(null);
  const [commentsError, setCommentsError] = useState<string | null>(null);

  const [paywallMessage, setPaywallMessage] = useState<string | null>(null);
  const [paywallError, setPaywallError] = useState<string | null>(null);

  const [displayNameMessage, setDisplayNameMessage] = useState<string | null>(null);
  const [displayNameError, setDisplayNameError] = useState<string | null>(null);

  function handleSeed() {
    setSeedMessage(null);
    setSeedError(null);

    startTransition(async () => {
      const result = await runSeedAction(setupKey);

      if (result.ok) {
        setSeedMessage(result.message);
      } else {
        setSeedError(result.error);
      }
    });
  }

  function handleCreateAdmin(event: React.FormEvent) {
    event.preventDefault();
    setAdminMessage(null);
    setAdminError(null);

    startTransition(async () => {
      const result = await createAdminSetupAction(setupKey, adminEmail, adminPassword);

      if (result.ok) {
        setAdminMessage(result.message);
        setAdminPassword("");
      } else {
        setAdminError(result.error);
      }
    });
  }

  function handleDropImageColumn() {
    setMigrateMessage(null);
    setMigrateError(null);

    startTransition(async () => {
      const result = await dropImageColumnAction(setupKey);

      if (result.ok) {
        setMigrateMessage(result.message);
      } else {
        setMigrateError(result.error);
      }
    });
  }

  function handleCreateCommentsTable() {
    setCommentsMessage(null);
    setCommentsError(null);

    startTransition(async () => {
      const result = await createCommentsTableAction(setupKey);

      if (result.ok) {
        setCommentsMessage(result.message);
      } else {
        setCommentsError(result.error);
      }
    });
  }

  function handleAddPaywallColumns() {
    setPaywallMessage(null);
    setPaywallError(null);

    startTransition(async () => {
      const result = await addPaywallColumnsAction(setupKey);

      if (result.ok) {
        setPaywallMessage(result.message);
      } else {
        setPaywallError(result.error);
      }
    });
  }

  function handleAddDisplayNameColumn() {
    setDisplayNameMessage(null);
    setDisplayNameError(null);

    startTransition(async () => {
      const result = await addDisplayNameColumnAction(setupKey);

      if (result.ok) {
        setDisplayNameMessage(result.message);
      } else {
        setDisplayNameError(result.error);
      }
    });
  }

  return (
    <div style={{ display: "grid", gap: "1.5rem" }}>
      <div style={cardStyle}>
        <p className="kicker" style={{ margin: 0 }}>
          One-time migration
        </p>
        <h2 style={{ margin: 0 }}>Add Display Name Column</h2>
        <p style={{ margin: 0, color: "var(--muted)" }}>
          Adds users.display_name for the account settings page. Safe to run more than once.
        </p>

        <button type="button" onClick={handleAddDisplayNameColumn} disabled={isPending} style={buttonStyle}>
          {isPending ? "Working..." : "Add Column"}
        </button>

        {displayNameMessage && (
          <p style={{ margin: 0, color: "#1a7a3c", fontWeight: 700 }}>{displayNameMessage}</p>
        )}
        {displayNameError && <p style={{ margin: 0, color: "#b42318", fontWeight: 700 }}>{displayNameError}</p>}
      </div>

      <div style={cardStyle}>
        <p className="kicker" style={{ margin: 0 }}>
          One-time migration
        </p>
        <h2 style={{ margin: 0 }}>Add Paywall Columns</h2>
        <p style={{ margin: 0, color: "var(--muted)" }}>
          Adds users.is_subscriber and articles.is_premium. Safe to run more than once.
        </p>

        <button type="button" onClick={handleAddPaywallColumns} disabled={isPending} style={buttonStyle}>
          {isPending ? "Working..." : "Add Columns"}
        </button>

        {paywallMessage && (
          <p style={{ margin: 0, color: "#1a7a3c", fontWeight: 700 }}>{paywallMessage}</p>
        )}
        {paywallError && <p style={{ margin: 0, color: "#b42318", fontWeight: 700 }}>{paywallError}</p>}
      </div>

      <div style={cardStyle}>
        <p className="kicker" style={{ margin: 0 }}>
          One-time migration
        </p>
        <h2 style={{ margin: 0 }}>Create Comments Table</h2>
        <p style={{ margin: 0, color: "var(--muted)" }}>
          Creates the comments table used by article comments. Safe to run more than once.
        </p>

        <button type="button" onClick={handleCreateCommentsTable} disabled={isPending} style={buttonStyle}>
          {isPending ? "Working..." : "Create Table"}
        </button>

        {commentsMessage && (
          <p style={{ margin: 0, color: "#1a7a3c", fontWeight: 700 }}>{commentsMessage}</p>
        )}
        {commentsError && <p style={{ margin: 0, color: "#b42318", fontWeight: 700 }}>{commentsError}</p>}
      </div>

      <div style={cardStyle}>
        <p className="kicker" style={{ margin: 0 }}>
          One-time migration
        </p>
        <h2 style={{ margin: 0 }}>Drop Cover Image Column</h2>
        <p style={{ margin: 0, color: "var(--muted)" }}>
          Removes the now-unused image column from the articles table. Safe to run more than
          once.
        </p>

        <button type="button" onClick={handleDropImageColumn} disabled={isPending} style={buttonStyle}>
          {isPending ? "Working..." : "Drop Column"}
        </button>

        {migrateMessage && (
          <p style={{ margin: 0, color: "#1a7a3c", fontWeight: 700 }}>{migrateMessage}</p>
        )}
        {migrateError && <p style={{ margin: 0, color: "#b42318", fontWeight: 700 }}>{migrateError}</p>}
      </div>

      <div style={cardStyle}>
        <p className="kicker" style={{ margin: 0 }}>
          Step 1
        </p>
        <h2 style={{ margin: 0 }}>Seed Database</h2>
        <p style={{ margin: 0, color: "var(--muted)" }}>
          Creates the articles/users tables and restores the Kyle Leahy article. Safe to run more
          than once.
        </p>

        <button type="button" onClick={handleSeed} disabled={isPending} style={buttonStyle}>
          {isPending ? "Working..." : "Run Seed"}
        </button>

        {seedMessage && <p style={{ margin: 0, color: "#1a7a3c", fontWeight: 700 }}>{seedMessage}</p>}
        {seedError && <p style={{ margin: 0, color: "#b42318", fontWeight: 700 }}>{seedError}</p>}
      </div>

      <form onSubmit={handleCreateAdmin} style={cardStyle}>
        <p className="kicker" style={{ margin: 0 }}>
          Step 2
        </p>
        <h2 style={{ margin: 0 }}>Create Admin Account</h2>
        <p style={{ margin: 0, color: "var(--muted)" }}>
          Type the password here yourself — it's sent straight to the server and never shown to
          anyone else.
        </p>

        <div>
          <p className="kicker" style={{ marginBottom: "0.4rem" }}>
            Admin Email
          </p>
          <input
            type="email"
            value={adminEmail}
            onChange={(event) => setAdminEmail(event.target.value)}
            placeholder="aw.andrewwang16@gmail.com"
            required
            style={inputStyle}
          />
        </div>

        <div>
          <p className="kicker" style={{ marginBottom: "0.4rem" }}>
            Password
          </p>
          <input
            type="password"
            value={adminPassword}
            onChange={(event) => setAdminPassword(event.target.value)}
            required
            minLength={8}
            autoComplete="new-password"
            style={inputStyle}
          />
        </div>

        <button type="submit" disabled={isPending} style={buttonStyle}>
          {isPending ? "Working..." : "Create / Update Admin"}
        </button>

        {adminMessage && (
          <p style={{ margin: 0, color: "#1a7a3c", fontWeight: 700 }}>{adminMessage}</p>
        )}
        {adminError && <p style={{ margin: 0, color: "#b42318", fontWeight: 700 }}>{adminError}</p>}
      </form>

      <p style={{ margin: 0, color: "var(--muted)", fontSize: "0.85rem" }}>
        When you're done setting up both admins, tell Claude to remove this /setup page and the
        SETUP_SECRET env var — it shouldn't stay live once it's served its purpose.
      </p>
    </div>
  );
}
