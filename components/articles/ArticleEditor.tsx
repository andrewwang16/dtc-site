"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { createArticleAction } from "@/app/articles/new/actions";
import type { ArticleBlock } from "@/lib/articles";
import type { RosterEntry } from "@/lib/mlb";
import ArticleBody from "@/components/articles/ArticleBody";
import PlayerPicker from "@/components/articles/PlayerPicker";
import { PremiumBadge } from "@/components/shared/PremiumLock";

type EditableBlock = ArticleBlock & { id: string };

function makeId() {
  return Math.random().toString(36).slice(2);
}

function parseYouTubeId(input: string): string | null {
  const trimmed = input.trim();
  const urlMatch = trimmed.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/
  );

  if (urlMatch) {
    return urlMatch[1];
  }

  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) {
    return trimmed;
  }

  return null;
}

function parseTweetId(input: string): string | null {
  const trimmed = input.trim();
  const urlMatch = trimmed.match(/(?:twitter|x)\.com\/[^/]+\/status\/(\d+)/);

  if (urlMatch) {
    return urlMatch[1];
  }

  if (/^\d+$/.test(trimmed)) {
    return trimmed;
  }

  return null;
}

const cardStyle: React.CSSProperties = {
  border: "1px solid var(--line)",
  borderRadius: "18px",
  background: "var(--panel)",
  padding: "1.15rem",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "0.75rem 1rem",
  borderRadius: "12px",
  border: "1px solid var(--line)",
  background: "var(--bg-soft)",
  color: "var(--text)",
  fontSize: "1rem",
  fontFamily: "inherit",
};

const pillButtonStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  padding: "0.5rem 0.9rem",
  borderRadius: "999px",
  border: "1px solid var(--line)",
  background: "rgba(15,31,61,0.02)",
  color: "var(--text)",
  fontWeight: 700,
  cursor: "pointer",
  fontSize: "0.85rem",
};

