/**
 * Italian public holidays + the Messina patron feast, used to colour Sundays
 * and festività red on the roster grid. Mirrors backend
 * `app/services/holidays.py`.
 *
 * Sundays are handled by the caller (weekday check); this returns only the
 * named public/patron holidays. Madonna della Lettera (3 June) is Messina's
 * patron feast — included because the client operates in Messina.
 */

/** Gregorian Easter Sunday (Meeus/Jones/Butcher). Returns 1-based month/day. */
function easterSunday(year: number): { month: number; day: number } {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return { month, day };
}

/** Fixed-date Italian public holidays (+ Messina patron feast on 3 June). */
const FIXED: Record<string, string> = {
  "1-1": "Capodanno",
  "1-6": "Epifania",
  "4-25": "Festa della Liberazione",
  "5-1": "Festa dei Lavoratori",
  "6-2": "Festa della Repubblica",
  "6-3": "Madonna della Lettera (Messina)",
  "8-15": "Ferragosto",
  "11-1": "Ognissanti",
  "12-8": "Immacolata Concezione",
  "12-25": "Natale",
  "12-26": "Santo Stefano",
};

/**
 * The festività name for a date (month is 1-based), or null. Movable feasts
 * (Pasqua and Lunedì dell'Angelo) are derived from Easter each year.
 */
export function holidayName(
  year: number,
  month: number,
  day: number
): string | null {
  const fixed = FIXED[`${month}-${day}`];
  if (fixed) return fixed;
  const easter = easterSunday(year);
  if (month === easter.month && day === easter.day) return "Pasqua";
  const em = new Date(year, easter.month - 1, easter.day + 1);
  if (month === em.getMonth() + 1 && day === em.getDate())
    return "Lunedì dell'Angelo";
  return null;
}
