"use client";

import { useState, type CSSProperties } from "react";

const DEFAULT_HEADSHOT = "/images/default-batter.svg";

// The MLB photo CDN serves most rostered players under the "67" headshot
// cut, but many minor leaguers/prospects only have a photo under the
// "milb" cut instead — try that before giving up and showing the default
// silhouette.
function milbFallbackSrc(src: string): string {
  return src.replace("/headshot/67/", "/headshot/milb/");
}

export default function PlayerHeadshot({
  src,
  alt,
  style,
  className,
}: {
  src: string;
  alt: string;
  style?: CSSProperties;
  className?: string;
}) {
  const [stage, setStage] = useState<0 | 1 | 2>(0);

  const resolvedSrc = stage === 0 ? src : stage === 1 ? milbFallbackSrc(src) : DEFAULT_HEADSHOT;

  return (
    <img
      src={resolvedSrc}
      alt={alt}
      style={style}
      className={className}
      onError={() => setStage((current) => (current < 2 ? ((current + 1) as 0 | 1 | 2) : 2))}
    />
  );
}
