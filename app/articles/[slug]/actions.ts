"use server";

import { revalidatePath } from "next/cache";
import { getViewerSession } from "@/lib/require-viewer";
import { getAdminSession } from "@/lib/require-admin";
import { hasPremiumAccess } from "@/lib/access";
import { createComment, deleteComment } from "@/lib/comments";
import { deleteArticle, updateArticle, type ArticleBlock } from "@/lib/articles";

const MAX_COMMENT_LENGTH = 2000;

export type PostCommentResult = { ok: true } | { ok: false; error: string };
export type ActionResult = { ok: true } | { ok: false; error: string };

export async function postCommentAction(
  articleSlug: string,
  body: string,
  isPremium: boolean
): Promise<PostCommentResult> {
  const session = await getViewerSession();

  if (!session?.user?.email) {
    return { ok: false, error: "Sign in to comment." };
  }

  if (isPremium && !hasPremiumAccess(session.user)) {
    return { ok: false, error: "Subscribe to comment on this article." };
  }

  const trimmed = body.trim();

  if (!trimmed) {
    return { ok: false, error: "Comment can't be empty." };
  }

  if (trimmed.length > MAX_COMMENT_LENGTH) {
    return { ok: false, error: `Comments are limited to ${MAX_COMMENT_LENGTH} characters.` };
  }

  try {
    await createComment({
      articleSlug,
      authorEmail: session.user.email,
      authorName: session.user.name ?? session.user.email,
      body: trimmed,
    });

    revalidatePath(`/articles/${articleSlug}`);

    return { ok: true };
  } catch (error) {
    console.error("Failed to post comment", error);
    return { ok: false, error: "Something went wrong posting your comment." };
  }
}

export async function deleteCommentAction(
  articleSlug: string,
  commentId: number
): Promise<ActionResult> {
  const session = await getViewerSession();

  if (!session?.user?.email) {
    return { ok: false, error: "Sign in required." };
  }

  try {
    const deleted = session.user.isAdmin
      ? await deleteComment(commentId)
      : await deleteComment(commentId, { authorEmail: session.user.email });

    if (!deleted) {
      return { ok: false, error: "Comment not found, or you don't have permission to delete it." };
    }

    revalidatePath(`/articles/${articleSlug}`);

    return { ok: true };
  } catch (error) {
    console.error("Failed to delete comment", error);
    return { ok: false, error: "Something went wrong deleting the comment." };
  }
}

export async function deleteArticleAction(articleSlug: string): Promise<ActionResult> {
  const session = await getAdminSession();

  if (!session) {
    return { ok: false, error: "Not authorized." };
  }

  try {
    await deleteArticle(articleSlug);

    revalidatePath("/articles");
    revalidatePath("/");

    return { ok: true };
  } catch (error) {
    console.error("Failed to delete article", error);
    return { ok: false, error: "Something went wrong deleting the article." };
  }
}

export type UpdateArticleInput = {
  title: string;
  authorName?: string;
  blocks: ArticleBlock[];
  playerId?: number;
  playerName?: string;
  isPremium?: boolean;
};

export type UpdateArticleResult =
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

export async function updateArticleAction(
  articleSlug: string,
  input: UpdateArticleInput
): Promise<UpdateArticleResult> {
  const session = await getAdminSession();

  if (!session?.user?.email) {
    return { ok: false, error: "Not authorized." };
  }

  if (!isNonEmptyString(input.title)) {
    return { ok: false, error: "Title is required." };
  }

  const blocks = sanitizeBlocks(input.blocks ?? []);

  if (blocks.length === 0) {
    return { ok: false, error: "Add at least one paragraph or embed." };
  }

  try {
    const article = await updateArticle(articleSlug, {
      title: input.title.trim(),
      author: input.authorName?.trim() || session.user.name || session.user.email,
      body: blocks,
      playerId: input.playerId,
      playerName: input.playerName,
      isPremium: input.isPremium ?? true,
    });

    if (!article) {
      return { ok: false, error: "Article not found." };
    }

    revalidatePath("/articles");
    revalidatePath("/");
    revalidatePath(`/articles/${article.slug}`);

    return { ok: true, slug: article.slug };
  } catch (error) {
    console.error("Failed to update article", error);
    return { ok: false, error: "Something went wrong updating the article." };
  }
}
