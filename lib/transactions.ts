import { CARDINALS_TEAM_ID } from "@/lib/mlb";

export type Transaction = {
  id: number;
  date: string;
  typeDesc: string;
  description: string;
  personId?: number;
  personName?: string;
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

    const transactions: Transaction[] = (data.transactions ?? []).map((entry) => ({
      id: entry.id,
      date: entry.date,
      typeDesc: entry.typeDesc ?? "Transaction",
      description: entry.description ?? "",
      personId: entry.person?.id,
      personName: entry.person?.fullName,
    }));

    transactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return transactions;
  } catch (error) {
    console.error("getSeasonTransactions failed", error);
    return [];
  }
}
