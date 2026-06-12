export function todayKey() { return new Date().toLocaleDateString("en-CA"); }
export function dayNumber(key) {
  const epoch = new Date("2026-06-12T00:00:00");
  const d = new Date(key + "T00:00:00");
  return Math.round((d - epoch) / 86400000) + 1;
}
/* "1986-87" -> "1980s" */
export function decadeOf(season) {
  const y = parseInt(season.slice(0, 4), 10);
  return Math.floor(y / 10) * 10 + "s";
}
export const DECADES = ["1960s", "1970s", "1980s", "1990s", "2000s", "2010s", "2020s"];
