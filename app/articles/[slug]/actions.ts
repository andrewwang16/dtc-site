"use server";

import { revalidatePath } from "next/cache";
import { getViewerSession } from "@/lib/require-viewer";
import { getAdminSession } from "@/lib/require-admin";
import { createComment, deleteComment } from "@/lib/comments";
import { deleteArticle } from "@/lib/articles";

const MAX_COMMENT_LENGTH = 2000;

export type PostCommentResult = { ok: true } | { ok: false; error: string };
export type ActionResult = { ok: true } | { ok: false; error: string };

export async function postCommentAction(
  articleSlug: string,
  body: string
): Promise<PostCommentResult> {
  const session = await getViewerSession();

  if (!session?.user?.email) {
    return { ok: false, error: "Sign in to comment." };
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
