"use client";

import { useState } from "react";
import GameDetailModal from "@/components/schedule/GameDetailModal";
import type { MlbGame } from "@/components/schedule/scheduleUtils";

export default function BoxScoreButton({ game }: { game: MlbGame }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "0.4rem",
          padding: "0.5rem 0.9rem",
          borderRadius: "999px",
          border: "1px solid rgba(253,250,243,.45)",
          background: "rgba(253,250,243,.16)",
          color: "inherit",
          fontWeight: 700,
          fontSize: "0.85rem",
          cursor: "pointer",
        }}
      >
        Box Score
      </button>

      {isOpen && <GameDetailModal game={game} onClose={() => setIsOpen(false)} />}
    </>
  );
}
