// Rebuilds lib/contracts-data.json, the league-wide contract data behind the
// roster builder's payroll, from two public sources:
//
// - FanGraphs RosterResource payroll pages (one per team): guaranteed
//   contracts, club/mutual options, arbitration years, pre-arb free-agency
//   timing, and each club's "other payments" (dead money, cash owed in
//   trades, buyouts).
// - MLB Trade Rumors' arbitration salary projections article.
//
// Run with `node scripts/update-contracts.mjs`, then review the diff —
// both sources change through the offseason. The arbitration article URL
// changes every year (ARBITRATION_URL below).

import { writeFile } from "node:fs/promises";

const SEASON = 2027;
const ARBITRATION_URL = "https://www.mlbtraderumors.com/2026/10/projected-arbitration-salaries-for-2027.html";
const OUTPUT = new URL("../lib/contracts-data.json", import.meta.url);
const USER_AGENT = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127 Safari/537.36";

// FanGraphs RosterResource slug → MLB Stats API team id.
const TEAMS = {
  angels: 108, astros: 117, athletics: 133, "blue-jays": 141, braves: 144, brewers: 158,
  cardinals: 138, cubs: 112, diamondbacks: 109, dodgers: 119, giants: 137, guardians: 114,
  mariners: 136, marlins: 146, mets: 121, nationals: 120, orioles: 110, padres: 135,
  phillies: 143, pirates: 134, rangers: 140, rays: 139, "red-sox": 111, reds: 113,
  rockies: 115, royals: 118, tigers: 116, twins: 142, "white-sox": 145, yankees: 147,
};

