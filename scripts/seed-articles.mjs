import pg from "pg";

const connectionString =
  process.env.POSTGRES_URL ??
  process.env.DATABASE_URL ??
  process.env.POSTGRES_URL_NON_POOLING;

if (!connectionString) {
  console.error(
    "No database connection string found. Run `vercel env pull .env.local` first, then run this script with those vars loaded (e.g. `node --env-file=.env.local scripts/seed-articles.mjs`)."
  );
  process.exit(1);
}

const pool = new pg.Pool({ connectionString, ssl: { rejectUnauthorized: false } });

async function sql(strings, ...values) {
  const text = strings.reduce(
    (acc, chunk, i) => acc + chunk + (i < values.length ? `$${i + 1}` : ""),
    ""
  );
  const result = await pool.query(text, values);
  return result.rows;
}

const KYLE_LEAHY_BODY = [
  "Kyle Leahy's path to the major leagues was never a straight line. Drafted out of college in 2018, the right-hander spent parts of five seasons working through the Cardinals' minor league system before making his MLB debut in July 2023. For a lot of relievers, that kind of timeline ends the story before it really starts. For Leahy, it was just the beginning.",
  "What stands out about Leahy's game isn't a single overpowering pitch — it's the way he's learned to sequence his arsenal to keep hitters off balance, mixing his fastball with secondary offerings to generate weak contact rather than relying purely on swing-and-miss stuff. That approach has made him a trustworthy option for a Cardinals bullpen that has leaned on him in a variety of situations, from mop-up innings to higher-leverage spots as the season has worn on.",
  "At 6-foot-5 and listed at 225 pounds, Leahy has the frame teams look for in a durable reliever, and durability has been part of his value proposition — he's shown he can handle a heavier workload without a steep drop-off in stuff deep into the summer. That kind of reliability is easy to overlook in a bullpen that also features higher-profile arms, but it's exactly the sort of thing that keeps a pitching staff functional over a 162-game season.",
  "The switch-hitting Leahy — a rarity for a pitcher, since the bat/throw split refers to his own hitting side, not something that comes into play on the mound — has also drawn praise from teammates and coaches for his makeup and preparation. Relievers who can handle uncertainty, warm up on short notice, and pitch on back-to-back days without complaint tend to earn a manager's trust, and that trust shows up in how often his name gets called.",
  "For a full breakdown of his 2026 season — innings pitched, ERA, strikeout and walk rates, and how his role has evolved month to month — the live numbers tell the rest of the story.",
];

async function main() {
  await sql`
    CREATE TABLE IF NOT EXISTS articles (
      id SERIAL PRIMARY KEY,
      slug TEXT UNIQUE NOT NULL,
      title TEXT NOT NULL,
      author TEXT NOT NULL,
      author_email TEXT NOT NULL,
      date DATE NOT NULL,
      image TEXT NOT NULL,
      excerpt TEXT NOT NULL,
      body JSONB NOT NULL,
      player_id INTEGER,
      player_name TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS articles_date_idx ON articles (date DESC)
  `;

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
    INSERT INTO articles (slug, title, author, author_email, date, image, excerpt, body, player_id, player_name)
    VALUES (
      'kyle-leahy-cardinals-bullpen-role',
      'Kyle Leahy Is Quietly Becoming a Cardinals Bullpen Fixture',
      'Claude',
      'nootnewspod@gmail.com',
      '2026-08-21',
      '/images/articletestimage.png',
      'The Boulder, Colorado native has taken a winding road to St. Louis, and this year he''s carved out a real role in the Cardinals'' relief corps.',
      ${JSON.stringify(body)}::jsonb,
      681517,
      'Kyle Leahy'
    )
    ON CONFLICT (slug) DO NOTHING
  `;

  console.log("Seed complete: articles table ready, Kyle Leahy article present.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
