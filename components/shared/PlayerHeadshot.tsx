"use client";

import { useState, type CSSProperties } from "react";

const DEFAULT_HEADSHOT = "/images/default-batter.svg";

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
  const [failed, setFailed] = useState(false);

  return (
    <img
      src={failed ? DEFAULT_HEADSHOT : src}
      alt={alt}
      style={style}
      className={className}
      onError={() => setFailed(true)}
    />
  );
}
