import { Pool } from "pg";

let pool: Pool | null = null;

function getPool(): Pool {
  if (pool) {
    return pool;
  }

  const connectionString =
    process.env.POSTGRES_URL ??
    process.env.DATABASE_URL ??
    process.env.POSTGRES_URL_NON_POOLING;

  if (!connectionString) {
    throw new Error(
      "No database connection string found. Set POSTGRES_URL (or DATABASE_URL) in your environment."
    );
  }

  pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false },
    max: 5,
  });

  return pool;
}

/**
 * Tagged-template query helper, e.g. `sql\`SELECT * FROM t WHERE id = ${id}\``.
 * Kept as a tagged template (rather than switching every call site to
 * pool.query(text, params)) so lib/articles.ts and lib/users.ts didn't
 * need to change when the underlying driver did.
 */
export async function sql<T = Record<string, unknown>>(
  strings: TemplateStringsArray,
  ...values: unknown[]
): Promise<T[]> {
  const text = strings.reduce(
    (acc, chunk, i) => acc + chunk + (i < values.length ? `$${i + 1}` : ""),
    ""
  );

  const result = await getPool().query(text, values);

  return result.rows as T[];
}

export function getSql() {
  return sql;
}
