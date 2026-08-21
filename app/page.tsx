import Hero from "../components/home/Hero";
import CardinalsLiveScore from "../components/home/CardinalsLiveScore";
import DivisionStandings from "../components/home/DivisionStandings";

export default function Home() {
  return (
    <div style={{ display: "grid", gap: "5.5rem", paddingBottom: "4rem" }}>

      <section className="container fade-up" style={{ paddingTop: "3.7rem" }}>
        <div className="home-top-grid">
          <div className="home-podcasts">
            <Hero />
          </div>
          <div className="home-scoreboard">
            <CardinalsLiveScore />
          </div>
        </div>
      </section>

      <DivisionStandings />

    </div>
  );
}
