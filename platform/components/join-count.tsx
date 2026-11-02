"use client";

import { useEffect, useState } from "react";

/** The one live number in the MVP: how many kids have joined. Polls every 10 seconds. */
export function JoinCount({ sessionId, initial, live }: { sessionId: string; initial: number; live: boolean }) {
  const [count, setCount] = useState(initial);

  useEffect(() => {
    if (!live) return;
    let cancelled = false;
    const tick = async () => {
      try {
        const res = await fetch(`/api/teacher/session/${sessionId}`, { cache: "no-store" });
        if (!res.ok) return;
        const json = (await res.json()) as { count: number; ended: boolean };
        if (!cancelled) setCount(json.count);
        if (json.ended) window.location.reload();
      } catch {
        // keep the last value
      }
    };
    const timer = setInterval(tick, 10_000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [sessionId, live]);

  return (
    <span className="kpi-value" aria-live="polite">
      {count}
      <span className="kpi-unit meta">{count === 1 ? "kid has joined" : "kids have joined"}</span>
    </span>
  );
}
