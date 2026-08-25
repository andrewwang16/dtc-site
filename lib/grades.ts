const GRADES_CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vQMyQUVKkgDbPKBzYhN-tetk46-uiziLPsSEN0UC08lwP5XFFSnPbryv3r7XkDD2vhd0fWXEtX9jCCA/pub?output=csv";

export type MonthlyGrade = {
  month: string;
  grade: string | null;
  link: string | null;
};

type GradesSheet = {
  months: Array<{ month: string; link: string | null; grades: Map<string, string> }>;
};

function normalizeName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z\s]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

// Minimal CSV parser: handles quoted fields (commas/quotes inside quotes)
// and both \n and \r\n line endings, since Google Sheets' CSV export can
// use either depending on platform.
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows.filter((cells) => cells.some((cell) => cell.trim() !== ""));
}

async function fetchGradesSheet(): Promise<GradesSheet | null> {
  try {
    const response = await fetch(GRADES_CSV_URL, { next: { revalidate: 3600 } });

    if (!response.ok) {
      return null;
    }

    const text = (await response.text()).replace(/^﻿/, "");
    const rows = parseCsv(text);

    if (rows.length < 2) {
      return null;
    }

    const [header, ...dataRows] = rows;
    const playerColumns = header.slice(2).map((name) => name.trim());

    const months = dataRows.map((row) => {
      const grades = new Map<string, string>();

      playerColumns.forEach((name, index) => {
        const value = row[index + 2]?.trim();

        if (value) {
          grades.set(normalizeName(name), value);
        }
      });

      return {
        month: row[0]?.trim() ?? "",
        link: row[1]?.trim() || null,
        grades,
      };
    });

    return { months };
  } catch (error) {
    console.error("fetchGradesSheet failed", error);
    return null;
  }
}

export async function getPlayerGrades(fullName: string): Promise<MonthlyGrade[]> {
  const sheet = await fetchGradesSheet();

  if (!sheet) {
    return [];
  }

  const key = normalizeName(fullName);
  const isTracked = sheet.months.some((month) => month.grades.has(key));

  if (!isTracked) {
    return [];
  }

  return sheet.months.map((month) => {
    const raw = month.grades.get(key);
    const grade = raw && raw.toUpperCase() !== "N/A" ? raw : null;

    return { month: month.month, grade, link: month.link };
  });
}
