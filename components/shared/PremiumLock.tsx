export function LockIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="5" y="11" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

export function PremiumBadge() {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "0.3rem",
        padding: "0.2rem 0.55rem",
        borderRadius: "999px",
        background: "rgba(15,31,61,0.06)",
        color: "var(--accent-soft)",
        fontWeight: 700,
        fontSize: "0.72rem",
        textTransform: "uppercase",
        letterSpacing: "0.03em",
        whiteSpace: "nowrap",
      }}
    >
      <LockIcon size={11} />
      Subscriber Only
    </span>
  );
}

export function PremiumLockCard({ message }: { message?: string }) {
  return (
    <div
      style={{
        border: "1px solid var(--line)",
        borderRadius: "18px",
        background: "var(--panel)",
        padding: "2rem 1.5rem",
        display: "grid",
        justifyItems: "center",
        gap: "0.6rem",
        textAlign: "center",
      }}
    >
      <div
        style={{
          width: "44px",
          height: "44px",
          borderRadius: "50%",
          background: "rgba(15,31,61,0.06)",
          display: "grid",
          placeItems: "center",
          color: "var(--accent-soft)",
        }}
      >
        <LockIcon size={20} />
      </div>
      <p style={{ margin: 0, fontWeight: 800 }}>Subscriber Only</p>
      <p style={{ margin: 0, color: "var(--muted)", maxWidth: "36ch" }}>
        {message ?? "This content is available to subscribers only."}
      </p>
    </div>
  );
}
