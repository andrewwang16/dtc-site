"use client";

import { useRouter } from "next/navigation";

const COMBINED_VALUE = "combined";

export default function TeamSplitSelect({
  playerId,
  year,
  view,
  teams,
  selectedTeamId,
}: {
  playerId: number;
  year: number;
  view?: string;
  teams: Array<{ id: number; label: string }>;
  selectedTeamId: number | null;
}) {
  const router = useRouter();

  return (
    <select
      value={selectedTeamId ?? COMBINED_VALUE}
      onChange={(event) => {
        const value = event.target.value;
        const viewQuery = view ? `&view=${view}` : "";
        const teamQuery = value === COMBINED_VALUE ? "" : `&team=${value}`;

        router.push(`/players/${playerId}?year=${year}${viewQuery}${teamQuery}`);
      }}
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
      <option value={COMBINED_VALUE}>{teams.length}TM (Combined)</option>
      {teams.map((team) => (
        <option key={team.id} value={team.id}>
          {team.label}
        </option>
      ))}
    </select>
  );
}
