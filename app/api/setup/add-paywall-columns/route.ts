import { getSql } from "@/lib/db";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const key = searchParams.get("key");

  if (!key || key !== process.env.SETUP_SECRET) {
    return new Response("Not authorized", { status: 401 });
  }

  try {
    const sql = getSql();
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_subscriber BOOLEAN NOT NULL DEFAULT false`;
    await sql`ALTER TABLE articles ADD COLUMN IF NOT EXISTS is_premium BOOLEAN NOT NULL DEFAULT true`;
    return Response.json({ ok: true });
  } catch (error) {
    console.error("Add paywall columns failed", error);
    return new Response("Migration failed", { status: 500 });
  }
}
