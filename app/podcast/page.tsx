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

const EPISODES_PER_PAGE = 10;

type PlaylistEpisode = {
  videoId: string;
  title: string;
  thumbnailUrl: string;
  duration?: string;
};

function getDeepValue<T>(value: unknown, path: Array<string>): T | undefined {
  let current: any = value;

  for (const key of path) {
    if (!current || typeof current !== "object") {
      return undefined;
    }

    current = current[key];
  }

  return current as T | undefined;
}

function collectEpisodes(node: unknown, episodes: PlaylistEpisode[]) {
  if (!node || typeof node !== "object" || episodes.length >= 500) {
    return;
  }

  const record = node as Record<string, any>;

  if (record.lockupViewModel) {
    const card = record.lockupViewModel;

    const title =
      getDeepValue<string>(card, [
        "metadata",
        "lockupMetadataViewModel",
        "title",
        "content",
      ]) ?? "Untitled episode";

    const videoId =
      getDeepValue<string>(card, [
        "rendererContext",
        "commandContext",
        "onTap",
        "innertubeCommand",
        "watchEndpoint",
        "videoId",
      ]) ??
      getDeepValue<string>(card, [
        "contentImage",
        "thumbnailViewModel",
        "overlays",
        "1",
        "thumbnailHoverOverlayToggleActionsViewModel",
        "buttons",
        "1",
        "toggleButtonViewModel",
        "defaultButtonViewModel",
        "buttonViewModel",
        "onTap",
        "innertubeCommand",
        "signalServiceEndpoint",
        "actions",
        "0",
        "addToPlaylistCommand",
        "videoId",
      ]) ??
      "";

    const thumbnailSources =
      getDeepValue<any[]>(card, [
        "contentImage",
        "thumbnailViewModel",
        "image",
        "sources",
      ]) ?? [];

    const thumbnailUrl =
      getDeepValue<string>(card, [
        "contentImage",
        "thumbnailViewModel",
        "image",
        "sources",
        String(thumbnailSources.length - 1),
        "url",
      ]) ??
      getDeepValue<string>(card, [
        "contentImage",
        "thumbnailViewModel",
        "image",
        "sources",
        "0",
        "url",
      ]) ??
      "";

    const duration = getDeepValue<string>(card, [
      "metadata",
      "lockupMetadataViewModel",
      "metadata",
      "content",
    ]);

    if (videoId && thumbnailUrl) {
      episodes.push({
        videoId,
        title,
        thumbnailUrl,
        duration,
      });
    }
  }

  for (const value of Object.values(record)) {
    collectEpisodes(value, episodes);
  }
}

async function getPodcastEpisodes(playlistId: string) {
  try {
    const response = await fetch(
      `https://www.youtube.com/playlist?list=${playlistId}`,
      {
        headers: {
          "user-agent": "Mozilla/5.0",
        },
        next: {
          revalidate: 3600,
        },
      }
    );

    if (!response.ok) {
      return [] as PlaylistEpisode[];
    }

    const html = await response.text();
    const marker = "var ytInitialData = ";
    const start = html.indexOf(marker);

    if (start === -1) {
      return [] as PlaylistEpisode[];
    }

    const jsonStart = start + marker.length;
    const jsonEnd = html.indexOf(";</script>", jsonStart);

    if (jsonEnd === -1) {
      return [] as PlaylistEpisode[];
    }

    const data = JSON.parse(html.slice(jsonStart, jsonEnd));
    const episodes: PlaylistEpisode[] = [];

    collectEpisodes(data, episodes);

    return episodes;
  } catch {
    return [] as PlaylistEpisode[];
  }
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

  const episodes = await getPodcastEpisodes(show.playlistId);

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
        gap: "5.5rem",
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
                    borderRadius: "18px",
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

                  <div style={{ padding: "1rem", display: "grid", gap: "0.4rem" }}>
                    <p className="kicker" style={{ margin: 0 }}>
                      {show.label}
                      {episode.duration ? ` · ${episode.duration}` : ""}
                    </p>

                    <p
                      style={{
                        margin: 0,
                        fontWeight: 700,
                        fontSize: "0.95rem",
                        lineHeight: 1.35,
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