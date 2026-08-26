import { auth } from "@/auth";
import { hasPremiumAccess } from "@/lib/access";
import { PremiumBadge, PremiumLockCard } from "@/components/shared/PremiumLock";
import { getFortyManSplit, getAllMlbPlayers, type RosterEntry } from "@/lib/mlb";
import { getCardinalsProspects } from "@/lib/prospects";
import PlayerComparison from "@/components/compare/PlayerComparison";

export default async function ComparePage() {
  const year = new Date().getFullYear();

  const [{ active, sixtyDayIL }, prospects, externalPlayers, session] = await Promise.all([
    getFortyManSplit(year),
    getCardinalsProspects(year),
    getAllMlbPlayers(year),
    auth(),
  ]);

  const hasAccess = hasPremiumAccess(session?.user);

  const seen = new Set<number>();
  const cardinalsPlayers: RosterEntry[] = [...active, ...sixtyDayIL, ...prospects].filter((player) => {
    if (seen.has(player.id)) {
      return false;
    }
    seen.add(player.id);
    return true;
  });

  return (
    <div style={{ display: "grid", gap: "1rem", paddingBottom: "4rem", paddingTop: "2.2rem" }}>
      <section className="container fade-up">
        <div style={{ display: "flex", alignItems: "baseline", gap: "0.75rem", flexWrap: "wrap" }}>
          <p className="kicker">Players</p>
          {!hasAccess && <PremiumBadge />}
        </div>
        <h1 className="section-title">Player Comparison</h1>
        <p style={{ marginTop: "0.9rem", color: "var(--muted)", maxWidth: "62ch" }}>
          Compare a player from the Cardinals&apos; system against anyone else in MLB, stat for
          stat.
        </p>
      </section>

      <section className="container fade-up" style={{ animationDelay: "0.06s" }}>
        {hasAccess ? (
          <PlayerComparison cardinalsPlayers={cardinalsPlayers} externalPlayers={externalPlayers} year={year} />
        ) : (
          <PremiumLockCard message="Subscribe to use the Player Comparison tool." />
        )}
      </section>
    </div>
  );
}
