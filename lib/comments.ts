import { getSql } from "@/lib/db";

export type Comment = {
  id: number;
  articleSlug: string;
  authorEmail: string;
  authorName: string;
  body: string;
  createdAt: string;
};

type CommentRow = {
  id: number;
  article_slug: string;
  author_email: string;
  author_name: string;
  body: string;
  created_at: string;
};

function rowToComment(row: CommentRow): Comment {
  return {
    id: row.id,
    articleSlug: row.article_slug,
    authorEmail: row.author_email,
    authorName: row.author_name,
    body: row.body,
    createdAt: row.created_at,
  };
}

export async function getCommentsForArticle(slug: string): Promise<Comment[]> {
  try {
    const sql = getSql();
    const rows = (await sql`
      SELECT id, article_slug, author_email, author_name, body, created_at
      FROM comments
      WHERE article_slug = ${slug}
      ORDER BY created_at ASC, id ASC
    `) as CommentRow[];

    return rows.map(rowToComment);
  } catch (error) {
    console.error("getCommentsForArticle failed", error);
    return [];
  }
}

export async function deleteComment(
  id: number,
  options: { authorEmail?: string } = {}
): Promise<boolean> {
  const sql = getSql();

  const rows = options.authorEmail
    ? ((await sql`
        DELETE FROM comments WHERE id = ${id} AND author_email = ${options.authorEmail} RETURNING id
      `) as { id: number }[])
    : ((await sql`
        DELETE FROM comments WHERE id = ${id} RETURNING id
      `) as { id: number }[]);

  return rows.length > 0;
}

export async function createComment(input: {
  articleSlug: string;
  authorEmail: string;
  authorName: string;
  body: string;
}): Promise<Comment> {
  const sql = getSql();

  const rows = (await sql`
    INSERT INTO comments (article_slug, author_email, author_name, body)
    VALUES (${input.articleSlug}, ${input.authorEmail}, ${input.authorName}, ${input.body})
    RETURNING id, article_slug, author_email, author_name, body, created_at
  `) as CommentRow[];

  return rowToComment(rows[0]);
}
