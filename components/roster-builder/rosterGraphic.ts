import { playerHeadshotUrl, teamLogoUrl } from "@/lib/mlb";

// A shareable PNG of the built roster: three columns — the lineup, the
// rotation and bench, and the bullpen — with portrait headshots, and the
// session's transactions in small print underneath. Drawn straight onto a
// canvas; the MLB image CDNs send CORS headers, so photos don't taint it.

export type GraphicPlayer = {
  id: number;
  name: string;
  // Batting side or throwing hand, shown after the name: "(L)".
  hand?: string;
};

export type GraphicRow = {
  badge?: string;
  player: GraphicPlayer | null;
  // Right-aligned: the slot or position ("CF", "RHP").
  tag?: string;
};

export type GraphicSection = { title: string; rows: GraphicRow[] };

export type GraphicTransaction = { label: string; color: string; summary: string; detail?: string };

// The club's colors (see lib/teams.ts): `primary` behind the header and
// numbers, `accent` for the stripe, `highlight` for titles and positions.
export type GraphicTeam = { id: number; name: string; primary: string; accent: string; highlight: string };

export type RosterGraphicData = {
  season: number;
  team: GraphicTeam;
  // Left to right; each column stacks its sections.
  columns: GraphicSection[][];
  stats: { label: string; value: string }[];
  transactions: GraphicTransaction[];
};

const SCALE = 2;
const WIDTH = 1500;
const PAD = 48;
const COLUMN_GAP = 24;
const HEADER_HEIGHT = 200;
const SECTION_HEAD = 50;
const ROW_HEIGHT = 74;
const ROW_GAP = 8;
const SECTION_GAP = 26;
// MLB headshots are 2:3 portraits; drawing them at that shape shows the
// whole face instead of cropping it into a circle.
const PHOTO_HEIGHT = 62;
const PHOTO_WIDTH = Math.round((PHOTO_HEIGHT * 2) / 3);
const BADGE_WIDTH = 30;
const MAX_TRANSACTIONS = 24;

const COLORS = {
  bg: "#f7f4ee",
  panel: "#ffffff",
  line: "#dcd3c0",
  text: "#17181c",
  muted: "#5a5c63",
  photoBg: "#e8e2d4",
};

const DISPLAY_FONT = `"Anton", Impact, sans-serif`;
const BODY_FONT = `"Roboto Condensed", "Helvetica Neue", Helvetica, Arial, sans-serif`;

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image.naturalWidth > 0 ? image : null);
    image.onerror = () => resolve(null);
    image.src = src;
  });
}

// Same fallback as PlayerHeadshot: the "67" cut, then the minor league cut.
// Created players (negative ids) have no photo.
async function loadHeadshot(playerId: number) {
  if (playerId < 0) {
    return null;
  }
  const src = playerHeadshotUrl(playerId, 120);
  return (await loadImage(src)) ?? (await loadImage(src.replace("/headshot/67/", "/headshot/milb/")));
}

function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

