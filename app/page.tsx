import Hero from "../components/home/Hero";
import CardinalsLiveScore from "../components/home/CardinalsLiveScore";
import DivisionStandings from "../components/home/DivisionStandings";
import LatestArticles from "../components/home/LatestArticles";
import WelcomeBanner from "../components/home/WelcomeBanner";

export default function Home() {
  return (
    <div style={{ display: "grid", gap: "2.75rem", paddingBottom: "4rem" }}>

      <div style={{ paddingTop: "2.2rem" }}>
        <WelcomeBanner />
      </div>

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

      <LatestArticles />

      <DivisionStandings />

    </div>
  );
}
