import { getSql } from "@/lib/db";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const key = searchParams.get("key");

  if (!key || key !== process.env.SETUP_SECRET) {
    return new Response("Not authorized", { status: 401 });
  }

  try {
    const sql = getSql();
    await sql`
      CREATE TABLE IF NOT EXISTS comments (
        id SERIAL PRIMARY KEY,
        article_slug TEXT NOT NULL REFERENCES articles(slug) ON DELETE CASCADE,
        author_email TEXT NOT NULL,
        author_name TEXT NOT NULL,
        body TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `;
    await sql`CREATE INDEX IF NOT EXISTS comments_article_slug_idx ON comments (article_slug, created_at)`;
    return Response.json({ ok: true });
  } catch (error) {
    console.error("Create comments table failed", error);
    return new Response("Migration failed", { status: 500 });
  }
}
