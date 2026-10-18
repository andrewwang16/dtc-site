import Hero from "../components/home/Hero";
import CardinalsLiveScore from "../components/home/CardinalsLiveScore";
import DivisionStandings from "../components/home/DivisionStandings";
import WelcomeBanner from "../components/home/WelcomeBanner";
import OffseasonBanner from "../components/home/OffseasonBanner";
import { CARDINALS_TEAM_ID } from "@/lib/mlb";

// The Cardinals are in their offseason when they have no game (spring
// training, regular season or postseason) within a week of today — a
// window wider than any in-season break, like the All-Star break.
async function isOffseason() {
  const day = 24 * 60 * 60 * 1000;
  const iso = (date: Date) => date.toISOString().slice(0, 10);
  const now = Date.now();
  try {
    const response = await fetch(
      `https://statsapi.mlb.com/api/v1/schedule?sportId=1&teamId=${CARDINALS_TEAM_ID}` +
        `&startDate=${iso(new Date(now - 7 * day))}&endDate=${iso(new Date(now + 7 * day))}&gameType=S,R,F,D,L,W`,
      { next: { revalidate: 3600 } }
    );
    if (!response.ok) {
      return false;
    }
    const data: { totalGames?: number } = await response.json();
    return (data.totalGames ?? 0) === 0;
  } catch {
    // If the schedule can't be checked, fall back to the scoreboard.
    return false;
  }
}

export default async function Home() {
  const offseason = await isOffseason();

  return (
    <div style={{ display: "grid", gap: "2.75rem", paddingBottom: "4rem" }}>

      <div style={{ paddingTop: "2.2rem" }}>
        <WelcomeBanner />
      </div>

      {offseason ? (
        // Offseason: a compact GM Simulator invite, then the two latest
        // episodes side by side.
        <section className="container fade-up" style={{ display: "grid", gap: "1.25rem" }}>
          <OffseasonBanner />
          <div className="home-podcasts-row">
            <Hero />
          </div>
        </section>
      ) : (
        <section className="container fade-up">
          <div className="home-top-grid">
            <div className="home-podcasts">
              <Hero />
            </div>
            <div className="home-scoreboard">
              <CardinalsLiveScore />
            </div>
          </div>
        </section>
      )}

      <DivisionStandings />

    </div>
  );
}
