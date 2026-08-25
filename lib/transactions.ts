import { CARDINALS_TEAM_ID } from "@/lib/mlb";

export type TransactionPlayer = {
  id: number;
  fullName: string;
};

export type Transaction = {
  id: number;
  date: string;
  typeDesc: string;
  description: string;
  people: TransactionPlayer[];
};

type RawTransaction = {
  id: number;
  date: string;
  typeDesc?: string;
  description?: string;
  person?: { id: number; fullName: string };
};

function toIsoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

export async function getSeasonTransactions(year: number): Promise<Transaction[]> {
  const today = new Date();
  const seasonEnd = year === today.getFullYear() ? today : new Date(year, 11, 31);

  try {
    const response = await fetch(
      `https://statsapi.mlb.com/api/v1/transactions?teamId=${CARDINALS_TEAM_ID}&startDate=${year}-01-01&endDate=${toIsoDate(seasonEnd)}`,
      { next: { revalidate: 1800 } }
    );

    if (!response.ok) {
      return [];
    }

    const data: { transactions?: RawTransaction[] } = await response.json();

    // Multi-player moves (trades especially) come back as one raw entry per
    // player, all sharing the same `id` and identical description text —
    // group them into a single transaction with everyone's name attached,
    // instead of showing the same description repeated once per player.
    const byId = new Map<number, Transaction>();

    for (const entry of data.transactions ?? []) {
      const existing = byId.get(entry.id);

      if (existing) {
        if (entry.person) {
          existing.people.push({ id: entry.person.id, fullName: entry.person.fullName });
        }
        continue;
      }

      byId.set(entry.id, {
        id: entry.id,
        date: entry.date,
        typeDesc: entry.typeDesc ?? "Transaction",
        description: entry.description ?? "",
        people: entry.person ? [{ id: entry.person.id, fullName: entry.person.fullName }] : [],
      });
    }

    const transactions = Array.from(byId.values());

    transactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return transactions;
  } catch (error) {
    console.error("getSeasonTransactions failed", error);
    return [];
  }
}
