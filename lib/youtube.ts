const YOUTUBE_API_BASE = "https://www.googleapis.com/youtube/v3";
const MAX_PAGES = 20;

export type PlaylistVideo = {
  videoId: string;
  title: string;
  description: string;
  publishedAt: string;
  thumbnailUrl: string;
};

type PlaylistItemsResponse = {
  nextPageToken?: string;
  items?: Array<{
    snippet?: {
      title?: string;
      description?: string;
      publishedAt?: string;
      resourceId?: { videoId?: string };
      thumbnails?: {
        medium?: { url?: string };
        default?: { url?: string };
      };
    };
  }>;
};

async function fetchPlaylistPage(
  playlistId: string,
  apiKey: string,
  pageToken?: string
): Promise<PlaylistItemsResponse | null> {
  const url = new URL(`${YOUTUBE_API_BASE}/playlistItems`);
  url.searchParams.set("part", "snippet");
  url.searchParams.set("playlistId", playlistId);
  url.searchParams.set("maxResults", "50");
  url.searchParams.set("key", apiKey);

  if (pageToken) {
    url.searchParams.set("pageToken", pageToken);
  }

  const response = await fetch(url.toString(), { next: { revalidate: 21600 } });

  if (!response.ok) {
    console.error("YouTube playlistItems request failed", playlistId, response.status);
    return null;
  }

  return (await response.json()) as PlaylistItemsResponse;
}

function decodeXml(text: string) {
  return text
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&amp;/g, "&");
}

// YouTube's public playlist feed: no API key needed, but it only lists the
// 15 most recent videos.
async function getPlaylistFeedVideos(playlistId: string): Promise<PlaylistVideo[]> {
  try {
    const response = await fetch(`https://www.youtube.com/feeds/videos.xml?playlist_id=${encodeURIComponent(playlistId)}`, {
      next: { revalidate: 3600 },
    });

    if (!response.ok) {
      console.error("getPlaylistFeedVideos failed", playlistId, response.status);
      return [];
    }

    const xml = await response.text();
    const tag = (entry: string, name: string) => entry.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`))?.[1];

    return [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)].flatMap(([, entry]) => {
      const videoId = tag(entry, "yt:videoId");
      const title = tag(entry, "title");
      if (!videoId || !title) {
        return [];
      }
      return [
        {
          videoId,
          title: decodeXml(title),
          description: decodeXml(tag(entry, "media:description") ?? ""),
          publishedAt: tag(entry, "published") ?? "",
          // Same thumbnail size the Data API's "medium" gives.
          thumbnailUrl: `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`,
        },
      ];
    });
  } catch (error) {
    console.error("getPlaylistFeedVideos failed", playlistId, error);
    return [];
  }
}

// The full playlist comes from the YouTube Data API (YOUTUBE_API_KEY). If
// the key isn't set or the API fails, fall back to the public feed's most
// recent episodes rather than showing nothing.
export async function getPlaylistVideos(playlistId: string): Promise<PlaylistVideo[]> {
  const apiKey = process.env.YOUTUBE_API_KEY;

  if (!apiKey) {
    console.warn("getPlaylistVideos: YOUTUBE_API_KEY is not set; using the public feed (latest 15 videos)");
    return getPlaylistFeedVideos(playlistId);
  }

  const videos: PlaylistVideo[] = [];
  let pageToken: string | undefined;
  let pagesFetched = 0;

  try {
    do {
      const data = await fetchPlaylistPage(playlistId, apiKey, pageToken);

      if (!data) {
        break;
      }

      for (const item of data.items ?? []) {
        const snippet = item.snippet;
        const videoId = snippet?.resourceId?.videoId;
        const title = snippet?.title;

        if (!videoId || !title || title === "Private video" || title === "Deleted video") {
          continue;
        }

        videos.push({
          videoId,
          title,
          description: snippet?.description ?? "",
          publishedAt: snippet?.publishedAt ?? "",
          thumbnailUrl: snippet?.thumbnails?.medium?.url ?? snippet?.thumbnails?.default?.url ?? "",
        });
      }

      pageToken = data.nextPageToken;
      pagesFetched += 1;
    } while (pageToken && pagesFetched < MAX_PAGES);
  } catch (error) {
    console.error("getPlaylistVideos failed", error);
  }

  return videos.length > 0 ? videos : getPlaylistFeedVideos(playlistId);
}
