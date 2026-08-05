/* Competition and domestic-league badge definitions.
   Each badge has a short label, two brand colours [bg, fg] for the monogram
   fallback, and an optional logo URL (filled during enrichment passes).
   The sticker shows a EUROPEAN competition badge top-left when the player's
   season had a continental run, otherwise the DOMESTIC league badge. */

export const COMPETITIONS = {
  EC:   { label: "European Cup",          short: "EC",   colors: ["#0A2C5E", "#FFFFFF"], logo: null },
  UCL:  { label: "Champions League",      short: "UCL",  colors: ["#0A1A3F", "#FFFFFF"], logo: null },
  CWC:  { label: "Cup Winners' Cup",      short: "CWC",  colors: ["#5A1A2B", "#FFFFFF"], logo: null },
  FAIRS:{ label: "Fairs Cup",             short: "ICFC", colors: ["#1E5631", "#FFFFFF"], logo: null },
  UEFA: { label: "UEFA Cup",              short: "UEFA", colors: ["#2A2A2A", "#FF8A00"], logo: null },
  UEL:  { label: "Europa League",         short: "UEL",  colors: ["#1A1A1A", "#FF6A00"], logo: null },
  UECL: { label: "Conference League",     short: "UECL", colors: ["#0B3D2E", "#7FE3B0"], logo: null },
  INT:  { label: "Intertoto Cup",         short: "INT",  colors: ["#3A5A1E", "#FFFFFF"], logo: null }
};

export const LEAGUES = {
  ITA: { label: "Serie A",      short: "ITA", colors: ["#0A2E6E", "#FFFFFF"], logo: null },
  ENG: { label: "England",      short: "ENG", colors: ["#3D1A5B", "#FFFFFF"], logo: null },
  ESP: { label: "Spain",        short: "ESP", colors: ["#9E1B32", "#FFD24A"], logo: null },
  GER: { label: "Germany",      short: "GER", colors: ["#1A1A1A", "#E30613"], logo: null },
  FRA: { label: "France",       short: "FRA", colors: ["#0A2C5E", "#FFFFFF"], logo: null }
};

/* Resolve which badge a player-season sticker should show.
   player.euro is an optional array of {comp, season}; if the entry's own
   season has a matching euro run we use that competition, else fall back to
   the domestic league. Returns {label, short, colors, logo, season}. */
export function badgeFor(player) {
  const euro = player.euro && player.euro.length
    ? player.euro.find((e) => e.season === player.season) || player.euro[0]
    : null;
  if (euro && COMPETITIONS[euro.comp]) {
    return { ...COMPETITIONS[euro.comp], season: euro.season || player.season, kind: "euro" };
  }
  const lg = LEAGUES[player.league] || { label: player.country || "League", short: (player.league || "").slice(0, 3) || "LGE", colors: ["#2A2A2A", "#FFFFFF"], logo: null };
  return { ...lg, season: player.season, kind: "league" };
}
