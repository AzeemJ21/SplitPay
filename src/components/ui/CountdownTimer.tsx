"use client";

import { useEffect, useState } from "react";

function formatRemaining(ms: number) {
  if (ms <= 0) return null;
  const totalMin = Math.floor(ms / 60000);
  const d = Math.floor(totalMin / (60 * 24));
  const h = Math.floor((totalMin % (60 * 24)) / 60);
  const m = totalMin % 60;
  return `${d}d ${h}h ${m}m`;
}

type CountdownTimerProps = {
  targetDate: Date;
};

export function CountdownTimer({ targetDate }: CountdownTimerProps) {
  const [label, setLabel] = useState<string | null>(() => formatRemaining(+targetDate - Date.now()));
  const [expired, setExpired] = useState(+targetDate <= Date.now());

  useEffect(() => {
    const tick = () => {
      const ms = +targetDate - Date.now();
      if (ms <= 0) {
        setExpired(true);
        setLabel(null);
        return;
      }
      setExpired(false);
      setLabel(formatRemaining(ms));
    };
    tick();
    const id = window.setInterval(tick, 60_000);
    return () => window.clearInterval(id);
  }, [targetDate]);

  if (expired) {
    return <span className="text-xs text-orange-400">Processing auto-release…</span>;
  }
  if (!label) return null;
  return <span className="text-xs text-orange-400">Auto-releases in {label}</span>;
}
