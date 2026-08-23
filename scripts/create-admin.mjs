// Provisions one of the two reserved admin accounts directly in the
// database. This is deliberately NOT reachable through the public
// /sign-up form — those two emails are rejected there — so admin
// status can only ever be granted by someone with real database
// access running this script, never by self-signup.
import pg from "pg";
import bcrypt from "bcryptjs";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";

const ADMIN_EMAILS = new Set([
  "aw.andrewwang16@gmail.com",
  "joshua.p.jacobs98@gmail.com",
]);

const connectionString =
  process.env.POSTGRES_URL ??
  process.env.DATABASE_URL ??
  process.env.POSTGRES_URL_NON_POOLING;

if (!connectionString) {
  console.error(
    "No database connection string found. Run `vercel env pull .env.local` first, then run this script with those vars loaded (e.g. `node --env-file=.env.local scripts/create-admin.mjs`)."
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

const rl = createInterface({ input: stdin, output: stdout });

const emailInput = await rl.question("Admin email: ");
const email = emailInput.toLowerCase().trim();

if (!ADMIN_EMAILS.has(email)) {
  console.error(`"${email}" is not one of the two reserved admin emails. Refusing to proceed.`);
  rl.close();
  process.exit(1);
}

const password = await rl.question("Password to set (input is visible — run this in a private terminal): ");
rl.close();

if (!password || password.length < 8) {
  console.error("Password must be at least 8 characters.");
  process.exit(1);
}

async function main() {
  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      is_admin BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;

  const passwordHash = await bcrypt.hash(password, 12);

  await sql`
    INSERT INTO users (email, password_hash, is_admin)
    VALUES (${email}, ${passwordHash}, true)
    ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, is_admin = true
  `;

  console.log(`\nAdmin account ready for ${email}.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
