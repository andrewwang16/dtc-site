import { getPlaylistVideos } from "@/lib/youtube";

const SHOWS = [
  { label: "Dealin' the Cards", playlistId: "PLzLr3_w2micHl1PeuYZYfjYQdZfT9LO0a" },
  { label: "Birds on the Farm", playlistId: "PLzLr3_w2micHiyyourtPl_GYVgsnQGfcx" },
] as const;

export type PodcastMention = {
  videoId: string;
  title: string;
  publishedAt: string;
  thumbnailUrl: string;
  showLabel: string;
};

// A numbered/suffixed name ("Victor Scott II") is often referenced without
// the suffix in casual commentary, so match on both forms.
function buildNameVariants(fullName: string): string[] {
  const variants = [fullName];
  const withoutSuffix = fullName.replace(/\s+(Jr\.?|Sr\.?|II|III|IV)$/i, "").trim();

  if (withoutSuffix && withoutSuffix !== fullName) {
    variants.push(withoutSuffix);
  }

  return variants.map((name) => name.toLowerCase());
}

export async function getPodcastMentionsForPlayer(fullName: string): Promise<PodcastMention[]> {
  const nameVariants = buildNameVariants(fullName);

  const showResults = await Promise.all(
    SHOWS.map(async (show) => ({
      show,
      videos: await getPlaylistVideos(show.playlistId),
    }))
  );

  const mentions: PodcastMention[] = [];

  for (const { show, videos } of showResults) {
    for (const video of videos) {
      const haystack = `${video.title} ${video.description}`.toLowerCase();
      const isMentioned = nameVariants.some((name) => haystack.includes(name));

      if (isMentioned) {
        mentions.push({
          videoId: video.videoId,
          title: video.title,
          publishedAt: video.publishedAt,
          thumbnailUrl: video.thumbnailUrl,
          showLabel: show.label,
        });
      }
    }
  }

  mentions.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());

  return mentions;
}
