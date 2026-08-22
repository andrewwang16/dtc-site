import { getSql } from "@/lib/db";

export type User = {
  email: string;
  passwordHash: string;
  isAdmin: boolean;
};

type UserRow = {
  email: string;
  password_hash: string;
  is_admin: boolean;
};

function rowToUser(row: UserRow): User {
  return {
    email: row.email,
    passwordHash: row.password_hash,
    isAdmin: row.is_admin,
  };
}

export async function getUserByEmail(email: string): Promise<User | undefined> {
  const sql = getSql();
  const rows = (await sql`
    SELECT email, password_hash, is_admin
    FROM users
    WHERE email = ${email.toLowerCase().trim()}
    LIMIT 1
  `) as UserRow[];

  return rows[0] ? rowToUser(rows[0]) : undefined;
}

export async function createViewerAccount(email: string, passwordHash: string): Promise<User> {
  const sql = getSql();
  const normalizedEmail = email.toLowerCase().trim();

  const rows = (await sql`
    INSERT INTO users (email, password_hash, is_admin)
    VALUES (${normalizedEmail}, ${passwordHash}, false)
    RETURNING email, password_hash, is_admin
  `) as UserRow[];

  return rowToUser(rows[0]);
}