function BlockCard({
  block,
  onChange,
  onMoveUp,
  onMoveDown,
  onRemove,
  canMoveUp,
  canMoveDown,
}: {
  block: EditableBlock;
  onChange: (block: EditableBlock) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onRemove: () => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
}) {
  const label =
    block.type === "paragraph" ? "Paragraph" : block.type === "youtube" ? "YouTube" : "Tweet";

  return (
    <div style={{ ...cardStyle, padding: "0.9rem", display: "grid", gap: "0.6rem" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.5rem" }}>
        <p className="kicker" style={{ margin: 0 }}>
          {label}
        </p>

        <div style={{ display: "flex", gap: "0.35rem" }}>
          <button
            type="button"
            onClick={onMoveUp}
            disabled={!canMoveUp}
            style={{ ...pillButtonStyle, padding: "0.3rem 0.6rem", opacity: canMoveUp ? 1 : 0.4 }}
          >
            ↑
          </button>
          <button
            type="button"
            onClick={onMoveDown}
            disabled={!canMoveDown}
            style={{ ...pillButtonStyle, padding: "0.3rem 0.6rem", opacity: canMoveDown ? 1 : 0.4 }}
          >
            ↓
          </button>
          <button
            type="button"
            onClick={onRemove}
            style={{ ...pillButtonStyle, padding: "0.3rem 0.6rem", color: "#b42318" }}
          >
            Remove
          </button>
        </div>
      </div>

      {block.type === "paragraph" && (
        <textarea
          value={block.text}
          onChange={(event) => onChange({ ...block, text: event.target.value })}
          placeholder="Write a paragraph..."
          rows={4}
          style={{ ...inputStyle, resize: "vertical" }}
        />
      )}

      {block.type === "youtube" && (
        <div>
          <input
            type="text"
            defaultValue={block.videoId}
            placeholder="Paste a YouTube URL or video ID"
            onBlur={(event) => {
              const videoId = parseYouTubeId(event.target.value);
              onChange({ ...block, videoId: videoId ?? "" });
            }}
            style={inputStyle}
          />
          {block.videoId ? (
            <p style={{ margin: "0.4rem 0 0", color: "var(--muted)", fontSize: "0.8rem" }}>
              Video ID: {block.videoId}
            </p>
          ) : (
            <p style={{ margin: "0.4rem 0 0", color: "#b42318", fontSize: "0.8rem" }}>
              Paste a valid YouTube link to embed it.
            </p>
          )}
        </div>
      )}

      {block.type === "tweet" && (
        <div>
          <input
            type="text"
            defaultValue={block.tweetId}
            placeholder="Paste a tweet/X URL or status ID"
            onBlur={(event) => {
              const tweetId = parseTweetId(event.target.value);
              onChange({ ...block, tweetId: tweetId ?? "" });
            }}
            style={inputStyle}
          />
          {block.tweetId ? (
            <p style={{ margin: "0.4rem 0 0", color: "var(--muted)", fontSize: "0.8rem" }}>
              Tweet ID: {block.tweetId}
            </p>
          ) : (
            <p style={{ margin: "0.4rem 0 0", color: "#b42318", fontSize: "0.8rem" }}>
              Paste a valid tweet/X link to embed it.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function formatPreviewDate() {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date());
}

export default function ArticleEditor({ roster }: { roster: RosterEntry[] }) {
  const router = useRouter();
  const { data: session } = useSession();
  const [isPending, startTransition] = useTransition();

  const [mode, setMode] = useState<"edit" | "preview">("edit");
  const [title, setTitle] = useState("");
  const [blocks, setBlocks] = useState<EditableBlock[]>([
    { id: makeId(), type: "paragraph", text: "" },
  ]);
  const [selectedPlayer, setSelectedPlayer] = useState<RosterEntry | null>(null);
  const [isFree, setIsFree] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function updateBlock(id: string, next: EditableBlock) {
    setBlocks((current) => current.map((block) => (block.id === id ? next : block)));
  }

  function removeBlock(id: string) {
    setBlocks((current) => current.filter((block) => block.id !== id));
  }

  function moveBlock(id: string, direction: -1 | 1) {
    setBlocks((current) => {
      const index = current.findIndex((block) => block.id === id);
      const targetIndex = index + direction;

      if (index === -1 || targetIndex < 0 || targetIndex >= current.length) {
        return current;
      }

      const next = [...current];
      [next[index], next[targetIndex]] = [next[targetIndex], next[index]];

      return next;
    });
  }

  function addBlock(type: ArticleBlock["type"]) {
    const base = { id: makeId() };

    if (type === "paragraph") {
      setBlocks((current) => [...current, { ...base, type: "paragraph", text: "" }]);
    } else if (type === "youtube") {
      setBlocks((current) => [...current, { ...base, type: "youtube", videoId: "" }]);
    } else {
      setBlocks((current) => [...current, { ...base, type: "tweet", tweetId: "" }]);
    }
  }

  function getCleanedBlocks(): ArticleBlock[] {
    return blocks
      .map((block) => {
        const { id, ...rest } = block;
        return rest;
      })
      .filter((block) => {
        if (block.type === "paragraph") return block.text.trim().length > 0;
        if (block.type === "youtube") return block.videoId.trim().length > 0;
        return block.tweetId.trim().length > 0;
      });
  }

  function handlePublish() {
    setError(null);

    if (!title.trim()) {
      setError("Title is required.");
      return;
    }

    const cleanedBlocks = getCleanedBlocks();

    if (cleanedBlocks.length === 0) {
      setError("Add at least one paragraph or embed.");
      return;
    }

    startTransition(async () => {
      const result = await createArticleAction({
        title: title.trim(),
        blocks: cleanedBlocks,
        playerId: selectedPlayer?.id,
        playerName: selectedPlayer?.fullName,
        isPremium: !isFree,
      });

      if (!result.ok) {
        setError(result.error);
        return;
      }

      router.push(`/articles/${result.slug}`);
    });
  }

  const canPublish = !isPending;
  const previewBlocks = getCleanedBlocks();
  const authorName = session?.user?.name ?? session?.user?.email ?? "You";

  return (
    <div style={{ display: "grid", gap: "1.25rem" }}>
      <div style={{ display: "flex", gap: "0.5rem" }}>
        <button
          type="button"
          onClick={() => setMode("edit")}
          style={{
            ...pillButtonStyle,
            background: mode === "edit" ? "var(--accent)" : "rgba(15,31,61,0.02)",
            color: mode === "edit" ? "white" : "var(--text)",
            borderColor: mode === "edit" ? "#8a1024" : "var(--line)",
          }}
        >
          Edit
        </button>
        <button
          type="button"
          onClick={() => setMode("preview")}
          style={{
            ...pillButtonStyle,
            background: mode === "preview" ? "var(--accent)" : "rgba(15,31,61,0.02)",
            color: mode === "preview" ? "white" : "var(--text)",
            borderColor: mode === "preview" ? "#8a1024" : "var(--line)",
          }}
        >
          Preview
        </button>
      </div>

      {mode === "edit" ? (
        <>
          <div>
            <p className="kicker" style={{ marginBottom: "0.4rem" }}>
              Title
            </p>
            <input
              type="text"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Article title"
              style={inputStyle}
            />
          </div>

          <div>
            <p className="kicker" style={{ marginBottom: "0.4rem" }}>
              Attached Player (optional)
            </p>
            <PlayerPicker
              roster={roster}
              selected={selectedPlayer}
              onSelect={setSelectedPlayer}
              onClear={() => setSelectedPlayer(null)}
            />
          </div>

          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.6rem",
              border: "1px solid var(--line)",
              borderRadius: "18px",
              background: "var(--panel)",
              padding: "0.9rem 1.15rem",
              cursor: "pointer",
            }}
          >
            <input
              type="checkbox"
              checked={isFree}
              onChange={(event) => setIsFree(event.target.checked)}
              style={{ width: "1.1rem", height: "1.1rem" }}
            />
            <span>
              <span style={{ fontWeight: 700 }}>Free article</span>
              <span style={{ display: "block", color: "var(--muted)", fontSize: "0.85rem" }}>
                Articles are subscriber-only by default. Check this to make it free for everyone.
              </span>
            </span>
          </label>

          <div style={{ display: "grid", gap: "0.75rem" }}>
            <p className="kicker" style={{ margin: 0 }}>
              Body
            </p>

            {blocks.map((block, index) => (
              <BlockCard
                key={block.id}
                block={block}
                onChange={(next) => updateBlock(block.id, next)}
                onMoveUp={() => moveBlock(block.id, -1)}
                onMoveDown={() => moveBlock(block.id, 1)}
                onRemove={() => removeBlock(block.id)}
                canMoveUp={index > 0}
                canMoveDown={index < blocks.length - 1}
              />
            ))}

            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
              <button type="button" style={pillButtonStyle} onClick={() => addBlock("paragraph")}>
                + Add Paragraph
              </button>
              <button type="button" style={pillButtonStyle} onClick={() => addBlock("youtube")}>
                + Add YouTube
              </button>
              <button type="button" style={pillButtonStyle} onClick={() => addBlock("tweet")}>
                + Add Tweet
              </button>
            </div>
          </div>
        </>
      ) : (
        <div style={{ maxWidth: "760px" }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: "0.75rem", flexWrap: "wrap" }}>
            <p className="kicker" style={{ margin: 0 }}>Article</p>
            {!isFree && <PremiumBadge />}
          </div>
          <h1 className="section-title">{title.trim() || "Untitled article"}</h1>

          <p style={{ marginTop: "0.75rem", color: "var(--muted)" }}>
            By {authorName} · {formatPreviewDate()}
          </p>

          <div style={{ marginTop: "1.75rem" }}>
            {previewBlocks.length > 0 ? (
              <ArticleBody body={previewBlocks} />
            ) : (
              <p style={{ margin: 0, color: "var(--muted)" }}>
                Nothing to preview yet — add a paragraph or embed.
              </p>
            )}
          </div>

          {selectedPlayer && (
            <Link
              href={`/players/${selectedPlayer.id}`}
              style={{
                marginTop: "2rem",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "1rem",
                border: "1px solid var(--line)",
                borderRadius: "18px",
                background: "var(--panel)",
                padding: "1.15rem",
                color: "inherit",
              }}
            >
              <div>
                <p className="kicker" style={{ marginBottom: "0.3rem" }}>
                  Player Profile
                </p>
                <p style={{ margin: 0, fontWeight: 800 }}>
                  View {selectedPlayer.fullName}&apos;s full stats & bio
                </p>
              </div>
              <span style={{ fontSize: "1.3rem" }}>→</span>
            </Link>
          )}
        </div>
      )}

      {error && (
        <p style={{ margin: 0, color: "#b42318", fontWeight: 700 }}>{error}</p>
      )}

      <button
        type="button"
        onClick={handlePublish}
        disabled={!canPublish}
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "0.75rem 1.5rem",
          borderRadius: "999px",
          border: "1px solid #8a1024",
          background: canPublish ? "var(--accent)" : "rgba(196,30,58,0.4)",
          color: "white",
          fontWeight: 800,
          cursor: canPublish ? "pointer" : "not-allowed",
          fontSize: "1rem",
        }}
      >
        {isPending ? "Publishing..." : "Publish"}
      </button>
    </div>
  );
}