// A portrait photo in a rounded rectangle, scaled to cover it (the photo's
// own 2:3 shape, so nothing of the face is cut off).
function drawHeadshot(
  ctx: CanvasRenderingContext2D,
  team: GraphicTeam,
  image: HTMLImageElement | null,
  name: string,
  x: number,
  y: number
) {
  ctx.save();
  roundedRect(ctx, x, y, PHOTO_WIDTH, PHOTO_HEIGHT, 8);
  ctx.fillStyle = image ? COLORS.photoBg : team.primary;
  ctx.fill();
  ctx.clip();

  if (image) {
    const scale = Math.max(PHOTO_WIDTH / image.naturalWidth, PHOTO_HEIGHT / image.naturalHeight);
    const w = image.naturalWidth * scale;
    const h = image.naturalHeight * scale;
    ctx.drawImage(image, x + (PHOTO_WIDTH - w) / 2, y, w, h);
  } else {
    ctx.fillStyle = "#ffffff";
    ctx.font = `800 17px ${BODY_FONT}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(initials(name), x + PHOTO_WIDTH / 2, y + PHOTO_HEIGHT / 2 + 1);
  }
  ctx.restore();
}

// Shrinks text until it fits, then truncates with an ellipsis as a last resort.
function fitText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, weight: number, size: number, minSize: number) {
  let fontSize = size;
  ctx.font = `${weight} ${fontSize}px ${BODY_FONT}`;
  while (ctx.measureText(text).width > maxWidth && fontSize > minSize) {
    fontSize -= 1;
    ctx.font = `${weight} ${fontSize}px ${BODY_FONT}`;
  }
  let fitted = text;
  while (ctx.measureText(fitted).width > maxWidth && fitted.length > 1) {
    fitted = fitted.slice(0, -2) + "…";
  }
  return fitted;
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, firstLineIndent: number) {
  const words = text.split(" ");
  const lines: string[] = [];
  let line = "";

  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    const available = lines.length === 0 ? maxWidth - firstLineIndent : maxWidth;
    if (line && ctx.measureText(candidate).width > available) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) {
    lines.push(line);
  }
  return lines;
}

function sectionHeight(section: GraphicSection) {
  return SECTION_HEAD + section.rows.length * (ROW_HEIGHT + ROW_GAP) - ROW_GAP;
}

function columnHeight(sections: GraphicSection[]) {
  return sections.reduce((sum, section) => sum + sectionHeight(section), 0) + SECTION_GAP * Math.max(0, sections.length - 1);
}

function drawColumn(
  ctx: CanvasRenderingContext2D,
  sections: GraphicSection[],
  x: number,
  width: number,
  top: number,
  headshots: Map<number, HTMLImageElement | null>,
  team: GraphicTeam
) {
  let y = top;

  for (const section of sections) {
    const title = section.title.toUpperCase();
    ctx.fillStyle = team.highlight;
    ctx.font = `28px ${DISPLAY_FONT}`;
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.fillText(title, x, y + 30);
    const titleWidth = ctx.measureText(title).width;
    ctx.fillStyle = COLORS.line;
    ctx.fillRect(x + titleWidth + 12, y + 19, width - titleWidth - 12, 2);
    y += SECTION_HEAD;

    // Room for numbers/roles only in sections that use them (the bullpen's
    // SU/CL, the lineup's batting order), so other rows start right at the
    // photo.
    const hasBadges = section.rows.some((row) => row.badge);

    for (const row of section.rows) {
      roundedRect(ctx, x, y, width, ROW_HEIGHT, 12);
      if (row.player) {
        ctx.fillStyle = COLORS.panel;
        ctx.fill();
      }
      ctx.strokeStyle = COLORS.line;
      ctx.lineWidth = 1.5;
      ctx.setLineDash(row.player ? [] : [6, 5]);
      ctx.stroke();
      ctx.setLineDash([]);

      const midY = y + ROW_HEIGHT / 2;
      let cursor = x + 10;

      if (hasBadges) {
        if (row.badge) {
          ctx.fillStyle = team.primary;
          ctx.font = `${row.badge.length > 1 ? 21 : 25}px ${DISPLAY_FONT}`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(row.badge, cursor + BADGE_WIDTH / 2, midY + 1);
        }
        cursor += BADGE_WIDTH + 4;
      }

      let tagWidth = 0;
      if (row.tag) {
        ctx.font = `800 17px ${BODY_FONT}`;
        tagWidth = ctx.measureText(row.tag).width;
        ctx.fillStyle = row.player ? team.highlight : COLORS.muted;
        ctx.textAlign = "right";
        ctx.textBaseline = "middle";
        ctx.fillText(row.tag, x + width - 14, midY + 1);
      }
      const nameLimit = x + width - 14 - (tagWidth ? tagWidth + 12 : 0);

      if (row.player) {
        drawHeadshot(ctx, team, headshots.get(row.player.id) ?? null, row.player.name, cursor, y + (ROW_HEIGHT - PHOTO_HEIGHT) / 2);
        cursor += PHOTO_WIDTH + 12;

        const handText = row.player.hand ? ` (${row.player.hand})` : "";
        ctx.font = `500 16px ${BODY_FONT}`;
        const handWidth = handText ? ctx.measureText(handText).width : 0;
        const name = fitText(ctx, row.player.name, nameLimit - cursor - handWidth, 800, 22, 15);
        ctx.fillStyle = COLORS.text;
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        ctx.fillText(name, cursor, midY + 1);

        if (handText) {
          const nameWidth = ctx.measureText(name).width;
          ctx.fillStyle = COLORS.muted;
          ctx.font = `500 16px ${BODY_FONT}`;
          ctx.fillText(handText, cursor + nameWidth, midY + 1);
        }
      } else {
        ctx.fillStyle = COLORS.muted;
        ctx.font = `500 16px ${BODY_FONT}`;
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        ctx.fillText("Open spot", cursor, midY + 1);
      }

      y += ROW_HEIGHT + ROW_GAP;
    }

    y += SECTION_GAP - ROW_GAP;
  }
}

export async function renderRosterGraphic(data: RosterGraphicData): Promise<Blob> {
  // Canvas text only uses web fonts that have already loaded.
  await Promise.all([
    document.fonts.load(`30px "Anton"`),
    document.fonts.load(`800 22px "Roboto Condensed"`),
    document.fonts.load(`500 16px "Roboto Condensed"`),
  ]).catch(() => undefined);

  const playerIds = [...new Set(
    data.columns.flat().flatMap((section) => section.rows.flatMap((row) => (row.player ? [row.player.id] : [])))
  )];
  const [siteLogo, teamLogo, ...photos] = await Promise.all([
    loadImage("/images/logo.png"),
    loadImage(teamLogoUrl(data.team.id).replace("team-cap-on-light", "team-cap-on-dark")),
    ...playerIds.map(loadHeadshot),
  ]);
  const headshots = new Map(playerIds.map((id, index) => [id, photos[index]]));

  const columnCount = Math.max(1, data.columns.length);
  const columnWidth = (WIDTH - PAD * 2 - COLUMN_GAP * (columnCount - 1)) / columnCount;

  // Transactions in small print, two to a row, oldest first. Lay them out
  // first so the canvas can be sized to fit.
  const measure = document.createElement("canvas").getContext("2d")!;
  const LABEL_FONT = `800 11px ${BODY_FONT}`;
  const ENTRY_FONT = `500 13px ${BODY_FONT}`;
  const LINE_HEIGHT = 17;
  const ENTRY_GAP = 6;
  const entryColumns = 2;
  const entryWidth = (WIDTH - PAD * 2 - COLUMN_GAP * (entryColumns - 1)) / entryColumns;
  const chronological = [...data.transactions].reverse();
  const shown = chronological.slice(0, MAX_TRANSACTIONS);
  const entries = shown.map((transaction) => {
    measure.font = LABEL_FONT;
    const labelWidth = measure.measureText(transaction.label.toUpperCase()).width + 8;
    measure.font = ENTRY_FONT;
    const text = transaction.detail ? `${transaction.summary} — ${transaction.detail}` : transaction.summary;
    return { transaction, labelWidth, lines: wrapText(measure, text, entryWidth, labelWidth) };
  });
  // Fill the left column first, then the right, keeping them about even.
  const half = Math.ceil(entries.length / entryColumns);
  const entryGroups = [entries.slice(0, half), entries.slice(half)];
  const groupHeight = (group: typeof entries) =>
    group.reduce((sum, entry) => sum + entry.lines.length * LINE_HEIGHT + ENTRY_GAP, 0);
  const hiddenCount = chronological.length - shown.length;
  const transactionsHeight =
    entries.length === 0
      ? 0
      : 46 + Math.max(...entryGroups.map(groupHeight)) + (hiddenCount > 0 ? LINE_HEIGHT : 0) + 10;

  const bodyTop = HEADER_HEIGHT + 44;
  const bodyHeight = Math.max(...data.columns.map(columnHeight));
  const footerHeight = 56;
  const height = bodyTop + bodyHeight + 30 + transactionsHeight + footerHeight;

  const canvas = document.createElement("canvas");
  canvas.width = WIDTH * SCALE;
  canvas.height = height * SCALE;
  const ctx = canvas.getContext("2d")!;
  ctx.scale(SCALE, SCALE);

  ctx.fillStyle = COLORS.bg;
  ctx.fillRect(0, 0, WIDTH, height);

  // Header band.
  ctx.fillStyle = data.team.primary;
  ctx.fillRect(0, 0, WIDTH, HEADER_HEIGHT);
  ctx.fillStyle = data.team.accent;
  ctx.fillRect(0, HEADER_HEIGHT - 10, WIDTH, 10);

  let titleX = PAD;
  if (teamLogo) {
    ctx.drawImage(teamLogo, PAD, 40, 112, 112);
    titleX += 136;
  }

  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.font = `800 22px ${BODY_FONT}`;
  ctx.fillStyle = "rgba(255,255,255,0.75)";
  ctx.fillText(`${data.season} ${data.team.name.toUpperCase()}`, titleX, 76);
  ctx.fillStyle = "#ffffff";
  ctx.font = `64px ${DISPLAY_FONT}`;
  ctx.fillText("PROJECTED ROSTER", titleX, 144);

  if (siteLogo) {
    ctx.drawImage(siteLogo, WIDTH - PAD - 116, 34, 116, 116);
  }

  // Quick stats strip under the header.
  let statX = PAD;
  for (const stat of data.stats) {
    ctx.font = `800 14px ${BODY_FONT}`;
    ctx.fillStyle = COLORS.muted;
    ctx.textAlign = "left";
    const label = stat.label.toUpperCase();
    ctx.fillText(label, statX, HEADER_HEIGHT + 30);
    const labelWidth = ctx.measureText(label).width;
    ctx.font = `800 20px ${BODY_FONT}`;
    ctx.fillStyle = COLORS.text;
    ctx.fillText(stat.value, statX + labelWidth + 8, HEADER_HEIGHT + 31);
    statX += labelWidth + ctx.measureText(stat.value).width + 40;
  }

  data.columns.forEach((sections, index) => {
    drawColumn(ctx, sections, PAD + index * (columnWidth + COLUMN_GAP), columnWidth, bodyTop, headshots, data.team);
  });

  // Transactions.
  let y = bodyTop + bodyHeight + 30;
  if (entries.length > 0) {
    roundedRect(ctx, PAD - 16, y, WIDTH - (PAD - 16) * 2, transactionsHeight - 10, 14);
    ctx.fillStyle = COLORS.panel;
    ctx.fill();
    ctx.strokeStyle = COLORS.line;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = data.team.primary;
    ctx.font = `18px ${DISPLAY_FONT}`;
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.fillText("TRANSACTIONS", PAD, y + 30);
    const top = y + 50;

    entryGroups.forEach((group, groupIndex) => {
      const x = PAD + groupIndex * (entryWidth + COLUMN_GAP);
      let entryY = top;
      for (const { transaction, labelWidth, lines } of group) {
        ctx.font = LABEL_FONT;
        ctx.fillStyle = transaction.color;
        ctx.fillText(transaction.label.toUpperCase(), x, entryY);
        ctx.font = ENTRY_FONT;
        ctx.fillStyle = COLORS.text;
        lines.forEach((line, index) => {
          ctx.fillText(line, index === 0 ? x + labelWidth : x, entryY + index * LINE_HEIGHT);
        });
        entryY += lines.length * LINE_HEIGHT + ENTRY_GAP;
      }
    });

    if (hiddenCount > 0) {
      ctx.font = `500 12px ${BODY_FONT}`;
      ctx.fillStyle = COLORS.muted;
      ctx.fillText(
        `+ ${hiddenCount} more move${hiddenCount === 1 ? "" : "s"}`,
        PAD,
        top + Math.max(...entryGroups.map(groupHeight))
      );
    }
  }

  ctx.font = `700 14px ${BODY_FONT}`;
  ctx.fillStyle = COLORS.muted;
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillText("Built with the Dealin' the Cards GM Simulator", WIDTH / 2, height - 24);

  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Couldn't create the image"))), "image/png")
  );
}
