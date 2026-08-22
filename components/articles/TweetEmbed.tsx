"use client";

import { useEffect, useRef } from "react";

declare global {
  interface Window {
    twttr?: {
      widgets: { load: (element?: HTMLElement) => void };
    };
  }
}

function loadTwitterWidgetsScript() {
  if (document.getElementById("twitter-wjs")) {
    return;
  }

  const script = document.createElement("script");
  script.id = "twitter-wjs";
  script.src = "https://platform.twitter.com/widgets.js";
  script.async = true;
  document.body.appendChild(script);
}

export default function TweetEmbed({ tweetId }: { tweetId: string }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (window.twttr?.widgets) {
      window.twttr.widgets.load(containerRef.current ?? undefined);
    } else {
      loadTwitterWidgetsScript();
    }
  }, [tweetId]);

  return (
    <div ref={containerRef}>
      <blockquote className="twitter-tweet">
        <a href={`https://twitter.com/x/status/${tweetId}`}>Loading tweet...</a>
      </blockquote>
    </div>
  );
}
