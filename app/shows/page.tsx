import LatestArticles from "../../components/home/LatestArticles";
import LatestVideos from "../../components/home/LatestVideos";
import PlayerSpotlight from "../../components/home/PlayerSpotlight";
import ProspectSection from "../../components/home/ProspectSection";

export default function ShowsPage() {
  return (
    <div style={{ display: "grid", gap: "5.5rem", paddingBottom: "4rem", paddingTop: "2.2rem" }}>
      <section className="container fade-up">
        <p className="kicker">Shows</p>
        <h1 className="section-title">Network Series and Talent</h1>
        <p style={{ marginTop: "0.9rem", color: "var(--muted)", maxWidth: "64ch" }}>
          Main show episodes, prospect-focused programming, guest interviews, and expanded long-form baseball media.
        </p>
      </section>

      <PlayerSpotlight />

      <ProspectSection />

      <LatestArticles />

      <LatestVideos />
    </div>
  );
}
