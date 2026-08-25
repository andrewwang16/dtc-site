import { getSql } from "@/lib/db";

export type User = {
  email: string;
  passwordHash: string;
  isAdmin: boolean;
  isSubscriber: boolean;
};

type UserRow = {
  email: string;
  password_hash: string;
  is_admin: boolean;
  is_subscriber: boolean;
};

function rowToUser(row: UserRow): User {
  return {
    email: row.email,
    passwordHash: row.password_hash,
    isAdmin: row.is_admin,
    isSubscriber: row.is_subscriber,
  };
}

export async function getUserByEmail(email: string): Promise<User | undefined> {
  const sql = getSql();
  const rows = (await sql`
    SELECT email, password_hash, is_admin, is_subscriber
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
    RETURNING email, password_hash, is_admin, is_subscriber
  `) as UserRow[];

  return rowToUser(rows[0]);
}

export async function setSubscriberStatus(email: string, isSubscriber: boolean): Promise<boolean> {
  const sql = getSql();
  const normalizedEmail = email.toLowerCase().trim();

  const rows = (await sql`
    UPDATE users
    SET is_subscriber = ${isSubscriber}
    WHERE email = ${normalizedEmail}
    RETURNING email
  `) as Array<{ email: string }>;

  return rows.length > 0;
}
