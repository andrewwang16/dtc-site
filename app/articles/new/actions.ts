"use server";

import { revalidatePath } from "next/cache";
import { getAdminSession } from "@/lib/require-admin";
import { createArticle, type ArticleBlock } from "@/lib/articles";

export type CreateArticleInput = {
  title: string;
  image: string;
  blocks: ArticleBlock[];
  playerId?: number;
  playerName?: string;
};

export type CreateArticleResult =
  | { ok: true; slug: string }
  | { ok: false; error: string };

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function sanitizeBlocks(blocks: ArticleBlock[]): ArticleBlock[] {
  return blocks.filter((block) => {
    if (block.type === "paragraph") {
      return isNonEmptyString(block.text);
    }

    if (block.type === "youtube") {
      return isNonEmptyString(block.videoId);
    }

    return isNonEmptyString(block.tweetId);
  });
}

export async function createArticleAction(
  input: CreateArticleInput
): Promise<CreateArticleResult> {
  const session = await getAdminSession();

  if (!session?.user?.email) {
    return { ok: false, error: "Not authorized." };
  }

  if (!isNonEmptyString(input.title)) {
    return { ok: false, error: "Title is required." };
  }

  if (!isNonEmptyString(input.image)) {
    return { ok: false, error: "A cover image is required." };
  }

  const blocks = sanitizeBlocks(input.blocks ?? []);

  if (blocks.length === 0) {
    return { ok: false, error: "Add at least one paragraph or embed." };
  }

  try {
    const article = await createArticle({
      title: input.title.trim(),
      author: session.user.name ?? session.user.email,
      authorEmail: session.user.email,
      image: input.image,
      body: blocks,
      playerId: input.playerId,
      playerName: input.playerName,
    });

    revalidatePath("/articles");
    revalidatePath("/");
    revalidatePath(`/articles/${article.slug}`);

    return { ok: true, slug: article.slug };
  } catch (error) {
    console.error("Failed to create article", error);
    return { ok: false, error: "Something went wrong publishing the article." };
  }
}
