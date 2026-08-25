import { auth } from "@/auth";
import { hasPremiumAccess } from "@/lib/access";
import { PremiumBadge, PremiumLockCard } from "@/components/shared/PremiumLock";
import { getFortyManSplit, getAllMlbPlayers } from "@/lib/mlb";
import { getCardinalsProspects } from "@/lib/prospects";
import RosterBuilder from "@/components/roster-builder/RosterBuilder";

export default async function RosterBuilderPage() {
  const year = new Date().getFullYear();

  const [{ active: roster, sixtyDayIL }, prospects, externalPlayers, session] = await Promise.all([
    getFortyManSplit(year),
    getCardinalsProspects(year),
    getAllMlbPlayers(year),
    auth(),
  ]);

  const hasAccess = hasPremiumAccess(session?.user);

  return (
    <div style={{ display: "grid", gap: "2rem", paddingBottom: "4rem", paddingTop: "2.2rem" }}>
      <section className="container fade-up">
        <div style={{ display: "flex", alignItems: "baseline", gap: "0.75rem", flexWrap: "wrap" }}>
          <p className="kicker">Players</p>
          {!hasAccess && <PremiumBadge />}
        </div>
        <h1 className="section-title">Roster Builder</h1>
        <p style={{ marginTop: "0.9rem", color: "var(--muted)", maxWidth: "62ch" }}>
          Build out a 26-man active roster from the Cardinals&apos; 40-man players, minor league
          system, or anyone else in MLB — drag a player onto a spot, or click a spot to search.
        </p>
      </section>

      <section className="container fade-up" style={{ animationDelay: "0.06s" }}>
        {hasAccess ? (
          <RosterBuilder
            roster={roster}
            prospects={prospects}
            externalPlayers={externalPlayers}
            sixtyDayIL={sixtyDayIL}
          />
        ) : (
          <PremiumLockCard message="Subscribe to use the Roster Builder." />
        )}
      </section>
    </div>
  );
}
