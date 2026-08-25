"use server";

import { revalidatePath } from "next/cache";
import { getViewerSession } from "@/lib/require-viewer";
import { createComment } from "@/lib/comments";

const MAX_COMMENT_LENGTH = 2000;

export type PostCommentResult = { ok: true } | { ok: false; error: string };

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
