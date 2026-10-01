// Locale-aware month + weekday names via Intl (no extra dependency).
import type { Locale } from "./i18n";

const bcp = (l: Locale) => (l === "it" ? "it-IT" : "en-US");
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

// Full month names, index 0 = January (matches JS month index).
export function monthNames(locale: Locale): string[] {
  const fmt = new Intl.DateTimeFormat(bcp(locale), { month: "long" });
  return Array.from({ length: 12 }, (_, i) =>
    cap(fmt.format(new Date(2021, i, 15)))
  );
}

// Two-letter weekday initials, index 0 = Sunday (matches JS Date.getDay()).
// en: Su Mo Tu We Th Fr Sa · it: Do Lu Ma Me Gi Ve Sa
export function weekdayInitials(locale: Locale): string[] {
  const fmt = new Intl.DateTimeFormat(bcp(locale), { weekday: "short" });
  // 2023-01-01 was a Sunday.
  return Array.from({ length: 7 }, (_, i) => {
    const s = fmt.format(new Date(2023, 0, 1 + i)).replace(/\./g, "");
    return cap(s.slice(0, 2));
  });
}
