import { playerHeadshotUrl, teamLogoUrl } from "@/lib/mlb";

// A shareable PNG of the built roster: headshots for the 26-man roster up
// top, the session's transactions in smaller print underneath. Drawn
// straight onto a canvas — the MLB image CDNs send CORS headers, so the
// photos don't taint it.

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
  left: GraphicSection[];
  right: GraphicSection[];
  stats: { label: string; value: string }[];
  transactions: GraphicTransaction[];
};

const SCALE = 2;
const WIDTH = 1200;
const PAD = 56;
const COLUMN_GAP = 32;
const COLUMN_WIDTH = (WIDTH - PAD * 2 - COLUMN_GAP) / 2;
const HEADER_HEIGHT = 210;
const SECTION_HEAD = 54;
const ROW_HEIGHT = 66;
const ROW_GAP = 8;
const SECTION_GAP = 28;
const HEADSHOT = 50;
const MAX_TRANSACTIONS = 24;

const COLORS = {
  bg: "#f7f4ee",
  panel: "#ffffff",
  line: "#dcd3c0",
  text: "#17181c",
  muted: "#5a5c63",
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

function drawHeadshot(
  ctx: CanvasRenderingContext2D,
  team: GraphicTeam,
  image: HTMLImageElement | null,
  name: string,
  cx: number,
  cy: number,
  size: number
) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, size / 2, 0, Math.PI * 2);
  ctx.closePath();
  ctx.fillStyle = image ? "#e8e2d4" : team.primary;
  ctx.fill();
  ctx.clip();

  if (image) {
    // Cover the circle, anchored near the top so faces stay in frame.
    const ratio = image.naturalHeight / image.naturalWidth;
    const w = size;
    const h = size * ratio;
    ctx.drawImage(image, cx - w / 2, cy - size / 2 - (h - size) * 0.1, w, h);
  } else {
    ctx.fillStyle = "#ffffff";
    ctx.font = `800 ${Math.round(size * 0.36)}px ${BODY_FONT}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(initials(name), cx, cy + 1);
  }
  ctx.restore();

  ctx.beginPath();
  ctx.arc(cx, cy, size / 2, 0, Math.PI * 2);
  ctx.strokeStyle = COLORS.line;
  ctx.lineWidth = 1.5;
  ctx.stroke();
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
  return sections.reduce((sum, section) => sum + sectionHeight(section), 0) + SECTION_GAP * (sections.length - 1);
}

function drawColumn(
  ctx: CanvasRenderingContext2D,
  sections: GraphicSection[],
  x: number,
  top: number,
  headshots: Map<number, HTMLImageElement | null>,
  team: GraphicTeam
) {
  let y = top;

  for (const section of sections) {
    ctx.fillStyle = team.highlight;
    ctx.font = `30px ${DISPLAY_FONT}`;
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.fillText(section.title.toUpperCase(), x, y + 32);
    const titleWidth = ctx.measureText(section.title.toUpperCase()).width;
    ctx.fillStyle = COLORS.line;
    ctx.fillRect(x + titleWidth + 14, y + 21, COLUMN_WIDTH - titleWidth - 14, 2);
    y += SECTION_HEAD;

    for (const row of section.rows) {
      roundedRect(ctx, x, y, COLUMN_WIDTH, ROW_HEIGHT, 14);
      if (row.player) {
        ctx.fillStyle = COLORS.panel;
        ctx.fill();
        ctx.strokeStyle = COLORS.line;
        ctx.lineWidth = 1.5;
        ctx.setLineDash([]);
      } else {
        ctx.strokeStyle = COLORS.line;
        ctx.lineWidth = 1.5;
        ctx.setLineDash([6, 5]);
      }
      ctx.stroke();
      ctx.setLineDash([]);

      const midY = y + ROW_HEIGHT / 2;
      let cursor = x + 14;

      if (row.badge) {
        ctx.fillStyle = team.primary;
        ctx.font = `26px ${DISPLAY_FONT}`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(row.badge, cursor + 14, midY + 1);
      }
      cursor += 36;

      if (row.tag) {
        ctx.fillStyle = row.player ? team.highlight : COLORS.muted;
        ctx.font = `800 20px ${BODY_FONT}`;
        ctx.textAlign = "right";
        ctx.textBaseline = "middle";
        ctx.fillText(row.tag, x + COLUMN_WIDTH - 18, midY + 1);
      }
      const tagSpace = row.tag ? 70 : 18;

      if (row.player) {
        drawHeadshot(ctx, team, headshots.get(row.player.id) ?? null, row.player.name, cursor + HEADSHOT / 2, midY, HEADSHOT);
        cursor += HEADSHOT + 14;

        const handText = row.player.hand ? ` (${row.player.hand})` : "";
        ctx.font = `500 18px ${BODY_FONT}`;
        const handWidth = handText ? ctx.measureText(handText).width : 0;
        const maxName = x + COLUMN_WIDTH - tagSpace - cursor - handWidth;
        const name = fitText(ctx, row.player.name, maxName, 800, 24, 17);
        ctx.fillStyle = COLORS.text;
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        ctx.fillText(name, cursor, midY + 1);

        if (handText) {
          const nameWidth = ctx.measureText(name).width;
          ctx.fillStyle = COLORS.muted;
          ctx.font = `500 18px ${BODY_FONT}`;
          ctx.fillText(handText, cursor + nameWidth, midY + 1);
        }
      } else {
        ctx.fillStyle = COLORS.muted;
        ctx.font = `500 18px ${BODY_FONT}`;
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
    document.fonts.load(`800 24px "Roboto Condensed"`),
    document.fonts.load(`500 18px "Roboto Condensed"`),
  ]).catch(() => undefined);

  const playerIds = [...data.left, ...data.right].flatMap((section) =>
    section.rows.flatMap((row) => (row.player ? [row.player.id] : []))
  );
  const [siteLogo, teamLogo, ...photos] = await Promise.all([
    loadImage("/images/logo.png"),
    loadImage(teamLogoUrl(data.team.id).replace("team-cap-on-light", "team-cap-on-dark")),
    ...playerIds.map(loadHeadshot),
  ]);
  const headshots = new Map(playerIds.map((id, index) => [id, photos[index]]));

  // Lay out the transactions first so the canvas can be sized to fit them.
  const measure = document.createElement("canvas").getContext("2d")!;
  const transactionWidth = WIDTH - PAD * 2;
  const chronological = [...data.transactions].reverse();
  const shown = chronological.slice(0, MAX_TRANSACTIONS);
  const transactionLines = shown.map((transaction) => {
    measure.font = `800 13px ${BODY_FONT}`;
    const labelWidth = measure.measureText(transaction.label.toUpperCase()).width + 10;
    measure.font = `500 16px ${BODY_FONT}`;
    const text = transaction.detail ? `${transaction.summary} — ${transaction.detail}` : transaction.summary;
    return { transaction, labelWidth, lines: wrapText(measure, text, transactionWidth, labelWidth) };
  });
  const LINE_HEIGHT = 22;
  const hiddenCount = chronological.length - shown.length;
  const transactionsHeight =
    data.transactions.length === 0
      ? 0
      : 64 +
        transactionLines.reduce((sum, entry) => sum + entry.lines.length * LINE_HEIGHT + 6, 0) +
        (hiddenCount > 0 ? LINE_HEIGHT : 0) +
        10;

  const bodyTop = HEADER_HEIGHT + 44;
  const bodyHeight = Math.max(columnHeight(data.left), columnHeight(data.right));
  const footerHeight = 70;
  const height = bodyTop + bodyHeight + 36 + transactionsHeight + footerHeight;

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
    ctx.drawImage(teamLogo, PAD, 42, 116, 116);
    titleX += 140;
  }

  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.font = `800 22px ${BODY_FONT}`;
  ctx.fillStyle = "rgba(255,255,255,0.75)";
  ctx.fillText(`${data.season} ${data.team.name.toUpperCase()}`, titleX, 78);
  ctx.fillStyle = "#ffffff";
  ctx.font = `64px ${DISPLAY_FONT}`;
  ctx.fillText("PROJECTED ROSTER", titleX, 148);

  if (siteLogo) {
    ctx.drawImage(siteLogo, WIDTH - PAD - 120, 35, 120, 120);
  }

  // Quick stats strip under the header.
  ctx.textBaseline = "alphabetic";
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

  drawColumn(ctx, data.left, PAD, bodyTop, headshots, data.team);
  drawColumn(ctx, data.right, PAD + COLUMN_WIDTH + COLUMN_GAP, bodyTop, headshots, data.team);

  // Transactions, in smaller print.
  let y = bodyTop + bodyHeight + 36;
  if (data.transactions.length > 0) {
    roundedRect(ctx, PAD - 20, y, WIDTH - (PAD - 20) * 2, transactionsHeight - 10, 16);
    ctx.fillStyle = COLORS.panel;
    ctx.fill();
    ctx.strokeStyle = COLORS.line;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = data.team.primary;
    ctx.font = `22px ${DISPLAY_FONT}`;
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.fillText("TRANSACTIONS", PAD, y + 40);
    y += 64;

    for (const { transaction, labelWidth, lines } of transactionLines) {
      ctx.font = `800 13px ${BODY_FONT}`;
      ctx.fillStyle = transaction.color;
      ctx.fillText(transaction.label.toUpperCase(), PAD, y);
      ctx.font = `500 16px ${BODY_FONT}`;
      ctx.fillStyle = COLORS.text;
      lines.forEach((line, index) => {
        ctx.fillText(line, index === 0 ? PAD + labelWidth : PAD, y + index * LINE_HEIGHT);
      });
      y += lines.length * LINE_HEIGHT + 6;
    }

    if (hiddenCount > 0) {
      ctx.font = `500 15px ${BODY_FONT}`;
      ctx.fillStyle = COLORS.muted;
      ctx.fillText(`+ ${hiddenCount} more move${hiddenCount === 1 ? "" : "s"}`, PAD, y);
    }
  }

  ctx.font = `700 15px ${BODY_FONT}`;
  ctx.fillStyle = COLORS.muted;
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillText("Built with the Dealin' the Cards Roster Builder", WIDTH / 2, height - 30);

  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Couldn't create the image"))), "image/png")
  );
}
