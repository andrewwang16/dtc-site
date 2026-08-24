import { Pool, types } from "pg";

// pg's default type parsers turn DATE (OID 1082) and TIMESTAMP/TIMESTAMPTZ
// (OID 1114 / 1184) columns into JS Date objects. The Neon driver this
// replaced returned them as plain strings, which is what the rest of the
// app (e.g. formatting article dates) assumes — return raw strings instead
// of switching every call site to handle both.
types.setTypeParser(1082, (value) => value);
types.setTypeParser(1114, (value) => value);
types.setTypeParser(1184, (value) => value);

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

  // Without this, a network hiccup on an idle pooled connection (common
  // in serverless, where containers freeze/thaw between invocations)
  // emits an unhandled 'error' event and crashes the whole function
  // instead of just that one query failing.
  pool.on("error", (error) => {
    console.error("Postgres pool error", error);
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
