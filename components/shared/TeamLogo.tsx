"use client";

import { useState, type CSSProperties } from "react";

export default function TeamLogo({
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

  if (failed) {
    return null;
  }

  return <img src={src} alt={alt} style={style} className={className} onError={() => setFailed(true)} />;
}
