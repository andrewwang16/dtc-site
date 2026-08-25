"use server";

import bcrypt from "bcryptjs";
import { getSql } from "@/lib/db";
import { ADMIN_EMAILS } from "@/lib/admin-emails";

const KYLE_LEAHY_BODY = [
  "Kyle Leahy's path to the major leagues was never a straight line. Drafted out of college in 2018, the right-hander spent parts of five seasons working through the Cardinals' minor league system before making his MLB debut in July 2023. For a lot of relievers, that kind of timeline ends the story before it really starts. For Leahy, it was just the beginning.",
  "What stands out about Leahy's game isn't a single overpowering pitch — it's the way he's learned to sequence his arsenal to keep hitters off balance, mixing his fastball with secondary offerings to generate weak contact rather than relying purely on swing-and-miss stuff. That approach has made him a trustworthy option for a Cardinals bullpen that has leaned on him in a variety of situations, from mop-up innings to higher-leverage spots as the season has worn on.",
  "At 6-foot-5 and listed at 225 pounds, Leahy has the frame teams look for in a durable reliever, and durability has been part of his value proposition — he's shown he can handle a heavier workload without a steep drop-off in stuff deep into the summer. That kind of reliability is easy to overlook in a bullpen that also features higher-profile arms, but it's exactly the sort of thing that keeps a pitching staff functional over a 162-game season.",
  "The switch-hitting Leahy — a rarity for a pitcher, since the bat/throw split refers to his own hitting side, not something that comes into play on the mound — has also drawn praise from teammates and coaches for his makeup and preparation. Relievers who can handle uncertainty, warm up on short notice, and pitch on back-to-back days without complaint tend to earn a manager's trust, and that trust shows up in how often his name gets called.",
  "For a full breakdown of his 2026 season — innings pitched, ERA, strikeout and walk rates, and how his role has evolved month to month — the live numbers tell the rest of the story.",
];

function checkKey(key: string): boolean {
  const expected = process.env.SETUP_SECRET;
  return Boolean(expected) && key === expected;
}

export type SetupResult = { ok: true; message: string } | { ok: false; error: string };

export async function runSeedAction(key: string): Promise<SetupResult> {
  if (!checkKey(key)) {
    return { ok: false, error: "Not authorized." };
  }

  try {
    const sql = getSql();

    await sql`
      CREATE TABLE IF NOT EXISTS articles (
        id SERIAL PRIMARY KEY,
        slug TEXT UNIQUE NOT NULL,
        title TEXT NOT NULL,
        author TEXT NOT NULL,
        author_email TEXT NOT NULL,
        date DATE NOT NULL,
        excerpt TEXT NOT NULL,
        body JSONB NOT NULL,
        player_id INTEGER,
        player_name TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `;

    await sql`CREATE INDEX IF NOT EXISTS articles_date_idx ON articles (date DESC)`;

    await sql`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        is_admin BOOLEAN NOT NULL DEFAULT false,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `;

    const body = KYLE_LEAHY_BODY.map((text) => ({ type: "paragraph", text }));

    await sql`
      INSERT INTO articles (slug, title, author, author_email, date, excerpt, body, player_id, player_name)
      VALUES (
        'kyle-leahy-cardinals-bullpen-role',
        'Kyle Leahy Is Quietly Becoming a Cardinals Bullpen Fixture',
        'Claude',
        'nootnewspod@gmail.com',
        '2026-08-21',
        'The Boulder, Colorado native has taken a winding road to St. Louis, and this year he''s carved out a real role in the Cardinals'' relief corps.',
        ${JSON.stringify(body)}::jsonb,
        681517,
        'Kyle Leahy'
      )
      ON CONFLICT (slug) DO NOTHING
    `;

    return { ok: true, message: "Tables ready and Kyle Leahy article seeded." };
  } catch (error) {
    console.error("Seed failed", error);
    return { ok: false, error: "Seed failed — check server logs." };
  }
}

export async function dropImageColumnAction(key: string): Promise<SetupResult> {
  if (!checkKey(key)) {
    return { ok: false, error: "Not authorized." };
  }

  try {
    const sql = getSql();
    await sql`ALTER TABLE articles DROP COLUMN IF EXISTS image`;
    return { ok: true, message: "Dropped the image column from articles." };
  } catch (error) {
    console.error("Drop image column failed", error);
    return { ok: false, error: "Migration failed — check server logs." };
  }
}

export async function createCommentsTableAction(key: string): Promise<SetupResult> {
  if (!checkKey(key)) {
    return { ok: false, error: "Not authorized." };
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

    return { ok: true, message: "Comments table ready." };
  } catch (error) {
    console.error("Create comments table failed", error);
    return { ok: false, error: "Migration failed — check server logs." };
  }
}

export async function createAdminSetupAction(
  key: string,
  email: string,
  password: string
): Promise<SetupResult> {
  if (!checkKey(key)) {
    return { ok: false, error: "Not authorized." };
  }

  const normalizedEmail = email.toLowerCase().trim();

  if (!ADMIN_EMAILS.has(normalizedEmail)) {
    return { ok: false, error: "That email isn't one of the two reserved admin emails." };
  }

  if (!password || password.length < 8) {
    return { ok: false, error: "Password must be at least 8 characters." };
  }

  try {
    const sql = getSql();
    const passwordHash = await bcrypt.hash(password, 12);

    await sql`
      INSERT INTO users (email, password_hash, is_admin)
      VALUES (${normalizedEmail}, ${passwordHash}, true)
      ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, is_admin = true
    `;

    return { ok: true, message: `Admin account ready for ${normalizedEmail}.` };
  } catch (error) {
    console.error("Create admin failed", error);
    return { ok: false, error: "Failed to create admin — check server logs." };
  }
}