// MLB Trade Rumors' team headings → MLB team id.
const MLBTR_TEAMS = {
  "Arizona Diamondbacks": 109, "Atlanta Braves": 144, "Baltimore Orioles": 110, "Boston Red Sox": 111,
  "Chicago Cubs": 112, "Chicago White Sox": 145, "Cincinnati Reds": 113, "Cleveland Guardians": 114,
  "Colorado Rockies": 115, "Detroit Tigers": 116, "Houston Astros": 117, "Kansas City Royals": 118,
  "Los Angeles Angels": 108, "Los Angeles Dodgers": 119, "Miami Marlins": 146, "Milwaukee Brewers": 158,
  "Minnesota Twins": 142, "New York Mets": 121, "New York Yankees": 147, Athletics: 133,
  "Oakland Athletics": 133, "Philadelphia Phillies": 143, "Pittsburgh Pirates": 134, "San Diego Padres": 135,
  "San Francisco Giants": 137, "Seattle Mariners": 136, "St. Louis Cardinals": 138, "Tampa Bay Rays": 139,
  "Texas Rangers": 140, "Toronto Blue Jays": 141, "Washington Nationals": 120,
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchText(url) {
  const response = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
  if (!response.ok) {
    throw new Error(`${response.status} fetching ${url}`);
  }
  return response.text();
}

function decodeEntities(text) {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&#8217;|&rsquo;/g, "'")
    .replace(/&#039;|&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));
}

function normalizeName(name) {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\b(jr|sr|ii|iii|iv)\b\.?/g, "")
    .replace(/[^a-z]/g, "");
}

// "$6M", "$112.5M", "$780K".
function money(amount) {
  if (Math.abs(amount) >= 1_000_000) {
    return `$${(amount / 1_000_000).toFixed(2).replace(/\.?0+$/, "")}M`;
  }
  return `$${Math.round(amount / 1_000)}K`;
}

function seasonRange(start, end) {
  return start === end ? String(start) : `${start}–${String(end).slice(2)}`;
}

async function loadFanGraphsTeam(slug) {
  const html = await fetchText(`https://www.fangraphs.com/roster-resource/payroll/${slug}`);
  const match = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (!match) {
    throw new Error(`No page data for ${slug}`);
  }
  const query = JSON.parse(match[1]).props.pageProps.dehydratedState.queries.find((entry) =>
    String(entry.queryKey?.[0]).startsWith("roster-resource/payroll")
  );
  return query.state.data;
}

// MLB Trade Rumors lists projections under a heading per team:
// <li><strong><a>Name</a></strong> (4.150): $4.2MM</li>
async function loadArbitrationProjections() {
  const html = await fetchText(ARBITRATION_URL);
  const body = html.slice(html.indexOf("entry-content"));
  const projections = [];
  let teamId = null;

  const tokens = body.matchAll(
    /<span[^>]*>([^<]+?) \(\d+\)<\/span>|<li><strong>(?:<a[^>]*>)?([^<]+?)(?:<\/a>)?<\/strong>\s*\(([\d.]+)\):\s*\$([\d.]+)(MM|K)([^<]*)<\/li>/g
  );

  for (const token of tokens) {
    if (token[1]) {
      teamId = MLBTR_TEAMS[decodeEntities(token[1]).trim()] ?? null;
      continue;
    }
    if (teamId === null) {
      continue;
    }
    const amount = Number(token[4]) * (token[5] === "MM" ? 1_000_000 : 1_000);
    projections.push({
      name: decodeEntities(token[2]).trim(),
      teamId,
      serviceTime: token[3],
      salary: Math.round(amount),
      note: decodeEntities(token[6]).trim().replace(/^\(|\)$/g, "") || undefined,
    });
  }

  return projections;
}

const TYPE_PRIORITY = ["GUARANTEED", "CLUB OPTION", "MUTUAL OPTION", "ARB", "PRE-ARB"];

function typeRank(type) {
  const upper = type.toUpperCase();
  const index = TYPE_PRIORITY.findIndex((prefix) => upper.startsWith(prefix));
  return index === -1 ? Infinity : index;
}

// Last season before the first free-agent row, across every contract entry
// FanGraphs has for the player.
function freeAgentAfter(years) {
  const firstFreeAgent = years
    .filter((year) => year.Type.toUpperCase().startsWith("FREE AGENT"))
    .reduce((min, year) => Math.min(min, year.Season), Infinity);
  return Number.isFinite(firstFreeAgent) ? firstFreeAgent - 1 : undefined;
}

// For arbitration players FanGraphs doesn't list (often players outside a
// 40-man): find the MLB id by name, keeping only someone in that club's
// organization so common names resolve to the right player.
async function findPlayerId(name, teamId) {
  const response = await fetch(
    `https://statsapi.mlb.com/api/v1/people/search?names=${encodeURIComponent(name)}&hydrate=currentTeam`
  );
  if (!response.ok) {
    return null;
  }
  const { people = [] } = await response.json();
  const matches = people.filter(
    (person) => person.currentTeam?.id === teamId || person.currentTeam?.parentOrgId === teamId
  );
  return matches.length === 1 ? matches[0].id : null;
}

// FanGraphs describes deferrals in a free-text note. Phrasings that pin
// down how much of SEASON's salary is deferred are read into a number:
// "$68 million deferred annually", "$7.75M each year is deferred",
// "$5.25M of each guaranteed year's salary is deferred", "$10M each from
// 2027-29", "$3M from 2027". Anything else is kept as the note only.
function deferralFrom(summary) {
  const note = [summary.LongContractSummaryPayrollNote, summary.ContractSummaryPayrollNote].find((text) =>
    /defer/i.test(text ?? "")
  );
  if (!note) {
    return {};
  }

  const amount = (text) => Math.round(Number(text) * 1_000_000);
  const M = String.raw`\$([\d.]+)\s*(?:million|MM|M)`;
  let perSeason = null;

  const everyYear = [
    new RegExp(`${M}\\s+(?:is\\s+)?deferred\\s+(?:annually|each year|per year|per season)`, "i"),
    new RegExp(`${M}\\s+(?:each year|annually)\\s+is\\s+deferred`, "i"),
    new RegExp(`${M}\\s+of each (?:guaranteed )?year'?s salary is deferred`, "i"),
  ];
  for (const pattern of everyYear) {
    const match = note.match(pattern);
    if (match) {
      perSeason = amount(match[1]);
      break;
    }
  }

  if (perSeason === null) {
    for (const match of note.matchAll(new RegExp(`${M}\\s+each\\s+from\\s+(\\d{4})[-–](\\d{2,4})`, "gi"))) {
      const start = Number(match[2]);
      const end = Number(match[3].length === 2 ? String(start).slice(0, 2) + match[3] : match[3]);
      if (SEASON >= start && SEASON <= end) {
        perSeason = amount(match[1]);
      }
    }
  }

  if (perSeason === null) {
    const exact = note.match(new RegExp(`${M}\\s+from\\s+${SEASON}\\b`, "i"));
    if (exact) {
      perSeason = amount(exact[1]);
    }
  }

  return { deferralNote: decodeEntities(note).trim(), ...(perSeason ? { deferredPerSeason: perSeason } : {}) };
}

function buildContract(summary, years, allYears, arbitration) {
  const current = years.find((year) => year.Season === SEASON);
  const type = current.Type.toUpperCase();
  const faAfter = freeAgentAfter(allYears);

  if (type.startsWith("GUARANTEED")) {
    const guaranteed = years.filter((year) => year.Season >= SEASON && year.Type.toUpperCase().startsWith("GUARANTEED"));
    const salaryBySeason = Object.fromEntries(guaranteed.map((year) => [year.Season, Math.round(year.Salary)]));
    const lastGuaranteed = Math.max(...guaranteed.map((year) => year.Season));
    const options = years.filter((year) => year.Season > lastGuaranteed && /OPTION/i.test(year.Type));
    const optionNote = options.length
      ? ` · ${/MUTUAL/i.test(options[0].Type) ? "mutual" : "club"} option ${seasonRange(options[0].Season, options[options.length - 1].Season)}`
      : "";

    const deferral = deferralFrom(summary);
    // Luxury-tax hit: the deal's AAV, with deferred money at present value.
    const cbt = current.TotalCBTHit ? Math.round(current.TotalCBTHit) : null;

    return {
      status: "guaranteed",
      salary: Math.round(current.Salary),
      detail: `${summary.YearsTotal} yr / ${money(summary.ContractTotal)} (${seasonRange(summary.startSeason, summary.endSeason)})${optionNote}`,
      freeAgentAfter: lastGuaranteed,
      salaryBySeason,
      ...(cbt !== null && Math.abs(cbt - current.Salary) >= 1 ? { cbt } : {}),
      ...(deferral.deferralNote ? { deferralNote: deferral.deferralNote } : {}),
      ...(deferral.deferredPerSeason ? { deferred: Math.min(deferral.deferredPerSeason, Math.round(current.Salary)) } : {}),
    };
  }

  if (type.includes("OPTION")) {
    if (!current.Salary) {
      return null;
    }
    const mutual = type.startsWith("MUTUAL");
    const buyout = current.OptionBuyout ?? (summary.TotalPotentialBuyout || null);
    return {
      status: mutual ? "mutual-option" : "club-option",
      salary: Math.round(current.Salary),
      detail: `${money(current.Salary)} ${mutual ? "mutual" : "club"} option${buyout ? `, ${money(buyout)} buyout` : ""}`,
      freeAgentAfter: SEASON,
      ...(buyout ? { buyout: Math.round(buyout) } : {}),
    };
  }

  if (type.startsWith("ARB")) {
    if (!arbitration) {
      return null;
    }
    return {
      status: "arbitration",
      salary: arbitration.salary,
      // Two-plus years of service in arbitration means Super Two.
      detail: `${current.Type.replace("ARB", "Arb")}${arbitration.serviceTime.startsWith("2.") ? " (Super Two)" : ""} · MLBTR projection${arbitration.note ? ` (${arbitration.note})` : ""}`,
      freeAgentAfter: faAfter,
    };
  }

  return null;
}

async function main() {
  const arbitration = await loadArbitrationProjections();
  console.log(`MLB Trade Rumors: ${arbitration.length} arbitration projections`);

  const contracts = {};
  const preArbFreeAgentAfter = {};
  // Pre-arb players' salaries for the season before SEASON. Clubs pay
  // pre-arb players a bit over the minimum, so the prior salary is a better
  // floor for SEASON than the minimum alone.
  const preArbPriorSalary = {};
  // Players whose contracts are up: FanGraphs' only SEASON row for them is
  // a free-agent one (no deal, option, or arbitration year).
  const freeAgents = new Set();
  const otherPayments = {};
  const taxAdjustments = {};
  let playerBenefits = null;
  const fanGraphsArbIds = new Map();
  const unmatchedArb = [];

  const teamData = {};
  for (const [slug, teamId] of Object.entries(TEAMS)) {
    teamData[teamId] = await loadFanGraphsTeam(slug);
    process.stdout.write(".");
    await sleep(600);
  }
  console.log();

  const projectionsByTeam = new Map();
  for (const projection of arbitration) {
    const key = `${projection.teamId}:${normalizeName(projection.name)}`;
    projectionsByTeam.set(key, projection);
  }
  const matchedProjections = new Set();

  for (const [teamIdText, data] of Object.entries(teamData)) {
    const teamId = Number(teamIdText);

    // A player can have several entries (a pre-arb year plus an extension);
    // group them so the one covering SEASON wins.
    const byPlayer = new Map();
    for (const entry of data.dataContract ?? []) {
      const id = entry.contractSummary.MLBAMID;
      if (!id) {
        continue;
      }
      byPlayer.set(id, [...(byPlayer.get(id) ?? []), entry]);
    }

    for (const [id, entries] of byPlayer) {
      const allYears = entries.flatMap((entry) => entry.contractYears);
      const candidates = entries
        .map((entry) => ({ entry, current: entry.contractYears.find((year) => year.Season === SEASON) }))
        .filter(({ current }) => current)
        .sort((a, b) => typeRank(a.current.Type) - typeRank(b.current.Type));
      const best = candidates[0];

      if (!best) {
        continue;
      }

      if (best.current.Type.toUpperCase().startsWith("FREE AGENT")) {
        freeAgents.add(id);
        continue;
      }

      const type = best.current.Type.toUpperCase();
      const name = best.entry.contractSummary.playerName;

      if (type.startsWith("PRE-ARB")) {
        const faYear = freeAgentAfter(allYears);
        if (faYear) {
          preArbFreeAgentAfter[id] = faYear;
        }
        const prior = allYears.find((year) => year.Season === SEASON - 1 && year.Salary > 0);
        if (prior) {
          preArbPriorSalary[id] = Math.round(prior.Salary);
        }
        continue;
      }

      let projection;
      if (type.startsWith("ARB")) {
        projection = projectionsByTeam.get(`${teamId}:${normalizeName(name)}`);
        if (projection) {
          matchedProjections.add(projection);
        } else {
          fanGraphsArbIds.set(normalizeName(name), { id, teamId, allYears, entry: best.entry, current: best.current });
          continue;
        }
      }

      const contract = buildContract(best.entry.contractSummary, best.entry.contractYears, allYears, projection);
      if (contract) {
        // Only used below to recognize option players MLBTR also projects.
        contract.matchName = normalizeName(name);
        contracts[id] = contract;
      }
    }

    const payments = (data.dataOtherPayments ?? [])
      .filter((payment) => payment.Season >= SEASON && payment.PaymentAmount)
      .map((payment) => ({
        season: payment.Season,
        amount: Math.round(payment.PaymentAmount),
        description: decodeEntities(payment.PaymentDescription ?? "").replace(/^\$ /, ""),
      }));
    if (payments.length) {
      otherPayments[teamId] = payments;
    }

    // Luxury-tax-only entries: e.g. AAV credits and debits when cash
    // changed hands in a trade.
    const adjustments = (data.dataOtherPaymentsLuxuryTax ?? [])
      .filter((payment) => payment.Season === SEASON && payment.PaymentAmount)
      .map((payment) => ({
        amount: Math.round(payment.PaymentAmount),
        description: decodeEntities(payment.PaymentDescription ?? ""),
      }));
    if (adjustments.length) {
      taxAdjustments[teamId] = adjustments;
    }

    // FanGraphs' league-wide estimate of player benefits, which count
    // toward every club's luxury-tax payroll.
    const overall = (data.dataOverall ?? []).find((row) => row.Season === SEASON);
    if (overall?.estPlayerBenefits) {
      playerBenefits = Math.round(overall.estPlayerBenefits);
    }
  }

  // Projections that didn't match by team — usually a player FanGraphs has
  // moved since the article — fall back to a league-wide name match.
  for (const projection of arbitration) {
    if (matchedProjections.has(projection)) {
      continue;
    }
    const fallback = fanGraphsArbIds.get(normalizeName(projection.name));
    if (fallback) {
      const contract = buildContract(fallback.entry.contractSummary, fallback.entry.contractYears, fallback.allYears, projection);
      if (contract) {
        contracts[fallback.id] = contract;
        matchedProjections.add(projection);
        continue;
      }
    }
    // Already listed with an option for SEASON (MLBTR projects those too).
    const listed = Object.entries(contracts).some(
      ([, contract]) => contract.status.endsWith("option") && contract.matchName === normalizeName(projection.name)
    );
    if (listed) {
      continue;
    }
    const id = await findPlayerId(projection.name, projection.teamId);
    if (id && !contracts[id]) {
      contracts[id] = {
        status: "arbitration",
        salary: projection.salary,
        detail: `Arb · MLBTR projection${projection.note ? ` (${projection.note})` : ""}`,
      };
      continue;
    }
    unmatchedArb.push(`${projection.name} (${projection.teamId})`);
  }

  for (const contract of Object.values(contracts)) {
    delete contract.matchName;
  }

  const output = {
    season: SEASON,
    updated: new Date().toISOString().slice(0, 10),
    contracts,
    preArbFreeAgentAfter,
    preArbPriorSalary,
    otherPayments,
    taxAdjustments,
    playerBenefits,
    // Drop anyone a later entry signed (e.g. an arbitration projection
    // matched by name).
    freeAgents: [...freeAgents].filter((id) => !contracts[id]).sort((a, b) => a - b),
  };
  await writeFile(OUTPUT, `${JSON.stringify(output)}\n`);

  console.log(`Wrote ${Object.keys(contracts).length} contracts, ${Object.keys(preArbFreeAgentAfter).length} pre-arb FA years, other payments for ${Object.keys(otherPayments).length} teams`);
  console.log(`Arbitration: ${unmatchedArb.length} of ${arbitration.length} projections unmatched`);
  console.log(`Impending free agents (FanGraphs): ${output.freeAgents.length}`);
  console.log(`Pre-arb ${SEASON - 1} salaries: ${Object.keys(preArbPriorSalary).length}`);
  const deferrals = Object.entries(contracts).filter(([, contract]) => contract.deferralNote);
  console.log(`Deferrals: ${deferrals.length} contracts with notes, ${deferrals.filter(([, c]) => c.deferred).length} with a per-season amount`);
  if (unmatchedArb.length) {
    console.log(`  Unmatched: ${unmatchedArb.join(", ")}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
