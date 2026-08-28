import { getSql } from "@/lib/db";

export type ArticleBlock =
  | { type: "paragraph"; text: string }
  | { type: "youtube"; videoId: string }
  | { type: "tweet"; tweetId: string };

export type Article = {
  slug: string;
  title: string;
  author: string;
  authorEmail: string;
  date: string;
  excerpt: string;
  body: ArticleBlock[];
  playerId?: number;
  playerName?: string;
  isPremium: boolean;
};

type ArticleRow = {
  slug: string;
  title: string;
  author: string;
  author_email: string;
  date: string;
  excerpt: string;
  body: ArticleBlock[];
  player_id: number | null;
  player_name: string | null;
  is_premium: boolean;
};

function rowToArticle(row: ArticleRow): Article {
  return {
    slug: row.slug,
    title: row.title,
    author: row.author,
    authorEmail: row.author_email,
    date: row.date,
    excerpt: row.excerpt,
    body: row.body,
    playerId: row.player_id ?? undefined,
    playerName: row.player_name ?? undefined,
    isPremium: row.is_premium,
  };
}

export async function getAllArticles(): Promise<Article[]> {
  try {
    const sql = getSql();
    const rows = (await sql`
      SELECT slug, title, author, author_email, date, excerpt, body, player_id, player_name, is_premium
      FROM articles
      ORDER BY date DESC, id DESC
    `) as ArticleRow[];

    return rows.map(rowToArticle);
  } catch (error) {
    console.error("getAllArticles failed", error);
    return [];
  }
}

export async function getRecentArticles(count: number): Promise<Article[]> {
  try {
    const sql = getSql();
    const rows = (await sql`
      SELECT slug, title, author, author_email, date, excerpt, body, player_id, player_name, is_premium
      FROM articles
      ORDER BY date DESC, id DESC
      LIMIT ${count}
    `) as ArticleRow[];

    return rows.map(rowToArticle);
  } catch (error) {
    console.error("getRecentArticles failed", error);
    return [];
  }
}

export async function getArticleBySlug(slug: string): Promise<Article | undefined> {
  try {
    const sql = getSql();
    const rows = (await sql`
      SELECT slug, title, author, author_email, date, excerpt, body, player_id, player_name, is_premium
      FROM articles
      WHERE slug = ${slug}
      LIMIT 1
    `) as ArticleRow[];

    return rows[0] ? rowToArticle(rows[0]) : undefined;
  } catch (error) {
    console.error("getArticleBySlug failed", error);
    return undefined;
  }
}

export async function getArticlesForPlayer(playerId: number): Promise<Article[]> {
  try {
    const sql = getSql();
    const rows = (await sql`
      SELECT slug, title, author, author_email, date, excerpt, body, player_id, player_name, is_premium
      FROM articles
      WHERE player_id = ${playerId}
      ORDER BY date DESC, id DESC
    `) as ArticleRow[];

    return rows.map(rowToArticle);
  } catch (error) {
    console.error("getArticlesForPlayer failed", error);
    return [];
  }
}

export async function deleteArticle(slug: string): Promise<void> {
  const sql = getSql();
  await sql`DELETE FROM articles WHERE slug = ${slug}`;
}

function slugify(title: string) {
  return title
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function buildExcerpt(body: ArticleBlock[]) {
  const firstParagraph = body.find((block) => block.type === "paragraph");

  if (!firstParagraph || firstParagraph.type !== "paragraph") {
    return "";
  }

  return firstParagraph.text.length > 220
    ? `${firstParagraph.text.slice(0, 217)}...`
    : firstParagraph.text;
}

export async function createArticle(input: {
  title: string;
  author: string;
  authorEmail: string;
  body: ArticleBlock[];
  playerId?: number;
  playerName?: string;
  isPremium?: boolean;
}): Promise<Article> {
  const baseSlug = slugify(input.title) || "article";
  let slug = baseSlug;
  let attempt = 1;

  while ((await getArticleBySlug(slug)) !== undefined) {
    attempt += 1;
    slug = `${baseSlug}-${attempt}`;
  }

  const excerpt = buildExcerpt(input.body);
  const today = new Date().toISOString().slice(0, 10);
  const sql = getSql();

  const rows = (await sql`
    INSERT INTO articles (slug, title, author, author_email, date, excerpt, body, player_id, player_name, is_premium)
    VALUES (
      ${slug},
      ${input.title},
      ${input.author},
      ${input.authorEmail},
      ${today},
      ${excerpt},
      ${JSON.stringify(input.body)}::jsonb,
      ${input.playerId ?? null},
      ${input.playerName ?? null},
      ${input.isPremium ?? true}
    )
    RETURNING slug, title, author, author_email, date, excerpt, body, player_id, player_name, is_premium
  `) as ArticleRow[];

  return rowToArticle(rows[0]);
}

export async function updateArticle(
  slug: string,
  input: {
    title: string;
    author: string;
    body: ArticleBlock[];
    playerId?: number;
    playerName?: string;
    isPremium?: boolean;
  }
): Promise<Article | undefined> {
  const excerpt = buildExcerpt(input.body);
  const sql = getSql();

  const rows = (await sql`
    UPDATE articles
    SET
      title = ${input.title},
      author = ${input.author},
      excerpt = ${excerpt},
      body = ${JSON.stringify(input.body)}::jsonb,
      player_id = ${input.playerId ?? null},
      player_name = ${input.playerName ?? null},
      is_premium = ${input.isPremium ?? true}
    WHERE slug = ${slug}
    RETURNING slug, title, author, author_email, date, excerpt, body, player_id, player_name, is_premium
  `) as ArticleRow[];

  return rows[0] ? rowToArticle(rows[0]) : undefined;
}
