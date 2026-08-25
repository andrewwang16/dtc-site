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
    return null;
  }

  return (await response.json()) as PlaylistItemsResponse;
}

export async function getPlaylistVideos(playlistId: string): Promise<PlaylistVideo[]> {
  const apiKey = process.env.YOUTUBE_API_KEY;

  if (!apiKey) {
    console.error("getPlaylistVideos: YOUTUBE_API_KEY is not set");
    return [];
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

  return videos;
}
