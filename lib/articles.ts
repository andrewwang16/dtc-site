export type Article = {
  slug: string;
  title: string;
  author: string;
  date: string;
  image: string;
  excerpt: string;
  body: string[];
  playerId?: number;
  playerName?: string;
};

const articles: Article[] = [
  {
    slug: "kyle-leahy-cardinals-bullpen-role",
    title: "Kyle Leahy Is Quietly Becoming a Cardinals Bullpen Fixture",
    author: "Claude",
    date: "2026-08-21",
    image: "/images/articletestimage.png",
    excerpt:
      "The Boulder, Colorado native has taken a winding road to St. Louis, and this year he's carved out a real role in the Cardinals' relief corps.",
    body: [
      "Kyle Leahy's path to the major leagues was never a straight line. Drafted out of college in 2018, the right-hander spent parts of five seasons working through the Cardinals' minor league system before making his MLB debut in July 2023. For a lot of relievers, that kind of timeline ends the story before it really starts. For Leahy, it was just the beginning.",
      "What stands out about Leahy's game isn't a single overpowering pitch — it's the way he's learned to sequence his arsenal to keep hitters off balance, mixing his fastball with secondary offerings to generate weak contact rather than relying purely on swing-and-miss stuff. That approach has made him a trustworthy option for a Cardinals bullpen that has leaned on him in a variety of situations, from mop-up innings to higher-leverage spots as the season has worn on.",
      "At 6-foot-5 and listed at 225 pounds, Leahy has the frame teams look for in a durable reliever, and durability has been part of his value proposition — he's shown he can handle a heavier workload without a steep drop-off in stuff deep into the summer. That kind of reliability is easy to overlook in a bullpen that also features higher-profile arms, but it's exactly the sort of thing that keeps a pitching staff functional over a 162-game season.",
      "The switch-hitting Leahy — a rarity for a pitcher, since the bat/throw split refers to his own hitting side, not something that comes into play on the mound — has also drawn praise from teammates and coaches for his makeup and preparation. Relievers who can handle uncertainty, warm up on short notice, and pitch on back-to-back days without complaint tend to earn a manager's trust, and that trust shows up in how often his name gets called.",
      "For a full breakdown of his 2026 season — innings pitched, ERA, strikeout and walk rates, and how his role has evolved month to month — the live numbers tell the rest of the story.",
    ],
    playerId: 681517,
    playerName: "Kyle Leahy",
  },
];

export function getAllArticles(): Article[] {
  return [...articles].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );
}

export function getRecentArticles(count: number): Article[] {
  return getAllArticles().slice(0, count);
}

export function getArticleBySlug(slug: string): Article | undefined {
  return articles.find((article) => article.slug === slug);
}
