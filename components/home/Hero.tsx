const hosts = ["Josh Jacobs", "Sandy McMillan", "Andrew Wang"];
const mainPlaylistId = "PLzLr3_w2micHl1PeuYZYfjYQdZfT9LO0a";
const farmPlaylistId = "PLzLr3_w2micHiyyourtPl_GYVgsnQGfcx";

export default function Hero() {
  return (
    <>
        <article className="podcast-card">
          <p className="kicker" style={{ marginBottom: "0.45rem" }}>
            Latest Dealin&apos; the Cards Episode
          </p>
          <div className="podcast-video">
            <iframe
              title="Latest Dealin' the Cards episode"
              src={`https://www.youtube.com/embed/videoseries?list=${mainPlaylistId}`}
              style={{ width: "100%", height: "100%", border: 0 }}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
            />
          </div>
        </article>

        <article className="podcast-card">
          <p className="kicker" style={{ marginBottom: "0.45rem" }}>
            Latest Birds on the Farm Episode
          </p>
          <div className="podcast-video">
            <iframe
              title="Latest Birds on the Farm episode"
              src={`https://www.youtube.com/embed/videoseries?list=${farmPlaylistId}`}
              style={{ width: "100%", height: "100%", border: 0 }}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
            />
          </div>
        </article>
    </>
  );
}
