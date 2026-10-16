"use client";

import { useState, type ReactNode } from "react";

export type SplitOption = { key: string; label: string; content: ReactNode };

// One card for every split table (month, handedness, home/away), switched
// with a dropdown. The tables are all rendered on the server, so switching
// is instant.
export default function SplitsPanel({ options }: { options: SplitOption[] }) {
  const [selected, setSelected] = useState(options[0]?.key);
  const current = options.find((option) => option.key === selected) ?? options[0];

  return (
    <>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "0.75rem",
          flexWrap: "wrap",
          margin: "0 0 1rem",
        }}
      >
        <h2 className="player-section-title" style={{ margin: 0 }}>
          Splits
        </h2>
        <div className="player-header-controls">
          <select
            value={current?.key}
            onChange={(event) => setSelected(event.target.value)}
            aria-label="Split type"
            style={{
              padding: "0.6rem 1rem",
              borderRadius: "999px",
              border: "1px solid var(--line)",
              background: "var(--panel)",
              color: "var(--text)",
              fontWeight: 700,
              fontSize: "0.95rem",
            }}
          >
            {options.map((option) => (
              <option key={option.key} value={option.key}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <article
        className="split-table-card"
        style={{
          border: "1px solid var(--line)",
          borderRadius: "18px",
          background: "var(--panel)",
          padding: "1.15rem",
        }}
      >
        {current?.content}
      </article>
    </>
  );
}
