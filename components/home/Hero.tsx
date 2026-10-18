import { getPlaylistVideos } from "@/lib/youtube";

const mainPlaylistId = "PLzLr3_w2micHl1PeuYZYfjYQdZfT9LO0a";

const EMBED_ALLOW = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share";

// The two most recent Dealin' the Cards episodes. If the playlist can't be
// read, the first card falls back to YouTube's playlist embed (which opens
// on the latest video) and the second is left out.
export default async function Hero() {
  const [latest, previous] = await getPlaylistVideos(mainPlaylistId);

  const cards = [
    {
      label: "Latest Dealin' the Cards Episode",
      title: latest?.title ?? "Latest Dealin' the Cards episode",
      src: latest
        ? `https://www.youtube.com/embed/${latest.videoId}`
        : `https://www.youtube.com/embed/videoseries?list=${mainPlaylistId}`,
    },
    ...(previous
      ? [
          {
            label: "Previous Episode",
            title: previous.title,
            src: `https://www.youtube.com/embed/${previous.videoId}`,
          },
        ]
      : []),
  ];

  return (
    <>
      {cards.map((card) => (
        <article key={card.src} className="podcast-card">
          <p className="kicker" style={{ marginBottom: "0.45rem" }}>
            {card.label}
          </p>
          <div className="podcast-video">
            <iframe title={card.title} src={card.src} style={{ width: "100%", height: "100%", border: 0 }} allow={EMBED_ALLOW} allowFullScreen />
          </div>
        </article>
      ))}
    </>
  );
}
