import { FRUIT_BY_KEY, fruitOfLabel, type FruitKey } from "@/lib/fruit";

type Props = {
  fruit?: string | null;
  label?: string;
  className?: string;
};

function resolveKey(fruit?: string | null, label?: string): FruitKey | undefined {
  if (fruit && fruit in FRUIT_BY_KEY) return fruit as FruitKey;
  if (label) return fruitOfLabel(label)?.key;
  return undefined;
}

export default function FruitIcon({ fruit, label, className = "h-5 w-5" }: Props) {
  const key = resolveKey(fruit, label);

  switch (key) {
    case "bananas":
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden fill="none">
          <path
            d="M4.2 6.1c-.4-1.3 1.3-2.1 2-.9 1.4 2.4 2.4 5.6 4.8 8 2.4 2.4 5.8 3.3 8 3.1 1.5-.1 2 1.8.6 2.3-6.2 2.2-12.9-1.6-15.1-8.6-.3-1.1-.4-2.3-.3-3.9Z"
            fill="currentColor"
          />
          <path d="M4.4 5.4c0-1 .7-1.8 1.6-1.8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.55" />
        </svg>
      );
    case "mangos":
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden fill="none">
          <ellipse cx="11.6" cy="13.4" rx="6.5" ry="7.7" transform="rotate(-18 11.6 13.4)" fill="currentColor" />
          <path d="M15.4 5.6c.6-1.6 2-2.4 3.7-2.2-.4 1.7-1.7 2.6-3.7 2.2Z" fill="currentColor" opacity="0.5" />
          <path d="M15.2 6c-.3-1.2-.1-2.2.5-3.1" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" opacity="0.7" />
        </svg>
      );
    case "manzanas":
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden fill="none">
          <path
            d="M12 7.3c-1.2-1.6-3.6-2-5.3-.6C4.3 8.5 4.3 12.7 6.6 16c1.3 1.9 3.1 3.1 5.4 3.1s4.1-1.2 5.4-3.1c2.3-3.3 2.3-7.5-.1-9.3-1.7-1.4-4.1-1-5.3.6Z"
            fill="currentColor"
          />
          <path d="M12 7.2c-.2-1.6.4-2.9 1.8-3.7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.65" />
          <path d="M13.6 4.1c1.6-.7 3.1-.5 4.2.4-1.2 1-2.6 1.2-4.2-.4Z" fill="currentColor" opacity="0.55" />
        </svg>
      );
    case "naranjas":
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden fill="none">
          <circle cx="12" cy="13" r="7.9" fill="currentColor" />
          <path
            d="M12 5.3v15.4M5 9.4l14 7.2M19 9.4 5 16.6"
            stroke="#050A08"
            strokeOpacity="0.28"
            strokeWidth="1"
          />
          <path d="M12 5.2c.5-1.3 1.5-2 3-2.1-.5 1.4-1.5 2.1-3 2.1Z" fill="currentColor" opacity="0.55" />
        </svg>
      );
    case "papayas":
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden fill="none">
          <path
            d="M12.2 3.6c3.3 0 5.6 2.4 5.6 5.5 0 1.9-.8 3.2-1.2 4.7-.4 1.4-.2 2.7.6 3.9.9 1.3 1.6 2.2 1.6 3.2 0 1.3-1.9 1.7-2.6.5-.7-1.2-2-1.9-4-1.9s-3.3.7-4 1.9c-.7 1.2-2.6.8-2.6-.5 0-1 .7-1.9 1.6-3.2.8-1.2 1-2.5.6-3.9-.4-1.5-1.2-2.8-1.2-4.7 0-3.1 2.3-5.5 5.6-5.5Z"
            fill="currentColor"
          />
          <path d="M12.2 3.7c-.2-1.4.4-2.5 1.8-3.1" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" opacity="0.55" />
          <circle cx="10.2" cy="10" r="0.9" fill="#050A08" opacity="0.22" />
          <circle cx="13.6" cy="9.2" r="0.9" fill="#050A08" opacity="0.22" />
          <circle cx="12.6" cy="12.2" r="0.9" fill="#050A08" opacity="0.22" />
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden fill="none">
          <circle cx="12" cy="12" r="8" fill="currentColor" opacity="0.9" />
          <path d="M12 4v16M4 12h16" stroke="#050A08" strokeOpacity="0.25" strokeWidth="1.2" />
        </svg>
      );
  }
}
