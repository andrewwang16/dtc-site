import { NextRequest, NextResponse } from "next/server";
import { getSql } from "@/lib/db";

export async function GET(request: NextRequest) {
  const key = request.nextUrl.searchParams.get("key");

  if (!key || key !== process.env.SETUP_SECRET) {
    return NextResponse.json({ ok: false, error: "Not authorized." }, { status: 401 });
  }

  try {
    const sql = getSql();
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS display_name TEXT`;

    return NextResponse.json({ ok: true, message: "Added users.display_name." });
  } catch (error) {
    console.error("Add display name column failed", error);
    return NextResponse.json({ ok: false, error: "Migration failed." }, { status: 500 });
  }
}
