"use client";

import { useEffect, useRef, useState } from "react";

type Props = {
  value: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  duration?: number;
  className?: string;
};

export default function CountUp({
  value,
  decimals = 0,
  prefix = "",
  suffix = "",
  duration = 1400,
  className = "",
}: Props) {
  const ref = useRef<HTMLSpanElement>(null);
  const [display, setDisplay] = useState(0);
  const current = useRef(0);
  const armed = useRef(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    let frame = 0;
    let cancelled = false;

    const run = () => {
      armed.current = true;
      const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
      if (reduce) {
        current.current = value;
        setDisplay(value);
        return;
      }
      const from = current.current;
      const start = performance.now();
      const tick = (now: number) => {
        if (cancelled) return;
        const progress = Math.min(1, (now - start) / duration);
        const eased = 1 - Math.pow(1 - progress, 3);
        const next = from + (value - from) * eased;
        current.current = next;
        setDisplay(next);
        if (progress < 1) frame = requestAnimationFrame(tick);
        else {
          current.current = value;
          setDisplay(value);
        }
      };
      frame = requestAnimationFrame(tick);
    };

    if (armed.current || typeof IntersectionObserver === "undefined") {
      run();
    } else {
      const observer = new IntersectionObserver(
        (entries) => entries.forEach((entry) => entry.isIntersecting && run()),
        { threshold: 0.35 },
      );
      observer.observe(node);
      return () => {
        cancelled = true;
        observer.disconnect();
        cancelAnimationFrame(frame);
      };
    }

    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
    };
  }, [value, duration]);

  return (
    <span ref={ref} className={className}>
      {prefix}
      {display.toLocaleString("es-ES", {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      })}
      {suffix}
    </span>
  );
}
