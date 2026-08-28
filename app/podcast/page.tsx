import { getPlaylistVideos } from "@/lib/youtube";

const SHOWS = {
  dtc: {
    slug: "dtc",
    label: "Dealin' the Cards",
    playlistId: "PLzLr3_w2micHl1PeuYZYfjYQdZfT9LO0a",
  },
  btf: {
    slug: "btf",
    label: "Birds on the Farm",
    playlistId: "PLzLr3_w2micHiyyourtPl_GYVgsnQGfcx",
  },
} as const;

type ShowSlug = keyof typeof SHOWS;

const EPISODES_PER_PAGE = 12;

function formatEpisodeDate(iso: string) {
  if (!iso) {
    return "";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(iso));
}

type PodcastPageProps = {
  searchParams: Promise<{
    page?: string;
    show?: string;
  }>;
};

export default async function PodcastPage({
  searchParams,
}: PodcastPageProps) {
  const params = await searchParams;

  const activeShowSlug: ShowSlug = params.show === "btf" ? "btf" : "dtc";
  const show = SHOWS[activeShowSlug];

  const episodes = await getPlaylistVideos(show.playlistId);

  const requestedPage = Number.parseInt(params.page ?? "1", 10);
  const currentPage =
    Number.isFinite(requestedPage) && requestedPage >= 1
      ? requestedPage
      : 1;

  const totalPages = Math.max(
    1,
    Math.ceil(episodes.length / EPISODES_PER_PAGE)
  );

  const safePage = Math.min(currentPage, totalPages);

  const startIndex = (safePage - 1) * EPISODES_PER_PAGE;
  const currentEpisodes = episodes.slice(
    startIndex,
    startIndex + EPISODES_PER_PAGE
  );

  const hasOlderEpisodes = safePage < totalPages;
  const hasNewerEpisodes = safePage > 1;

  return (
    <div
      style={{
        display: "grid",
        gap: "2.75rem",
        paddingBottom: "4rem",
        paddingTop: "2.2rem",
      }}
    >
      <section className="container fade-up">
        <p className="kicker">Podcast</p>

        <h1 className="section-title">{show.label}</h1>
      </section>

      <section
        className="container fade-up"
        style={{ animationDelay: "0.08s" }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            justifyContent: "flex-end",
            gap: "1rem",
            flexWrap: "wrap",
          }}
        >
          <a
            href={`https://www.youtube.com/playlist?list=${show.playlistId}`}
            target="_blank"
            rel="noreferrer"
            style={{
              color: "var(--accent-soft)",
              fontWeight: 700,
            }}
          >
            Open playlist
          </a>
        </div>

        {episodes.length === 0 ? (
          <article
            style={{
              border: "1px solid var(--line)",
              borderRadius: "18px",
              background: "var(--panel)",
              padding: "1.15rem",
              marginTop: "1rem",
            }}
          >
            <h3 style={{ marginTop: 0 }}>Playlist unavailable</h3>

            <p
              style={{
                marginBottom: 0,
                color: "var(--muted)",
              }}
            >
              The playlist data could not be loaded right now.
            </p>
          </article>
        ) : (
          <>
            <div
              className="podcast-grid"
              style={{
                marginTop: "1rem",
              }}
            >
              {currentEpisodes.map((episode) => (
                <a
                  key={episode.videoId}
                  href={`https://www.youtube.com/watch?v=${episode.videoId}`}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    display: "grid",
                    border: "1px solid var(--line)",
                    borderRadius: "14px",
                    background: "var(--panel)",
                    overflow: "hidden",
                    color: "inherit",
                    textDecoration: "none",
                  }}
                >
                  <div
                    style={{
                      aspectRatio: "16 / 9",
                      overflow: "hidden",
                      background: "rgba(15,31,61,.08)",
                    }}
                  >
                    <img
                      src={episode.thumbnailUrl}
                      alt={episode.title}
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    />
                  </div>

                  <div style={{ padding: "0.7rem", display: "grid", gap: "0.3rem" }}>
                    <p className="kicker" style={{ margin: 0, fontSize: "0.68rem" }}>
                      {show.label}
                      {episode.publishedAt ? ` · ${formatEpisodeDate(episode.publishedAt)}` : ""}
                    </p>

                    <p
                      style={{
                        margin: 0,
                        fontWeight: 700,
                        fontSize: "0.82rem",
                        lineHeight: 1.3,
                      }}
                    >
                      {episode.title}
                    </p>
                  </div>
                </a>
              ))}
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                gap: "1rem",
                marginTop: "2rem",
                flexWrap: "wrap",
              }}
            >
              {hasNewerEpisodes ? (
                <a
                  href={`?show=${show.slug}&page=${safePage - 1}`}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: "0.7rem 1.1rem",
                    border: "1px solid var(--line)",
                    borderRadius: "999px",
                    background: "var(--panel)",
                    color: "var(--foreground)",
                    fontWeight: 700,
                    textDecoration: "none",
                  }}
                >
                  ← Newer Episodes
                </a>
              ) : null}

              <span
                style={{
                  color: "var(--muted)",
                  fontWeight: 600,
                }}
              >
                Page {safePage} of {totalPages}
              </span>

              {hasOlderEpisodes ? (
                <a
                  href={`?show=${show.slug}&page=${safePage + 1}`}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: "0.7rem 1.1rem",
                    border: "1px solid var(--line)",
                    borderRadius: "999px",
                    background: "var(--accent)",
                    color: "white",
                    fontWeight: 700,
                    textDecoration: "none",
                  }}
                >
                  Show Older Episodes →
                </a>
              ) : null}
            </div>
          </>
        )}
      </section>
    </div>
  );
}
