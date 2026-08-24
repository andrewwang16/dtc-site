import type { ArticleBlock } from "@/lib/articles";
import TweetEmbed from "@/components/articles/TweetEmbed";

function ArticleBlockView({ block }: { block: ArticleBlock }) {
  if (block.type === "paragraph") {
    return (
      <p style={{ margin: 0, lineHeight: 1.7, fontSize: "1.05rem" }}>
        {block.text}
      </p>
    );
  }

  if (block.type === "youtube") {
    return (
      <div
        style={{
          borderRadius: "18px",
          overflow: "hidden",
          border: "1px solid var(--line)",
          aspectRatio: "16 / 9",
        }}
      >
        <iframe
          title="Embedded YouTube video"
          src={`https://www.youtube.com/embed/${block.videoId}`}
          style={{ width: "100%", height: "100%", border: 0 }}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
        />
      </div>
    );
  }

  return <TweetEmbed tweetId={block.tweetId} />;
}

export default function ArticleBody({ body }: { body: ArticleBlock[] }) {
  return (
    <div style={{ display: "grid", gap: "1.15rem" }}>
      {body.map((block, index) => (
        <ArticleBlockView key={index} block={block} />
      ))}
    </div>
  );
}
